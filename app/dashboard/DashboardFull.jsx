"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { teamData } from "../teamData";

function safeText(v) {
  return typeof v === "string" && v.trim() !== "" ? v : "–";
}

function safeNumber(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function safeDateString(v) {
  if (!v) return null;
  const t = Date.parse(v);
  if (isNaN(t)) return null;
  return new Date(t).toLocaleString("de-AT");
}

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
  const [search, setSearch] = useState("");
const [sort, setSort] = useState("last"); // last | name


  const [detailsModal, setDetailsModal] = useState(null);
  const [editTarif, setEditTarif] = useState("");
  const [newSessions, setNewSessions] = useState([{ date: "", duration: 60 }]);

  const [reassignModal, setReassignModal] = useState(null);
  const [newTherapist, setNewTherapist] = useState("");
  const [createBestandOpen, setCreateBestandOpen] = useState(false);
const [bestandVorname, setBestandVorname] = useState("");
const [bestandNachname, setBestandNachname] = useState("");
const [bestandTherapeut, setBestandTherapeut] = useState("");


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
      .select(`
  id,
  created_at,
  vorname,
  nachname,
  email,
  telefon,
  strasse_hausnr,
  plz_ort,
  geburtsdatum,
  beschaeftigungsgrad,
  leidensdruck,
  anliegen,
  verlauf,
  ziel,
  status,
  bevorzugte_zeit,
  wunschtherapeut,
  honorar_klient
`)
      
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
      if (therapistFilter !== "alle" &&
        r.wunschtherapeut !== therapistFilter)
        return false;
      if (search) {
  const q = search.toLowerCase();
  const name = `${r.vorname || ""} ${r.nachname || ""}`.toLowerCase();
  if (!name.includes(q)) return false;
}
return true;
    });
  }, [requests, filter, therapistFilter, search]);

  if (!user) return <div>Bitte einloggen…</div>;
  
    const sorted = useMemo(() => {
  return [...filtered].sort((a, b) => {
    if (sort === "name") {
      return `${a.nachname || ""}${a.vorname || ""}`.localeCompare(
        `${b.nachname || ""}${b.vorname || ""}`
      );
    }

    const sa = sessionsByRequest[a.id]?.at(-1)?.date || a.created_at;
    const sb = sessionsByRequest[b.id]?.at(-1)?.date || b.created_at;

    return new Date(sb) - new Date(sa);
  });
}, [filtered, sort, sessionsByRequest]);


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
        <input
  placeholder="🔍 Klientin suchen…"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={{
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #ccc",
    minWidth: 220,
  }}
/>

<select
  value={sort}
  onChange={(e) => setSort(e.target.value)}
  style={{
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #ccc",
  }}
>
  <option value="last">Letzte Aktivität</option>
  <option value="name">Name A–Z</option>
</select>

      </div>
      
<button
  onClick={() => setCreateBestandOpen(true)}
  style={{
    marginBottom: 16,
    padding: "8px 14px",
    borderRadius: 999,
    background: "#E8FFF0",
    border: "1px solid #90D5A0",
    fontWeight: 600,
  }}
>
  ➕ Bestandsklient:in anlegen
