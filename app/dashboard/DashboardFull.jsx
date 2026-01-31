"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { teamData } from "../lib/teamData";
import jsPDF from "jspdf";
import "jspdf-autotable";

console.log("🔥 DashboardFull RENDERED");
// ================= STATUS UPDATE (NEU, ZENTRAL) =================
async function updateRequestStatus({
  requestId,
  status,
  client,
  vorname,
}) {
  const res = await fetch("/api/requests/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      status,
      client,
      vorname,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("❌ Status update failed:", t);
    alert("Aktion fehlgeschlagen");
    throw new Error("status_update_failed");
  }
}

/* ================= STATUS ================= */
function normalizeStatus(raw) {
  if (!raw) return "neu";

  const s = String(raw).toLowerCase().trim();

  // ✅ NEU / UNBEARBEITET
  if (["neu", "offen", "new"].includes(s)) return "neu";

if (["termin_neu", "neuer_termin"].includes(s)) return "termin_neu";
  if (
    ["termin_bestaetigt", "bestaetigt", "confirmed"].includes(s)
  ) {
    return "termin_bestaetigt";
  }

  // ✅ AKTIV
  if (["active", "aktiv", "begleitung aktiv"].includes(s)) return "active";

  // ❌ KEIN MATCH
  if (["kein_match", "no_match"].includes(s)) return "kein_match";

// 🛂 ADMIN
if (["admin_pruefen", "admin", "admin_weiterleiten"].includes(s)) return "admin_pruefen";
  
  // 🗑 PAPIERKORB
  if (["papierkorb", "trash"].includes(s)) return "papierkorb";

  // 🏁 BEENDET
  if (["beendet", "finished"].includes(s)) return "beendet";

  console.warn("⚠️ UNBEKANNTER STATUS:", raw);
  return "neu"; // 🔥 Fallback, damit nichts verschwindet
}




const STATUS_LABEL = {
 neu: "Neu",
  termin_neu: "Neuer Termin",
  termin_bestaetigt: "Termin bestätigt",
  active: "Begleitung aktiv",
  kein_match: "Kein Match",
  beendet: "Beendet",
  papierkorb: "Papierkorb",
  admin_pruefen: "Admin – Weiterleitung prüfen",

};
const STATUS_FILTER_MAP = {
  unbearbeitet: ["neu", "termin_neu"],
erstgespraech: ["termin_bestaetigt"],
  admin_pruefen: ["admin_pruefen", "admin_weiterleiten"],
  aktiv: ["active"],
  abrechnung: ["active"],
  beendet: ["beendet"],
  papierkorb: ["papierkorb"],
  alle: [
    "offen",
    "neu",
    "termin_neu",
    "termin_bestaetigt",
    "active",
    "kein_match",
    "beendet",
    "papierkorb",
    "admin_pruefen",
  ],
};





const UNBEARBEITET = ["neu", "termin_neu"];


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
        padding: 20,
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
          boxShadow: "0 10px 30px rgba(0,0,0,.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Action({ label, hint, onClick }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <button onClick={onClick}>{label}</button>
      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
        {hint}
      </div>
    </div>
  );
}

/* ================= HELPERS (SAFE) ================= */

function safeText(v, fallback = "–") {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : fallback;
  }
  if (typeof v === "number") return String(v);
  return fallback;
}

