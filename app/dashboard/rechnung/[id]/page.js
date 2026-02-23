"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function RechnungPage({ params }) {
  const { id } = params;

  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      // 🔹 1. Alle Sessions wie im Billing-Tab laden
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/therapist/billing-sessions", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const billingData = await res.json();

      if (!res.ok) {
        console.error("Billing API Fehler:", billingData);
        setLoading(false);
        return;
      }

      const allSessions = billingData.data || [];

      // 🔹 2. Nur Sessions dieser Anfrage
      const invoiceSessions = allSessions.filter(
        (s) => String(s.anfrage_id) === String(id)
      );

      setSessions(invoiceSessions);

      // 🔹 3. Anfrage laden (Klientendaten)
      const { data: anfrage } = await supabase
        .from("anfragen")
        .select("*")
        .eq("id", id)
        .single();

      setClient(anfrage);

      // 🔹 4. Therapist ID ermitteln
      const therapistId =
        anfrage?.assigned_therapist_id ||
        invoiceSessions?.[0]?.therapist_id;

      if (therapistId) {
        const { data: invoiceSettings } = await supabase
          .from("therapist_invoice_settings")
          .select("*")
          .eq("therapist_id", therapistId)
          .single();

        setSettings(invoiceSettings || {});
      }

    } catch (err) {
      console.error("Rechnung Load Error:", err);
    }

    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Lade Rechnung…</div>;
  if (!client) return <div style={{ padding: 40 }}>Keine Daten</div>;

  const vatRate = Number(settings?.default_vat_rate || 0);

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
    <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 800,
          border: "1px solid #ddd",
          padding: 40,
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2>Rechnung</h2>

        {/* Therapeut */}
        <div style={{ marginBottom: 20 }}>
          <strong>{settings?.company_name || "—"}</strong><br />
          <div style={{ whiteSpace: "pre-line" }}>
            {settings?.address || ""}
          </div>
          {settings?.vat_number && <>UID: {settings.vat_number}<br /></>}
          {settings?.tax_number && <>Steuernr: {settings.tax_number}<br /></>}
        </div>

        <hr />

        {/* Klient */}
        <div style={{ marginTop: 20 }}>
          <strong>Rechnung an:</strong><br />
          {client.vorname} {client.nachname}<br />
          {client.strasse_hausnr}<br />
          {client.plz_ort}<br />
          {client.email}
        </div>

        <hr style={{ margin: "30px 0" }} />

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

        <div style={{ textAlign: "right", marginTop: 20 }}>
          <div>Netto: {totalNet.toFixed(2)} €</div>
          {vatRate > 0 && (
            <div>USt {vatRate}%: {vatAmount.toFixed(2)} €</div>
          )}
          <strong>Gesamt: {totalBrutto.toFixed(2)} €</strong>
        </div>

        <div style={{ marginTop: 40 }}>
          IBAN: {settings?.iban}<br />
          BIC: {settings?.bic}
        </div>
      </div>
    </div>
  );
}
