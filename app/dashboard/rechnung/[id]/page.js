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
    const { data: anfrage } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    const { data: sess } = await supabase
      .from("sessions")
      .select("*")
      .eq("anfrage_id", id);

    const { data: userData } = await supabase.auth.getUser();

    const res = await fetch("/api/invoice-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_email: userData.user.email,
      }),
    });

    const invoice = await res.json();

    setClient(anfrage);
    setSessions(sess || []);
    setSettings(invoice.settings || {});
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Lade Rechnung…</div>;
  if (!client) return <div>Keine Daten</div>;

  const vatRate = Number(settings.default_vat_rate || 0);

  const totalNet = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const vatAmount = vatRate > 0 ? totalNet * (vatRate / 100) : 0;
  const totalGross = totalNet + vatAmount;

  return (
    <div style={{ padding: 40, display: "flex", gap: 40 }}>
      
      {/* ================= VORSCHAU ================= */}
      <div
        style={{
          flex: 1,
          border: "1px solid #ddd",
          padding: 30,
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2>Rechnung</h2>

        {/* THERAPEUT */}
        <div style={{ marginBottom: 20 }}>
          <strong>{settings.company_name}</strong><br />
          {settings.address}<br />
          {settings.vat_number && <>UID: {settings.vat_number}<br /></>}
          {settings.tax_number && <>Steuernr: {settings.tax_number}<br /></>}
        </div>

        <hr />

        {/* KLIENT */}
        <div style={{ marginTop: 20 }}>
          <strong>Rechnung an:</strong><br />
          {client.vorname} {client.nachname}<br />
          {client.strasse_hausnr}<br />
          {client.plz_ort}<br />
          {client.email && <>{client.email}<br /></>}
          {client.steuer_nr && <>Steuernr: {client.steuer_nr}</>}
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

        <hr style={{ margin: "30px 0" }} />

        <div style={{ textAlign: "right" }}>
          <div>Netto: {totalNet.toFixed(2)} €</div>
          {vatRate > 0 && (
            <div>
              USt {vatRate}%: {vatAmount.toFixed(2)} €
            </div>
          )}
          <strong>
            Gesamt: {totalGross.toFixed(2)} €
          </strong>
        </div>

        <div style={{ marginTop: 40, fontSize: 12 }}>
          IBAN: {settings.iban}<br />
          BIC: {settings.bic}
        </div>

        <button
          style={{ marginTop: 30 }}
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

  doc.setFontSize(10);
  doc.text(settings.company_name || "", 14, 15);
  doc.text(settings.address || "", 14, 20);

  doc.text(
    `Rechnung an ${client.vorname} ${client.nachname}`,
    14,
    40
  );

  const totalNet = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const vatAmount =
    vatRate > 0 ? totalNet * (vatRate / 100) : 0;

  const totalGross = totalNet + vatAmount;

  doc.autoTable({
    startY: 50,
    head: [["Datum", "Preis"]],
    body: sessions.map((s) => [
      new Date(s.date).toLocaleDateString("de-AT"),
      Number(s.price).toFixed(2),
    ]),
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  doc.text(`Netto: ${totalNet.toFixed(2)} €`, 140, finalY);

  if (vatRate > 0) {
    doc.text(
      `USt ${vatRate}%: ${vatAmount.toFixed(2)} €`,
      140,
      finalY + 6
    );
  }

  doc.text(
    `Gesamt: ${totalGross.toFixed(2)} €`,
    140,
    finalY + 12
  );

  doc.save(
    `Rechnung_${client.vorname}_${client.nachname}.pdf`
  );
}