function safeNumber(v, fallback = "–") {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeDateString(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-AT");
}

function quarterKeyFromDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function currentQuarterKey() {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}
function renderAnliegen(anliegen) {
  if (!anliegen) return "–";

  // 1️⃣ String (z.B. Freitext)
  if (typeof anliegen === "string") {
    const t = anliegen.trim();
    return t ? t : "–";
  }

  // 2️⃣ Array (z.B. ["Stress", "Angst"])
  if (Array.isArray(anliegen)) {
    return anliegen.length ? anliegen.join(", ") : "–";
  }

  // 3️⃣ Objekt aus Checkboxes
  // z.B. { stress: true, angst: true, schlaf: false }
  if (typeof anliegen === "object") {
    const selected = Object.entries(anliegen)
      .filter(([, v]) => v === true)
      .map(([k]) =>
        k
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      );

    return selected.length ? selected.join(", ") : "–";
  }

  return "–";
}

/* ================= EXPORT (CSV / PDF) ================= */

function exportBillingCSV(rows) {
  if (!rows || !rows.length) return;

  const header = [
    "Klient",
    "Sitzungen",
    "Umsatz",
    "Provision Poise",
  
  ];

  const csvRows = [
    header.join(";"),
    ...rows.map((r) =>
      [
        r.klient,
        r.sessions,
        Number(r.umsatz || 0).toFixed(2),
        Number(r.provision || 0).toFixed(2),
        Number(r.payout || 0).toFixed(2),
      ].join(";")
    ),
  ];

  const blob = new Blob([csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `abrechnung_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportBillingPDF(rows) {
  if (!rows || !rows.length) return;

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Poise – Abrechnung", 14, 15);

  doc.autoTable({
    startY: 22,
    head: [
  
    ],
    body: rows.map((r) => [
      r.klient,
      r.sessions,
      Number(r.umsatz || 0).toFixed(2),
      Number(r.provision || 0).toFixed(2),
      Number(r.payout || 0).toFixed(2),
    ]),
    styles: { fontSize: 10 },
  });

  doc.save(`abrechnung_${new Date().toISOString().slice(0, 10)}.pdf`);
}
// ================= PAPIERKORB ACTIONS =================

async function restoreFromTrash(r) {
  const res = await fetch("/api/requests/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: r.id,
      status: "neu",
    }),
  });

  if (!res.ok) {
    alert("Fehler beim Wiederherstellen");
    return;
  }

  // 🔄 Frontend-State sofort aktualisieren
  location.reload();
}

async function deleteForever(r) {
  if (!confirm("Anfrage wirklich endgültig löschen?")) return;

  const res = await fetch("/api/requests/delete-forever", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: r.id,
    }),
  });

  if (!res.ok) {
    alert("Fehler beim Löschen");
    return;
  }

  // 🔄 Frontend-State aktualisieren
  location.reload();
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

 
  // ================= ABRECHNUNG FILTER =================
const [billingMode, setBillingMode] = useState("monat");
// "monat" | "quartal" | "jahr" | "einzeln"

const now = new Date();
const [billingYear, setBillingYear] = useState(now.getFullYear());
const [billingMonth, setBillingMonth] = useState(now.getMonth() + 1);
const [billingQuarter, setBillingQuarter] = useState(
  Math.floor(now.getMonth() / 3) + 1
);

const [billingDate, setBillingDate] = useState(""); // YYYY-MM-DD

  const [invoiceSettings, setInvoiceSettings] = useState({
  company_name: "",
  address: "",
  iban: "",
  bic: "",
  logo_url: "",
  default_vat_country: "AT",
  default_vat_rate: 0,
});

const [invoiceLoading, setInvoiceLoading] = useState(false);






  /* ---------- LOAD USER ---------- */
useEffect(() => {
  supabase.auth.getUser().then(({ data, error }) => {
    console.log("AUTH getUser:", data, error);
    setUser(data?.user || null);
  });
}, []);


 useEffect(() => {
  if (!user?.email) return;
  if (filter !== "abrechnung") return;

  let mounted = true;

  (async () => {
    setInvoiceLoading(true);

    const res = await fetch("/api/invoice-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_email: user.email }),
    });

    if (res.ok) {
      const data = await res.json();
      if (mounted && data?.settings) {
        setInvoiceSettings((p) => ({ ...p, ...data.settings }));
      }
    }

    if (mounted) setInvoiceLoading(false);
  })();

  return () => {
    mounted = false;
  };
}, [user, filter]);


 /* ---------- LOAD REQUESTS ---------- */
useEffect(() => {
  console.log("🚀 LOAD REQUESTS EFFECT START");

  supabase
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
      anliegen,
      leidensdruck,
      verlauf,
      ziel,
      diagnose,
      status,
      bevorzugte_zeit,
      wunschtherapeut,
      honorar_klient,
      admin_therapeuten
    `)
    .order("created_at", { ascending: false })
    .then(({ data, error }) => {
      console.log("📦 SUPABASE anfragen DATA:", data);
      console.log("❌ SUPABASE anfragen ERROR:", error);

      if (error) {
        console.error("🔥 Fehler beim Laden der Anfragen:", error);
        setRequests([]);
        return;
      }

  setRequests(
  (data || []).map((r) => {
    const normalized = normalizeStatus(r.status);

    if (!normalized) {
      console.warn("⚠️ EMPTY STATUS", r.id, r.status);
    }

let adminTher = r.admin_therapeuten;

// 🔥 WICHTIG: String → leeres Array (kein JSON!)
if (typeof adminTher === "string") {
  adminTher = adminTher.trim() ? [adminTher] : [];
}

// 🔥 null / sonst was → leeres Array
if (!Array.isArray(adminTher)) {
  adminTher = [];
}

return {
  ...r,
  admin_therapeuten: adminTher,
  _status: normalized || "neu",
};
  })
);

    });
}, []);



/* ---------- LOAD SESSIONS (AUTH-SAFE) ---------- */
useEffect(() => {
  if (!user) return; // 🔥 DAS ist der Fix

  let mounted = true;

  supabase
    .from("sessions")
    .select("*")
    .then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("❌ SESSION LOAD ERROR:", error);
        setSessionsByRequest({});
        return;
      }

      const grouped = {};
      (data || []).forEach((s) => {
        const key = String(s.anfrage_id);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });

      Object.keys(grouped).forEach((k) => {
        grouped[k].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );
      });

      setSessionsByRequest(grouped);
    });

  return () => {
    mounted = false;
  };
}, [user]); // 🔥 WICHTIG
  /* =========================================================
   LOAD BILLING SESSIONS
   Quelle für ALLE Abrechnungen
========================================================= */

/* =========================================================
   LOAD BILLING SESSIONS (IMMER ALLE – FILTER NUR IM FRONTEND)
========================================================= */

const [billingSessions, setBillingSessions] = useState([]);
useEffect(() => {
  if (!user) return;

  supabase
    .from("sessions")
    .select(
      `
        id,
        date,
        price,
        therapist,
        anfrage_id,
        anfragen (
          vorname,
          nachname,
          status
        )
      `
    )
    .then(({ data, error }) => {
      if (error) {
        console.error("SESSION LOAD ERROR", error);
        return;
      }
      setBillingSessions(Array.isArray(data) ? data : []);
    });
}, [user]);


  
const sessionsSafe = useMemo(() => {
  return Array.isArray(billingSessions) ? billingSessions : [];
}, [billingSessions]);


/* =========================================================
   GEFILTERTE ANFRAGEN (KARTEN / LISTEN)
========================================================= */
const filteredRequests = useMemo(() => {
  console.log("🔍 FILTER:", filter);
  console.log("📦 REQUESTS RAW:", requests);

  const allowedStatuses = STATUS_FILTER_MAP[filter] || [];

  return requests.filter((r) =>
    allowedStatuses.includes(r._status)
  );
}, [requests, filter]);






/* =========================================================
   SORTIERUNG DER ANFRAGEN
========================================================= */

