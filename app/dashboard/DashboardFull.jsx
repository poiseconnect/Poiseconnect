"use client";

import { useEffect, useMemo, useState } from "react";
import { teamData } from "../lib/teamData";
import jsPDF from "jspdf";
import "jspdf-autotable";
import ActionMenu from "../components/ActionMenu";
import { supabase } from "../lib/supabase";

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || "";
}
// ================= POISE DASHBOARD COLORS =================
const POISE_COLORS = {
  unbearbeitet: {
    base: "#F2726A",     // coral/rot
    active: "#8E3A4A",   // dunkler Kreis
  },
  erstgespraech: {
    base: "#6F8FCB",     // blau
    active: "#E6B3C2",   // rosa Kreis
  },
  aktiv: {
    base: "#E3AC1D",     // gelb/orange body
    active: "#0B6E4F",   // dunkelgrüner Kreis
    
  },
  admin_pruefen: {
  base: "#4C6FFF",
  active: "#1B2A6B",
},
  abrechnung: {
    base: "#7BC47F",     // grün body
    active: "#F2D98D",   // beige Kreis
  },
  beendet: {
    base: "#CBE34B",     // lime
    active: "#E7A374",   // orange Kreis
  },
  papierkorb: {
    base: "#9FC3CF",     // hellblau
    active: "#7E6BC4",   // lila Kreis
  },
  einstellungen: {
    base: "#000000",     // schwarz body
    active: "#EDEDED",   // weißer Kreis
  },
  alle: {
    base: "#F4F6F8",
    active: "#2C3E50",
  },
};
function DashboardTab({ label, value, active, onClick, color }) {
  const textColor = value === "einstellungen" ? "#000" : "#fff";

  return (
    <div
      onClick={() => onClick(value)}
      style={{
        width: 120,
        height: 220,
        borderRadius: 999,
        cursor: "pointer",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        background: color.base,
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: color.active,
          position: "absolute",
          top: -12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 14,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: 17,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: textColor,
            textTransform: "uppercase",
            wordBreak: "break-word",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
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
  einstellungen: [],
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
const MATCHING_THEMEN = [
  { key: "partnerschaft_beziehung", label: "Partnerschaft & Beziehung" },
  { key: "beruf_ziele_orientierung", label: "Beruf, Ziele & Orientierung" },
  { key: "emotionales_essen", label: "Emotionales Essen" },
  { key: "depressive_verstimmung", label: "Depressive Verstimmung" },
  { key: "stress", label: "Stress" },
  { key: "burnout", label: "Burnout" },
  { key: "selbstwert_selbstliebe", label: "Selbstwert & Selbstliebe" },
  { key: "angst_panik", label: "Angst & Panikattacken" },
  { key: "krankheit_psychosomatik", label: "Krankheit & Psychosomatik" },
  { key: "angehoerige", label: "Angehörige" },
  { key: "sexualitaet", label: "Sexualität" },
  { key: "trauer", label: "Trauer" },
];
// ================= CALENDAR MODE HELPER =================
function getCalendarModeByTherapistId(id) {
  const t = teamData.find((x) => x.id === id);
  return t?.calendar_mode || "booking"; // fallback = alter flow
}
function getCardStyleByFilter(filter) {
  const c = POISE_COLORS[filter] || POISE_COLORS.alle;

  return {
    background: "#FFFFFF",
    border: `2px solid ${c.active}`,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    position: "relative",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

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
function exportSingleClientPDF(clientRow, sessions, invoiceSettings) {
  if (!clientRow || !sessions?.length) return;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const today = new Date();

  const vatRate = Number(invoiceSettings.default_vat_rate || 0);

  const therapistName = invoiceSettings.company_name || "";
  const therapistAddress = invoiceSettings.address || "";
  const clientName = clientRow.klient || "Klient";

  // ================= HEADER =================

  doc.setFontSize(9);
doc.text(therapistName || "", 14, 15);
doc.text(therapistAddress || "", 14, 20);

if (invoiceSettings.vat_number) {
  doc.text(`UID: ${invoiceSettings.vat_number}`, 14, 25);
}

if (invoiceSettings.tax_number) {
  doc.text(`Steuernr: ${invoiceSettings.tax_number}`, 14, 30);
}

  // LOGO (optional)
  if (invoiceSettings.logo_url) {
    try {
      doc.addImage(
        invoiceSettings.logo_url,
        "PNG",
        pageWidth - 45,
        10,
        28,
        18
      );
    } catch {}
  }

  // Empfänger
  doc.setFontSize(11);
doc.text("Rechnung an:", 14, 30);

doc.text(clientRow.klient || "", 14, 36);
doc.text(clientRow.strasse_hausnr || "", 14, 42);
doc.text(clientRow.plz_ort || "", 14, 48);

if (clientRow.email) {
  doc.text(clientRow.email, 14, 54);
}

if (clientRow.steuer_nr) {
  doc.text(`Steuernr: ${clientRow.steuer_nr}`, 14, 60);
}

  // Rechnungsinfo rechts
  doc.setFontSize(11);
  doc.text("Rechnung", pageWidth - 60, 30);

  doc.setFontSize(10);
  doc.text(
    `Rechnungsdatum: ${today.toLocaleDateString("de-AT")}`,
    pageWidth - 60,
    36
  );

  // ================= INTRO =================

  doc.setFontSize(12);
  doc.text(`Sehr geehrte/r ${clientName},`, 14, 55);

  doc.setFontSize(11);
  doc.text(
    "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:",
    14,
    65
  );

  // ================= TABLE =================

  const body = sessions.map((s, i) => {
    const price = Number(s.price || 0);

    return [
      i + 1,
      new Date(s.date).toLocaleDateString("de-AT"),
      `${price.toFixed(2)} €`,
    ];
  });

  doc.autoTable({
    startY: 75,
    head: [["Pos.", "Sitzung", "Einzelpreis"]],
    body,
    headStyles: {
      fillColor: [46, 139, 201], // blau wie Screenshot
      textColor: 255,
      halign: "left",
    },
    styles: {
      fontSize: 10,
    },
  });

  // ================= TOTALS =================

  const finalY = doc.lastAutoTable.finalY + 10;

  const totalNet = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const vatAmount =
    vatRate > 0 ? totalNet * (vatRate / 100) : 0;

  const totalGross = totalNet + vatAmount;

  doc.setFontSize(11);

  doc.text(
    `Gesamt netto: ${totalNet.toFixed(2)} €`,
    pageWidth - 80,
    finalY
  );

  doc.text(
    `zzgl. Umsatzsteuer ${vatRate}%: ${vatAmount.toFixed(2)} €`,
    pageWidth - 80,
    finalY + 6
  );

  doc.text(
    `Gesamtbetrag brutto: ${totalGross.toFixed(2)} €`,
    pageWidth - 80,
    finalY + 12
  );

  // ================= FOOTER =================

  doc.setFontSize(9);

  doc.text(therapistName, 14, 275);
  doc.text(`IBAN: ${invoiceSettings.iban || "-"}`, 14, 280);
  doc.text(`BIC: ${invoiceSettings.bic || "-"}`, 14, 285);

  if (invoiceSettings.tax_number) {
    doc.text(`Steuernummer: ${invoiceSettings.tax_number}`, 100, 280);
  }

  if (invoiceSettings.vat_number) {
    doc.text(`UID: ${invoiceSettings.vat_number}`, 100, 285);
  }

  // ================= SAVE =================

  doc.save(
    `Rechnung_${clientName}_${today
      .toISOString()
      .slice(0, 10)}.pdf`
  );
}
function exportBillingPDF(rows, invoiceSettings, periodLabel = "") {
  if (!rows || !rows.length) return;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const today = new Date();

  // HEADER
  doc.setFontSize(10);
  doc.text(
    `${invoiceSettings.company_name || ""} – ${invoiceSettings.address || ""}`,
    14,
    15
  );

  // LOGO
  if (invoiceSettings.logo_url) {
    try {
      doc.addImage(invoiceSettings.logo_url, "PNG", pageWidth - 50, 10, 30, 20);
    } catch (e) {}
  }

  // EMPFÄNGER
  doc.setFontSize(11);
  doc.text("Rechnung an:", 14, 30);
  doc.text("Klient:in siehe Tabelle", 14, 36);

  // RECHNUNG INFO
  doc.text("Rechnung", pageWidth - 60, 30);
  doc.setFontSize(10);
  doc.text(
    `Rechnungsdatum: ${today.toLocaleDateString("de-AT")}`,
    pageWidth - 60,
    36
  );

  doc.text(`Leistungszeitraum: ${periodLabel}`, pageWidth - 60, 42);

  doc.setFontSize(16);
  doc.text("Rechnung", 14, 55);

  // TABLE
  doc.autoTable({
    startY: 70,
    head: [["Klient", "Sitzungen", "Gesamt €"]],
    body: rows.map((r) => [
      r.klient,
      r.sessions,
      `${r.umsatz.toFixed(2)} €`,
    ]),
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  const totalNet = rows.reduce((sum, r) => sum + r.umsatz, 0);
  const vatRate = Number(invoiceSettings.default_vat_rate || 0);
  const vatAmount = totalNet * (vatRate / 100);
  const totalGross = totalNet + vatAmount;

  doc.text(`Gesamt netto: ${totalNet.toFixed(2)} €`, pageWidth - 80, finalY);
  doc.text(
    `zzgl. Umsatzsteuer ${vatRate}%: ${vatAmount.toFixed(2)} €`,
    pageWidth - 80,
    finalY + 6
  );
  doc.text(
    `Gesamtbetrag brutto: ${totalGross.toFixed(2)} €`,
    pageWidth - 80,
    finalY + 12
  );

  // FOOTER
  doc.setFontSize(9);
  doc.text(`${invoiceSettings.company_name || ""}`, 14, 280);
  doc.text(`IBAN: ${invoiceSettings.iban || "-"}`, 14, 285);
  doc.text(`BIC: ${invoiceSettings.bic || "-"}`, 14, 290);

  doc.save(`Rechnung_${today.toISOString().slice(0, 10)}.pdf`);
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
function getActionsForRequest(r, sessionList = []) {
  const status = normalizeStatus(r._status || r.status);

  const therapistId =
    r.assigned_therapist_id ||
    sessionList?.[0]?.therapist_id ||
    teamData.find((t) => t.name === r.wunschtherapeut)?.id ||
    null;

  const calendarMode = getCalendarModeByTherapistId(therapistId);

  if (status === "neu" || status === "termin_neu") {
    const actions = [];

    if (calendarMode === "booking" && r.bevorzugte_zeit) {
      actions.push({
        key: "confirm",
        label: "✅ Termin bestätigen",
        hint: "Anliegen passt zu mir – ich führe das Erstgespräch",
      });
    }

    if (calendarMode === "booking") {
      actions.push({
        key: "new_appointment",
        label: "🔁 Neuer Termin",
        hint: "Termin passt nicht – Klient:in wählt neu",
      });
    }

    if (calendarMode === "proposal") {
      actions.push({
        key: "proposal_send",
        label: "📩 Terminvorschläge senden",
        hint: "Therapeut schlägt Zeiten vor",
      });
    }

    actions.push({
      key: "forward",
      label: "⏸ Keine Kapazitäten",
      hint: "Anliegen passt, aber aktuell keine Kapazitäten",
    });

    actions.push({
      key: "admin",
      label: "👥 Anliegen passt nicht zu mir",
      hint: "Admin wählt passende Therapeut:innen",
    });

    actions.push({
      key: "no_match",
      label: "❌ Kein Match (Poise)",
      hint: "Anliegen passt grundsätzlich nicht zu Poise",
    });

    actions.push({
      key: "details",
      label: "🔍 Details",
      hint: "Alle Angaben und Verlauf ansehen",
    });

    return actions;
  }

  if (status === "termin_bestaetigt") {
    const actions = [
      {
        key: "match",
        label: "❤️ Match",
        hint: "Erstgespräch war passend – Begleitung startet",
      },
    ];

    if (calendarMode === "booking") {
      actions.push({
        key: "new_appointment",
        label: "🔁 Neuer Termin",
        hint: "Klient:in wählt neuen Termin",
      });
    }

    if (calendarMode === "proposal") {
      actions.push({
        key: "proposal_send",
        label: "📩 Neue Vorschläge senden",
        hint: "Therapeut schlägt neue Zeiten vor",
      });
    }

    actions.push({
      key: "no_match",
      label: "❌ Kein Match (Poise)",
      hint: "Anliegen passt grundsätzlich nicht zu Poise",
    });

    actions.push({
      key: "details",
      label: "🔍 Details",
      hint: "Alle Angaben und Verlauf ansehen",
    });

    return actions;
  }

  if (status === "active") {
    const actions = [
      {
        key: "details",
        label: "🔍 Details",
        hint: "Sitzungen, Tarif und Verlauf ansehen",
      },
      {
        key: "finish",
        label: "🔴 Coaching beenden",
        hint: "Klient:in in beendet verschieben",
      },
      {
        key: "reassign",
        label: "👥 Therapeut wechseln",
        hint: "An Admin zur Neuverteilung geben",
      },
    ];

    if (calendarMode === "booking") {
      actions.push({
        key: "copy_link",
        label: "🔗 Buchungslink kopieren",
        hint: "Link für weitere Terminbuchungen kopieren",
      });
      actions.push({
        key: "send_link",
        label: "📧 Buchungslink senden",
        hint: "Link direkt per Mail an Klient:in senden",
      });
    }

    if (calendarMode === "proposal") {
      actions.push({
        key: "proposal_send",
        label: "📩 Weitere Vorschläge senden",
        hint: "Neue Zeitvorschläge an Klient:in senden",
      });
    }

    return actions;
  }

  if (status === "beendet") {
    return [
      {
        key: "details",
        label: "🔍 Details",
        hint: "Verlauf und Daten ansehen",
      },
      {
        key: "reactivate",
        label: "🔄 Coaching wieder aktivieren",
        hint: "Klient:in zurück in aktiv setzen",
      },
    ];
  }

  if (status === "papierkorb") {
    return [
      {
        key: "details",
        label: "🔍 Details",
        hint: "Eintrag ansehen",
      },
      {
        key: "restore",
        label: "♻️ Wiederherstellen",
        hint: "Anfrage zurückholen",
      },
      {
        key: "delete",
        label: "🗑 Löschen",
        hint: "Anfrage endgültig löschen",
      },
    ];
  }

  if (status === "admin_pruefen") {
    return [
      {
        key: "details",
        label: "🔍 Details",
        hint: "Angaben ansehen",
      },
    ];
  }

  return [
    {
      key: "details",
      label: "🔍 Details",
      hint: "Angaben ansehen",
    },
  ];
}

/* ================= DASHBOARD ================= */

export default function DashboardFull() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
const [role, setRole] = useState(null); // "admin" | "therapist"
  const isAdmin = role === "admin";
const [myUserId, setMyUserId] = useState(null);
  const [myTeamMemberId, setMyTeamMemberId] = useState(null);
const [access, setAccess] = useState("loading");
  const [sessionsByRequest, setSessionsByRequest] = useState({});
  const [billingSessions, setBillingSessions] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("alle");
  const [filter, setFilter] = useState("unbearbeitet");
  const [openMenuId, setOpenMenuId] = useState(null);
 
  

  const [therapistFilter, setTherapistFilter] = useState("alle");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("last"); // last | name

  const [detailsModal, setDetailsModal] = useState(null);
  const [editTarif, setEditTarif] = useState("");
  const [newSessions, setNewSessions] = useState([{ date: "", duration: 60 }]);
  const [bookingSettings, setBookingSettings] = useState(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [myAvailability, setMyAvailability] = useState(true);
  const [meetingLinkOverride, setMeetingLinkOverride] = useState("");
  const [matchingScoresModalOpen, setMatchingScoresModalOpen] = useState(false);
const [matchingScores, setMatchingScores] = useState({
  partnerschaft_beziehung: 0,
  beruf_ziele_orientierung: 0,
  emotionales_essen: 0,
  depressive_verstimmung: 0,
  stress: 0,
  burnout: 0,
  selbstwert_selbstliebe: 0,
  angst_panik: 0,
  krankheit_psychosomatik: 0,
  angehoerige: 0,
  sexualitaet: 0,
  trauer: 0,
});
const [matchingScoresSaving, setMatchingScoresSaving] = useState(false);

  // ================= PROPOSALS =================
const [proposalModal, setProposalModal] = useState(null);
const [proposalDates, setProposalDates] = useState([
  { date: "" },
  { date: "" },
  { date: "" },
]);

  const [reassignModal, setReassignModal] = useState(null);
  const [newTherapist, setNewTherapist] = useState("");

  const [createBestandOpen, setCreateBestandOpen] = useState(false);
  const [bestandVorname, setBestandVorname] = useState("");
  const [bestandNachname, setBestandNachname] = useState("");
  const [bestandTherapeut, setBestandTherapeut] = useState("");
  const [bestandEmail, setBestandEmail] = useState("");
const [bestandTelefon, setBestandTelefon] = useState("");
const [bestandStrasse, setBestandStrasse] = useState("");
const [bestandPlzOrt, setBestandPlzOrt] = useState("");
const [bestandGeburtsdatum, setBestandGeburtsdatum] = useState("");
const [bestandBeschaeftigungsgrad, setBestandBeschaeftigungsgrad] = useState("");
  const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout fehlgeschlagen:", error);
    alert("Logout fehlgeschlagen");
    return;
  }

  // 🔥 WICHTIG: kompletter Reload, sonst bleibt alte Session
  window.location.href = "/";
};

 
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
  tax_number: "",        // 🔥 NEU
  vat_number: "",        // 🔥 UID Nummer
  default_vat_country: "AT",
  default_vat_rate: 0,
});

const [invoiceLoading, setInvoiceLoading] = useState(false);



async function handleAction(action, r, sessionList = [], calendarModeParam) {
  try {
const therapistId =
  r.assigned_therapist_id ||
  sessionList?.[0]?.therapist_id ||
  teamData.find((t) => t.name === r.wunschtherapeut)?.id ||
  null;

const calendarMode =
  getCalendarModeByTherapistId(therapistId);

if (action === "details") {
  setDetailsModal({
    ...r,
    _status: r._status,
  });
  setEditTarif(r.honorar_klient || "");
  setMeetingLinkOverride(r.meeting_link_override || "");
  setNewSessions([{ date: "", duration: 60 }]);
  setOpenMenuId(null);
  return;
}
    if (action === "confirm") {
      await updateRequestStatus({
        requestId: r.id,
        status: "termin_bestaetigt",
        client: r.email,
        vorname: r.vorname,
      });

      setRequests((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, _status: "termin_bestaetigt", status: "termin_bestaetigt" }
            : x
        )
      );
    }

if (action === "no_match") {
  await fetch("/api/no-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anfrageId: r.id,
      client: r.email,
      vorname: r.vorname,
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      console.error("NO MATCH FAILED:", text);
      alert("Fehler beim Senden");
      throw new Error("no_match_failed");
    }
  });

  setRequests((prev) =>
    prev.map((x) =>
      x.id === r.id
        ? { ...x, _status: "papierkorb", status: "papierkorb" }
        : x
    )
  );
}

    if (action === "forward") {
      const res = await fetch("/api/forward-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: r.id,
          client: r.email,
          vorname: r.vorname,
          excludedTherapist: r.wunschtherapeut,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("FORWARD FAILED:", t);
        alert("Fehler bei der Weiterleitung");
        setOpenMenuId(null);
        return;
      }

      setRequests((prev) => prev.filter((x) => x.id !== r.id));
      alert("📧 Anfrage weitergeleitet – Klient:in wählt neu");
    }

    if (action === "admin") {
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
    }

    if (action === "new_appointment") {
      const therapistName =
        r.wunschtherapeut || sessionList?.[0]?.therapist;

      if (!therapistName && calendarMode === "booking") {
        alert("❌ Keine Therapeut:in gefunden");
        setOpenMenuId(null);
        return;
      }

      if (calendarMode === "booking") {
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
          alert("Fehler beim Senden");
          setOpenMenuId(null);
          return;
        }

        alert("📧 Neue Terminauswahl gesendet");
      } else {
        setProposalModal(r);
        setProposalDates([{ date: "" }, { date: "" }, { date: "" }]);
      }
    }

    if (action === "proposal_send") {
      setProposalModal(r);
      setProposalDates([{ date: "" }, { date: "" }, { date: "" }]);
    }

    if (action === "match") {
      const res = await fetch("/api/match-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anfrageId: r.id,
          honorar: r.honorar_klient,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("MATCH FAILED:", t);
        alert("Fehler beim Match");
        setOpenMenuId(null);
        return;
      }

      location.reload();
      return;
    }

    if (action === "finish") {
      const res = await fetch("/api/finish-coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anfrageId: r.id }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("FINISH FAILED:", t);
        alert("❌ Fehler beim Beenden");
        setOpenMenuId(null);
        return;
      }

      setRequests((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, _status: "beendet", status: "beendet" }
            : x
        )
      );

      alert("✅ Coaching beendet");
    }

    if (action === "reassign") {
      setReassignModal(r);
      setNewTherapist("");
    }

    if (action === "copy_link") {
      await copyBookingLink(r);
    }

    if (action === "send_link") {
      await sendBookingLink(r);
    }

    if (action === "reactivate") {
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
    }

    if (action === "restore") {
      await restoreFromTrash(r);
      return;
    }

    if (action === "delete") {
      await deleteForever(r);
      return;
    }
  } catch (err) {
    console.error("ACTION ERROR", err);
  }

  setOpenMenuId(null);
}


  /* ---------- LOAD USER ---------- */
useEffect(() => {
  async function loadAuthAndRole() {
    const { data } = await supabase.auth.getUser();

    if (!data?.user) return;

    const token = await getAccessToken();

    const res = await fetch("/api/dashboard/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    if (!res.ok || !json?.user) {
      console.warn("❌ Zugriff verweigert", json);
      setAccess("denied");
      return;
    }

    setUser(json.user);
    setMyUserId(json.user.id);

    const member = json.member;

    if (!member || member.active !== true) {
      setAccess("denied");
      return;
    }

    setMyTeamMemberId(member.id);
    setRole(member.role);
    setMyAvailability(!!member.available_for_intake);
    setAccess("granted");
  }

  loadAuthAndRole();
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
body: JSON.stringify({ therapist_id: myTeamMemberId }),
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

useEffect(() => {
  if (!user?.email) return;
  if (!role) return;

  (async () => {
    try {
      const token = await getAccessToken();

      const res = await fetch("/api/dashboard/requests", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("🔥 Fehler beim Laden der Anfragen:", json);
        setRequests([]);
        return;
      }

      setRequests(
        (json.requests || []).map((r) => {
          const normalized = normalizeStatus(r.status);

          let adminTher = r.admin_therapeuten;

          if (typeof adminTher === "string") {
            adminTher = adminTher.trim() ? [adminTher] : [];
          }
          if (!Array.isArray(adminTher)) adminTher = [];

          return {
            ...r,
            admin_therapeuten: adminTher,
            _status: normalized || "neu",
          };
        })
      );

      if (json.role) setRole(json.role);
      if (json.myTeamMemberId) setMyTeamMemberId(json.myTeamMemberId);
    } catch (err) {
      console.error("🔥 REQUEST LOAD FAILED:", err);
      setRequests([]);
    }
  })();
}, [user, role]);
/* ---------- LOAD SESSIONS (ADMIN API – STABIL) ---------- */
useEffect(() => {
  let mounted = true;

  fetch("/api/admin/sessions")
    .then((res) => res.json())
    .then(({ data }) => {
      if (!mounted) return;

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
    })
    .catch((err) => {
      console.error("ADMIN SESSION LOAD FAILED", err);
      setSessionsByRequest({});
    });

  return () => {
    mounted = false;
  };
}, []);
  /* =========================================================
   LOAD BILLING SESSIONS
   Quelle für ALLE Abrechnungen
========================================================= */

/* =========================================================
   LOAD BILLING SESSIONS (IMMER ALLE – FILTER NUR IM FRONTEND)
========================================================= */
useEffect(() => {
  if (!user?.email) return;
  if (!role) return; // ⛔ warten bis Rolle bekannt

  // Therapeut: warten bis team_member_id da
  if (role === "therapist" && !myTeamMemberId) return;

  const endpoint =
    role === "admin"
      ? "/api/admin/billing-sessions"
      : "/api/therapist/billing-sessions";

  console.log("📡 Lade Billing von:", endpoint);

  (async () => {
    try {
const {
  data: { session },
} = await supabase.auth.getSession();

const r = await fetch(endpoint, {
  headers: {
    Authorization: `Bearer ${session?.access_token}`,
  },
});

      const res = await r.json();

      if (!r.ok) {
        console.error("❌ BILLING API ERROR:", res);
        setBillingSessions([]);
        return;
      }

      console.log("✅ BILLING DATEN:", res?.data?.length);

      setBillingSessions(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("🔥 BILLING LOAD FAILED:", err);
      setBillingSessions([]);
    }
  })();
}, [user, role, myTeamMemberId]); // ✅ SUPER WICHTIG



const sessionsSafe = useMemo(() => {
  return Array.isArray(billingSessions) ? billingSessions : [];
}, [billingSessions]);
  
useEffect(() => {
  if (!user?.email) return;
  if (role !== "therapist") return;
  if (!myTeamMemberId) return;

  loadBookingSettings();
  loadMyAvailability();
}, [user, role, myTeamMemberId]);
useEffect(() => {
  if (!user?.email) return;
  if (role !== "therapist") return;

  (async () => {
    try {
      const token = await getAccessToken();

      const res = await fetch("/api/team-members/matching-scores", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("MATCHING SCORES LOAD ERROR:", json);
        return;
      }

      if (json?.matching_scores) {
        setMatchingScores((prev) => ({
          ...prev,
          ...json.matching_scores,
        }));
      }
    } catch (err) {
      console.error("MATCHING SCORES LOAD ERROR:", err);
    }
  })();
}, [user, role]);
async function loadBookingSettings() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch("/api/booking/settings/get", {
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
    },
  });

  const json = await res.json();

  setBookingSettings(
    json.settings || {
      booking_enabled: false,
      slot_duration_min: 60,
      buffer_min: 10,
      time_zone: "Europe/Vienna",
      min_booking_notice_hours: 24,
      meeting_link: "",
    }
  );
}


async function loadMyAvailability() {
  try {
    const token = await getAccessToken();

    const res = await fetch("/api/dashboard/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      console.error("LOAD AVAILABILITY ERROR:", json);
      return;
    }

    setMyAvailability(!!json?.member?.available_for_intake);
  } catch (error) {
    console.error("LOAD AVAILABILITY ERROR:", error);
  }
}
  async function saveBookingSettings() {
  setBookingSaving(true);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/booking/settings/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
  ...bookingSettings,
  therapist_id: myTeamMemberId
}),
    });

    const json = await res.json();

    if (!res.ok) {
      alert("Fehler beim Speichern");
      console.log(json);
      return;
    }

    setBookingSettings(json.data);
    alert("✅ Buchungssettings gespeichert");
  } finally {
    setBookingSaving(false);
  }
}
  async function toggleMyAvailability(nextValue) {
  const res = await fetch("/api/team-members/toggle-availability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamMemberId: myTeamMemberId,
      available: nextValue,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("TOGGLE AVAILABILITY ERROR:", json);
    alert("Fehler beim Speichern");
    return;
  }

  setMyAvailability(nextValue);
  alert(
    nextValue
      ? "✅ Du bist jetzt im Formular sichtbar"
      : "⏸ Du bist jetzt im Formular ausgeblendet"
  );
}
  // ================================
