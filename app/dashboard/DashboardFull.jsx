"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { teamData } from "../lib/teamData";

import jsPDF from "jspdf";
import "jspdf-autotable";

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
function isInBillingPeriod(dateStr, billingPeriod, billingDate) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;

  if (billingPeriod === "monat") {
    const [y, m] = billingDate.split("-");
    return year === Number(y) && month === Number(m);
  }

  if (billingPeriod === "quartal") {
    const [y, q] = billingDate.split("-Q");
    return year === Number(y) && quarter === Number(q);
  }

  if (billingPeriod === "jahr") {
    return year === Number(billingDate);
  }

  return true;
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

/* ================= EXPORT (CSV / PDF) ================= */

function exportBillingCSV(rows) {
  if (!rows || !rows.length) return;

  const header = [
    "Klient",
    "Sitzungen",
    "Umsatz",
    "Provision Poise",
    "Auszahlung Therapeut:in",
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
      ["Klient", "Sitzungen", "Umsatz (€)", "Provision (€)", "Auszahlung (€)"],
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

function exportSessionsCSV(sessions, meta = {}) {
  if (!sessions || !sessions.length) {
    alert("Keine Sitzungen im ausgewählten Zeitraum");
    return;
  }

  const header = [
    "Rechnungsjahr",
    "Rechnungsmonat",
    "Klient Vorname",
    "Klient Nachname",
    "Sitzungsdatum",
    "Dauer (Min)",
    "Einzelpreis €",
    "Gesamtbetrag €",
    "Therapeut:in",
  ];

  const rows = sessions.map((s) => {
    const d = new Date(s.date);
    return [
      d.getFullYear(),
      d.getMonth() + 1,
      s.anfragen?.vorname || "",
      s.anfragen?.nachname || "",
      d.toLocaleDateString("de-AT"),
      s.duration_min || 60,
      Number(s.price || 0).toFixed(2),
      Number(s.price || 0).toFixed(2),
      s.therapist || "",
    ].join(";");
  });

  const csv = [header.join(";"), ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `poise_sitzungen_${meta.year}_${meta.month}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}
function exportClientInvoicePDF({
  client,
  sessions,
  year,
  month,
  therapistName,
}) {
  if (!sessions || !sessions.length) {
    alert("Keine Sitzungen vorhanden");
    return;
  }

  const doc = new jsPDF();
  const total = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  doc.setFontSize(14);
  doc.text("Rechnung", 14, 18);

  doc.setFontSize(10);
  doc.text(`Rechnungszeitraum: ${month}.${year}`, 14, 28);
  doc.text(`Klient: ${client}`, 14, 34);
  doc.text(`Therapeut:in: ${therapistName}`, 14, 40);

  doc.autoTable({
    startY: 50,
    head: [["Datum", "Dauer", "Betrag €"]],
    body: sessions.map((s) => [
      new Date(s.date).toLocaleDateString("de-AT"),
      `${s.duration_min || 60} Min`,
      Number(s.price || 0).toFixed(2),
    ]),
    styles: { fontSize: 10 },
  });

  doc.text(
    `Gesamtbetrag: ${total.toFixed(2)} €`,
    14,
    doc.lastAutoTable.finalY + 12
  );

  doc.save(`rechnung_${client}_${month}_${year}.pdf`);
}
/* ================= POISE – QUARTALS EXPORT ================= */

function exportPoiseQuarterCSV(rows, totals) {
  if (!rows || !rows.length) {
    alert("Keine Quartalsdaten vorhanden");
    return;
  }

  const header = [
    "Typ",
    "Quartal",
    "Klient",
    "Stundensatz",
    "Sitzungen",
    "Umsatz",
    "Provision Poise",
  ];

  const clientRows = rows.map((r) =>
    [
      "Klient",
      r.quarter,
      r.klient,
      Number(r.rate).toFixed(2),
      r.sessions,
      Number(r.umsatz).toFixed(2),
      Number(r.provision).toFixed(2),
    ].join(";")
  );

  const totalRows = totals.map((t) =>
    [
      "Gesamt",
      t.quarter,
      "ALLE",
      Number(t.rate).toFixed(2),
      t.sessions,
      Number(t.umsatz).toFixed(2),
      Number(t.provision).toFixed(2),
    ].join(";")
  );

  const csv = [
    header.join(";"),
    ...clientRows,
    ...totalRows,
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `poise_quartalsabrechnung_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
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
/* ================= ABRECHNUNG – STATE ================= */

// Daten
const [billingSessions, setBillingSessions] = useState([]);

// Modus
const [billingMode, setBillingMode] = useState("all"); 
// "all" | "single"

// Auswahl Klient (nur bei single)
const [billingClientId, setBillingClientId] = useState("");

// Zeitraum
const [billingSpan, setBillingSpan] = useState("monat"); 
// "monat" | "quartal"

const now = new Date();
const [billingYear, setBillingYear] = useState(now.getFullYear());
const [billingMonth, setBillingMonth] = useState(now.getMonth() + 1);
const [billingQuarter, setBillingQuarter] = useState(
  Math.floor(now.getMonth() / 3) + 1
);

  /* ================= ABRECHNUNG – LOGIK ================= */

// 1. Zeitraumfilter
const filteredBillingSessions = useMemo(() => {
  return billingSessions.filter((s) => {
    if (!s?.date) return false;

    const d = new Date(s.date);
    if (Number.isNaN(d.getTime())) return false;

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;

    if (billingSpan === "monat") {
      return year === billingYear && month === billingMonth;
    }

    if (billingSpan === "quartal") {
      return year === billingYear && quarter === billingQuarter;
    }

    return false;
  });
}, [billingSessions, billingSpan, billingYear, billingMonth, billingQuarter]);

// 2. Optionaler Klient:innen-Filter
const scopedBillingSessions = useMemo(() => {
  if (billingMode === "single" && billingClientId) {
    return filteredBillingSessions.filter(
      (s) => String(s.anfrage_id) === String(billingClientId)
    );
  }
  return filteredBillingSessions;
}, [filteredBillingSessions, billingMode, billingClientId]);

// 3. Gruppierung pro Klient
const billingByClient = useMemo(() => {
  const map = {};

  scopedBillingSessions.forEach((s) => {
    if (!s.anfrage_id) return;

    if (!map[s.anfrage_id]) {
      map[s.anfrage_id] = {
        klient:
          `${s.anfragen?.vorname || ""} ${s.anfragen?.nachname || ""}`.trim() ||
          "Unbekannt",
        sessions: 0,
        umsatz: 0,
        provision: 0,
        payout: 0,
      };
    }

    map[s.anfrage_id].sessions += 1;
    map[s.anfrage_id].umsatz += Number(s.price) || 0;
    map[s.anfrage_id].provision += Number(s.commission) || 0;
    map[s.anfrage_id].payout += Number(s.payout) || 0;
  });

  return Object.values(map);
}, [scopedBillingSessions]);

// 4. Gesamtsummen (für Poise & Jahresinfo)
const billingTotals = useMemo(() => {
  return billingByClient.reduce(
    (acc, b) => {
      acc.sessions += b.sessions;
      acc.umsatz += b.umsatz;
      acc.provision += b.provision;
      acc.payout += b.payout;
      return acc;
    },
    { sessions: 0, umsatz: 0, provision: 0, payout: 0 }
  );
}, [billingByClient]);
  
  /* ---------- 5. JAHRESGESAMT (INFO) ---------- */
const billingYearTotals = useMemo(() => {
  return billingSessions
    .filter((s) => {
      if (!s?.date) return false;
      const d = new Date(s.date);
      return (
        !Number.isNaN(d.getTime()) &&
        d.getFullYear() === billingYear
      );
    })
    .reduce(
      (acc, s) => {
        acc.sessions += 1;
        acc.umsatz += Number(s.price) || 0;
        acc.provision += Number(s.commission) || 0;
        acc.payout += Number(s.payout) || 0;
        return acc;
      },
      { sessions: 0, umsatz: 0, provision: 0, payout: 0 }
    );
}, [billingSessions, billingYear]);
  
  /* ---------- 6. POISE: PRO TEAMMITGLIED ---------- */
const billingByTherapist = useMemo(() => {
  const map = {};

  filteredBillingSessions.forEach((s) => {
    if (!s?.therapist) return;

    if (!map[s.therapist]) {
      map[s.therapist] = {
        therapist: s.therapist,
        sessions: 0,
        umsatz: 0,
        provision: 0,
      };
    }

    map[s.therapist].sessions += 1;
    map[s.therapist].umsatz += Number(s.price) || 0;
    map[s.therapist].provision += Number(s.commission) || 0;
  });

  return Object.values(map);
}, [filteredBillingSessions]);
/* ---------- 7. POISE: QUARTAL EXPORT (pro Klient & Stundensatz) ---------- */
const poiseQuarterRows = useMemo(() => {
  // Basis: gefilterte Sitzungen (Zeitraum = aktuelles Quartal laut UI)
  // Wichtig: filteredBillingSessions hängt an billingSpan/billingYear/billingQuarter
  if (!Array.isArray(filteredBillingSessions)) return [];

  // Nur sinnvoll bei Quartal — falls Monat gewählt ist, exportieren wir trotzdem die Monatsdaten als "Q?" nicht.
  const quarterLabel = `Q${billingQuarter} ${billingYear}`;

  const map = {}; // key = anfrageId|rate

  filteredBillingSessions.forEach((s) => {
    if (!s?.anfrage_id) return;

    const rate = Number(s.price || 0); // vereinfachend: price = Einzelbetrag/Rate
    const key = `${s.anfrage_id}|${rate}`;

    if (!map[key]) {
      map[key] = {
        quarter: quarterLabel,
        klient:
          `${s.anfragen?.vorname || ""} ${s.anfragen?.nachname || ""}`.trim() ||
          "Unbekannt",
        rate,
        sessions: 0,
        umsatz: 0,
        provision: 0,
      };
    }

    map[key].sessions += 1;
    map[key].umsatz += Number(s.price) || 0;
    map[key].provision += Number(s.commission) || 0;
  });

  // sort: Klient, dann Rate
  return Object.values(map).sort((a, b) => {
    const c = a.klient.localeCompare(b.klient);
    if (c !== 0) return c;
    return a.rate - b.rate;
  });
}, [filteredBillingSessions, billingQuarter, billingYear]);

const poiseQuarterTotalsByRate = useMemo(() => {
  if (!poiseQuarterRows.length) return [];

  const map = {}; // key = rate
  poiseQuarterRows.forEach((r) => {
    const rate = Number(r.rate || 0);
    if (!map[rate]) {
      map[rate] = {
        quarter: r.quarter,
        rate,
        sessions: 0,
        umsatz: 0,
        provision: 0,
      };
    }
    map[rate].sessions += r.sessions;
    map[rate].umsatz += r.umsatz;
    map[rate].provision += r.provision;
  });

  return Object.values(map).sort((a, b) => a.rate - b.rate);
}, [poiseQuarterRows]);




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
    .select(
      `
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
    `
    )
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
      const key = String(s.anfrage_id);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    Object.keys(grouped).forEach((k) => {
      grouped[k].sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    setSessionsByRequest(grouped);
  });
}, []);

/* ---------- LOAD BILLING SESSIONS ---------- */
useEffect(() => {
  if (!user?.email) return;

  let query = supabase
    .from("sessions")
    .select(
      `
      id,
      date,
      price,
      commission,
      payout,
      therapist,
      anfrage_id,
      anfragen (
        vorname,
        nachname,
        status
      )
    `
    );

  if (user.email !== "hallo@mypoise.de") {
    query = query.eq("therapist", user.email);
  }

  query.then(({ data, error }) => {
    if (!error) setBillingSessions(data || []);
  });
}, [user]);

/* ---------- FILTER ---------- */
const UNBEARBEITET = ["offen", "termin_neu", "termin_bestaetigt"];

const FILTER_MAP = {
  unbearbeitet: ["offen", "termin_neu", "termin_bestaetigt"],
  aktiv: ["active"],
  beendet: ["beendet"],
  papierkorb: ["papierkorb"],
  abrechnung: [],
  alle: [
    "offen",
    "termin_neu",
    "termin_bestaetigt",
    "active",
    "beendet",
    "papierkorb",
  ],
};

const filtered = useMemo(() => {
  const allowed = FILTER_MAP[filter] || FILTER_MAP.alle;

  return requests.filter((r) => {
    if (!allowed.includes(r._status)) return false;

    if (therapistFilter !== "alle" && r.wunschtherapeut !== therapistFilter) {
      return false;
    }

    if (search) {
      const q = search.toLowerCase();
      const name = `${r.vorname || ""} ${r.nachname || ""}`.toLowerCase();
      if (!name.includes(q)) return false;
    }

    return true;
  });
}, [requests, filter, therapistFilter, search]);

const sorted = useMemo(() => {
  return [...filtered].sort((a, b) => {
    if (sort === "name") {
      return `${a.nachname || ""}${a.vorname || ""}`.localeCompare(
        `${b.nachname || ""}${b.vorname || ""}`
      );
    }

    const aSessions = sessionsByRequest[String(a.id)] || [];
    const bSessions = sessionsByRequest[String(b.id)] || [];

    const sa = aSessions.length ? aSessions[aSessions.length - 1]?.date : null;
    const sb = bSessions.length ? bSessions[bSessions.length - 1]?.date : null;

    const da = sa ? new Date(sa) : new Date(a.created_at);
    const db = sb ? new Date(sb) : new Date(b.created_at);

    return db - da;
  });
}, [filtered, sort, sessionsByRequest]);

/* ---------- EARLY RETURN (NACH ALLEN HOOKS!) ---------- */
if (!user) return <div>Bitte einloggen…</div>;


  /* ================= UI ================= */

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      {/* FILTER */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("unbearbeitet")}>Unbearbeitet</button>

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
            <option key={t.email} value={t.email}>
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

{/* ================= ABRECHNUNG ================= */}
{filter === "abrechnung" && (
  <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
    <h2>💶 Abrechnung</h2>

    {/* EBENE 1 – KLINT:INNEN */}
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <select
        value={billingMode}
        onChange={(e) => {
          setBillingMode(e.target.value);
          setBillingClientId("");
        }}
      >
        <option value="all">Alle Klient:innen</option>
        <option value="single">Eine Klient:in</option>
      </select>

      {billingMode === "single" && (
        <select
          value={billingClientId}
          onChange={(e) => setBillingClientId(e.target.value)}
        >
          <option value="">Klient:in wählen…</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.vorname} {r.nachname}
            </option>
          ))}
        </select>
      )}
    </div>

    {/* EBENE 2 – ZEITRAUM */}
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <select value={billingSpan} onChange={(e) => setBillingSpan(e.target.value)}>
        <option value="monat">Monat</option>
        <option value="quartal">Quartal</option>
      </select>

      <select value={billingYear} onChange={(e) => setBillingYear(Number(e.target.value))}>
        {[2023, 2024, 2025, 2026].map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {billingSpan === "monat" && (
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

      {billingSpan === "quartal" && (
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
    </div>

    {/* TABELLE */}
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th align="left">Klient:in</th>
          <th>Sitzungen</th>
          <th>Umsatz €</th>
          <th>Provision €</th>
          <th>Auszahlung €</th>
        </tr>
      </thead>
      <tbody>
        {billingByClient.map((b, i) => (
          <tr key={i}>
            <td>{b.klient}</td>
            <td align="center">{b.sessions}</td>
            <td align="right">{b.umsatz.toFixed(2)}</td>
            <td align="right">{b.provision.toFixed(2)}</td>
            <td align="right">{b.payout.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
{/* EXPORT */}
<div
  style={{
    display: "flex",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  }}
>
  <button
    onClick={() => exportBillingCSV(billingByClient)}
    style={{
      padding: "6px 12px",
      borderRadius: 8,
      border: "1px solid #ccc",
    }}
  >
    📄 CSV exportieren
  </button>

  <button
    onClick={() => exportBillingPDF(billingByClient)}
    style={{
      padding: "6px 12px",
      borderRadius: 8,
      border: "1px solid #ccc",
    }}
  >
    📑 PDF exportieren
  </button>
</div>
 


    {/* GESAMT */}
    <hr />
    <p><strong>Gesamt Sitzungen:</strong> {billingTotals.sessions}</p>
    <p><strong>Gesamt Provision:</strong> {billingTotals.provision.toFixed(2)} €</p>
  </section>
)}
      {/* POISE – TEAMÜBERSICHT */}
{filter === "abrechnung" && (
  <>
    <hr style={{ margin: "20px 0" }} />

    <h3>
      🏢 Abrechnungsübersicht
      {user?.email === "hallo@mypoise.de" ? " – Poise (alle Teammitglieder)" : ""}
    </h3>

    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th align="left">
            {user?.email === "hallo@mypoise.de"
              ? "Therapeut:in"
              : "Meine Abrechnung"}
          </th>
          <th>Sitzungen</th>
          <th>Umsatz €</th>
          <th>Provision €</th>
        </tr>
      </thead>

      <tbody>
        {billingByTherapist.map((t) => (
          <tr key={t.therapist}>
            <td>
              {teamData.find((x) => x.email === t.therapist)?.name ||
                t.therapist}
            </td>
            <td align="center">{t.sessions}</td>
            <td align="right">{t.umsatz.toFixed(2)}</td>
            <td align="right">{t.provision.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div style={{ marginTop: 12, color: "#555" }}>
      ℹ️ Jahresgesamt {billingYear}:{" "}
      <strong>{billingYearTotals.sessions}</strong> Sitzungen ·{" "}
      <strong>{billingYearTotals.provision.toFixed(2)} €</strong> Provision
    </div>
  </>
)}






      {/* KARTEN */}
      {filter !== "abrechnung" &&
        sorted.map((r) => {
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
              key={r.id}
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
                  {teamData.find((t) => t.email === r.wunschtherapeut)?.name ||
                    r.wunschtherapeut}
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

              <button
                onClick={() => {
                  setDetailsModal(r);
                  setEditTarif(r.honorar_klient || "");
                  setNewSessions([{ date: "", duration: 60 }]);
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
                          vorname: r.vorname,
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
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
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

                  <button
                    onClick={() => {
                      setReassignModal(r);
                      setNewTherapist("");
                    }}
                  >
                    🔁 Therapeut wechseln
                  </button>
                </div>
              )}

              {/* BEENDET */}
              {r._status === "beendet" && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() =>
                      fetch("/api/update-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          anfrageId: r.id,
                          status: "active",
                        }),
                      }).then(() => location.reload())
                    }
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
      {detailsModal && (
        <Modal onClose={() => setDetailsModal(null)}>
          <div>
            <h3>
              {safeText(detailsModal?.vorname)} {safeText(detailsModal?.nachname)}
            </h3>

            {/* FORMULARINFOS – IMMER */}
            <section>
              <p>
                <strong>Name:</strong> {safeText(detailsModal?.vorname)}{" "}
                {safeText(detailsModal?.nachname)}
              </p>

              <p>
                <strong>E-Mail:</strong> {safeText(detailsModal?.email)}
              </p>

              <p>
                <strong>Telefon:</strong> {safeText(detailsModal?.telefon)}
              </p>

              <p>
                <strong>Adresse:</strong> {safeText(detailsModal?.strasse_hausnr)}{" "}
                {safeText(detailsModal?.plz_ort)}
              </p>

              <p>
                <strong>Alter:</strong>{" "}
                {detailsModal?.geburtsdatum && !isNaN(Date.parse(detailsModal.geburtsdatum))
                  ? new Date().getFullYear() -
                    new Date(detailsModal.geburtsdatum).getFullYear()
                  : "–"}
              </p>

              <hr />

              <p>
                <strong>Anliegen:</strong>{" "}
                {typeof detailsModal?.anliegen === "string" ? detailsModal.anliegen : "–"}
              </p>

              <p>
                <strong>Leidensdruck:</strong> {safeText(detailsModal?.leidensdruck)}
              </p>

              <p>
                <strong>Wie lange schon:</strong> {safeText(detailsModal?.verlauf)}
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
                <strong>Wunschtherapeut:</strong>{" "}
                {teamData.find((t) => t.email === detailsModal?.wunschtherapeut)?.name ||
                  safeText(detailsModal?.wunschtherapeut)}
              </p>

              {safeDateString(detailsModal?.bevorzugte_zeit) && (
                <p>
                  <strong>Ersttermin:</strong> {safeDateString(detailsModal.bevorzugte_zeit)}
                </p>
              )}
            </section>

            {/* AKTIV-BEREICH */}
            {detailsModal._status === "active" && (
              <div style={{ marginTop: 12 }}>
                <hr />

                <p>
                  <strong>Anzahl Sitzungen:</strong>{" "}
                  {(sessionsByRequest[String(detailsModal.id)] || []).length}
                </p>

                <label>Stundensatz (€)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    value={editTarif}
                    onChange={(e) => setEditTarif(e.target.value)}
                    style={{ width: 140 }}
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
                </div>

                <h4 style={{ marginTop: 14 }}>Provision</h4>
                <p>
                  <strong>Gesamt:</strong>{" "}
                  {(sessionsByRequest[String(detailsModal.id)] || [])
                    .reduce((sum, s) => sum + (Number(s.price) || 0) * 0.3, 0)
                    .toFixed(2)}{" "}
                  €
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

                <h4 style={{ marginTop: 14 }}>Sitzungen</h4>
                {(sessionsByRequest[String(detailsModal.id)] || []).map((s, i) => (
                  <div key={s.id || `${s.date}-${i}`}>
                    {safeDateString(s.date) || "–"} · {safeNumber(s.duration_min)} Min
                  </div>
                ))}

                <h4 style={{ marginTop: 14 }}>Neue Sitzung eintragen</h4>

                {newSessions.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
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

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setNewSessions([...newSessions, { date: "", duration: 60 }])}
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
              </div>
            )}

            <hr />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setDetailsModal(null)}>Schließen</button>
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
              <option key={t.email} value={t.email}>
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
              <option key={t.email} value={t.email}>
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

  /* ---------- HELPERS (API) ---------- */

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