const sortedRequests = useMemo(() => {
  return [...filteredRequests].sort((a, b) => {
    if (sort === "name") {
      return `${a.nachname || ""}${a.vorname || ""}`.localeCompare(
        `${b.nachname || ""}${b.vorname || ""}`
      );
    }

    const aSessions = sessionsByRequest[String(a.id)] || [];
    const bSessions = sessionsByRequest[String(b.id)] || [];

    const sa = aSessions.length
      ? aSessions[aSessions.length - 1]?.date
      : null;
    const sb = bSessions.length
      ? bSessions[bSessions.length - 1]?.date
      : null;

    const da = sa ? new Date(sa) : new Date(a.created_at);
    const db = sb ? new Date(sb) : new Date(b.created_at);

    return db - da;
  });
}, [filteredRequests, sort, sessionsByRequest]);
/* =========================================================
   THERAPEUT:IN FILTER NUR FÜR AKTIV TAB
========================================================= */
const therapistFilteredRequests = useMemo(() => {
  if (filter !== "aktiv") return sortedRequests;
  if (therapistFilter === "alle") return sortedRequests;

  return sortedRequests.filter((r) => {
    if (r.wunschtherapeut === therapistFilter) return true;

    const sessions = sessionsByRequest[String(r.id)] || [];
    return sessions.some((s) => s.therapist === therapistFilter);
  });
}, [sortedRequests, therapistFilter, filter, sessionsByRequest]);


/* =========================================================
   ABRECHNUNG – SESSION FILTER (ZEITRAUM)
========================================================= */

const filteredBillingSessions = useMemo(() => {
  return sessionsSafe.filter((s) => {
    if (!s?.date) return false;

    // 👤 Therapeut:innen-Filter (NUR HIER!)
    if (therapistFilter !== "alle" && s.therapist !== therapistFilter) {
      return false;
    }

    const d = new Date(s.date);

    if (billingMode === "jahr") {
      return d.getFullYear() === billingYear;
    }

    if (billingMode === "monat") {
      return (
        d.getFullYear() === billingYear &&
        d.getMonth() + 1 === billingMonth
      );
    }

    if (billingMode === "quartal") {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return d.getFullYear() === billingYear && q === billingQuarter;
    }

    if (billingMode === "einzeln") {
      return billingDate && s.date.startsWith(billingDate);
    }

    return true;
  });
}, [
  sessionsSafe,
  therapistFilter,
  billingMode,
  billingYear,
  billingMonth,
  billingQuarter,
  billingDate,
]);




const billingByClient = useMemo(() => {
  const map = {};

  (filteredBillingSessions || []).forEach((s) => {
    if (!s?.anfrage_id) return;

    if (!map[s.anfrage_id]) {
      map[s.anfrage_id] = {
        klient:
          `${s.anfragen?.vorname || ""} ${s.anfragen?.nachname || ""}`.trim() ||
          "Unbekannt",
        therapist: s.therapist,
        sessions: 0,
        umsatz: 0,
        provision: 0,
      };
    }

    map[s.anfrage_id].sessions += 1;

    const price = Number(s.price || 0);
    const vatRate = Number(invoiceSettings.default_vat_rate || 0);

    const netBase =
      vatRate > 0 ? price / (1 + vatRate / 100) : price;

    const provisionNet = netBase * 0.3;

    map[s.anfrage_id].umsatz += price;
    map[s.anfrage_id].provision += provisionNet;
  });

  return Object.values(map);
}, [filteredBillingSessions, invoiceSettings.default_vat_rate]);




  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      {/* 🔥 HARD DEBUG – NIEMALS LÖSCHEN */}
<div
  style={{
    background: "#000",
    color: "#0f0",
    padding: 12,
    marginBottom: 16,
    fontSize: 12,
    borderRadius: 8,
    fontFamily: "monospace",
  }}
>
  <div>DEBUG DASHBOARD</div>
  <div>requests.length: {requests.length}</div>
  <div>filter: {filter}</div>
  <div>
    statuses:
    {requests.map((r) => r.status || "∅").join(" | ")}
  </div>
  <div>
    normalized:
    {requests.map((r) => r._status || "∅").join(" | ")}
  </div>
</div>

      
      {/* ================= DEBUG OVERLAY (DEV ONLY) ================= */}
{process.env.NODE_ENV === "development" && (
  <pre
    style={{
      background: "#f4f4f4",
      padding: 12,
      fontSize: 12,
      borderRadius: 8,
      marginBottom: 16,
      border: "1px solid #ddd",
    }}
  >
    {JSON.stringify(
      {
        filter,
        totalRequests: requests.length,
        visibleRequests: filteredRequests.length,
        statuses: requests.map((r) => r._status),
      },
      null,
      2
    )}
  </pre>
)}

      <h1>Poise Dashboard</h1>

      {/* FILTER */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("unbearbeitet")}>Unbearbeitet</button>
        <button onClick={() => setFilter("erstgespraech")}>
  🗓 Erstgespräch
</button>
        
<button onClick={() => setFilter("admin_pruefen")}>
    🛂 Admin – Weiterleitungen
  </button>


        <button onClick={() => setFilter("abrechnung")}>💶 Abrechnung</button>

        <button onClick={() => setFilter("aktiv")}>Aktiv</button>
        <button onClick={() => setFilter("papierkorb")}>Papierkorb</button>
        <button onClick={() => setFilter("beendet")}>Beendet</button>
        <button onClick={() => setFilter("alle")}>Alle</button>

<select
  value={therapistFilter}
  onChange={(e) => setTherapistFilter(e.target.value)}
>
  <option value="alle">Alle Teammitglieder</option>
  {teamData.map((t) => (
 <option key={t.email} value={t.name}>
      {t.name}
    </option>
  ))}