// 🔗 BOOKING LINK FUNCTIONS
// ================================

async function copyBookingLink(r) {
  if (!r?.booking_token) {
    alert("Kein booking_token vorhanden");
    return;
  }

  const bookingUrl = `${window.location.origin}/booking/${r.booking_token}`;

  try {
    await navigator.clipboard.writeText(bookingUrl);
    alert("✅ Buchungslink kopiert");
  } catch (err) {
    console.error("COPY BOOKING LINK FAILED:", err);
    alert("Link konnte nicht kopiert werden");
  }
}

async function sendBookingLink(r) {
  if (!r?.booking_token) {
    alert("Kein booking_token vorhanden");
    return;
  }

  if (!r?.email) {
    alert("Keine E-Mail vorhanden");
    return;
  }

  const therapistName =
    teamData.find((t) => t.id === r.assigned_therapist_id)?.name ||
    r.wunschtherapeut ||
    "";

  const res = await fetch("/api/send-booking-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: r.id,
      email: r.email,
      vorname: r.vorname,
      bookingToken: r.booking_token,
      therapistName,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("SEND BOOKING LINK ERROR:", json);
    alert("Fehler beim Senden");
    return;
  }

  alert("✅ Buchungslink gesendet");
}
/* =========================================================
   GEFILTERTE ANFRAGEN (KARTEN / LISTEN)
========================================================= */
const filteredRequests = useMemo(() => {
  const allowedStatuses = STATUS_FILTER_MAP[filter] || [];

  return requests.filter((r) => {
    return allowedStatuses.includes(r._status);
  });
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

    const d = new Date(s.date); // ✅ DAS HAT GEFEHLT

    // 👤 Therapeut:innen-Filter
    if (
      therapistFilter !== "alle" &&
      String(s.therapist_id) !== String(therapistFilter)
    ) {
      return false;
    }

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
  const a = s.anfragen || {};

  map[s.anfrage_id] = {
    anfrage_id: s.anfrage_id,

    klient:
      `${a.vorname || ""} ${a.nachname || ""}`.trim() || "Unbekannt",

    // 🔥 CLIENT DATEN (NEU)
    vorname: a.vorname || "",
    nachname: a.nachname || "",
    email: a.email || "",
    strasse_hausnr: a.strasse_hausnr || "",
    plz_ort: a.plz_ort || "",
    steuer_nr: a.steuer_nr || "",

    therapist_id: s.therapist_id,
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
// ================= CLIENT FILTER FÜR ABRECHNUNG =================
const visibleBillingRows = useMemo(() => {
  if (selectedClientId === "alle") {
    return billingByClient;
  }

  return billingByClient.filter(
    (row) => String(row.anfrage_id) === String(selectedClientId)
  );
}, [billingByClient, selectedClientId]);

if (!user) {
  return <div style={{ padding: 40 }}>Lade Benutzer…</div>;
}

if (access === "loading") {
  return <div style={{ padding: 40 }}>Prüfe Zugriff…</div>;
}

if (access === "denied") {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h2>Kein Zugriff auf das Dashboard</h2>

      <p style={{ marginTop: 12 }}>
        Dein Account ist nicht freigeschaltet.
      </p>

      <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
        Eingeloggt als: {user.email}
      </p>

      <button
        style={{ marginTop: 20 }}
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = "/";
        }}
      >
        Logout
      </button>
    </div>
  );
}

