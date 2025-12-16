"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { teamData } from "../teamData";

/* ================= STATUS ================= */

function normalizeStatus(raw) {
  if (!raw) return "offen";
  const s = String(raw).toLowerCase().trim();

  if (["offen", "neu", ""].includes(s)) return "offen";
  if (["termin_neu", "new_appointment"].includes(s)) return "termin_neu";
  if (
    [
      "termin_bestaetigt",
      "termin bestätigt",
      "confirmed",
      "appointment_confirmed",
      "bestaetigt",
    ].includes(s)
  )
    return "termin_bestaetigt";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["kein_match", "no_match"].includes(s)) return "kein_match";
  if (["beendet", "finished"].includes(s)) return "beendet";
  if (["papierkorb"].includes(s)) return "papierkorb";

  return "offen";
}

const STATUS_LABEL = {
  offen: "Neu",
  termin_neu: "Neuer Termin",
  termin_bestaetigt: "Termin bestätigt",
  active: "Begleitung aktiv",
  kein_match: "Kein Match",
  beendet: "Beendet",
  papierkorb: "Papierkorb",
};

/* ================= MODAL ================= */

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
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
          maxWidth: 720,
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
  const [therapistFilter, setTherapistFilter] = useState("alle");

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

    let query = supabase
      .from("anfragen")
      .select("*")
      .order("created_at", { ascending: false });

    if (user.email !== "hallo@mypoise.de") {
      query = query.eq("wunschtherapeut", user.email);
    }

    query.then(({ data }) => {
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

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filter === "unbearbeitet" && !UNBEARBEITET.includes(r._status))
        return false;
      if (filter === "aktiv" && r._status !== "active") return false;
      if (filter === "papierkorb" && r._status !== "papierkorb") return false;
      if (
        therapistFilter !== "alle" &&
        r.wunschtherapeut !== therapistFilter
      )
        return false;
      return true;
    });
  }, [requests, filter, therapistFilter]);

  if (!user) return <div>Bitte einloggen…</div>;

  /* ================= UI ================= */

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      {/* FILTER */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setFilter("unbearbeitet")}>Unbearbeitet</button>
        <button onClick={() => setFilter("aktiv")}>Aktiv</button>
        <button onClick={() => setFilter("papierkorb")}>Papierkorb</button>
        <button onClick={() => setFilter("alle")}>Alle</button>

        <select
          value={therapistFilter}
          onChange={(e) => setTherapistFilter(e.target.value)}
        >
          <option value="alle">Alle Teammitglieder</option>
          {teamData.map((t) => (
            <option key={t.email} value={t.email}>
              {t.name}
            </option>
          ))}
        </select>
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
          <div>{STATUS_LABEL[r._status]}</div>

          {r.wunschtherapeut && (
            <div style={{ fontSize: 13, color: "#555" }}>
              👤{" "}
              {teamData.find((t) => t.email === r.wunschtherapeut)?.name ||
                r.wunschtherapeut}
            </div>
          )}

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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() =>
                  fetch("/api/confirm-appointment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      requestId: r.id,
                      therapist: user.email,
                      client: r.email,
                      slot: r.bevorzugte_zeit,
                    }),
                  }).then(() => location.reload())
                }
              >
                ✔ Termin bestätigen
              </button>

              <button onClick={() => moveToTrash(r)}>✖ Absagen</button>
              <button onClick={() => moveToTrash(r)}>🔁 Neuer Termin</button>
              <button onClick={() => moveToTrash(r)}>👥 Weiterleiten</button>
            </div>
          )}

          {/* MATCH / NO MATCH */}
          {r._status === "termin_bestaetigt" && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={() =>
                  fetch("/api/match-client", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      anfrageId: r.id,
                      therapistEmail: user.email,
                      honorar: r.honorar_klient,
                    }),
                  }).then(() => location.reload())
                }
              >
                ❤️ Match
              </button>

              <button
                onClick={() =>
                  fetch("/api/no-match", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ anfrageId: r.id }),
                  }).then(() => location.reload())
                }
              >
                ❌ Kein Match
              </button>
            </div>
          )}

          {/* AKTIV */}
          {r._status === "active" && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() =>
                  fetch("/api/finish-coaching", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ anfrageId: r.id }),
                  }).then(() => location.reload())
                }
              >
                🔴 Coaching beenden
              </button>
            </div>
          )}

          {/* PAPIERKORB */}
          {r._status === "papierkorb" && (
            <div style={{ marginTop: 8 }}>
              <button onClick={() => restoreFromTrash(r)}>
                ♻️ Wiederherstellen
              </button>
              <button onClick={() => deleteForever(r)}>🗑 Löschen</button>
            </div>
          )}
        </article>
      ))}

      {/* DETAILANSICHT */}
      {detailsModal && (
        <Modal onClose={() => setDetailsModal(null)}>
          <h3>
            {detailsModal.vorname} {detailsModal.nachname}
          </h3>

          {/* FORMULARINFOS – IMMER */}
          <section>
            <p>
              <strong>E-Mail:</strong> {detailsModal.email}
            </p>
            <p>
              <strong>Telefon:</strong> {detailsModal.telefon}
            </p>
            <p>
              <strong>Anliegen:</strong> {detailsModal.anliegen}
            </p>
            <p>
              <strong>Wunschtherapeut:</strong> {detailsModal.wunschtherapeut}
            </p>
{detailsModal.bevorzugte_zeit &&
 !isNaN(Date.parse(detailsModal.bevorzugte_zeit)) && (
  <p>
    <strong>Ersttermin:</strong>{" "}
    {new Date(detailsModal.bevorzugte_zeit).toLocaleString("de-AT")}
  </p>
)}

          </section>

          {/* AKTIV-BEREICH */}
          {detailsModal._status === "active" && (
            <>
              <hr />

              {/* KENNZAHLEN */}
              <p>
                <strong>Anzahl Sitzungen:</strong>{" "}
                {(sessionsByRequest[detailsModal.id] || []).length}
              </p>

              {/* STUNDENSATZ */}
              <label>Stundensatz (€)</label>
              <input
                type="number"
                value={editTarif}
                onChange={(e) => setEditTarif(e.target.value)}
              />
              <button
                onClick={() =>
                  fetch("/api/update-tarif", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      anfrageId: detailsModal.id,
                      tarif: Number(editTarif),
                    }),
                  })
                }
              >
                💾 Speichern
              </button>

              {/* PROVISION */}
              <h4>Provision</h4>
              <p>
                <strong>Gesamt:</strong>{" "}
                {(sessionsByRequest[detailsModal.id] || [])
                  .reduce((sum, s) => sum + s.price * 0.3, 0)
                  .toFixed(2)}{" "}
                €
              </p>

              <h4>Provision pro Quartal</h4>
              {Object.entries(
                (sessionsByRequest[detailsModal.id] || []).reduce(
                  (acc, s) => {
                    const d = new Date(s.date);
                    const q = `Q${Math.floor(d.getMonth() / 3) + 1} ${
                      d.getFullYear()
                    }`;
                    acc[q] = (acc[q] || 0) + s.price * 0.3;
                    return acc;
                  },
                  {}
                )
              ).map(([q, sum]) => (
                <div key={q}>
                  {q}: {sum.toFixed(2)} €
                </div>
              ))}

              {/* SITZUNGEN */}
              <h4>Sitzungen</h4>
              {(sessionsByRequest[detailsModal.id] || []).map((s) => (
                <div key={s.id}>
                  {new Date(s.date).toLocaleString("de-AT")} · {s.duration_min} Min
                </div>
              ))}

              {/* NEUE SITZUNG */}
              <h4>Neue Sitzung eintragen</h4>
              {newSessions.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input
                    type="datetime-local"
                    value={s.date}
                    onChange={(e) => {
                      const copy = [...newSessions];
                      copy[i].date = e.target.value;
                      setNewSessions(copy);
                    }}
                  />
                  <select
                    value={s.duration}
                    onChange={(e) => {
                      const copy = [...newSessions];
                      copy[i].duration = Number(e.target.value);
                      setNewSessions(copy);
                    }}
                  >
                    <option value={50}>50 Min</option>
                    <option value={60}>60 Min</option>
                    <option value={75}>75 Min</option>
                  </select>
                </div>
              ))}

              <button
                onClick={() =>
                  setNewSessions([...newSessions, { date: "", duration: 60 }])
                }
              >
                ➕ Weitere Sitzung
              </button>

              <button
  onClick={() =>
    fetch("/api/add-sessions-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anfrageId: detailsModal.id,
        therapist: user.email,
        sessions: newSessions.map((s) => ({
          date: s.date,
          duration: s.duration,
          price: Number(editTarif),
        })),
      }),
    }).then(() => location.reload())
  }
>
  💾 Sitzungen speichern
</button>

            </>
          )}
        </Modal>
      )}

      {/* REASSIGN */}
      {reassignModal && (
        <Modal onClose={() => setReassignModal(null)}>
          <select
            value={newTherapist}
            onChange={(e) => setNewTherapist(e.target.value)}
          >
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  anfrageId: reassignModal.id,
                  newTherapist,
                }),
              }).then(() => location.reload())
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
}