</select>


        <input
          placeholder="🔍 Klient:in suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            minWidth: 220,
          }}
        />
{filter !== "abrechnung" && sortedRequests.length === 0 && (
  <div
    style={{
      padding: 24,
      textAlign: "center",
      color: "#777",
      border: "1px dashed #ccc",
      borderRadius: 12,
      marginBottom: 20,
    }}
  >
    Keine Einträge für diesen Filter<br />
    <small>Aktiver Filter: {filter}</small>
  </div>
)}

        {filter !== "abrechnung" && (
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
)}

      </div>

{filter === "aktiv" && (
  <div style={{ marginBottom: 16 }}>
    <button
      onClick={() => setCreateBestandOpen(true)}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        background: "#E8FFF0",
        border: "1px solid #90D5A0",
        fontWeight: 600,
      }}
    >
      ➕ Bestandsklient:in anlegen
    </button>
  </div>
)}

{/* ================= ABRECHNUNG ================= */}
{filter === "abrechnung" && (
  <>
    {/* FILTERBAR */}
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 14,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <strong>Zeitraum:</strong>

      <select
        value={billingMode}
        onChange={(e) => setBillingMode(e.target.value)}
      >
        <option value="monat">Monat</option>
        <option value="quartal">Quartal</option>
        <option value="jahr">Jahr</option>
        <option value="einzeln">Einzelne Sitzung</option>
      </select>

      {(billingMode === "monat" ||
        billingMode === "quartal" ||
        billingMode === "jahr") && (
        <select
          value={billingYear}
          onChange={(e) => setBillingYear(Number(e.target.value))}
        >
          {[2023, 2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}

      {billingMode === "monat" && (
        <select
          value={billingMonth}
          onChange={(e) => setBillingMonth(Number(e.target.value))}
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      )}

      {billingMode === "quartal" && (
        <select
          value={billingQuarter}
          onChange={(e) => setBillingQuarter(Number(e.target.value))}
        >
          <option value={1}>Q1</option>
          <option value={2}>Q2</option>
          <option value={3}>Q3</option>
          <option value={4}>Q4</option>
        </select>
      )}

      {billingMode === "einzeln" && (
        <input
          type="date"
          value={billingDate}
          onChange={(e) => setBillingDate(e.target.value)}
        />
      )}
    </div>

    {/* ABRECHNUNGSBEREICH */}
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
      }}
    >
      {/* RECHNUNGSDATEN */}
      <details
        style={{
          marginBottom: 16,
          border: "1px solid #eee",
          borderRadius: 10,
          background: "#FAFAFA",
          padding: 10,
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          🧾 Rechnungsdaten (deine Angaben)
        </summary>

        <div style={{ marginTop: 10 }}>
          {invoiceLoading && <div>Lade Rechnungsdaten…</div>}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <label>Name / Firma</label>
              <input
                value={invoiceSettings.company_name}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    company_name: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Logo URL</label>
              <input
                value={invoiceSettings.logo_url}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    logo_url: e.target.value,
                  })
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label>Adresse</label>
              <textarea
                value={invoiceSettings.address}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    address: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>IBAN</label>
              <input
                value={invoiceSettings.iban}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    iban: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>BIC</label>
              <input
                value={invoiceSettings.bic}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    bic: e.target.value,
                  })
                }
              />
            </div>

            {/* sevDesk TOKEN */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label>sevDesk API Token (optional)</label>
              <input
                type="password"
                placeholder="sevdesk_xxx..."
                value={invoiceSettings.sevdesk_token || ""}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    sevdesk_token: e.target.value,
                  })
                }
              />
              <small style={{ color: "#666" }}>
                Nur nötig, wenn Rechnungen automatisch an sevDesk übertragen werden sollen.
              </small>
            </div>

            <div>
              <label>Land</label>
              <select
                value={invoiceSettings.default_vat_country}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    default_vat_country: e.target.value,
                  })
                }
              >
                <option value="AT">Österreich</option>
                <option value="DE">Deutschland</option>
              </select>
            </div>

            <div>
              <label>Standard USt %</label>
              <input
                type="number"
                value={invoiceSettings.default_vat_rate}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    default_vat_rate: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {/* SAVE BUTTON */}
          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={async () => {
                const res = await fetch("/api/accounting-settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    therapist_email: user.email,
                    ...invoiceSettings,
                  }),
                });

                if (!res.ok) {
                  alert("Fehler beim Speichern der Rechnungsdaten");
                  return;
                }

                alert("Rechnungsdaten gespeichert");
              }}
            >
              💾 Rechnungsdaten speichern
            </button>
          </div>
        </div>
      </details>
      {/* ================= ABRECHNUNG EXPORT & ÜBERSICHT ================= */}
<div
  style={{
    borderTop: "1px solid #eee",
    paddingTop: 16,
    marginTop: 16,
  }}