return (
<div
  style={{
    padding: typeof window !== "undefined" && window.innerWidth < 768 ? 12 : 24,
    maxWidth: 1100,
    width: "100%",
    margin: "0 auto",
    minHeight: "100vh",
    boxSizing: "border-box",
    overflowX: "hidden",
    background:
      role === "admin"
        ? "linear-gradient(180deg,#F8F9FF 0%, #FFFFFF 60%)"
        : "linear-gradient(180deg,#F7FFF9 0%, #FFFFFF 60%)",
  }}
>
     

      
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
      <div
  style={{
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  }}
>
  Eingeloggt als: <strong>{user?.email || "–"}</strong>
</div>
   <button
  onClick={async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout fehlgeschlagen:", error);
      alert("Logout fehlgeschlagen");
      return;
    }

    // 🔥 wichtig: kompletter Reload + Session reset
    window.location.href = "/";
  }}
  style={{
    marginBottom: 16,
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#f7f7f7",
    cursor: "pointer",
  }}
>
  🔒 Logout
</button>

{/* FILTER / TABS */}
<div
  style={{
    display: "flex",
    gap: 18,
    marginBottom: 24,
    flexWrap: "nowrap",
    alignItems: "flex-start",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 8,
  }}
>
  <DashboardTab
    label="Unbearbeitet"
    value="unbearbeitet"
    active={filter === "unbearbeitet"}
    onClick={setFilter}
    color={POISE_COLORS.unbearbeitet}
  />

  <DashboardTab
    label="Erstgespräch"
    value="erstgespraech"
    active={filter === "erstgespraech"}
    onClick={setFilter}
    color={POISE_COLORS.erstgespraech}
  />

  <DashboardTab
    label="Aktiv"
    value="aktiv"
    active={filter === "aktiv"}
    onClick={setFilter}
    color={POISE_COLORS.aktiv}
  />

  {isAdmin && (
    <DashboardTab
      label="Admin"
      value="admin_pruefen"
      active={filter === "admin_pruefen"}
      onClick={setFilter}
      color={POISE_COLORS.admin_pruefen}
    />
  )}

  <DashboardTab
    label="Abrechnung"
    value="abrechnung"
    active={filter === "abrechnung"}
    onClick={setFilter}
    color={POISE_COLORS.abrechnung}
  />

  <DashboardTab
    label="Beendet"
    value="beendet"
    active={filter === "beendet"}
    onClick={setFilter}
    color={POISE_COLORS.beendet}
  />

  <DashboardTab
    label="Papierkorb"
    value="papierkorb"
    active={filter === "papierkorb"}
    onClick={setFilter}
    color={POISE_COLORS.papierkorb}
  />

  <DashboardTab
    label="Einstellungen"
    value="einstellungen"
    active={filter === "einstellungen"}
    onClick={setFilter}
    color={POISE_COLORS.einstellungen}
  />
