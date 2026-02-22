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

  const total = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  return (
    <div style={{ padding: 40, display: "flex", gap: 40 }}>
      {/* ================= EDIT ================= */}
      <div style={{ flex: 1 }}>
        <h2>Rechnungsdaten bearbeiten</h2>

        <label>Firma</label>
        <input
          value={settings.company_name || ""}
          onChange={(e) =>
            setSettings({ ...settings, company_name: e.target.value })
          }
        />

        <label>Adresse</label>
        <textarea
          value={settings.address || ""}
          onChange={(e) =>
            setSettings({ ...settings, address: e.target.value })
          }
        />

        <label>USt %</label>
        <input
          type="number"
          value={settings.default_vat_rate || 0}
          onChange={(e) =>
            setSettings({
              ...settings,
              default_vat_rate: Number(e.target.value),
            })
          }
        />

        <button
          style={{ marginTop: 20 }}
          onClick={() => generatePDF()}
        >
          PDF generieren
        </button>
      </div>

      {/* ================= VORSCHAU ================= */}
      <div
        style={{
          flex: 1,
          border: "1px solid #ddd",
          padding: 20,
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <h2>Rechnung Vorschau</h2>

        <p><strong>{settings.company_name}</strong></p>
        <p>{settings.address}</p>

        <hr />

        <p>
          <strong>Rechnung an:</strong><br />
          {client.vorname} {client.nachname}
        </p>

        <table width="100%" style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th align="left">Datum</th>
              <th align="right">Preis €</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.date).toLocaleDateString()}</td>
                <td align="right">{Number(s.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr />

        <h3 style={{ textAlign: "right" }}>
          Gesamt: {total.toFixed(2)} €
        </h3>
      </div>
    </div>
  );

  function generatePDF() {
    const doc = new jsPDF();
    doc.text(settings.company_name || "", 10, 10);
    doc.text(settings.address || "", 10, 16);

    doc.text(
      `Rechnung an ${client.vorname} ${client.nachname}`,
      10,
      30
    );

    doc.autoTable({
      startY: 40,
      head: [["Datum", "Preis"]],
      body: sessions.map((s) => [
        new Date(s.date).toLocaleDateString(),
        Number(s.price).toFixed(2),
      ]),
    });

    doc.save("rechnung.pdf");
  }
}
