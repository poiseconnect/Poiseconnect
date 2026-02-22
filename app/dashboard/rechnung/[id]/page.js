"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function RechnungPage({ params }) {
  const { id } = params;

  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // 1️⃣ Anfrage laden
    const { data: anfrage } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    // 2️⃣ Sessions laden
    const { data: sess } = await supabase
      .from("sessions")
      .select("*")
      .eq("anfrage_id", Number(id));

    const sessionsSafe = sess || [];

    // 3️⃣ Therapist ID aus Sessions holen
    const therapistId = sessionsSafe?.[0]?.therapist_id;

    let invoiceSettings = {};

    if (therapistId) {
      const { data: invoice } = await supabase
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", therapistId)
        .single();

      invoiceSettings = invoice || {};
    }

    setClient(anfrage);
    setSessions(sessionsSafe);
    setSettings(invoiceSettings);
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Lade Rechnung…</div>;
  if (!client) return <div style={{ padding: 40 }}>Keine Daten</div>;

  const vatRate = Number(settings?.default_vat_rate || 0);

  // 🔥 Preise in DB sind BRUTTO
  const totalBrutto = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const totalNet =
    vatRate > 0 ? totalBrutto / (1 + vatRate / 100) : totalBrutto;

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
        <h2 style={{ marginBottom: 30 }}>Rechnung</h2>

        {/* ================= THERAPEUT ================= */}
        <div style={{ marginBottom: 30 }}>
          <strong>{settings?.company_name || "—"}</strong><br />
          {settings?.address || "—"}<br />
          {settings?.vat_number && <>UID: {settings.vat_number}<br /></>}
          {settings?.tax_number && <>Steuernr: {settings.tax_number}<br /></>}
        </div>

        <hr />

        {/* ================= KLIENT ================= */}
        <div style={{ marginTop: 30 }}>
          <strong>Rechnung an:</strong><br />
          {client.vorname} {client.nachname}<br />
          {client.strasse_hausnr || ""}<br />
          {client.plz_ort || ""}<br />
          {client.email && <>{client.email}<br /></>}
          {client.steuer_nr && <>Steuernr: {client.steuer_nr}</>}
        </div>

        <hr style={{ margin: "40px 0" }} />

        {/* ================= TABELLE ================= */}
        <table width="100%" style={{ marginBottom: 30 }}>
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

        {/* ================= SUMMEN ================= */}
        <div style={{ textAlign: "right", marginTop: 20 }}>
          <div>Netto: {totalNet.toFixed(2)} €</div>
          {vatRate > 0 && (
            <div>
              USt {vatRate}%: {vatAmount.toFixed(2)} €
            </div>
          )}
          <strong>
            Gesamt: {totalBrutto.toFixed(2)} €
          </strong>
        </div>

        {/* ================= ZAHLUNGSINFOS ================= */}
        <div style={{ marginTop: 50, fontSize: 14 }}>
          IBAN: {settings?.iban || "—"}<br />
          BIC: {settings?.bic || "—"}
        </div>

        <button
          style={{ marginTop: 40 }}
          onClick={() =>
            generatePDF(
              client,
              sessions,
              settings,
              vatRate
            )
          }
        >
          PDF generieren
        </button>
      </div>
    </div>
  );
}

function generatePDF(client, sessions, settings, vatRate) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(10);
  doc.text(settings?.company_name || "", 14, 15);
  doc.text(settings?.address || "", 14, 20);

  doc.setFontSize(12);
  doc.text(
    `Rechnung an ${client.vorname} ${client.nachname}`,
    14,
    40
  );

  const totalBrutto = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const totalNet =
    vatRate > 0 ? totalBrutto / (1 + vatRate / 100) : totalBrutto;

  const vatAmount = totalBrutto - totalNet;

  doc.autoTable({
    startY: 50,
    head: [["Datum", "Preis"]],
    body: sessions.map((s) => [
      new Date(s.date).toLocaleDateString("de-AT"),
      Number(s.price).toFixed(2) + " €",
    ]),
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  doc.text(`Netto: ${totalNet.toFixed(2)} €`, pageWidth - 70, finalY);

  if (vatRate > 0) {
    doc.text(
      `USt ${vatRate}%: ${vatAmount.toFixed(2)} €`,
      pageWidth - 70,
      finalY + 6
    );
  }

  doc.text(
    `Gesamt: ${totalBrutto.toFixed(2)} €`,
    pageWidth - 70,
    finalY + 12
  );

  doc.save(
    `Rechnung_${client.vorname}_${client.nachname}.pdf`
  );
}