</div>

{isAdmin && (
  <div style={{ marginBottom: 16 }}>
    <select
      value={therapistFilter}
      onChange={(e) => setTherapistFilter(e.target.value)}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #ccc",
        background: "#fff",
      }}
    >
      <option value="alle">Alle Teammitglieder</option>
      {teamData.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  </div>
)}

{filter !== "abrechnung" &&
  filter !== "einstellungen" &&
  sortedRequests.length === 0 && (
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
      Keine Einträge für diesen Filter
      <br />
      <small>Aktiver Filter: {filter}</small>
    </div>
)}

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


    {/* ================= EINSTELLUNGEN ================= */}
{filter === "einstellungen" && (
  <section
    style={{
      border: "1px solid #ddd",
      borderRadius: 12,
      padding: 16,
      background: "#fff",
    }}
  >
    <h2 style={{ marginTop: 0 }}>⚙️ Einstellungen</h2>

    {role === "therapist" && (
      <>
        <div
          style={{
            marginBottom: 16,
            border: "1px solid #eee",
            borderRadius: 10,
            background: "#FAFAFA",
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Sichtbarkeit im Anfrageformular
          </div>

          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Hier steuerst du, ob du für neue Klient:innen im Formular auswählbar bist.
          </div>

          <button
            type="button"
            onClick={() => toggleMyAvailability(!myAvailability)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #ccc",
              background: myAvailability ? "#E8FFF0" : "#FFF4E6",
              fontWeight: 600,
            }}
          >
            {myAvailability
              ? "🟢 Verfügbar – im Formular sichtbar"
              : "⏸ Nicht verfügbar – im Formular ausgeblendet"}
          </button>
        </div>

        {bookingSettings && (
          <div
            style={{
              marginBottom: 16,
              border: "1px solid #eee",
              borderRadius: 10,
              background: "#FAFAFA",
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 12 }}>
              📅 Online Terminbuchung
            </div>

            <label style={{ display: "block", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={!!bookingSettings.booking_enabled}
                onChange={(e) =>
                  setBookingSettings({
                    ...bookingSettings,
                    booking_enabled: e.target.checked,
                  })
                }
              />{" "}
              Online Buchung aktivieren
            </label>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div>
                <label>Termin Dauer (Min)</label>
                <input
                  type="number"
                  value={bookingSettings.slot_duration_min || 60}
                  onChange={(e) =>
                    setBookingSettings({
                      ...bookingSettings,
                      slot_duration_min: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <label>Puffer (Min)</label>
                <input
                  type="number"
                  value={bookingSettings.buffer_min || 10}
                  onChange={(e) =>
                    setBookingSettings({
                      ...bookingSettings,
                      buffer_min: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <label>Mindestvorlaufzeit (Stunden)</label>
                <input
                  type="number"
                  min={0}
                  value={bookingSettings.min_booking_notice_hours || 24}
                  onChange={(e) =>
                    setBookingSettings({
                      ...bookingSettings,
                      min_booking_notice_hours: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                
  <label>Buchungsfenster (Tage im Voraus)</label>
  <input
    type="number"
    min={7}
    max={180}
    value={bookingSettings.booking_window_days || 90}
    onChange={(e) =>
      setBookingSettings({
        ...bookingSettings,
        booking_window_days: Number(e.target.value),
      })
    }
  />
</div>

              <div>
                <label>Zeitzone</label>
                <input
                  value={bookingSettings.time_zone || "Europe/Vienna"}
                  onChange={(e) =>
                    setBookingSettings({
                      ...bookingSettings,
                      time_zone: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Poise Kalender</label>
              <input
                value={
                  bookingSettings.selected_calendar_name || "Kein Kalender hinterlegt"
                }
                disabled
                style={{
                  width: "100%",
                  background: "#f7f7f7",
                  color: "#555",
                }}
              />
              <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                Dieser Kalender wird zentral von Poise verwaltet.
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
  <label>Standard Video-Call Link</label>
  <input
    type="url"
    value={bookingSettings.meeting_link || ""}
    onChange={(e) =>
      setBookingSettings({
        ...bookingSettings,
        meeting_link: e.target.value,
      })
    }
    placeholder="https://meet.google.com/..."
    style={{
      width: "100%",
    }}
  />
  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
    Dieser Link wird standardmäßig in der Terminbestätigung verwendet.
  </div>
</div>

            <button
              type="button"
              onClick={saveBookingSettings}
              disabled={bookingSaving}
              style={{ marginTop: 12 }}
            >
              {bookingSaving ? "Speichere..." : "💾 Speichern"}
            </button>
          </div>
           )}

        <div
          style={{
            marginBottom: 16,
            border: "1px solid #eee",
            borderRadius: 10,
            background: "#FAFAFA",
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            🎯 Themen-Gewichtung für Matching
          </div>

          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Hier kannst du festlegen, bei welchen Anliegen du stärker gematcht wirst.
          </div>

          <button
            type="button"
            onClick={() => setMatchingScoresModalOpen(true)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #ccc",
              background: "#fff",
              fontWeight: 600,
            }}
          >
            Themen-Gewichtung bearbeiten
          </button>
        </div>
      </>
    )}

    {role !== "therapist" && (
      <div style={{ color: "#666" }}>
        Einstellungen sind aktuell nur für Therapeut:innen sichtbar.
      </div>
    )}
  </section>
)}
{/* ================= ABRECHNUNG ================= */}
{filter === "abrechnung" && (
  <>
    <div style={{ marginBottom: 10 }}>
<h2 style={{ margin: 0 }}>
  {isAdmin ? "Gesamtabrechnung (Admin)" : "Meine Abrechnung"}
</h2>

      <div style={{ fontSize: 12, color: "#666" }}>
{isAdmin
  ? "Du siehst alle Therapeut:innen."
  : "Du siehst nur deine eigenen Sitzungen."}
      </div>
    </div>

 
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
  <label>Steuernummer</label>
  <input
    value={invoiceSettings.tax_number}
    onChange={(e) =>
      setInvoiceSettings({
        ...invoiceSettings,
        tax_number: e.target.value,
      })
    }
  />
</div>

<div>
  <label>UID Nummer</label>
  <input
    placeholder="z.B. ATU12345678"
    value={invoiceSettings.vat_number}
    onChange={(e) =>
      setInvoiceSettings({
        ...invoiceSettings,
        vat_number: e.target.value,
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
  ...invoiceSettings,
  therapist_id: myTeamMemberId,
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
      onClick={() => {
        if (selectedClientId === "alle") {
          alert("Bitte zuerst einen Klienten auswählen");
          return;
        }

        const clientRow = visibleBillingRows[0];
        const clientSessions = filteredBillingSessions.filter(
          (s) => String(s.anfrage_id) === String(selectedClientId)
        );

        exportSingleClientPDF(
          clientRow,
          clientSessions,
          invoiceSettings
        );
      }}
      disabled={!visibleBillingRows.length}
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

  {/* CLIENT AUSWAHL */}
<div style={{ marginBottom: 12 }}>
  <strong>Klient:in:</strong>{" "}
  <select
    value={selectedClientId}
    onChange={(e) => setSelectedClientId(e.target.value)}
  >
    <option value="alle">Alle</option>

    {billingByClient.map((c) => (
      <option key={c.anfrage_id} value={c.anfrage_id}>
        {c.klient}
      </option>
    ))}
  </select>
</div>
{/* TABELLE */}
{visibleBillingRows.length === 0 ? (
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
        <th align="left">Therapeut</th>
        <th>Sitzungen</th>
        <th align="right">Umsatz €</th>
        <th align="right">Provision €</th>
        <th></th>
      </tr>
    </thead>

    <tbody>
      {visibleBillingRows.map((r, i) => {
        const therapistName =
          teamData.find((t) => t.id === r.therapist_id)?.name || "–";

        return (
          <tr key={i}>
            <td>{r.klient}</td>
            <td>{therapistName}</td>
            <td align="center">{r.sessions}</td>
            <td align="right">{r.umsatz.toFixed(2)}</td>
            <td align="right">{r.provision.toFixed(2)}</td>
            <td align="right">
              <button
                onClick={() => {
 window.open(
  `/dashboard/rechnung/${r.anfrage_id}`,
  "_blank"
);
                }}
              >
                🧾 Rechnung öffnen
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
)}

</div>  {/* ABRECHNUNG EXPORT & ÜBERSICHT */}
</section>
</>
)}
{openMenuId && (
  <div
    onClick={() => setOpenMenuId(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.2)",
      zIndex: 9998,
    }}
  />
)}
      {/* KARTEN */}
{filter !== "abrechnung" &&
  filter !== "einstellungen" &&
  therapistFilteredRequests.map((r) => {
          const sessionList = sessionsByRequest[String(r.id)] || [];
const therapistId =
  r.assigned_therapist_id ||
  sessionList?.[0]?.therapist_id ||
  teamData.find((t) => t.name === r.wunschtherapeut)?.id ||
  null;

const calendarMode =
  getCalendarModeByTherapistId(therapistId);
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
    ...getCardStyleByFilter(filter),
    position: "relative",
  }}
>
<div
  style={{
    paddingRight: 54,
    maxWidth: "100%",
    boxSizing: "border-box",
  }}
>
  <strong
    style={{
      display: "block",
      fontSize:
        typeof window !== "undefined" && window.innerWidth < 768 ? 20 : 28,
      lineHeight: 1,
      fontWeight: 800,
      letterSpacing: -0.4,
      marginBottom: 8,
      textTransform: "uppercase",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
    }}
  >
    {safeText(r.vorname, "")} {safeText(r.nachname, "")}
  </strong>

  <div
    style={{
      fontSize:
        typeof window !== "undefined" && window.innerWidth < 768 ? 15 : 18,
      fontWeight: 500,
      marginBottom: 10,
      wordBreak: "break-word",
    }}
  >
    {STATUS_LABEL[r._status] || safeText(r._status)}
  </div>
</div>
  <div style={{ position: "absolute", top: 10, right: 10 }}>
<button
  onClick={() =>
    setOpenMenuId(openMenuId === r.id ? null : r.id)
  }
  style={{
    border: "none",
    background: (POISE_COLORS[filter] || POISE_COLORS.alle).base,
    color: "#fff",
    borderRadius: 12,
    width:
      typeof window !== "undefined" && window.innerWidth < 768 ? 34 : 40,
    height:
      typeof window !== "undefined" && window.innerWidth < 768 ? 34 : 40,
    cursor: "pointer",
    fontSize:
      typeof window !== "undefined" && window.innerWidth < 768 ? 18 : 20,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
  }}
>
  •••
</button>

{openMenuId === r.id && (
  <ActionMenu
    actions={getActionsForRequest(r, sessionList)}
    onAction={(action) => handleAction(action, r, sessionList, calendarMode)}
    color={POISE_COLORS[filter] || POISE_COLORS.alle}
  />
)}
</div>

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
<p
  style={{
    fontSize:
      typeof window !== "undefined" && window.innerWidth < 768 ? 14 : 16,
    lineHeight: 1.45,
    marginTop: 10,
    marginBottom: 0,
    color: "#222",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    maxWidth: "100%",
  }}
>
  {typeof r.anliegen === "string" ? r.anliegen : "–"}
</p>
            {/* 🕒 Terminwunsch des Klienten */}
{calendarMode === "proposal" && r.terminwunsch_text && (
  <div
    style={{
      marginTop: 6,
      padding: "6px 8px",
      background: "#FFF4E6",
      borderRadius: 8,
      fontSize: 13,
    }}
  >
    🕒 Wunschzeit: {r.terminwunsch_text}
  </div>
)}
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
      _status: r.status,
    });
    setEditTarif(r.honorar_klient || "");
    setMeetingLinkOverride(r.meeting_link_override || "");
    setNewSessions([{ date: "", duration: 60 }]);
  }}
>
  🔍 Details
</button>





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
{detailsModal.terminwunsch_text && (
  <p>
    <strong>Wunschzeiten des Klienten:</strong><br />
    {detailsModal.terminwunsch_text}
  </p>
)}
</section>
<div style={{ marginTop: 12, marginBottom: 12 }}>
  <strong>Persönlicher Video-Link</strong>
  <input
    type="url"
    value={meetingLinkOverride}
    onChange={(e) => setMeetingLinkOverride(e.target.value)}
    placeholder="Optional: persönlicher Link nur für diese Klient:in"
    style={{
      width: "100%",
      marginTop: 6,
    }}
  />
  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
    Wenn hier ein Link eingetragen ist, wird dieser statt des Standard-Links aus den Einstellungen verwendet.
  </div>

  <button
    type="button"
    style={{ marginTop: 8 }}
    onClick={async () => {
      const res = await fetch("/api/update-meeting-link-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anfrageId: detailsModal.id,
          meeting_link_override: meetingLinkOverride || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("UPDATE MEETING LINK OVERRIDE FAILED:", text);
        alert("❌ Persönlicher Link konnte nicht gespeichert werden");
        return;
      }

      setDetailsModal({
        ...detailsModal,
        meeting_link_override: meetingLinkOverride || null,
      });

      setRequests((prev) =>
        prev.map((x) =>
          x.id === detailsModal.id
            ? { ...x, meeting_link_override: meetingLinkOverride || null }
            : x
        )
      );

      alert("✅ Persönlicher Video-Link gespeichert");
    }}
  >
    💾 Persönlichen Link speichern
  </button>
</div>

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
<div style={{ marginTop: 12 }}>
  <label>
    <input
      type="checkbox"
      checked={detailsModal.invoice_with_vat ?? true}
      onChange={async (e) => {
        const value = e.target.checked;

        await fetch("/api/update-invoice-setting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anfrageId: detailsModal.id,
            invoice_with_vat: value,
          }),
        });

        setDetailsModal({
          ...detailsModal,
          invoice_with_vat: value,
        });
      }}
    />
    Rechnung inkl. Umsatzsteuer
  </label>
</div>
    
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
    therapist_id: myTeamMemberId,
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
<label>E-Mail</label>
<input
  type="email"
  value={bestandEmail}
  onChange={(e) => setBestandEmail(e.target.value)}
  style={{ width: "100%", marginBottom: 8 }}
/>

<label>Telefon</label>
<input
  value={bestandTelefon}
  onChange={(e) => setBestandTelefon(e.target.value)}
  style={{ width: "100%", marginBottom: 8 }}
/>

<label>Straße & Hausnummer</label>
<input
  value={bestandStrasse}
  onChange={(e) => setBestandStrasse(e.target.value)}
  style={{ width: "100%", marginBottom: 8 }}
/>

<label>PLZ & Ort</label>
<input
  value={bestandPlzOrt}
  onChange={(e) => setBestandPlzOrt(e.target.value)}
  style={{ width: "100%", marginBottom: 8 }}
/>

<label>Geburtsdatum</label>
<input
  type="date"
  value={bestandGeburtsdatum}
  onChange={(e) => setBestandGeburtsdatum(e.target.value)}
  style={{ width: "100%", marginBottom: 8 }}
/>

<label>Beschäftigungsgrad</label>
<select
  value={bestandBeschaeftigungsgrad}
  onChange={(e) => setBestandBeschaeftigungsgrad(e.target.value)}
  style={{ width: "100%", marginBottom: 12 }}
>
  <option value="">Bitte wählen…</option>
  <option value="berufstaetig">Berufstätig</option>
  <option value="ausbildung">In Ausbildung</option>
</select>
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
  email: bestandEmail,
  telefon: bestandTelefon,
  strasse_hausnr: bestandStrasse,
  plz_ort: bestandPlzOrt,
  geburtsdatum: bestandGeburtsdatum,
  beschaeftigungsgrad: bestandBeschaeftigungsgrad,
  wunschtherapeut: bestandTherapeut,
  therapist_id: myTeamMemberId,
}),
                });

                if (!res.ok) {
                  alert("Fehler beim Anlegen");
                  return;
                }

setCreateBestandOpen(false);
setBestandVorname("");
setBestandNachname("");
setBestandEmail("");
setBestandTelefon("");
setBestandStrasse("");
setBestandPlzOrt("");
setBestandGeburtsdatum("");
setBestandBeschaeftigungsgrad("");
setBestandTherapeut("");
location.reload();
              }}
            >
              ✔ Anlegen
            </button>
          </div>
        </Modal>
      )}

      {/* ================= PROPOSAL MODAL ================= */}
      {proposalModal && (
        <Modal onClose={() => setProposalModal(null)}>
          <h3>📩 Terminvorschläge senden</h3>

          <p>
            Klient: <strong>{proposalModal.vorname}</strong>
          </p>

          {proposalDates.map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <input
                type="datetime-local"
                value={p.date}
                onChange={(e) => {
                  const copy = [...proposalDates];
                  copy[i].date = e.target.value;
                  setProposalDates(copy);
                }}
              />
            </div>
          ))}

          <div style={{ marginTop: 12 }}>
            <button
              onClick={async () => {
                const valid = proposalDates.filter((d) => d.date);

                if (!valid.length) {
                  alert("Bitte mindestens einen Termin eingeben");
                  return;
                }

                const res = await fetch("/api/proposals/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    requestId: proposalModal.id,
                    therapist_id: myTeamMemberId,
                    proposals: valid,
                  }),
                });

                if (!res.ok) {
                  alert("Fehler beim Speichern");
                  return;
                }

                alert("✅ Vorschläge gespeichert");
                setProposalModal(null);
              }}
            >
              💾 Speichern
            </button>
          </div>
        </Modal>
      )}
        {matchingScoresModalOpen && (
        <Modal onClose={() => setMatchingScoresModalOpen(false)}>
          <h3>Themen-Gewichtung</h3>

          <p style={{ fontSize: 14, color: "#666" }}>
            0 = keine Relevanz, 5 = sehr starke Relevanz
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 16,
            }}
          >
            {MATCHING_THEMEN.map((item) => (
              <div
                key={item.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <label>{item.label}</label>

                <input
                  type="number"
                  min={0}
                  max={5}
                  step={1}
                  value={matchingScores[item.key] ?? 0}
                  onChange={(e) =>
                    setMatchingScores((prev) => ({
                      ...prev,
                      [item.key]: Number(e.target.value),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={() => setMatchingScoresModalOpen(false)}
            >
              Abbrechen
            </button>

            <button
              type="button"
              disabled={matchingScoresSaving}
              onClick={async () => {
                setMatchingScoresSaving(true);

                try {
                  const token = await getAccessToken();

                  const res = await fetch("/api/team-members/matching-scores", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      matching_scores: matchingScores,
                    }),
                  });

                  const json = await res.json();

                  if (!res.ok) {
                    console.error("MATCHING SCORES SAVE ERROR:", json);
                    alert("Fehler beim Speichern");
                    return;
                  }

                  setMatchingScores((prev) => ({
                    ...prev,
                    ...(json.matching_scores || {}),
                  }));

                  alert("✅ Themen-Gewichtung gespeichert");
                  setMatchingScoresModalOpen(false);
                } catch (err) {
                  console.error("MATCHING SCORES SAVE ERROR:", err);
                  alert("Fehler beim Speichern");
                } finally {
                  setMatchingScoresSaving(false);
                }
              }}
            >
              {matchingScoresSaving ? "Speichere..." : "💾 Speichern"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