</button>

      {/* KARTEN */}
     {sorted.map((r) => {
  const sessionList = sessionsByRequest[r.id] || [];
  const lastSessionDate = sessionList.length
    ? sessionList[sessionList.length - 1]?.date
    : null;

  const daysSinceLast =
    lastSessionDate && !isNaN(Date.parse(lastSessionDate))
      ? (Date.now() - new Date(lastSessionDate).getTime()) / 86400000
      : null;

  return (

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

          {r._status === "active" && (
  <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
    🧠 Sitzungen: {sessionList.length}
    {lastSessionDate && !isNaN(Date.parse(lastSessionDate)) && (
      <>
        {" "}· letzte: {new Date(lastSessionDate).toLocaleDateString("de-AT")}
      </>
    )}
  </div>
)}

{r._status === "active" && daysSinceLast != null && daysSinceLast > 30 && (
  <div style={{ marginTop: 6, color: "darkred", fontSize: 13 }}>
    ⚠️ keine Sitzung seit {Math.round(daysSinceLast)} Tagen
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
);
})}

      

{/* DETAILANSICHT */}
{detailsModal && (
  <Modal onClose={() => setDetailsModal(null)}>
    <div>
      <h3>
        {safeText(detailsModal?.vorname)}{" "}
        {safeText(detailsModal?.nachname)}
      </h3>

      {/* FORMULARINFOS – IMMER */}
      <section>
        <p>
          <strong>Name:</strong>{" "}
          {safeText(detailsModal?.vorname)}{" "}
          {safeText(detailsModal?.nachname)}
        </p>

        <p>
          <strong>E-Mail:</strong> {safeText(detailsModal?.email)}
        </p>

        <p>
          <strong>Telefon:</strong> {safeText(detailsModal?.telefon)}
        </p>

        <p>
          <strong>Adresse:</strong>{" "}
          {safeText(detailsModal?.strasse_hausnr)}{" "}
          {safeText(detailsModal?.plz_ort)}
        </p>

        <p>
          <strong>Alter:</strong>{" "}
          {detailsModal?.geburtsdatum &&
          !isNaN(Date.parse(detailsModal.geburtsdatum))
            ? new Date().getFullYear() -
              new Date(detailsModal.geburtsdatum).getFullYear()
            : "–"}
        </p>

        <hr />

        <p>
          <strong>Anliegen:</strong>{" "}
          {typeof detailsModal?.anliegen === "string"
            ? detailsModal.anliegen
            : "–"}
        </p>

        <p>
          <strong>Leidensdruck:</strong>{" "}
          {safeText(detailsModal?.leidensdruck)}
        </p>

        <p>
          <strong>Wie lange schon:</strong>{" "}
          {safeText(detailsModal?.verlauf)}
        </p>

        <p>
          <strong>Ziel:</strong> {safeText(detailsModal?.ziel)}
        </p>

        <p>
          <strong>Beschäftigungsgrad:</strong>{" "}
          {safeText(detailsModal?.beschaeftigungsgrad)}
        </p>

        <hr />

        <p>
          <strong>Wunschtherapeut:</




 {detailsModal._status === "active" && (
  <div>
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
  </div>
)}


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
      {createBestandOpen && (
  <Modal onClose={() => setCreateBestandOpen(false)}>
    <h3>🧩 Bestandsklient:in anlegen</h3>

    <label>Vorname *</label>
    <input
      value={bestandVorname}
      onChange={(e) => setBestandVorname(e.target.value)}
      style={{ width: "100%", marginBottom: 8 }}
    />

    <label>Nachname *</label>
    <input
      value={bestandNachname}
      onChange={(e) => setBestandNachname(e.target.value)}
      style={{ width: "100%", marginBottom: 8 }}
    />

    <label>Therapeut *</label>
    <select
      value={bestandTherapeut}
      onChange={(e) => setBestandTherapeut(e.target.value)}
      style={{ width: "100%", marginBottom: 12 }}
    >
      <option value="">Bitte wählen…</option>
      {teamData.map((t) => (
        <option key={t.email} value={t.email}>
          {t.name}
        </option>
      ))}
    </select>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <button onClick={() => setCreateBestandOpen(false)}>
        Abbrechen
      </button>

      <button
        onClick={async () => {
          if (!bestandVorname || !bestandNachname || !bestandTherapeut) {
            alert("Bitte alle Pflichtfelder ausfüllen");
            return;
          }

          const res = await fetch("/api/create-bestand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vorname: bestandVorname,
              nachname: bestandNachname,
              wunschtherapeut: bestandTherapeut,
            }),
          });

          if (!res.ok) {
            alert("Fehler beim Anlegen");
            return;
          }

          setCreateBestandOpen(false);
          location.reload();
        }}
      >
        ✔ Anlegen
      </button>
    </div>
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
