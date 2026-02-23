"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function RechnungPage({ params }) {
  const { id } = params;

  const [loading, setLoading] = useState(true);

  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [servicePeriod, setServicePeriod] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [salutation, setSalutation] = useState("Sehr geehrte Damen und Herren,");
  const [introText, setIntroText] = useState(
    "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:"
  );
  const [paymentTerms, setPaymentTerms] = useState(
    "Zahlbar innerhalb von 14 Tagen ohne Abzug."
  );
  const [closingText, setClosingText] = useState(
    "Vielen Dank für Ihr Vertrauen."
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // Anfrage laden
    const { data: anfrage } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    setClient(anfrage);

    // Billing API nutzen (stabilste Quelle)
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

    const therapistId =
      anfrage?.assigned_therapist_id ||
      invoiceSessions?.[0]?.therapist_id;

    if (therapistId) {
      const { data: invoiceSettings } = await supabase
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", therapistId)
        .single();

      setSettings(invoiceSettings);
    }

    setInvoiceNumber("RE-" + Date.now().toString().slice(-5));
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setServicePeriod(new Date().toLocaleDateString("de-AT"));

    setClientName(`${anfrage?.vorname || ""} ${anfrage?.nachname || ""}`);
    setClientStreet(anfrage?.strasse_hausnr || "");
    setClientCity(anfrage?.plz_ort || "");
    setClientEmail(anfrage?.email || "");

    setLoading(false);
  }

  if (loading || !settings) return <div style={{ padding: 40 }}>Lade…</div>;

  const vatRate = Number(settings.default_vat_rate || 0);

  const totalNet = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const vatAmount = vatRate > 0 ? totalNet * (vatRate / 100) : 0;
  const totalGross = totalNet + vatAmount;

  async function saveInvoice() {
    const payload = {
      anfrage_id: id,
      therapist_id: settings?.therapist_id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      service_period: servicePeriod,
      client_name: clientName,
      client_street: clientStreet,
      client_city: clientCity,
      client_email: clientEmail,
      intro_text: introText,
      payment_terms: paymentTerms,
      closing_text: closingText,
      total_net: totalNet,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_gross: totalGross,
    };

    const res = await fetch("/api/invoices/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Fehler beim Speichern");
      return;
    }

    alert("Rechnung gespeichert");
  }

  return (
    <div style={{ background: "#f3f3f3", minHeight: "100vh", padding: "60px 0" }}>

      {/* BUTTON */}
      <div style={{ maxWidth: 900, margin: "0 auto 30px auto", textAlign: "right" }}>
        <button
          onClick={saveInvoice}
          style={{
            background: "#000",
            color: "#fff",
            padding: "12px 24px",
            border: "none",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          Rechnung speichern
        </button>
      </div>

      {/* RECHNUNG */}
      <div
        style={{
          background: "#fff",
          maxWidth: 900,
          margin: "0 auto",
          padding: 80,
          fontFamily: "Helvetica, Arial, sans-serif",
          color: "#111"
        }}
      >

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {settings.company_name}
            </div>
            <div style={{ whiteSpace: "pre-line", marginTop: 6 }}>
              {settings.address}
            </div>
            <div style={{ fontSize: 13, marginTop: 10, color: "#666" }}>
              UID: {settings.vat_number}<br />
              StNr: {settings.tax_number}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 34, fontWeight: 300 }}>
              RECHNUNG
            </div>
            <div style={{ marginTop: 20 }}>
              Nr: <input value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} /><br />
              Datum: <input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} /><br />
              Leistungszeitraum: <input value={servicePeriod} onChange={e=>setServicePeriod(e.target.value)} />
            </div>
          </div>
        </div>

        <hr style={{ margin: "60px 0" }} />

        {/* CLIENT */}
        <strong>Rechnung an:</strong><br />
        <input value={clientName} onChange={e=>setClientName(e.target.value)} /><br />
        <input value={clientStreet} onChange={e=>setClientStreet(e.target.value)} /><br />
        <input value={clientCity} onChange={e=>setClientCity(e.target.value)} /><br />
        <input value={clientEmail} onChange={e=>setClientEmail(e.target.value)} />

        <hr style={{ margin: "60px 0" }} />

        <p>{salutation}</p>
        <p>{introText}</p>

        <table width="100%" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th align="left">Pos.</th>
              <th align="left">Leistung</th>
              <th align="right">Einzelpreis</th>
              <th align="right">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, index) => (
              <tr key={s.id}>
                <td>{index + 1}</td>
                <td>Psychologische Beratung</td>
                <td align="right">{Number(s.price).toFixed(2)} €</td>
                <td align="right">{Number(s.price).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 40 }}>
          <div style={{ width: 300 }}>
            Netto: {totalNet.toFixed(2)} €<br />
            USt {vatRate}%: {vatAmount.toFixed(2)} €<br />
            <strong>Gesamt: {totalGross.toFixed(2)} €</strong>
          </div>
        </div>

        <hr style={{ margin: "60px 0" }} />

        <p>{paymentTerms}</p>
        <p>{closingText}</p>

        IBAN: {settings.iban}<br />
        BIC: {settings.bic}

      </div>
    </div>
  );
}
