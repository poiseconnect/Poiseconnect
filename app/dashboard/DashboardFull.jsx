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
const STATUS_FILTER_MAP = {
  unbearbeitet: ["offen", "termin_neu"],
  aktiv: ["active"],
  abrechnung: ["active", "beendet"],
  beendet: ["beendet"],
  papierkorb: ["papierkorb"],
  alle: [
    "offen",
    "termin_neu",
    "termin_bestaetigt",
    "active",
    "beendet",
    "papierkorb",
  ],
};
const UNBEARBEITET = ["offen", "termin_neu"];


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
    supabase.auth.getUser().then(({ data }) => {
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

  /* =========================================================
   LOAD BILLING SESSIONS
   Quelle für ALLE Abrechnungen
========================================================= */

const [billingSessions, setBillingSessions] = useState([]);

useEffect(() => {
  if (!user?.email) return;

  let query = supabase
    .from("sessions")
    .select(`
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
    `);

  // Therapeut:innen sehen nur ihre eigenen Sitzungen
  if (user.email !== "hallo@mypoise.de") {
    query = query.eq("therapist", user.email);
  }

  query.then(({ data, error }) => {
    if (!error) {
      setBillingSessions(data || []);
    }
  });
}, [user]);
  
const sessionsSafe = useMemo(() => {
  return Array.isArray(billingSessions) ? billingSessions : [];
}, [billingSessions]);


/* =========================================================
   GEFILTERTE ANFRAGEN (KARTEN / LISTEN)
========================================================= */

const filteredRequests = useMemo(() => {
  const allowedStatuses =
    STATUS_FILTER_MAP[filter] ?? STATUS_FILTER_MAP.alle;

  return requests.filter((r) => {
    if (!allowedStatuses.includes(r._status)) return false;

    if (
      therapistFilter !== "alle" &&
      r.wunschtherapeut !== therapistFilter
    ) {
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
   ABRECHNUNG – SESSION FILTER (ZEITRAUM)
========================================================= */

const filteredBillingSessions = useMemo(() => {
  return sessionsSafe.filter((s) => {
    if (!s?.date) return false;

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
        payout: 0,
      };
    }
// Anzahl Sitzungen
map[s.anfrage_id].sessions += 1;

// Endpreis, den der Klient zahlt
const price = Number(s.price || 0);

// Umsatzsteuer-Satz aus Rechnungsdaten
const vatRate = Number(invoiceSettings.default_vat_rate || 0);

// Anliegen ist USt-befreit (medizinisch etc.)
const isVatExemptCase = vatRate === 0;

// 1️⃣ Netto-Bemessungsgrundlage
const netBase =
  !isVatExemptCase && vatRate > 0
    ? price / (1 + vatRate / 100)
    : price;

// 2️⃣ Provision (30 % vom Netto)
const provisionNet = netBase * 0.3;

// 3️⃣ Auszahlung an Therapeut (Klient zahlt immer den Endpreis)
const payout = price - provisionNet;

// 4️⃣ Summieren
map[s.anfrage_id].umsatz += price;
map[s.anfrage_id].provision += provisionNet;
map[s.anfrage_id].payout += payout;

  });

  return Object.values(map);
}, [filteredBillingSessions]);
  const provisionByQuarter = useMemo(() => {
  if (!detailsModal) return [];

  const sessions = sessionsByRequest[String(detailsModal.id)] || [];
  const map = {};

  sessions.forEach((s) => {
    const q = quarterKeyFromDate(s.date);
    if (!q) return;
    map[q] = (map[q] || 0) + (Number(s.price) || 0) * 0.3;
  });

  return Object.entries(map).sort((a, b) => {
    const [aq, ay] = a[0].split(" ");
    const [bq, by] = b[0].split(" ");
    if (ay !== by) return Number(by) - Number(ay);
    return Number(bq.replace("Q", "")) - Number(aq.replace("Q", ""));
  });
}, [detailsModal, sessionsByRequest]);


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
          <th align="right">Auszahlung €</th>
        </tr>
      </thead>
      <tbody>
        {billingByClient.map((r, i) => (
          <tr key={i}>
            <td>{r.klient}</td>
            <td align="center">{r.sessions}</td>
            <td align="right">{r.umsatz.toFixed(2)}</td>
            <td align="right">{r.provision.toFixed(2)}</td>
            <td align="right">{r.payout.toFixed(2)}</td>
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
        sortedRequests.map((r) => {
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

    {/* ================= STUNDENSATZ ================= */}
    <label>Stundensatz (€)</label>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="number"
        value={editTarif}
        onChange={(e) => setEditTarif(e.target.value)}
        style={{ width: 140 }}
      />
      <button
        type="button"
        onClick={async () => {
          const res = await fetch("/api/update-tarif", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              anfrageId: detailsModal.id,
              tarif: Number(editTarif),
            }),
          });

          if (!res.ok) {
            alert("Fehler beim Speichern des Stundensatzes");
            return;
          }

          alert("Stundensatz gespeichert");
        }}
      >
        💾 Speichern
      </button>
    </div>

    {/* ================= PROVISION ================= */}
    <h4 style={{ marginTop: 14 }}>Provision</h4>
    <p>
      <strong>Gesamt:</strong>{" "}
      {(sessionsByRequest[String(detailsModal.id)] || [])
        .reduce((sum, s) => sum + (Number(s.price) || 0) * 0.3, 0)
        .toFixed(2)}{" "}
      €
    </p>

  <h4>Provision pro Quartal</h4>

{provisionByQuarter.length === 0 ? (
  <div style={{ color: "#777" }}>– Noch keine Sitzungen erfasst</div>
) : (
  provisionByQuarter.map(([q, sum]) => (
    <div key={q}>
      {q}: {Number(sum || 0).toFixed(2)} €
    </div>
  ))
)}


    {/* ================= SITZUNGEN ================= */}
    <h4 style={{ marginTop: 16 }}>Sitzungen</h4>

    {(sessionsByRequest[String(detailsModal.id)] || []).map((s, i) => (
      <div
        key={s.id || `${s.date}-${i}`}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span>
          {safeDateString(s.date) || "–"} ·{" "}
          {safeNumber(s.duration_min)} Min
        </span>

        <button
          type="button"
          style={{ color: "darkred" }}
          onClick={async () => {
            if (!confirm("Sitzung wirklich löschen?")) return;

            const res = await fetch("/api/delete-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: s.id }),
            });

            if (!res.ok) {
              alert("Fehler beim Löschen");
              return;
            }

            location.reload();
          }}
        >
          🗑️
        </button>
      </div>
    ))}

    {/* ================= NEUE SITZUNG ================= */}
    <h4 style={{ marginTop: 16 }}>Neue Sitzung eintragen</h4>

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

    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <button
        type="button"
        onClick={() =>
          setNewSessions([...newSessions, { date: "", duration: 60 }])
        }
      >
        ➕ Weitere Sitzung
      </button>

      <button
        type="button"
        onClick={async () => {
          const validSessions = newSessions.filter(
            (s) => s.date && String(s.date).trim() !== ""
          );

          if (!validSessions.length) {
            alert("Bitte mindestens eine Sitzung mit Datum eingeben");
            return;
          }

          const res = await fetch("/api/add-sessions-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              anfrageId: detailsModal.id,
              therapist: user.email,
              sessions: validSessions.map((s) => ({
                date: s.date,
                duration: s.duration,
                price: Number(editTarif),
              })),
            }),
          });

          if (!res.ok) {
            alert("Fehler beim Speichern der Sitzungen");
            return;
          }

          location.reload();
        }}
      >
        💾 Sitzungen speichern
      </button>
    </div>
  </div>
)}

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
