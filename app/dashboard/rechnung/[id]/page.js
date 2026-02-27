"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function RechnungPage({ params }) {
  const { id } = params;

  const [loading, setLoading] = useState(true);

  // DB Daten
  const [anfrage, setAnfrage] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);

  // Invoice Header Felder (editierbar)
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [servicePeriod, setServicePeriod] = useState("");
  const [customerNumber, setCustomerNumber] = useState(""); // optional (wie Vorlage)
  const [contactPerson, setContactPerson] = useState(""); // optional (wie Vorlage)

  // Client Felder (editierbar)
  const [clientName, setClientName] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientZipCity, setClientZipCity] = useState("");
  const [clientCountry, setClientCountry] = useState(""); // optional
  const [clientEmail, setClientEmail] = useState("");

  // Textbausteine (editierbar)
  const [salutation, setSalutation] = useState("Sehr geehrte Damen und Herren,");
  const [introText, setIntroText] = useState(
    "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:"
  );
  const [paymentTerms, setPaymentTerms] = useState(
    "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ab Rechnungseingang ohne Abzüge."
  );
  const [closingText, setClosingText] = useState(
    "Ich danke dir für dein Vertrauen und freue mich, dass ich dich mit Poise begleiten durfte.\n\nLiebe Grüße"
  );

  // Positionsdaten (editierbar je Session)
  const [descriptions, setDescriptions] = useState({}); // { [sessionId]: string }
  const [quantities, setQuantities] = useState({}); // { [sessionId]: number }
  const [unitPrices, setUnitPrices] = useState({}); // { [sessionId]: number } (default = s.price)

  // Speichern
  const [saving, setSaving] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    setLoading(true);

    // 1) Anfrage laden
    const { data: a, error: anfrageErr } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    if (anfrageErr) {
      console.error("ANFRAGE ERROR:", anfrageErr);
      setLoading(false);
      return;
    }

    setAnfrage(a);

    // 2) Sessions über Billing-API (stabile Quelle)
    const {
      data: { session },
      error: sessAuthErr,
    } = await supabase.auth.getSession();

    if (sessAuthErr) console.warn("SESSION AUTH WARN:", sessAuthErr);

    const res = await fetch("/api/therapist/billing-sessions", {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    const billingData = await res.json();
    const allSessions = billingData?.data || [];

    const invoiceSessions = allSessions.filter(
      (s) => String(s.anfrage_id) === String(id)
    );

    setSessions(invoiceSessions);

    // 3) TherapistId bestimmen
    const therapistId = a?.assigned_therapist_id || invoiceSessions?.[0]?.therapist_id;

    // 4) Invoice Settings laden (Therapeut) – NICHT editierbar
    if (therapistId) {
      const { data: invSet, error: invErr } = await supabase
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", therapistId)
        .single();

      if (invErr) console.error("INVOICE SETTINGS ERROR:", invErr);
      setSettings(invSet || null);
    } else {
      setSettings(null);
    }

    // 5) Defaults setzen (editierbar)
    const now = new Date();
    setInvoiceNumber((prev) => prev || "RE-" + Date.now().toString().slice(-5));
    setInvoiceDate((prev) => prev || now.toISOString().slice(0, 10));

    // Leistungszeitraum: min–max Datum aus Sessions, sonst heute
    const period = buildServicePeriod(invoiceSessions);
    setServicePeriod((prev) => prev || period);

    // Client defaults aus Anfrage
    setClientName((prev) => prev || `${a?.vorname || ""} ${a?.nachname || ""}`.trim());
    setClientStreet((prev) => prev || (a?.strasse_hausnr || ""));
    setClientZipCity((prev) => prev || (a?.plz_ort || ""));
    setClientEmail((prev) => prev || (a?.email || ""));
    setClientCountry((prev) => prev || "");

    // 6) Positionsfelder initialisieren (beschreibungen/qty/unit)
    setDescriptions((prev) => {
      const next = { ...prev };
      for (const s of invoiceSessions) {
        if (!next[s.id]) {
          // Vorlage-Style: “Psychologische Online Beratung …” (editierbar)
          next[s.id] = "Psychologische Beratung";
        }
      }
      return next;
    });

    setQuantities((prev) => {
      const next = { ...prev };
      for (const s of invoiceSessions) {
        if (typeof next[s.id] !== "number") next[s.id] = 1;
      }
      return next;
    });

    setUnitPrices((prev) => {
      const next = { ...prev };
      for (const s of invoiceSessions) {
        if (typeof next[s.id] !== "number") next[s.id] = Number(s.price || 0);
      }
      return next;
    });

    // optional: Ansprechpartner default (wie Vorlage)
    setContactPerson((prev) => prev || "");

    setLoading(false);
  }

  const vatRate = useMemo(() => Number(settings?.default_vat_rate || 0), [settings]);

  const lineItems = useMemo(() => {
    return (sessions || []).map((s) => {
      const qty = Number(quantities[s.id] ?? 1);
      const unit = Number(unitPrices[s.id] ?? Number(s.price || 0));
      const total = qty * unit;
      return {
        id: s.id,
        date: s.date,
        description: descriptions[s.id] ?? "",
        qty,
        unit,
        total,
      };
    });
  }, [sessions, descriptions, quantities, unitPrices]);

  const totals = useMemo(() => {
    const net = lineItems.reduce((sum, li) => sum + Number(li.total || 0), 0);
    const vat = vatRate > 0 ? net * (vatRate / 100) : 0;
    const gross = net + vat;
    return { net, vat, gross };
  }, [lineItems, vatRate]);

  async function saveInvoice() {
    try {
      setSaving(true);

      const payload = {
        id: savedInvoiceId || null,
        anfrage_id: id,
        therapist_id: settings?.therapist_id,

        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        service_period: servicePeriod,

        customer_number: customerNumber,
        contact_person: contactPerson,

        client_name: clientName,
        client_street: clientStreet,
        client_city: clientZipCity,
        client_country: clientCountry,
        client_email: clientEmail,

        salutation,
        intro_text: introText,
        payment_terms: paymentTerms,
        closing_text: closingText,

        vat_rate: vatRate,
        total_net: totals.net,
        vat_amount: totals.vat,
        total_gross: totals.gross,

        // Wichtig: Positionen mitspeichern
        line_items: lineItems.map((li, idx) => ({
          pos: idx + 1,
          session_id: li.id,
          date: li.date,
          description: li.description,
          qty: li.qty,
          unit_price: li.unit,
          total: li.total,
        })),
      };

      const res = await fetch("/api/invoices/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("SAVE INVOICE ERROR:", result);
        alert("Fehler beim Speichern");
        return;
      }

      if (result?.data?.id) setSavedInvoiceId(result.data.id);

      alert("Rechnung gespeichert");
    } finally {
      setSaving(false);
    }
  }

  function exportPDF() {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      buildPdf({
        doc,
        settings,
        invoiceNumber,
        invoiceDate,
        servicePeriod,
        customerNumber,
        contactPerson,
        clientName,
        clientStreet,
        clientZipCity,
        clientCountry,
        clientEmail,
        salutation,
        introText,
        paymentTerms,
        closingText,
        vatRate,
        lineItems,
        totals,
      });

      const safeName = (clientName || "Klient").replaceAll(" ", "_");
      doc.save(`Rechnung_${invoiceNumber}_${safeName}.pdf`);
    } catch (e) {
      console.error("PDF ERROR:", e);
      alert("PDF konnte nicht erstellt werden (siehe Console).");
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Lade…</div>;
  if (!anfrage) return <div style={{ padding: 40 }}>Keine Anfrage gefunden</div>;
  if (!settings) return <div style={{ padding: 40 }}>Keine Rechnungsdaten (Therapeut) gefunden</div>;

  // Styles (Vorlagen-Look)
  const pageBg = { background: "#f0f0f0", minHeight: "100vh", padding: "50px 0" };
  const paper = {
    background: "#fff",
    width: 900,
    margin: "0 auto",
    padding: "70px 70px 55px 70px",
    fontFamily: "Helvetica, Arial, sans-serif",
    color: "#111",
    boxShadow: "0 1px 10px rgba(0,0,0,0.08)",
  };

  const small = { fontSize: 11, color: "#444", lineHeight: 1.35 };
  const hTitle = { fontSize: 26, fontWeight: 600, margin: 0 };
  const muted = { color: "#666" };

  const inputBase = {
    border: "none",
    borderBottom: "1px solid #ddd",
    padding: "2px 4px",
    fontSize: 12,
    width: "auto",
    outline: "none",
  };

  const rightMetaLabel = { fontSize: 10, color: "#666", width: 130 };
  const rightMetaValue = { fontSize: 10, color: "#111" };

  return (
    <div style={pageBg}>
      {/* TOP ACTIONS */}
      <div style={{ width: 900, margin: "0 auto 18px auto", display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          onClick={saveInvoice}
          disabled={saving}
          style={{
            background: "#111",
            color: "#fff",
            border: "none",
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 13,
            borderRadius: 6,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Speichere…" : "Rechnung speichern"}
        </button>

        <button
          onClick={exportPDF}
          style={{
            background: "#fff",
            color: "#111",
            border: "1px solid #111",
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 13,
            borderRadius: 6,
          }}
        >
          PDF exportieren
        </button>
      </div>

      {/* PAPER */}
      <div style={paper}>
        {/* HEADER TOP LINE (klein) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ ...small, maxWidth: 520 }}>
            <div style={{ fontWeight: 700 }}>{settings.company_name}</div>
            <div style={{ whiteSpace: "pre-line" }}>{settings.address}</div>
          </div>

          {/* Logo optional */}
          <div style={{ width: 120, textAlign: "right" }}>
            {settings.logo_url ? (
              // Hinweis: direktes <img> ist ok für UI; PDF lädt kein remote image automatisch.
              <img src={settings.logo_url} alt="Logo" style={{ maxWidth: 90, maxHeight: 60, objectFit: "contain" }} />
            ) : null}
          </div>
        </div>

        {/* RECIPIENT + META */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
          {/* Recipient */}
          <div style={{ ...small }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Rechnung an</div>

            <div>
              <input style={{ ...inputBase, width: 360 }} value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <input style={{ ...inputBase, width: 360 }} value={clientStreet} onChange={(e) => setClientStreet(e.target.value)} />
            </div>
            <div>
              <input style={{ ...inputBase, width: 360 }} value={clientZipCity} onChange={(e) => setClientZipCity(e.target.value)} />
            </div>
            <div>
              <input style={{ ...inputBase, width: 360 }} value={clientCountry} onChange={(e) => setClientCountry(e.target.value)} placeholder="Land (optional)" />
            </div>

            <div style={{ marginTop: 8 }}>
              <input style={{ ...inputBase, width: 360 }} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            </div>
          </div>

          {/* Right meta like Vorlage */}
          <div style={{ width: 300 }}>
            <div style={{ textAlign: "right", marginBottom: 8 }}>
              <div style={hTitle}>Rechnung</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "6px 10px" }}>
              <div style={rightMetaLabel}>Rechnungs-Nr.</div>
              <div style={rightMetaValue}>
                <input style={{ ...inputBase, width: 140, textAlign: "right" }} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>

              <div style={rightMetaLabel}>Rechnungsdatum</div>
              <div style={rightMetaValue}>
                <input style={{ ...inputBase, width: 140, textAlign: "right" }} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>

              <div style={rightMetaLabel}>Leistungszeitraum</div>
              <div style={rightMetaValue}>
                <input style={{ ...inputBase, width: 140, textAlign: "right" }} value={servicePeriod} onChange={(e) => setServicePeriod(e.target.value)} />
              </div>

              <div style={rightMetaLabel}>Kundennummer</div>
              <div style={rightMetaValue}>
                <input style={{ ...inputBase, width: 140, textAlign: "right" }} value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} placeholder="optional" />
              </div>

              <div style={rightMetaLabel}>Ansprechpartner</div>
              <div style={rightMetaValue}>
                <input style={{ ...inputBase, width: 140, textAlign: "right" }} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="optional" />
              </div>
            </div>
          </div>
        </div>

        {/* TITLE LINE like "Rechnung Nr. ..." */}
        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            Rechnung Nr. {invoiceNumber}
          </div>
        </div>

        {/* TEXTS */}
        <div style={{ marginTop: 18, ...small }}>
          <div>
            <input
              style={{ ...inputBase, width: "100%" }}
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #eee",
                padding: 10,
                fontSize: 12,
                minHeight: 60,
                resize: "vertical",
              }}
            />
          </div>
        </div>

        {/* TABLE (Sessions) */}
        <div style={{ marginTop: 18 }}>
          <table width="100%" style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <th align="left" style={{ padding: "8px 6px" }}>Pos.</th>
                <th align="left" style={{ padding: "8px 6px" }}>Beschreibung</th>
                <th align="right" style={{ padding: "8px 6px" }}>Menge</th>
                <th align="right" style={{ padding: "8px 6px" }}>Einzelpreis</th>
                <th align="right" style={{ padding: "8px 6px" }}>Gesamtpreis</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, idx) => (
                <tr key={li.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "10px 6px", verticalAlign: "top" }}>{idx + 1}.</td>

                  <td style={{ padding: "10px 6px" }}>
                    <input
                      value={li.description}
                      onChange={(e) =>
                        setDescriptions((prev) => ({ ...prev, [li.id]: e.target.value }))
                      }
                      style={{ border: "none", borderBottom: "1px solid #eee", width: "100%", fontSize: 12, outline: "none" }}
                    />
                    <div style={{ marginTop: 4, fontSize: 10, color: "#666" }}>
                      Termin: {li.date ? new Date(li.date).toLocaleDateString("de-AT") : "—"}
                    </div>
                  </td>

                  <td style={{ padding: "10px 6px" }} align="right">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={li.qty}
                      onChange={(e) =>
                        setQuantities((prev) => ({ ...prev, [li.id]: Number(e.target.value || 0) }))
                      }
                      style={{ ...inputBase, width: 60, textAlign: "right" }}
                    />
                  </td>

                  <td style={{ padding: "10px 6px" }} align="right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={li.unit}
                      onChange={(e) =>
                        setUnitPrices((prev) => ({ ...prev, [li.id]: Number(e.target.value || 0) }))
                      }
                      style={{ ...inputBase, width: 90, textAlign: "right" }}
                    />{" "}
                    EUR
                  </td>

                  <td style={{ padding: "10px 6px" }} align="right">
                    {li.total.toFixed(2)} EUR
                  </td>
                </tr>
              ))}

              {/* Summary Rows like Vorlage */}
              <tr>
                <td colSpan={4} style={{ padding: "10px 6px", textAlign: "right", fontWeight: 600, background: "#fafafa" }}>
                  Gesamtbetrag netto
                </td>
                <td style={{ padding: "10px 6px", textAlign: "right", background: "#fafafa" }}>
                  {totals.net.toFixed(2)} EUR
                </td>
              </tr>

              {vatRate > 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "10px 6px", textAlign: "right", fontWeight: 600, background: "#fafafa" }}>
                    zzgl. Umsatzsteuer {vatRate}%
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "right", background: "#fafafa" }}>
                    {totals.vat.toFixed(2)} EUR
                  </td>
                </tr>
              ) : null}

              <tr>
                <td colSpan={4} style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, background: "#f0f0f0" }}>
                  Gesamtbetrag brutto
                </td>
                <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, background: "#f0f0f0" }}>
                  {totals.gross.toFixed(2)} EUR
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment + closing */}
        <div style={{ marginTop: 18, ...small }}>
          <textarea
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            style={{ width: "100%", border: "1px solid #eee", padding: 10, fontSize: 12, minHeight: 54, resize: "vertical" }}
          />

          <textarea
            value={closingText}
            onChange={(e) => setClosingText(e.target.value)}
            style={{ width: "100%", border: "1px solid #eee", padding: 10, fontSize: 12, minHeight: 90, marginTop: 10, resize: "vertical", whiteSpace: "pre-line" }}
          />
        </div>

        {/* Footer columns like Vorlage */}
        <div style={{ marginTop: 24, borderTop: "1px solid #eee", paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, ...small }}>
          <div>
            <div style={{ fontWeight: 700 }}>{settings.company_name}</div>
            <div style={{ whiteSpace: "pre-line" }}>{settings.address}</div>
            {clientEmail ? <div>E-Mail: {clientEmail}</div> : null}
          </div>

          <div>
            <div style={{ fontWeight: 700 }}>Rechtliches</div>
            <div style={muted}>UID:</div> {settings.vat_number || "—"}
            <br />
            <div style={muted}>Steuernr:</div> {settings.tax_number || "—"}
          </div>

          <div>
            <div style={{ fontWeight: 700 }}>Bank</div>
            <div>IBAN: {settings.iban || "—"}</div>
            <div>BIC: {settings.bic || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hilfsfunktionen */

function buildServicePeriod(sessions) {
  if (!sessions || sessions.length === 0) {
    return new Date().toLocaleDateString("de-AT");
  }
  const dates = sessions
    .map((s) => (s.date ? new Date(s.date).getTime() : null))
    .filter((t) => typeof t === "number");
  if (dates.length === 0) return new Date().toLocaleDateString("de-AT");

  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  const a = min.toLocaleDateString("de-AT");
  const b = max.toLocaleDateString("de-AT");
  return a === b ? a : `${a} - ${b}`;
}

function buildPdf({
  doc,
  settings,
  invoiceNumber,
  invoiceDate,
  servicePeriod,
  customerNumber,
  contactPerson,
  clientName,
  clientStreet,
  clientZipCity,
  clientCountry,
  clientEmail,
  salutation,
  introText,
  paymentTerms,
  closingText,
  vatRate,
  lineItems,
  totals,
}) {
  const marginX = 15;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(String(settings.company_name || ""), marginX, 18);
  const addrLines = String(settings.address || "").split("\n");
  let y = 23;
  for (const ln of addrLines) {
    doc.text(ln, marginX, y);
    y += 5;
  }

  // Right meta
  doc.setFontSize(18);
  doc.text("RECHNUNG", pageWidth - marginX, 22, { align: "right" });

  doc.setFontSize(10);
  const metaY = 32;
  doc.text("Rechnungs-Nr.:", pageWidth - marginX - 70, metaY);
  doc.text(String(invoiceNumber || ""), pageWidth - marginX, metaY, { align: "right" });

  doc.text("Rechnungsdatum:", pageWidth - marginX - 70, metaY + 6);
  doc.text(String(invoiceDate || ""), pageWidth - marginX, metaY + 6, { align: "right" });

  doc.text("Leistungszeitraum:", pageWidth - marginX - 70, metaY + 12);
  doc.text(String(servicePeriod || ""), pageWidth - marginX, metaY + 12, { align: "right" });

  if (customerNumber) {
    doc.text("Kundennummer:", pageWidth - marginX - 70, metaY + 18);
    doc.text(String(customerNumber), pageWidth - marginX, metaY + 18, { align: "right" });
  }
  if (contactPerson) {
    doc.text("Ansprechpartner:", pageWidth - marginX - 70, metaY + 24);
    doc.text(String(contactPerson), pageWidth - marginX, metaY + 24, { align: "right" });
  }

  // Recipient
  let ry = 50;
  doc.setFontSize(10);
  doc.text("Rechnung an:", marginX, ry);
  ry += 6;
  doc.text(String(clientName || ""), marginX, ry);
  ry += 5;
  doc.text(String(clientStreet || ""), marginX, ry);
  ry += 5;
  doc.text(String(clientZipCity || ""), marginX, ry);
  ry += 5;
  if (clientCountry) {
    doc.text(String(clientCountry), marginX, ry);
    ry += 5;
  }
  if (clientEmail) {
    doc.text(String(clientEmail), marginX, ry);
    ry += 5;
  }

  // Title
  ry += 8;
  doc.setFont("helvetica", "bold");
  doc.text(`Rechnung Nr. ${invoiceNumber}`, marginX, ry);
  doc.setFont("helvetica", "normal");

  // Texts
  ry += 10;
  doc.setFontSize(10);
  doc.text(String(salutation || ""), marginX, ry);
  ry += 6;

  const introLines = doc.splitTextToSize(String(introText || ""), pageWidth - 2 * marginX);
  doc.text(introLines, marginX, ry);
  ry += introLines.length * 5 + 4;

  // Table
  const body = (lineItems || []).map((li, idx) => {
    const dateStr = li.date ? new Date(li.date).toLocaleDateString("de-AT") : "";
    const desc = li.description ? `${li.description}\nTermin: ${dateStr}` : `Termin: ${dateStr}`;
    return [
      `${idx + 1}.`,
      desc,
      String(li.qty ?? 1),
      `${Number(li.unit || 0).toFixed(2)} EUR`,
      `${Number(li.total || 0).toFixed(2)} EUR`,
    ];
  });

  doc.autoTable({
    startY: ry,
    head: [["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamtpreis"]],
    body,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [255, 255, 255], textColor: 20, lineWidth: 0.1, lineColor: 200 },
    tableLineWidth: 0.1,
    tableLineColor: 200,
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 95 },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  });

  let fy = doc.lastAutoTable.finalY + 6;

  // Totals block (like Vorlage)
  doc.setFont("helvetica", "bold");
  doc.text("Gesamtbetrag netto", pageWidth - marginX - 70, fy);
  doc.setFont("helvetica", "normal");
  doc.text(`${totals.net.toFixed(2)} EUR`, pageWidth - marginX, fy, { align: "right" });

  fy += 6;

  if (vatRate > 0) {
    doc.setFont("helvetica", "bold");
    doc.text(`zzgl. Umsatzsteuer ${vatRate}%`, pageWidth - marginX - 70, fy);
    doc.setFont("helvetica", "normal");
    doc.text(`${totals.vat.toFixed(2)} EUR`, pageWidth - marginX, fy, { align: "right" });
    fy += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Gesamtbetrag brutto", pageWidth - marginX - 70, fy);
  doc.text(`${totals.gross.toFixed(2)} EUR`, pageWidth - marginX, fy, { align: "right" });
  doc.setFont("helvetica", "normal");

  fy += 10;

  // Payment + closing
  const payLines = doc.splitTextToSize(String(paymentTerms || ""), pageWidth - 2 * marginX);
  doc.text(payLines, marginX, fy);
  fy += payLines.length * 5 + 4;

  const closeLines = doc.splitTextToSize(String(closingText || ""), pageWidth - 2 * marginX);
  doc.text(closeLines, marginX, fy);
  fy += closeLines.length * 5 + 6;
// =================== FOOTER BLOCK ===================

const pageCount = doc.internal.getNumberOfPages();

for (let i = 1; i <= pageCount; i++) {
  doc.setPage(i);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 15;
  const footerTopY = pageHeight - 45; // höher setzen!
  const lineGap = 5;

  const usableWidth = pageWidth - marginX * 2;
  const colWidth = usableWidth / 3;

  // Linie über Footer
  doc.setDrawColor(200);
  doc.line(marginX, footerTopY - 6, pageWidth - marginX, footerTopY - 6);

  doc.setFontSize(9);

  // ===== SPALTE 1 =====
  let x1 = marginX;
  let y1 = footerTopY;

  doc.setFont("helvetica", "bold");
  doc.text(settings.company_name || "", x1, y1);
  doc.setFont("helvetica", "normal");
  y1 += lineGap;

  const addressLines = (settings.address || "").split("\n");
  addressLines.forEach(line => {
    doc.text(line, x1, y1);
    y1 += lineGap;
  });

  if (settings.email) {
    doc.text(`E-Mail: ${settings.email}`, x1, y1);
  }

  // ===== SPALTE 2 =====
  let x2 = marginX + colWidth;
  let y2 = footerTopY;

  doc.setFont("helvetica", "bold");
  doc.text("Rechtliches", x2, y2);
  doc.setFont("helvetica", "normal");
  y2 += lineGap;

  doc.text(`UID: ${settings.vat_number || "—"}`, x2, y2);
  y2 += lineGap;

  doc.text(`Steuernr: ${settings.tax_number || "—"}`, x2, y2);

  // ===== SPALTE 3 =====
  let x3 = marginX + colWidth * 2;
  let y3 = footerTopY;

  doc.setFont("helvetica", "bold");
  doc.text("Bank", x3, y3);
  doc.setFont("helvetica", "normal");
  y3 += lineGap;

  doc.text(`IBAN: ${settings.iban || "—"}`, x3, y3);
  y3 += lineGap;

  doc.text(`BIC: ${settings.bic || "—"}`, x3, y3);
}
}
