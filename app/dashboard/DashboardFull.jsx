"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { teamData } from "../teamData";

/* ================= STATUS ================= */

function normalizeStatus(raw) {
  if (!raw) return "offen";
  let s = String(raw).toLowerCase().trim();
  if (["offen", "neu", ""].includes(s)) return "offen";
  if (["termin_neu"].includes(s)) return "termin_neu";
  if (["termin_bestaetigt"].includes(s)) return "termin_bestaetigt";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["kein_match"].includes(s)) return "kein_match";
  if (["beendet"].includes(s)) return "beendet";
  if (["papierkorb"].includes(s)) return "papierkorb";
  return "offen";
}

const STATUS_META = {
  offen: { label: "Neu" },
  termin_neu: { label: "Neuer Termin" },
  termin_bestaetigt: { label: "Termin bestätigt" },
  active: { label: "Begleitung aktiv" },
  kein_match: { label: "Kein Match" },
  beendet: { label: "Beendet" },
  papierkorb: { label: "Papierkorb" },
};

/* ================= MODAL ================= */

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ================= DASHBOARD ================= */

export default function DashboardFull() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessionsByRequest, setSessionsByRequest] = useState({});
  const [filter, setFilter] = useState("unbearbeitet");

  const [detailsModal, setDetailsModal] = useState(null);
  const [editTarif, setEditTarif] = useState("");
  const [newSessions, setNewSessions] = useState([{ date: "", duration: 60 }]);

  const [reassignModal, setReassignModal] = useState(null);
  const [newTherapist, setNewTherapist] = useState("");

  /* ---------- LOAD USER ---------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  /* ---------- LOAD REQUESTS ---------- */
  useEffect(() => {
    if (!user?.email) return;

    supabase
      .from("anfragen")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRequests(
          (data || []).map((r) => ({
            ...r,
            _status: normalizeStatus(r.status),
          }))
        );
      });
  }, [user]);

  /* ---------- LOAD SESSIONS ---------- */
  useEffect(() => {
    supabase.from("sessions").select("*").then(({ data }) => {
      const grouped = {};
      (data || []).forEach((s) => {
        if (!grouped[s.anfrage_id]) grouped[s.anfrage_id] = [];
        grouped[s.anfrage_id].push(s);
      });
      setSessionsByRequest(grouped);
    });
  }, []);

  /* ---------- FILTER ---------- */
  const UNBEARBEITET = ["offen", "termin_neu", "termin_bestaetigt"];
  const filtered = requests.filter((r) => {
    if (filter === "unbearbeitet") return UNBEARBEITET.includes(r._status);
    if (filter === "aktiv") return r._status === "active";
    if (filter === "papierkorb") return r._status === "papierkorb";
    return true;
  });

  if (!user) return <div>Bitte einloggen…</div>;

  /* ================= UI ================= */

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>Dashboard</h1>

      {/* FILTER */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setFilter("unbearbeitet")}>Unbearbeitet</button>
        <button onClick={() => setFilter("aktiv")}>Aktiv</button>
        <button onClick={() => setFilter("papierkorb")}>Papierkorb</button>
        <button onClick={() => setFilter("alle")}>Alle</button>
      </div>

      {/* KARTEN */}
      {filtered.map((r) => (
        <article
          key={r.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <strong>
            {r.vorname} {r.nachname}
          </strong>
          <div>{STATUS_META[r._status]?.label}</div>

          <p>{r.anliegen}</p>

          <button
            onClick={() => {
              setDetailsModal(r);
              setEditTarif(r.honorar_klient || "");
            }}
          >
            🔍 Details
          </button>

          {/* ENTSCHEIDUNGEN */}
          {UNBEARBEITET.includes(r._status) && (
            <>
              <button onClick={() => fetch("/api/confirm-appointment", { method: "POST", body: JSON.stringify({ requestId: r.id }) })}>
                ✔ Termin bestätigen
              </button>

              <button onClick={() => moveToTrash(r)}>✖ Absagen</button>
              <button onClick={() => moveToTrash(r)}>🔁 Neuer Termin</button>
              <button onClick={() => moveToTrash(r)}>👥 Weiterleiten</button>
            </>
          )}

          {r._status === "termin_bestaetigt" && (
            <>
              <button onClick={() => fetch("/api/match-client", { method: "POST", body: JSON.stringify({ anfrageId: r.id }) })}>
                ❤️ Match
              </button>
              <button onClick={() => fetch("/api/no-match", { method: "POST", body: JSON.stringify({ anfrageId: r.id }) })}>
                ❌ Kein Match
              </button>
            </>
          )}

          {r._status === "papierkorb" && (
            <>
              <button onClick={() => restoreFromTrash(r)}>♻️ Wiederherstellen</button>
              <button onClick={() => deleteForever(r)}>🗑 Löschen</button>
            </>
          )}
        </article>
      ))}

      {/* DETAILANSICHT */}
      {detailsModal && (
        <Modal onClose={() => setDetailsModal(null)}>
          <h3>
            {detailsModal.vorname} {detailsModal.nachname}
          </h3>

          <h4>Sitzungen</h4>
          {(sessionsByRequest[detailsModal.id] || []).map((s) => (
            <div key={s.id}>
              {new Date(s.date).toLocaleString()} – {s.price} € (Provision {(s.price * 0.3).toFixed(2)} €)
            </div>
          ))}

          <h4>Stundensatz</h4>
          <input value={editTarif} onChange={(e) => setEditTarif(e.target.value)} />

          <button
            onClick={() =>
              fetch("/api/update-tarif", {
                method: "POST",
                body: JSON.stringify({ anfrageId: detailsModal.id, tarif: Number(editTarif) }),
              })
            }
          >
            💾 Speichern
          </button>

          <button onClick={() => moveToTrash(detailsModal)}>🗑 In Papierkorb</button>
          <button onClick={() => setReassignModal(detailsModal)}>🔀 Therapeut wechseln</button>
        </Modal>
      )}

      {/* REASSIGN */}
      {reassignModal && (
        <Modal onClose={() => setReassignModal(null)}>
          <select value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)}>
            <option value="">Bitte wählen…</option>
            {teamData.map((t) => (
              <option key={t.email} value={t.email}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              fetch("/api/reassign-request", {
                method: "POST",
                body: JSON.stringify({ anfrageId: reassignModal.id, newTherapist }),
              })
            }
          >
            Speichern
          </button>
        </Modal>
      )}
    </div>
  );

  /* ---------- HELPERS ---------- */
  async function moveToTrash(r) {
    await fetch("/api/update-status", {
      method: "POST",
      body: JSON.stringify({ anfrageId: r.id, status: "papierkorb" }),
    });
    location.reload();
  }

  async function restoreFromTrash(r) {
    await fetch("/api/update-status", {
      method: "POST",
      body: JSON.stringify({ anfrageId: r.id, status: "offen" }),
    });
    location.reload();
  }

  async function deleteForever(r) {
    await fetch("/api/delete-request", {
      method: "POST",
      body: JSON.stringify({ anfrageId: r.id }),
    });
    location.reload();
  }
}