>
  <div
    style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
      marginBottom: 12,
    }}
  >
    <button
      onClick={() => exportBillingCSV(billingByClient)}
      disabled={!billingByClient.length}
    >
      📄 CSV exportieren
    </button>

    <button
      onClick={() => exportBillingPDF(billingByClient)}
      disabled={!billingByClient.length}
    >
      🧾 PDF exportieren
    </button>

    <button
      disabled={!invoiceSettings.sevdesk_token}
      onClick={async () => {
        const res = await fetch("/api/sevdesk-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: billingByClient,
            invoiceSettings,
            period: {
              billingMode,
              billingYear,
              billingMonth,
              billingQuarter,
            },
          }),
        });

        if (!res.ok) {
          alert("Fehler beim sevDesk Export");
          return;
        }

        alert("Rechnungen erfolgreich an sevDesk übertragen");
      }}
    >
      📤 sevDesk Export
    </button>
  </div>

  {/* TABELLE */}
  {billingByClient.length === 0 ? (
    <div style={{ color: "#777" }}>
      – Keine Abrechnungsdaten für diesen Zeitraum
    </div>
  ) : (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 14,
      }}
    >
      <thead>
        <tr>
          <th align="left">Klient</th>
          <th>Sitzungen</th>
          <th align="right">Umsatz €</th>
          <th align="right">Provision €</th>
         
        </tr>
      </thead>
      <tbody>
        {billingByClient.map((r, i) => (
          <tr key={i}>
            <td>{r.klient}</td>
            <td align="center">{r.sessions}</td>
            <td align="right">{r.umsatz.toFixed(2)}</td>
            <td align="right">{r.provision.toFixed(2)}</td>
        
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>

    </section>
  </>
)}


      {/* KARTEN */}
{filter !== "abrechnung" &&
  therapistFilteredRequests.map((r) => {
          const sessionList = sessionsByRequest[String(r.id)] || [];
          const lastSessionDate = sessionList.length
            ? sessionList[sessionList.length - 1]?.date
            : null;

          const daysSinceLast =
            lastSessionDate && !isNaN(Date.parse(lastSessionDate))
              ? (Date.now() - new Date(lastSessionDate).getTime()) / 86400000
              : null;

          return (
          <article
  key={`${r.id}-${(sessionsByRequest[String(r.id)] || []).length}`}
  style={{
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  }}
>
              <strong>
                {safeText(r.vorname, "")} {safeText(r.nachname, "")}
              </strong>

              <div>{STATUS_LABEL[r._status] || safeText(r._status)}</div>

              {r.wunschtherapeut && (
                <div style={{ fontSize: 13, color: "#555" }}>
                  👤{" "}
                 {r.wunschtherapeut}

                </div>
              )}

              {r._status === "active" && (
                <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                  🧠 Sitzungen: {sessionList.length}
                  {lastSessionDate && !isNaN(Date.parse(lastSessionDate)) && (
                    <>
                      {" "}
                      · letzte:{" "}
                      {new Date(lastSessionDate).toLocaleDateString("de-AT")}
                    </>
                  )}
                </div>
              )}

              {r._status === "active" &&
                daysSinceLast != null &&
                daysSinceLast > 30 && (
                  <div style={{ marginTop: 6, color: "darkred", fontSize: 13 }}>
                    ⚠️ keine Sitzung seit {Math.round(daysSinceLast)} Tagen
                  </div>
                )}

              <p>{typeof r.anliegen === "string" ? r.anliegen : "–"}</p>
              {r._status === "admin_pruefen" && (
  <div
    style={{
      marginTop: 12,
      borderTop: "1px dashed #ddd",
      paddingTop: 12,
    }}
  >
    <strong>Therapeut:innen auswählen (max. 3)</strong>

    <div style={{ marginTop: 8 }}>
{teamData.map((t) => {
  const selected = (r.admin_therapeuten || []).includes(t.name);
  const maxReached = (r.admin_therapeuten || []).length >= 3;

  return (
    <label
      key={t.name}
      style={{
        display: "block",
        marginBottom: 6,
        opacity: selected || !maxReached ? 1 : 0.4,
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={!selected && maxReached}
        onChange={() => {
          setRequests((prev) =>
            prev.map((x) => {
              if (x.id !== r.id) return x;

              const current = x.admin_therapeuten || [];
              let next;

              if (current.includes(t.name)) {
                next = current.filter((n) => n !== t.name);
              } else {
                next = [...current, t.name].slice(0, 3);
              }

              return { ...x, admin_therapeuten: next };
            })
          );
        }}
      />{" "}
      {t.name}
    </label>
  );
})}
    </div>

    <button
      style={{ marginTop: 10 }}
      disabled={!r.admin_therapeuten || r.admin_therapeuten.length === 0}
      onClick={async () => {
        const res = await fetch("/api/admin-forward", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: r.id,
            therapists: r.admin_therapeuten,
            client: r.email,
            vorname: r.vorname,
          }),
        });

        if (!res.ok) {
          const t = await res.text();
          console.error("admin-forward failed:", t);
          alert("Fehler beim Senden");
          return;
        }

        alert("Mail an Klient:in gesendet ✅");
      }}
    >
      📧 Weiterleiten & Mail senden
    </button>
  </div>
)}

              <button
  onClick={() => {
    setDetailsModal({
      ...r,
     _status: "active",
    });
    setEditTarif(r.honorar_klient || "");
    setNewSessions([{ date: "", duration: 60 }]);
  }}
>
  🔍 Details
</button>


{["neu", "termin_neu"].includes(r._status) && (
  <div
    style={{
      display: "flex",
      gap: 16,
      marginTop: 12,
      flexWrap: "wrap",
    }}
  >
    {/* ✅ TERMIN BESTÄTIGEN */}
    <div style={{ maxWidth: 240 }}>
<button
  onClick={async () => {
    await updateRequestStatus({
  requestId: r.id,
  status: "termin_bestaetigt",
  client: r.email,
  vorname: r.vorname,
});

setRequests((prev) =>
  prev.map((x) =>
    x.id === r.id
      ? { ...x, _status: "termin_bestaetigt" }
      : x
  )
);
  }}
>
  ✅ Termin bestätigen
</button>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Anliegen passt zu mir – ich führe das Erstgespräch
      </div>
    </div>

    {/* ❌ KEIN MATCH POISE */}
    <div style={{ maxWidth: 240 }}>
    <button
  onClick={async () => {
    await updateRequestStatus({
      requestId: r.id,
      status: "papierkorb",
    });

    setRequests((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? { ...x, _status: "papierkorb" }
          : x
      )
    );
  }}
>
  ❌ Kein Match (Poise)
</button>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Anliegen passt grundsätzlich nicht zu Poise
      </div>
    </div>

{/* 🔁 NEUER TERMIN */}
<div style={{ maxWidth: 240 }}>
  <button
    onClick={async () => {
      const therapistName =
        r.wunschtherapeut ||
        sessionsByRequest[String(r.id)]?.[0]?.therapist;

      if (!therapistName) {
        alert("❌ Keine Therapeut:in für diese Anfrage gefunden");
        return;
      }

      const res = await fetch("/api/new-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: r.id,
          client: r.email,
          vorname: r.vorname,
          therapistName,
          oldSlot: r.bevorzugte_zeit,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("NEW APPOINTMENT FAILED:", t);
        alert("Fehler beim Senden der E-Mail");
        return;
      }

      alert("📧 Mail für neue Terminauswahl gesendet");
    }}
  >
    🔁 Neuer Termin
  </button>

  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
    Termin passt nicht – Klient:in wählt neu
  </div>
</div>

{/* ⏸ KEINE KAPAZITÄTEN */}
<div style={{ maxWidth: 240 }}>
  <button
    onClick={async () => {
      const res = await fetch("/api/forward-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: r.id,
          client: r.email,
          vorname: r.vorname,
          excludedTherapist: r.wunschtherapeut, // 🔥 wird in Step 8 ausgeschlossen
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("FORWARD FAILED:", t);
        alert("Fehler bei der Weiterleitung");
        return;
      }

      // sofort aus UI entfernen
      setRequests((prev) => prev.filter((x) => x.id !== r.id));

      alert("📧 Anfrage weitergeleitet – Klient:in wählt neu");
    }}
  >
    ⏸ Keine Kapazitäten
  </button>

  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
    Anliegen passt, aber aktuell keine Kapazitäten
  </div>
</div>

    {/* 👥 ANLIEGEN PASST NICHT ZU MIR */}
    <div style={{ maxWidth: 260 }}>
<button
  onClick={async () => {
    await updateRequestStatus({
      requestId: r.id,
      status: "admin_weiterleiten",
    });

    setRequests((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? {
              ...x,
              _status: "admin_pruefen",
              admin_therapeuten: [], // 🔥 DAS IST DER FIX
            }
          : x
      )
    );
  }}
>
  👥 Anliegen passt nicht zu mir
</button>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Admin wählt passende Therapeut:innen
      </div>
    </div>
  </div>
)}




              {/* MATCH / NO MATCH */}
              {/* MATCH / NO MATCH / WEITERLEITEN */}
{r._status === "termin_bestaetigt" && (
  <div
    style={{
      display: "flex",
      gap: 16,
      marginTop: 12,
      flexWrap: "wrap",
    }}
  >
    {/* ❤️ MATCH */}
    <div style={{ maxWidth: 220 }}>
      <button
        onClick={() =>
          fetch("/api/match-client", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              anfrageId: r.id,
              honorar: r.honorar_klient,
            }),
          }).then(() => location.reload())
        }
      >
        ❤️ Match
      </button>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Erstgespräch war passend – Begleitung startet
      </div>
    </div>

    {/* ❌ KEIN MATCH POISE */}
    <div style={{ maxWidth: 220 }}>
  <button
  onClick={async () => {
    await updateRequestStatus({
      requestId: r.id,
      status: "papierkorb",
    });

    setRequests((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? { ...x, _status: "papierkorb" }
          : x
      )
    );
  }}
>
  ❌ Kein Match (Poise)
</button>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Anliegen passt grundsätzlich nicht zu Poise
      </div>
    </div>

    {/* 🔁 NEUER TERMIN */}
    <div style={{ maxWidth: 220 }}>
<button
  onClick={async () => {
    await updateRequestStatus({
      requestId: r.id,
      status: "neuer_termin",
      client: r.email,
      vorname: r.vorname,
    });
    setRequests((prev) =>
      prev.filter((x) => x.id !== r.id)
    );
  }}
>
  🔁 Neuer Termin
</button>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Termin leider nicht verfügbar
      </div>
    </div>

    {/* 👥 ANLIEGEN PASST NICHT ZU MIR */}
    <div style={{ maxWidth: 240 }}>
     <button
  onClick={async () => {
    await updateRequestStatus({
      requestId: r.id,
      status: "admin_weiterleiten",
    });
    setRequests((prev) =>
      prev.filter((x) => x.id !== r.id)
    );
  }}
>
  👥 Anliegen passt nicht zu mir
</button>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Admin entscheidet über Weiterleitung
      </div>
    </div>
  </div>
)}


              {/* AKTIV */}
{r._status === "active" && (
  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
    
    {/* 🔴 COACHING BEENDET */}
    <button
      onClick={async () => {
        const res = await fetch("/api/finish-coaching", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anfrageId: r.id }),
        });

        if (!res.ok) {
          const t = await res.text();
          console.error("FINISH FAILED:", t);
          alert("❌ Coaching konnte nicht beendet werden:\n" + t);
          return;
        }

        // ✅ sofort in UI verschieben
        setRequests((prev) =>
          prev.map((x) =>
            x.id === r.id
              ? { ...x, _status: "beendet", status: "beendet" }
              : x
          )
        );

        alert("✅ Coaching beendet & Feedback-Mail gesendet");
      }}
    >
      🔴 Coaching beenden
    </button>

    {/* 👥 THERAPEUT WECHSELN → ADMIN */}
    <button
      onClick={async () => {
        await updateRequestStatus({
          requestId: r.id,
          status: "admin_weiterleiten",
        });

        setRequests((prev) =>
          prev.map((x) =>
            x.id === r.id
              ? {
                  ...x,
                  _status: "admin_pruefen",
                  status: "admin_weiterleiten",
                  admin_therapeuten: [],
                }
              : x
          )
        );

        alert("🛂 An Admin übergeben");
      }}
    >
      👥 Therapeut wechseln
    </button>

  </div>
)}

              {/* BEENDET */}
              {r._status === "beendet" && (
                <div style={{ marginTop: 8 }}>
<button
  onClick={async () => {
    await updateRequestStatus({
      requestId: r.id,
      status: "active",
    });

    setRequests((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? { ...x, _status: "active", status: "active" }
          : x
      )
    );
  }}
>
  🔄 Coaching wieder aktivieren
</button>
                </div>
              )}

              {/* PAPIERKORB */}
              {r._status === "papierkorb" && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => restoreFromTrash(r)}>♻️ Wiederherstellen</button>
                  <button onClick={() => deleteForever(r)}>🗑 Löschen</button>
                </div>
              )}
            </article>
          );
        })}

