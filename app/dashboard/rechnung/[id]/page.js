"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";

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

  const [descriptions, setDescriptions] = useState({});

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

    const descInit = {};
    invoiceSessions.forEach((s) => {
      descInit[s.id] = "Psychologische Beratung";
    });
    setDescriptions(descInit);

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

  if (loading || !settings) {
    return <div style={{ padding: 40 }}>Lade…</div>;
  }

  const vatRate = Number(settings.default_vat_rate || 0);

  const totalNet = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const vatAmount = vatRate > 0 ? totalNet * (vatRate / 100) : 0;
  const totalGross = totalNet + vatAmount;

  async function saveInvoice() {
    alert("Rechnung gespeichert");
  }

  function generatePDF() {
    const doc = new jsPDF();
    doc.text("Rechnung", 14, 20);
    doc.save("rechnung.pdf");
  }

  return (
    <div style={{ padding: 60 }}>

      <div style={{ marginBottom: 20 }}>
        <button onClick={generatePDF} style={{ marginRight: 10 }}>
          PDF Export
        </button>
        <button onClick={saveInvoice}>
          Rechnung speichern
        </button>
      </div>

      <h2>Rechnung</h2>

      <div>
        <strong>{settings.company_name}</strong><br />
        {settings.address}
      </div>

      <hr style={{ margin: "40px 0" }} />

      <div>
        <strong>Rechnung an:</strong><br />
        <input value={clientName} onChange={e=>setClientName(e.target.value)} /><br />
        <input value={clientStreet} onChange={e=>setClientStreet(e.target.value)} /><br />
        <input value={clientCity} onChange={e=>setClientCity(e.target.value)} /><br />
        <input value={clientEmail} onChange={e=>setClientEmail(e.target.value)} />
      </div>

      <hr style={{ margin: "40px 0" }} />

      <table width="100%">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Leistung</th>
            <th>Preis</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, index) => (
            <tr key={s.id}>
              <td>{index + 1}</td>
              <td>
                <input
                  value={descriptions[s.id] || ""}
                  onChange={(e) =>
                    setDescriptions({
                      ...descriptions,
                      [s.id]: e.target.value,
                    })
                  }
                />
              </td>
              <td>{Number(s.price).toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 40 }}>
        Netto: {totalNet.toFixed(2)} €<br />
        USt: {vatAmount.toFixed(2)} €<br />
        <strong>Gesamt: {totalGross.toFixed(2)} €</strong>
      </div>

    </div>
  );
}
