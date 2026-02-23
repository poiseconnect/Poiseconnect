"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function RechnungPage({ params }) {
  const { id } = params;

  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [therapistId, setTherapistId] = useState(null);

  const [invoiceId, setInvoiceId] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [introText, setIntroText] = useState(
    "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:"
  );
  const [closingText, setClosingText] = useState(
    "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ohne Abzüge."
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // 🔹 Anfrage laden
    const { data: anfrage } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    if (!anfrage) {
      setLoading(false);
      return;
    }

    setClient(anfrage);

    // 🔹 Billing API laden (stabil!)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/therapist/billing-sessions", {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    const billingData = await res.json();
    const allSessions = billingData.data || [];

    const invoiceSessions = allSessions.filter(
      (s) => String(s.anfrage_id) === String(id)
    );

    setSessions(invoiceSessions);

    // 🔹 Therapist ID ermitteln
    const resolvedTherapistId =
      anfrage?.assigned_therapist_id ||
      invoiceSessions?.[0]?.therapist_id;

    setTherapistId(resolvedTherapistId);

    // 🔹 Therapist Invoice Settings laden
    if (resolvedTherapistId) {
      const { data: invoiceSettings } = await supabase
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", resolvedTherapistId)
        .single();

      setSettings(invoiceSettings || {});
    }

    // 🔹 Prüfen ob Rechnung existiert
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("anfrage_id", id)
      .maybeSingle();

    if (existingInvoice) {
      setInvoiceId(existingInvoice.id);
      setInvoiceNumber(existingInvoice.invoice_number);
      setInvoiceDate(existingInvoice.invoice_date);
      setClientName(existingInvoice.client_name);
      setClientStreet(existingInvoice.client_street);
      setClientCity(existingInvoice.client_city);
      setClientEmail(existingInvoice.client_email);
      setIntroText(existingInvoice.intro_text || "");
      setClosingText(existingInvoice.payment_terms || "");
    } else {
      // Neue Rechnung vorbereiten
      setInvoiceNumber("RE-" + Date.now().toString().slice(-5));
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setClientName(`${anfrage.vorname} ${anfrage.nachname}`);
      setClientStreet(anfrage.strasse_hausnr || "");
      setClientCity(anfrage.plz_ort || "");
      setClientEmail(anfrage.email || "");
    }

    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Lade Rechnung…</div>;
  if (!client || !settings)
    return <div style={{ padding: 40 }}>Keine Daten</div>;

  const vatRate = Number(settings.default_vat_rate || 0);

  const totalBrutto = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const totalNet =
    vatRate > 0
      ? totalBrutto / (1 + vatRate / 100)
      : totalBrutto;

  const vatAmount = totalBrutto - totalNet;

  async function saveInvoice() {
    const invoicePayload = {
      id: invoiceId,
      anfrage_id: id,
      therapist_id: therapistId,

      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,

      client_name: clientName,
      client_street: clientStreet,
      client_city: clientCity,
      client_email: clientEmail,

      intro_text: introText,
      payment_terms: closingText,

      total_net: totalNet,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_gross: totalBrutto
    };

    const res = await fetch("/api/invoices/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoicePayload),
    });

    const result = await res.json();

    if (!res.ok) {
      alert("Fehler beim Speichern");
      console.log(result);
      return;
    }

    setInvoiceId(result.data.id);

    alert("Rechnung gespeichert");
  }

  return (
    <div style={{ display: "flex", padding: 40, gap: 40 }}>

      {/* ================= EDIT PANEL ================= */}
      <div style={{ width: 400 }}>
        <h3>Rechnungsdaten</h3>

        <label>Rechnungsnummer</label>
        <input
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />

        <label>Rechnungsdatum</label>
        <input
          type="date"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
        />

        <hr />

        <label>Kundenname</label>
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />

        <label>Straße</label>
        <input
          value={clientStreet}
          onChange={(e) => setClientStreet(e.target.value)}
        />

        <label>PLZ / Ort</label>
        <input
          value={clientCity}
          onChange={(e) => setClientCity(e.target.value)}
        />

        <label>E-Mail</label>
        <input
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
        />

        <hr />

        <label>Einleitung</label>
        <textarea
          value={introText}
          onChange={(e) => setIntroText(e.target.value)}
        />

        <label>Zahlungshinweis</label>
        <textarea
          value={closingText}
          onChange={(e) => setClosingText(e.target.value)}
        />

        <button
          onClick={saveInvoice}
          style={{ marginTop: 20 }}
        >
          Rechnung speichern
        </button>
      </div>

      {/* ================= VORSCHAU ================= */}
      <div
        style={{
          width: 800,
          background: "#fff",
          padding: 60,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h1>Rechnung</h1>

        {/* Therapeut (fix) */}
        <div style={{ marginBottom: 20 }}>
          <strong>{settings.company_name}</strong><br />
          <div style={{ whiteSpace: "pre-line" }}>
            {settings.address}
          </div>
          UID: {settings.vat_number}<br />
          StNr: {settings.tax_number}
        </div>

        <hr style={{ margin: "40px 0" }} />

        {/* Kunde */}
        <strong>Rechnung an:</strong><br />
        {clientName}<br />
        {clientStreet}<br />
        {clientCity}<br />
        {clientEmail}

        <hr style={{ margin: "40px 0" }} />

        <p>{introText}</p>

        <table width="100%">
          <thead>
            <tr>
              <th align="left">Datum</th>
              <th align="right">Preis €</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  {new Date(s.date).toLocaleDateString("de-AT")}
                </td>
                <td align="right">
                  {Number(s.price).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr />

        <div style={{ textAlign: "right" }}>
          Netto: {totalNet.toFixed(2)} €<br />
          {vatRate > 0 && (
            <>USt {vatRate}%: {vatAmount.toFixed(2)} €<br /></>
          )}
          <strong>Gesamt: {totalBrutto.toFixed(2)} €</strong>
        </div>

        <p style={{ marginTop: 40 }}>{closingText}</p>
      </div>
    </div>
  );
}
