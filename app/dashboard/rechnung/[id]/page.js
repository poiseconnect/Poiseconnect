"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function RechnungPage({ params }) {
  const { id } = params;

  const [invoiceData, setInvoiceData] = useState(null);
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

    // 🔹 Sessions laden
    const { data: sess } = await supabase
      .from("sessions")
      .select("*")
      .eq("anfrage_id", id);

    const therapistId =
      anfrage?.assigned_therapist_id || sess?.[0]?.therapist_id;

    let settings = {};

    if (therapistId) {
      const { data: invoiceSettings } = await supabase
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", therapistId)
        .single();

      settings = invoiceSettings || {};
    }

    // 🔥 Zentrale Datenstruktur
    setInvoiceData({
      invoiceNumber: "RE-" + Date.now().toString().slice(-5),
      invoiceDate: new Date().toISOString().slice(0, 10),

      therapistName: settings.company_name || "",
      therapistAddress: settings.address || "",
      therapistVat: settings.vat_number || "",
      therapistTax: settings.tax_number || "",
      therapistIBAN: settings.iban || "",
      therapistBIC: settings.bic || "",

      clientName: `${anfrage?.vorname || ""} ${anfrage?.nachname || ""}`,
      clientAddress: `${anfrage?.strasse_hausnr || ""}\n${anfrage?.plz_ort || ""}`,
      clientEmail: anfrage?.email || "",

      sessions: sess || [],
      vatRate: Number(settings.default_vat_rate || 0),
      introText:
        "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:",
      closingText:
        "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ohne Abzüge.",
    });

    setLoading(false);
  }

  if (loading || !invoiceData)
    return <div style={{ padding: 40 }}>Lade Rechnung…</div>;

  const totalBrutto = invoiceData.sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const totalNet =
    invoiceData.vatRate > 0
      ? totalBrutto / (1 + invoiceData.vatRate / 100)
      : totalBrutto;

  const vatAmount = totalBrutto - totalNet;

  function updateField(field, value) {
    setInvoiceData({ ...invoiceData, [field]: value });
  }

  return (
    <div style={{ display: "flex", padding: 40, gap: 40 }}>

      {/* ================= EDIT PANEL ================= */}
      <div style={{ width: 400 }}>
        <h3>Rechnung bearbeiten</h3>

        <label>Rechnungsnummer</label>
        <input
          value={invoiceData.invoiceNumber}
          onChange={(e) =>
            updateField("invoiceNumber", e.target.value)
          }
        />

        <label>Rechnungsdatum</label>
        <input
          type="date"
          value={invoiceData.invoiceDate}
          onChange={(e) =>
            updateField("invoiceDate", e.target.value)
          }
        />

        <hr />

        <label>Therapeut Name</label>
        <input
          value={invoiceData.therapistName}
          onChange={(e) =>
            updateField("therapistName", e.target.value)
          }
        />

        <label>Therapeut Adresse</label>
        <textarea
          value={invoiceData.therapistAddress}
          onChange={(e) =>
            updateField("therapistAddress", e.target.value)
          }
        />

        <label>UID</label>
        <input
          value={invoiceData.therapistVat}
          onChange={(e) =>
            updateField("therapistVat", e.target.value)
          }
        />

        <label>Steuernummer</label>
        <input
          value={invoiceData.therapistTax}
          onChange={(e) =>
            updateField("therapistTax", e.target.value)
          }
        />

        <hr />

        <label>Kundenname</label>
        <input
          value={invoiceData.clientName}
          onChange={(e) =>
            updateField("clientName", e.target.value)
          }
        />

        <label>Kundenadresse</label>
        <textarea
          value={invoiceData.clientAddress}
          onChange={(e) =>
            updateField("clientAddress", e.target.value)
          }
        />

        <label>E-Mail</label>
        <input
          value={invoiceData.clientEmail}
          onChange={(e) =>
            updateField("clientEmail", e.target.value)
          }
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

        <div style={{ marginTop: 20 }}>
          <strong>{invoiceData.therapistName}</strong><br />
          <div style={{ whiteSpace: "pre-line" }}>
            {invoiceData.therapistAddress}
          </div>
          UID: {invoiceData.therapistVat}<br />
          StNr: {invoiceData.therapistTax}
        </div>

        <hr style={{ margin: "40px 0" }} />

        <strong>Rechnung an:</strong><br />
        {invoiceData.clientName}<br />
        <div style={{ whiteSpace: "pre-line" }}>
          {invoiceData.clientAddress}
        </div>
        {invoiceData.clientEmail}

        <hr style={{ margin: "40px 0" }} />

        <table width="100%">
          <thead>
            <tr>
              <th align="left">Datum</th>
              <th align="right">Preis €</th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.sessions.map((s) => (
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
          USt: {vatAmount.toFixed(2)} €<br />
          <strong>Gesamt: {totalBrutto.toFixed(2)} €</strong>
        </div>
      </div>
    </div>
  );
}
