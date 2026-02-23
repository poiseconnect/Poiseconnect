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
  <div style={{ background: "#f3f3f3", minHeight: "100vh", padding: "60px 0" }}>

    {/* ================= TOOLBAR ================= */}
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

    {/* ================= RECHNUNGSBLATT ================= */}
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

      {/* ===== HEADER ===== */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {settings.company_name}
          </div>
          <div style={{ whiteSpace: "pre-line", marginTop: 6, fontSize: 14 }}>
            {settings.address}
          </div>
          <div style={{ fontSize: 13, marginTop: 10, color: "#666" }}>
            UID: {settings.vat_number}<br />
            StNr: {settings.tax_number}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: 1 }}>
            RECHNUNG
          </div>

          <div style={{ marginTop: 20, fontSize: 14 }}>
            <div>
              <strong>Nr:</strong>{" "}
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                style={{ border: "none", textAlign: "right", fontSize: 14 }}
              />
            </div>

            <div>
              <strong>Datum:</strong>{" "}
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={{ border: "none", textAlign: "right", fontSize: 14 }}
              />
            </div>

            <div>
              <strong>Leistungszeitraum:</strong>{" "}
              <input
                value={servicePeriod}
                onChange={(e) => setServicePeriod(e.target.value)}
                style={{ border: "none", textAlign: "right", fontSize: 14 }}
              />
            </div>
          </div>
        </div>
      </div>

      <hr style={{ margin: "60px 0", borderColor: "#eee" }} />

      {/* ===== KLIENT ===== */}
      <div style={{ marginBottom: 60 }}>
        <div style={{ fontSize: 13, color: "#777", marginBottom: 8 }}>
          Rechnung an
        </div>

        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          style={{ border: "none", fontWeight: 600, fontSize: 15 }}
        /><br />

        <input
          value={clientStreet}
          onChange={(e) => setClientStreet(e.target.value)}
          style={{ border: "none", fontSize: 14 }}
        /><br />

        <input
          value={clientCity}
          onChange={(e) => setClientCity(e.target.value)}
          style={{ border: "none", fontSize: 14 }}
        /><br />

        <input
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          style={{ border: "none", fontSize: 14, color: "#666" }}
        />
      </div>

      {/* ===== TEXT ===== */}
      <div style={{ marginBottom: 40 }}>
        <textarea
          value={salutation}
          onChange={(e) => setSalutation(e.target.value)}
          style={{ width: "100%", border: "none", resize: "none", fontSize: 14 }}
        />
      </div>

      <div style={{ marginBottom: 40 }}>
        <textarea
          value={introText}
          onChange={(e) => setIntroText(e.target.value)}
          style={{ width: "100%", border: "none", resize: "none", fontSize: 14 }}
        />
      </div>

      {/* ===== TABELLE ===== */}
      <table width="100%" style={{ borderCollapse: "collapse", fontSize: 14 }}>
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
            <tr key={s.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
              <td>{index + 1}</td>
              <td>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ border: "none", width: "100%" }}
                />
              </td>
              <td align="right">{Number(s.price).toFixed(2)} €</td>
              <td align="right">{Number(s.price).toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== SUMMENBLOCK ===== */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 50 }}>
        <div style={{ width: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Zwischensumme</span>
            <span>{totalNet.toFixed(2)} €</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>USt {vatRate}%</span>
            <span>{vatAmount.toFixed(2)} €</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 600,
              marginTop: 10,
              fontSize: 16
            }}
          >
            <span>Gesamtbetrag</span>
            <span>{totalGross.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      <hr style={{ margin: "60px 0", borderColor: "#eee" }} />

      {/* ===== FOOTER ===== */}
      <div style={{ fontSize: 13, color: "#555" }}>
        <textarea
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          style={{ width: "100%", border: "none", resize: "none" }}
        />
        <br /><br />
        <textarea
          value={closingText}
          onChange={(e) => setClosingText(e.target.value)}
          style={{ width: "100%", border: "none", resize: "none" }}
        />
        <br /><br />
        IBAN: {settings.iban}<br />
        BIC: {settings.bic}
      </div>
    </div>
  </div>
);
}
