"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { teamData } from "../teamData";

// ---------------------------------------------------------
// STATUS-NORMALISIERUNG
// ---------------------------------------------------------
function normalizeStatus(raw) {
  if (!raw) return "offen";

  let s = String(raw).toLowerCase().trim();
  s = s.replace(/['"]+/g, "").replace("::text", "").trim();

  if (["neu", "new", "offen", ""].includes(s)) return "offen";
  if (["termin_neu", "new_appointment"].includes(s)) return "termin_neu";
  if (["termin_bestaetigt", "confirmed"].includes(s)) return "termin_bestaetigt";
  if (["weitergeleitet", "forwarded"].includes(s)) return "weitergeleitet";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["beendet", "finished", "closed"].includes(s)) return "beendet";
  if (["kein_match", "nomatch", "no_match"].includes(s)) return "kein_match";
  if (["papierkorb"].includes(s)) return "papierkorb";

  return "offen";
}

const STATUS_META = {
  offen: { label: "Neu", bg: "#FFF7EC", border: "#E3C29A", text: "#8B5A2B" },
  termin_neu: { label: "Neuer Termin", bg: "#EFF3FF", border: "#9AAAF5", text: "#304085" },
  termin_bestaetigt: { label: "Termin bestätigt", bg: "#EAF8EF", border: "#9AD0A0", text: "#2F6E3A" },
  weitergeleitet: { label: "Weitergeleitet", bg: "#F4EFFF", border: "#C9B0FF", text: "#5E3EA8" },
  active: { label: "Begleitung aktiv", bg: "#E8FFF0", border: "#90D5A0", text: "#2D7A45" },
  kein_match: { label: "Kein Match", bg: "#FFECEC", border: "#F2A5A5", text: "#9B1C2C" },
  beendet: { label: "Beendet", bg: "#F0F0F0", border: "#CCCCCC", text: "#666" },
  papierkorb: { label: "Papierkorb", bg: "#F3F3F3", border: "#CCCCCC", text: "#666666" },
};

// ---------------------------------------------------------
// MODAL
// ---------------------------------------------------------
function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------
export default function DashboardFull() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessionsByRequest, setSessionsByRequest] = useState({});
  const [filter, setFilter] = useState("unbearbeitet");
  const [loading, setLoading] = useState(true);

  const [detailsModal, setDetailsModal] = useState(null);

  const [reassignModal, setReassignModal] = useState(null);
  const [newTherapist, setNewTherapist] = useState("");

  // ---------------------------------------------------------
  // USER LADEN
  // ---------------------------------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // ---------------------------------------------------------
  // ANFRAGEN LADEN
  // ---------------------------------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);

      let query = supabase
        .from("anfragen")
        .select("*")
        .order("created_at", { ascending: false });

      if (user.email !== "hallo@mypoise.de") {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data } = await query;

      setRequests(
        (data || []).map((r) => ({
          ...r,
          _status: normalizeStatus(r.status),
        }))
      );

      setLoading(false);
    }

    load();
  }, [user]);

  // ---------------------------------------------------------
  // SESSIONS LADEN
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // PAPIERKORB FUNKTIONEN
  // ---------------------------------------------------------
  async function moveToTrash(r) {
    await fetch("/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anfrageId: r.id, status: "papierkorb" }),
    });
    location.reload();
  }

  async function restoreFromTrash(r) {
    await fetch("/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anfrageId: r.id, status: "offen" }),
    });
    location.reload();
  }

  async function deleteForever(r) {
    await fetch("/api/delete-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anfrageId: r.id }),
    });
    location.reload();
  }

  // ---------------------------------------------------------
  // FILTER
  // ---------------------------------------------------------
  const UNBEARBEITET = ["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"];

  const filteredRequests = requests.filter((r) => {
    if (filter === "unbearbeitet") return UNBEARBEITET.includes(r._status);
    if (filter === "aktiv") return r._status === "active";
    if (filter === "papierkorb") return r._status === "papierkorb";
    return true;
  });

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  if (!user) return <div style={{ padding: 30 }}>Bitte einloggen…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      {/* FILTER */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setFilter("unbearbeitet")}>Unbearbeitet</button>
        <button onClick={() => setFilter("aktiv")}>Aktiv</button>
        <button onClick={() => setFilter("papierkorb")}>Papierkorb</button>
        <button onClick={() => setFilter("alle")}>Alle</button>
      </div>

      {loading && <p>Lade…</p>}

      {!loading &&
        filteredRequests.map((r) => {
          const status = STATUS_META[r._status];

          return (
            <article key={r.id} style={{ border: "1px solid #ddd", padding: 16, borderRadius: 12, marginBottom: 12 }}>
              <strong>{r.vorname} {r.nachname}</strong>
              <div style={{ fontSize: 12, color: status.text }}>{status.label}</div>

              <p>{r.anliegen}</p>

              <button onClick={() => setDetailsModal(r)}>🔍 Details</button>

              {r._status === "papierkorb" && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => restoreFromTrash(r)}>♻️ Wiederherstellen</button>
                  <button onClick={() => deleteForever(r)}>🗑 Löschen</button>
                </div>
              )}
            </article>
          );
        })}

      {/* DETAILS MODAL */}
      {detailsModal && (
        <Modal onClose={() => setDetailsModal(null)}>
          <h3>{detailsModal.vorname} {detailsModal.nachname}</h3>

          <p><strong>Status:</strong> {detailsModal._status}</p>

          <button
            onClick={() => {
              setReassignModal(detailsModal);
              setNewTherapist("");
            }}
          >
            🔀 Therapeut wechseln
          </button>

          <button onClick={() => moveToTrash(detailsModal)}>
            🗑 In Papierkorb
          </button>
        </Modal>
      )}

      {/* REASSIGN MODAL */}
      {reassignModal && (
        <Modal onClose={() => setReassignModal(null)}>
          <h3>Therapeut wechseln</h3>

          <select
            value={newTherapist}
            onChange={(e) => setNewTherapist(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="">Bitte wählen…</option>
            {teamData.map((t) => (
              <option key={t.email} value={t.email}>
                {t.name}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 16 }}>
            <button
              onClick={async () => {
                await fetch("/api/reassign-request", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    anfrageId: reassignModal.id,
                    newTherapist,
                  }),
                });
                location.reload();
              }}
            >
              Speichern
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
