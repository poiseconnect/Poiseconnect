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

  // 🔵 Kopf rechts
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [servicePeriod, setServicePeriod] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  // 🔵 Kunde
  const [clientName, setClientName] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // 🔵 Text
  const [salutation, setSalutation] = useState("Sehr geehrte Damen und Herren,");
  const [introText, setIntroText] = useState(
    "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:"
  );
  const [description, setDescription] = useState("Psychologische Beratung");
  const [paymentTerms, setPaymentTerms] = useState(
    "Zahlbar innerhalb von 14 Tagen ohne Abzug."
  );
  const [closingText, setClosingText] = useState(
    "Vielen Dank für Ihr Vertrauen."
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: anfrage } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    setClient(anfrage);

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

    const resolvedTherapistId =
      anfrage?.assigned_therapist_id ||
      invoiceSessions?.[0]?.therapist_id;

    setTherapistId(resolvedTherapistId);

    if (resolvedTherapistId) {
      const { data: invoiceSettings } = await supabase
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", resolvedTherapistId)
        .single();

      setSettings(invoiceSettings || {});
    }

    setInvoiceNumber("RE-" + Date.now().toString().slice(-5));
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setServicePeriod(new Date().toLocaleDateString("de-AT"));
    setClientName(`${anfrage?.vorname} ${anfrage?.nachname}`);
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

  return (
    <div style={{ padding: 60, background: "#fff", maxWidth: 900, margin: "auto" }}>
      
      {/* 🔵 Kopf */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <strong>{settings.company_name}</strong><br />
          <div style={{ whiteSpace: "pre-line" }}>
            {settings.address}
          </div>
          UID: {settings.vat_number}<br />
          StNr: {settings.tax_number}
        </div>

        <div style={{ textAlign: "right" }}>
          Rechnungsnr: <input value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} /><br />
          Datum: <input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} /><br />
          Leistungszeitraum: <input value={servicePeriod} onChange={e=>setServicePeriod(e.target.value)} /><br />
          Kundennr: <input value={customerNumber} onChange={e=>setCustomerNumber(e.target.value)} /><br />
          Ansprechpartner: <input value={contactPerson} onChange={e=>setContactPerson(e.target.value)} />
        </div>
      </div>

      <hr style={{ margin: "40px 0" }} />

      {/* 🔵 Kunde */}
      <strong>Rechnung an:</strong><br />
      <input value={clientName} onChange={e=>setClientName(e.target.value)} /><br />
      <input value={clientStreet} onChange={e=>setClientStreet(e.target.value)} /><br />
      <input value={clientCity} onChange={e=>setClientCity(e.target.value)} /><br />
      <input value={clientEmail} onChange={e=>setClientEmail(e.target.value)} />

      <hr style={{ margin: "40px 0" }} />

      <textarea value={salutation} onChange={e=>setSalutation(e.target.value)} /><br /><br />
      <textarea value={introText} onChange={e=>setIntroText(e.target.value)} /><br /><br />

      {/* 🔵 Tabelle */}
      <table width="100%" border="1" cellPadding="6">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Beschreibung</th>
            <th>Menge</th>
            <th>Einzelpreis</th>
            <th>Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, index) => (
            <tr key={s.id}>
              <td>{index + 1}</td>
              <td>
                <input value={description} onChange={e=>setDescription(e.target.value)} />
              </td>
              <td>1</td>
              <td align="right">{Number(s.price).toFixed(2)} €</td>
              <td align="right">{Number(s.price).toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: "right", marginTop: 20 }}>
        Netto: {totalNet.toFixed(2)} €<br />
        USt {vatRate}%: {vatAmount.toFixed(2)} €<br />
        <strong>Gesamt: {totalGross.toFixed(2)} €</strong>
      </div>

      <hr style={{ margin: "40px 0" }} />

      <textarea value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} /><br /><br />
      <textarea value={closingText} onChange={e=>setClosingText(e.target.value)} />

    </div>
  );
}