{/* DETAILANSICHT */}
{detailsModal && typeof detailsModal === "object" && (
  <Modal onClose={() => setDetailsModal(null)}>
    <div>
      <h3>
        {safeText(detailsModal.vorname)}{" "}
        {safeText(detailsModal.nachname)}
      </h3>

     {/* ================= FORMULARDATEN ================= */}
<section>
  {/* Kontaktdaten – NUR nach Terminbestätigung sichtbar */}
 {["termin_bestaetigt", "active", "beendet", "termin_neu"].includes(
  normalizeStatus(detailsModal.status || detailsModal._status)
) && (
    <>
      <p>
        <strong>E-Mail:</strong>{" "}
        {detailsModal.email || "–"}
      </p>

      <p>
        <strong>Telefon:</strong>{" "}
        {detailsModal.telefon || "–"}
      </p>

      <p>
        <strong>Adresse:</strong>{" "}
        {[detailsModal.strasse_hausnr, detailsModal.plz_ort]
          .filter(Boolean)
          .join(", ") || "–"}
      </p>
    </>
  )}

  <p>
    <strong>Alter:</strong>{" "}
    {detailsModal.geburtsdatum &&
    !isNaN(Date.parse(detailsModal.geburtsdatum))
      ? new Date().getFullYear() -
        new Date(detailsModal.geburtsdatum).getFullYear()
      : "–"}
  </p>

  <hr />

  <p>
  <strong>Anliegen (Auswahl):</strong><br />
  {renderAnliegen(detailsModal.anliegen)}
</p>

{detailsModal.ziel && (
  <p style={{ marginTop: 8 }}>
    <strong>Zusätzliche Beschreibung:</strong><br />
    {detailsModal.ziel}
  </p>
)}

  <p>
    <strong>Leidensdruck:</strong>{" "}
    {detailsModal.leidensdruck || "–"}
  </p>

  <p>
    <strong>Wie lange schon:</strong>{" "}
    {detailsModal.verlauf || "–"}
  </p>

  <p>
    <strong>Ziel:</strong>{" "}
    {detailsModal.ziel || "–"}
  </p>

  <p>
    <strong>Beschäftigungsgrad:</strong>{" "}
    {detailsModal.beschaeftigungsgrad || "–"}
  </p>

  <hr />

  <p>
    <strong>Wunschtherapeut:</strong>{" "}
    {teamData.find(
      (t) => t.email === detailsModal.wunschtherapeut
    )?.name || detailsModal.wunschtherapeut || "–"}
  </p>

  {detailsModal.bevorzugte_zeit && (
    <p>
      <strong>Ersttermin:</strong>{" "}
      {safeDateString(detailsModal.bevorzugte_zeit)}
    </p>
  )}
</section>


      {/* ================= AKTIV-BEREICH ================= */}
{["active", "beendet", "termin_bestaetigt"].includes(
  normalizeStatus(detailsModal.status || detailsModal._status)
) && (
        <div style={{ marginTop: 12 }}>
          {/* ================= STUNDENSATZ ================= */}
<div style={{ marginBottom: 16 }}>
  <h4>Stundensatz</h4>

  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <input
      type="number"
      placeholder="z.B. 120"
      value={editTarif}
      onChange={(e) => setEditTarif(e.target.value)}
      style={{ width: 120 }}
    />

    <span>€ / Sitzung</span>

    <button
      type="button"
      onClick={async () => {
        if (!editTarif || Number(editTarif) <= 0) {
          alert("Bitte gültigen Stundensatz eingeben");
          return;
        }

        const res = await fetch("/api/update-tarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anfrageId: detailsModal.id,
            tarif: editTarif,
          }),
        });

if (!res.ok) {
  const text = await res.text();
  console.error("UPDATE TARIF FAILED:", text || "(no response body)");
  alert("❌ Stundensatz konnte nicht gespeichert werden");
  return;
}

        // ✅ sofort im UI aktualisieren
        setRequests((prev) =>
          prev.map((x) =>
            x.id === detailsModal.id
              ? { ...x, honorar_klient: Number(editTarif) }
              : x
          )
        );

        alert("💶 Stundensatz gespeichert");
      }}
    >
      💾 Speichern
    </button>
  </div>

  {detailsModal.honorar_klient && (
    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
      Aktuell gespeichert: {detailsModal.honorar_klient} €
    </div>
  )}
</div>
          <hr />

          <p>
            <strong>Anzahl Sitzungen:</strong>{" "}
            {(sessionsByRequest[String(detailsModal.id)] || [])
              .length}
          </p>


                <h4>Provision pro Quartal</h4>
                {(() => {
                  const sessions = sessionsByRequest[String(detailsModal.id)] || [];
                  const map = sessions.reduce((acc, s) => {
                    const q = quarterKeyFromDate(s.date);
                    if (!q) return acc;
                    acc[q] = (acc[q] || 0) + (Number(s.price) || 0) * 0.3;
                    return acc;
                  }, {});
                  const entries = Object.entries(map).sort((a, b) => {
                    const [aq, ay] = a[0].split(" ");
                    const [bq, by] = b[0].split(" ");
                    const an = Number(String(aq).replace("Q", ""));
                    const bn = Number(String(bq).replace("Q", ""));
                    if (Number(ay) !== Number(by)) return Number(by) - Number(ay);
                    return bn - an;
                  });

                  const cq = currentQuarterKey();
                  const currentSum = map[cq] || 0;

                  return (
                    <div>
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: currentSum === 0 ? "#FFF7EC" : "#EAF8EF",
                          marginBottom: 10,
                        }}
                      >
                        <strong>Aktuelles Quartal ({cq}):</strong> {currentSum.toFixed(2)} €
                        {currentSum === 0 && (
                          <div style={{ marginTop: 6, color: "#8B5A2B" }}>
                            ⚠️ Noch keine Provision in diesem Quartal (keine erfassten Sitzungen).
                          </div>
                        )}
                      </div>

                      {entries.length === 0 ? (
                        <div style={{ color: "#777" }}>– Noch keine Sitzungen erfasst</div>
                      ) : (
                        entries.map(([q, sum]) => (
                          <div key={q}>
                            {q}: {Number(sum || 0).toFixed(2)} €
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
{/* ================= SITZUNGEN (NUR ANZEIGEN + LÖSCHEN) ================= */}

<h4 style={{ marginTop: 14 }}>Sitzungen</h4>

{(sessionsByRequest[String(detailsModal.id)] || []).length === 0 && (
  <div style={{ color: "#777" }}>Noch keine Sitzungen erfasst</div>
)}

{(sessionsByRequest[String(detailsModal.id)] || []).map((s, i) => (
  <div
    key={s.id || i}
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 80px 90px",
      gap: 10,
      alignItems: "center",
      marginBottom: 10,
      padding: "8px 10px",
      border: "1px solid #eee",
      borderRadius: 10,
      background: "#FAFAFA",
    }}
  >
    {/* DATUM (READONLY) */}
    <div>
      {safeDateString(s.date) || "–"}
    </div>

    {/* DAUER (READONLY) */}
    <div style={{ textAlign: "center" }}>
      {safeNumber(s.duration_min)} Min
    </div>

    {/* LÖSCHEN */}
    <div style={{ textAlign: "center" }}>
      <button
        type="button"
        onClick={async () => {
          if (!confirm("Sitzung wirklich löschen?")) return;

          const res = await fetch("/api/delete-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: s.id }),
          });

          if (!res.ok) {
            alert("Fehler beim Löschen der Sitzung");
            return;
          }

          location.reload();
        }}
        style={{
          fontSize: 18,
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        🗑
      </button>
      <div style={{ fontSize: 12, color: "#777" }}>
        Sitzung löschen
      </div>
    </div>
  </div>
))}



{/* ================= NEUE SITZUNGEN EINTRAGEN ================= */}
<h4 style={{ marginTop: 16 }}>Weitere Sitzungen eintragen</h4>

{newSessions.map((s, i) => (
  <div
    key={i}
    style={{
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 8,
    }}
  >
    <input
      type="datetime-local"
      value={s.date || ""}
      onChange={(e) => {
        const copy = [...newSessions];
        copy[i] = { ...copy[i], date: e.target.value };
        setNewSessions(copy);
      }}
    />

    <select
      value={s.duration || 60}
      onChange={(e) => {
        const copy = [...newSessions];
        copy[i] = {
          ...copy[i],
          duration: Number(e.target.value),
        };
        setNewSessions(copy);
      }}
    >
      <option value={50}>50 Min</option>
      <option value={60}>60 Min</option>
      <option value={75}>75 Min</option>
    </select>

    <button
      type="button"
      onClick={() =>
        setNewSessions((prev) => prev.filter((_, idx) => idx !== i))
      }
    >
      ❌
    </button>
  </div>
))}

<button
  type="button"
  onClick={() =>
    setNewSessions((prev) => [
      ...prev,
      { date: "", duration: 60 },
    ])
  }
>
  ➕ Weitere Sitzung hinzufügen
</button>

<div style={{ marginTop: 12 }}>
  <button
    type="button"
    onClick={async () => {
      const valid = newSessions.filter((s) => s.date);

      if (!valid.length) {
        alert("Bitte mindestens eine Sitzung mit Datum eintragen");
        return;
      }
const res = await fetch("/api/add-sessions-batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    anfrageId: detailsModal.id,
therapist:
  detailsModal?.wunschtherapeut ?? "system",
    sessions: valid.map((s) => ({
      date: s.date,
      duration: s.duration,
      price: Number(editTarif),
    })),
  }),
});

if (!res.ok) {
  const text = await res.text();
  console.error("ADD SESSIONS FAILED:", text);
  alert("❌ Sitzung konnte nicht gespeichert werden");
  return;
}

const data = await res.json();

      alert("✅ Sitzungen gespeichert");
      location.reload();
    }}
  >
    💾 Sitzungen speichern
  </button>
</div>

              </div>
            )}

            <hr />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
             <button type="button" onClick={() => setDetailsModal(null)}>
  Schließen
</button>

            </div>
          </div>
        </Modal>
      )}

      {/* REASSIGN */}
      {reassignModal && (
        <Modal onClose={() => setReassignModal(null)}>
          <h3>Therapeut wechseln</h3>

          <select
            value={newTherapist}
            onChange={(e) => setNewTherapist(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          >
            <option value="">Bitte wählen…</option>
            {teamData.map((t) => (
 <option key={t.email} value={t.name}>
    {t.name}
  </option>
))}

          </select>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setReassignModal(null)}>Abbrechen</button>
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
          </div>
        </Modal>
      )}

      {/* BESTANDSKLIENT:IN */}
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
  <option key={t.name} value={t.name}>
    {t.name}
  </option>
))}

          </select>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setCreateBestandOpen(false)}>Abbrechen</button>

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
                setBestandVorname("");
                setBestandNachname("");
                setBestandTherapeut("");
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


}
