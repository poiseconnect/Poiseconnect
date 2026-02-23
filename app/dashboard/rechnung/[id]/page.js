"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function RechnungPage({ params }) {
  const { id } = params;

  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [introText, setIntroText] = useState(
    "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:"
  );
  const [closingText, setClosingText] = useState(
    "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ohne Abzüge."
  );

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

    setClient(anfrage);

    // 🔹 Billing API (stabile Quelle!)
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

        {/* THERAPEUT (NICHT EDITIERBAR) */}
        <div style={{ marginBottom: 20 }}>
          <strong>{settings.company_name}</strong><br />
          <div style={{ whiteSpace: "pre-line" }}>
            {settings.address}
          </div>
          UID: {settings.vat_number}<br />
          StNr: {settings.tax_number}
        </div>

        <hr style={{ margin: "40px 0" }} />

        {/* KLIENT */}
        <strong>Rechnung an:</strong><br />
        {client.vorname} {client.nachname}<br />
        {client.strasse_hausnr}<br />
        {client.plz_ort}<br />
        {client.email}

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
