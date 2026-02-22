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

  // optional: damit du siehst, was passiert
  const [debug, setDebug] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);

    // 1) Anfrage laden
    const { data: anfrage, error: anfrageErr } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    // 2) Sessions laden (WICHTIG: UUID NICHT Number()!)
    const { data: sess, error: sessErr } = await supabase
      .from("sessions")
      .select("*")
      .eq("anfrage_id", id)
      .order("date", { ascending: true });

    const sessionsSafe = Array.isArray(sess) ? sess : [];

    // 3) therapist_id aus Sessions holen
    const therapistId = sessionsSafe?.[0]?.therapist_id || null;

    // 4) invoice settings holen
    let invoiceSettings = {};
    let invErr = null;

    if (therapistId) {
      const { data: invoice, error } = await supabase
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", therapistId)
        .single();

      invErr = error || null;
      invoiceSettings = invoice || {};
    }

    setClient(anfrage || null);
    setSessions(sessionsSafe);
    setSettings(invoiceSettings || {});
    setDebug({
      anfrageErr: anfrageErr?.message || null,
      sessErr: sessErr?.message || null,
      therapistId,
      invErr: invErr?.message || null,
      sessionsCount: sessionsSafe.length,
    });

    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Lade Rechnung…</div>;
  if (!client) return <div style={{ padding: 40 }}>Keine Daten</div>;

  const vatRate = Number(settings?.default_vat_rate || 0);

  // Preise in DB sind BRUTTO
  const totalBrutto = sessions.reduce((sum, s) => sum + Number(s.price || 0), 0);

  const totalNet = vatRate > 0 ? totalBrutto / (1 + vatRate / 100) : totalBrutto;
  const vatAmount = totalBrutto - totalNet;

  return (
    <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 820,
          border: "1px solid #ddd",
          padding: 40,
          borderRadius: 12,
          background: "#fff",
        }}
      >
        {/* DEBUG (kannst du später löschen) */}
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            background: "#f7f7f7",
            border: "1px solid #eee",
            borderRadius: 10,
            fontSize: 12,
            color: "#444",
          }}
        >
          <strong>Debug:</strong>{" "}
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(debug, null, 2)}
          </pre>
        </div>

        <h2 style={{ marginBottom: 30 }}>Rechnung</h2>

        {/* ================= THERAPEUT ================= */}
        <div style={{ marginBottom: 30 }}>
          <strong>{settings?.company_name || "—"}</strong>
          <br />
          <div style={{ whiteSpace: "pre-line" }}>{settings?.address || "—"}</div>

          {settings?.vat_number && (
            <>
              UID: {settings.vat_number}
              <br />
            </>
          )}

          {settings?.tax_number && (
            <>
              Steuernr: {settings.tax_number}
              <br />
            </>
          )}
        </div>

        <hr />

        {/* ================= KLIENT ================= */}
        <div style={{ marginTop: 30 }}>
          <strong>Rechnung an:</strong>
          <br />
          {client.vorname} {client.nachname}
          <br />
          {client.strasse_hausnr || ""}
          <br />
          {client.plz_ort || ""}
          <br />
          {client.email && (
            <>
              {client.email}
              <br />
            </>
          )}
          {client.steuer_nr && <>Steuernr: {client.steuer_nr}</>}
        </div>

        <hr style={{ margin: "40px 0" }} />

        {/* ================= TABELLE ================= */}
        {sessions.length === 0 ? (
          <div style={{ color: "#777" }}>Keine Sitzungen gefunden (sessions leer).</div>
        ) : (
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
                  <td>{new Date(s.date).toLocaleDateString("de-AT")}</td>
                  <td align="right">{Number(s.price || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <hr />

        {/* ================= SUMMEN ================= */}
        <div style={{ textAlign: "right", marginTop: 20 }}>
          <div>Netto: {totalNet.toFixed(2)} €</div>
          {vatRate > 0 && <div>USt {vatRate}%: {vatAmount.toFixed(2)} €</div>}
          <strong>Gesamt: {totalBrutto.toFixed(2)} €</strong>
        </div>

        {/* ================= ZAHLUNGSINFOS ================= */}
        <div style={{ marginTop: 50, fontSize: 14 }}>
          IBAN: {settings?.iban || "—"}
          <br />
          BIC: {settings?.bic || "—"}
        </div>

        <button
          style={{ marginTop: 40 }}
          onClick={() => generatePDF(client, sessions, settings, vatRate)}
          disabled={sessions.length === 0}
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
  const today = new Date();

  doc.setFontSize(10);
  doc.text(settings?.company_name || "", 14, 15);

  if (settings?.address) {
    const lines = String(settings.address).split("\n");
    let y = 20;
    lines.forEach((line) => {
      doc.text(line, 14, y);
      y += 5;
    });
  }

  let infoY = 20 + (settings?.address ? String(settings.address).split("\n").length * 5 : 0);
  infoY = Math.max(infoY, 25);

  if (settings?.vat_number) {
    doc.text(`UID: ${settings.vat_number}`, 14, infoY);
    infoY += 5;
  }
  if (settings?.tax_number) {
    doc.text(`Steuernr: ${settings.tax_number}`, 14, infoY);
    infoY += 5;
  }

  doc.setFontSize(12);
  doc.text("Rechnung", pageWidth - 60, 20);
  doc.setFontSize(10);
  doc.text(`Rechnungsdatum: ${today.toLocaleDateString("de-AT")}`, pageWidth - 60, 26);

  doc.setFontSize(11);
  doc.text("Rechnung an:", 14, 55);
  doc.text(`${client.vorname || ""} ${client.nachname || ""}`.trim(), 14, 61);
  if (client.strasse_hausnr) doc.text(String(client.strasse_hausnr), 14, 67);
  if (client.plz_ort) doc.text(String(client.plz_ort), 14, 73);
  if (client.email) doc.text(String(client.email), 14, 79);

  const totalBrutto = sessions.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const totalNet = vatRate > 0 ? totalBrutto / (1 + vatRate / 100) : totalBrutto;
  const vatAmount = totalBrutto - totalNet;

  doc.autoTable({
    startY: 90,
    head: [["Datum", "Preis"]],
    body: sessions.map((s) => [
      new Date(s.date).toLocaleDateString("de-AT"),
      `${Number(s.price || 0).toFixed(2)} €`,
    ]),
    styles: { fontSize: 10 },
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  doc.text(`Netto: ${totalNet.toFixed(2)} €`, pageWidth - 70, finalY);
  if (vatRate > 0) {
    doc.text(`USt ${vatRate}%: ${vatAmount.toFixed(2)} €`, pageWidth - 70, finalY + 6);
  }
  doc.text(`Gesamt: ${totalBrutto.toFixed(2)} €`, pageWidth - 70, finalY + 12);

  doc.setFontSize(9);
  doc.text(`IBAN: ${settings?.iban || "-"}`, 14, 285);
  doc.text(`BIC: ${settings?.bic || "-"}`, 14, 290);

  doc.save(`Rechnung_${client.vorname || "Klient"}_${client.nachname || ""}.pdf`);
}
