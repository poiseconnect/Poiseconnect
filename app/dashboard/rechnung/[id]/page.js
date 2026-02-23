"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";

/**
 * RechnungPage
 * - Datenquelle Sessions: /api/therapist/billing-sessions (so wie Abrechnungstab)
 * - Klient: aus anfragen
 * - Therapeut Settings: therapist_invoice_settings (read-only hier)
 * - Editierbar: Rechnungsmeta + Klientdaten + Texte + Leistungsbeschreibung + Leistungszeitraum + optional Kundennummer
 * - Nicht editierbar: Therapeutendaten (kommen aus Settings)
 * - Speichern: /api/invoices/save (Payload inkl. line_items)
 * - PDF Export: jsPDF + autotable
 */

export default function RechnungPage({ params }) {
  const { id } = params; // anfrage_id

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);

  // gespeicherte invoice id (falls API es liefert)
  const [invoiceId, setInvoiceId] = useState(null);

  // ========= Editierbare Felder (Vorlage) =========
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(""); // YYYY-MM-DD
  const [serviceFrom, setServiceFrom] = useState(""); // YYYY-MM-DD
  const [serviceTo, setServiceTo] = useState(""); // YYYY-MM-DD

  const [customerNumber, setCustomerNumber] = useState(""); // "Ihre Kundennummer"
  const [contactPerson, setContactPerson] = useState(""); // "Ihr Ansprechpartner"

  // Klient editierbar (für Rechnung!)
  const [billToName, setBillToName] = useState("");
  const [billToStreet, setBillToStreet] = useState("");
  const [billToZipCity, setBillToZipCity] = useState("");
  const [billToCountry, setBillToCountry] = useState("");
  const [billToEmail, setBillToEmail] = useState("");

  // Textblock wie Vorlage
  const [salutationLine1, setSalutationLine1] = useState("Sehr geehrte Damen und Herren,");
  const [salutationLine2, setSalutationLine2] = useState(""); // optional zweite Zeile, z.B. "liebe Sonja,"
  const [introText, setIntroText] = useState("Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:");
  const [paymentTerms, setPaymentTerms] = useState(
    "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ab Rechnungseingang ohne Abzüge."
  );
  const [closingText, setClosingText] = useState(
    "Bitte überweise den Rechnungsbetrag unter Angabe der Rechnungsnummer auf das unten angegebene Konto."
  );
  const [signatureLine, setSignatureLine] = useState(""); // z.B. "Sebastian Kickinger Poise by Linda Leinweber GmbH"

  // Leistung (Vorlage: 1 Zeile mit Menge = Sitzungen)
  const [serviceTitle, setServiceTitle] = useState("Psychologische Online Beratung");
  const [serviceSubTitle, setServiceSubTitle] = useState(""); // optional z.B. Therapeut:in / Thema
  const [unitLabel, setUnitLabel] = useState("Stk"); // Menge-Einheit
  const [overrideUnitPrice, setOverrideUnitPrice] = useState(""); // optional überschreiben
  const [datesTextOverride, setDatesTextOverride] = useState(""); // optional überschreiben

  // VAT handling
  const vatRate = useMemo(() => Number(settings?.default_vat_rate || 0), [settings]);

  // ======= Load =======
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    setLoading(true);

    // 1) Anfrage laden
    const { data: anfrage, error: anfrageErr } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    if (anfrageErr) {
      console.error("ANFRAGE LOAD ERROR:", anfrageErr);
      setClient(null);
      setSessions([]);
      setSettings(null);
      setLoading(false);
      return;
    }

    setClient(anfrage);

    // 2) Sessions über Billing API (genau wie Abrechnungstab)
    const {
      data: { session },
      error: sessAuthErr,
    } = await supabase.auth.getSession();

    if (sessAuthErr) {
      console.error("AUTH SESSION ERROR:", sessAuthErr);
    }

    let invoiceSessions = [];
    try {
      const r = await fetch("/api/therapist/billing-sessions", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      const json = await r.json();
      const allSessions = Array.isArray(json?.data) ? json.data : [];

      invoiceSessions = allSessions.filter((s) => String(s.anfrage_id) === String(id));
    } catch (e) {
      console.error("BILLING API ERROR:", e);
      invoiceSessions = [];
    }

    setSessions(invoiceSessions);

    // 3) therapist_id bestimmen (assigned_therapist_id ODER aus sessions)
    const therapistId = anfrage?.assigned_therapist_id || invoiceSessions?.[0]?.therapist_id || null;

    // 4) Settings laden
    if (therapistId) {
      const { data: invoiceSettings, error: invErr } = await supabase
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", therapistId)
        .single();

      if (invErr) {
        console.error("INVOICE SETTINGS LOAD ERROR:", invErr);
      }

      setSettings(invoiceSettings || { therapist_id: therapistId });
    } else {
      setSettings(null);
    }

    // 5) Defaults setzen (nur wenn noch leer)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayISO = `${yyyy}-${mm}-${dd}`;

    // Service period automatisch aus Sessions
    const sortedDates = [...invoiceSessions]
      .filter((s) => s?.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((s) => new Date(s.date));

    const fromISO =
      sortedDates.length > 0
        ? toISODate(sortedDates[0])
        : todayISO;

    const toISO =
      sortedDates.length > 0
        ? toISODate(sortedDates[sortedDates.length - 1])
        : todayISO;

    setInvoiceNumber((prev) => prev || `RE-${String(Date.now()).slice(-4)}`);
    setInvoiceDate((prev) => prev || todayISO);
    setServiceFrom((prev) => prev || fromISO);
    setServiceTo((prev) => prev || toISO);

    // Klientdaten (editierbar)
    const fullName = `${anfrage?.vorname || ""} ${anfrage?.nachname || ""}`.trim();
    setBillToName((prev) => prev || fullName || "—");
    setBillToStreet((prev) => prev || (anfrage?.strasse_hausnr || ""));
    setBillToZipCity((prev) => prev || (anfrage?.plz_ort || ""));
    setBillToCountry((prev) => prev || (anfrage?.land || "")); // falls es kein land gibt -> leer
    setBillToEmail((prev) => prev || (anfrage?.email || ""));

    // Ansprechpartner Default (kannst du überschreiben)
    setContactPerson((prev) => prev || (invoiceSettingsGuessContact(anfrage) || ""));
    // Kundennummer Default (kannst du überschreiben)
    setCustomerNumber((prev) => prev || (anfrage?.kunden_nr || ""));

    // Service title/subtitle default
    setServiceSubTitle((prev) => prev || "");

    // Unterschrift Default
    setSignatureLine((prev) => prev || "");

    setLoading(false);
  }

  // ======= Derived =======
  const qty = sessions.length;

  const unitPrice = useMemo(() => {
    // Default: wenn alle gleich → diesen Preis, sonst Durchschnitt (editierbar via override)
    if (!sessions.length) return 0;

    const prices = sessions.map((s) => Number(s.price || 0)).filter((n) => Number.isFinite(n));
    const unique = [...new Set(prices.map((p) => p.toFixed(2)))];

    if (overrideUnitPrice !== "" && Number.isFinite(Number(overrideUnitPrice))) {
      return Number(overrideUnitPrice);
    }

    if (unique.length === 1) return Number(prices[0] || 0);

    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / Math.max(1, prices.length);
    return avg;
  }, [sessions, overrideUnitPrice]);

  const grossTotal = useMemo(() => {
    // Wir behandeln Sessions-Preise als BRUTTO (wie du es vorher wolltest).
    const sum = sessions.reduce((acc, s) => acc + Number(s.price || 0), 0);
    return round2(sum);
  }, [sessions]);

  const netTotal = useMemo(() => {
    if (vatRate > 0) return round2(grossTotal / (1 + vatRate / 100));
    return round2(grossTotal);
  }, [grossTotal, vatRate]);

  const vatAmount = useMemo(() => round2(grossTotal - netTotal), [grossTotal, netTotal]);

  const datesText = useMemo(() => {
    if (datesTextOverride?.trim()) return datesTextOverride.trim();
    if (!sessions.length) return "";

    const dates = sessions
      .filter((s) => s?.date)
      .map((s) => new Date(s.date))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b)
      .map((d) => d.toLocaleDateString("de-AT"));

    // wie Vorlage: "Termine 6.12./12.12./18.12." -> wir machen "Termine: 06.12.2026 / 12.12.2026 ..."
    return dates.length ? `Termine: ${dates.join(" / ")}` : "";
  }, [sessions, datesTextOverride]);

  const lineItems = useMemo(() => {
    // Vorlage-Style: 1 Position = qty Sitzungen, unitPrice, total = grossTotal
    return [
      {
        pos: 1,
        title: serviceTitle,
        subtitle: serviceSubTitle,
        dates: datesText,
        qty,
        unitLabel,
        unitPrice: round2(unitPrice),
        total: round2(grossTotal),
      },
    ];
  }, [serviceTitle, serviceSubTitle, datesText, qty, unitLabel, unitPrice, grossTotal]);

  // ======= Actions =======
  async function saveInvoice() {
    if (!settings?.therapist_id) {
      alert("Therapeut:in nicht gefunden – bitte prüfen ob assigned_therapist_id gesetzt ist.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: invoiceId || null, // optional, falls upsert
        anfrage_id: String(id),
        therapist_id: String(settings.therapist_id),

        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        service_from: serviceFrom,
        service_to: serviceTo,

        customer_number: customerNumber,
        contact_person: contactPerson,

        client_name: billToName,
        client_street: billToStreet,
        client_city: billToZipCity,
        client_country: billToCountry,
        client_email: billToEmail,

        salutation_line1: salutationLine1,
        salutation_line2: salutationLine2,
        intro_text: introText,
        payment_terms: paymentTerms,
        closing_text: closingText,
        signature_line: signatureLine,

        vat_rate: vatRate,
        total_net: netTotal,
        vat_amount: vatAmount,
        total_gross: grossTotal,

        line_items: lineItems,
        session_ids: sessions.map((s) => s.id).filter(Boolean),
      };

      const res = await fetch("/api/invoices/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("INVOICE SAVE ERROR:", result);
        alert("Fehler beim Speichern (siehe Console).");
        return;
      }

      if (result?.data?.id) setInvoiceId(result.data.id);
      alert("✅ Rechnung gespeichert");
    } finally {
      setSaving(false);
    }
  }

  async function exportPDF() {
    setPdfBusy(true);
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 15;

      // Logo (optional) - wenn logo_url existiert und als DataURL funktioniert
      // (Wenn es eine normale URL ist, muss man es vorher als base64 laden. Wir lassen es optional weg.)
      // doc.add
