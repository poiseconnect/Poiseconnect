"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function InvoicePage({ params }) {
  const { id } = params;

  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [invoiceSettings, setInvoiceSettings] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: anfrage } = await supabase
        .from("anfragen")
        .select("*")
        .eq("id", id)
        .single();

      const { data: sess } = await supabase
        .from("sessions")
        .select("*")
        .eq("anfrage_id", id)
        .order("date", { ascending: true });

      const { data: userData } = await supabase.auth.getUser();

      const res = await fetch("/api/invoice-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: userData.user.email }),
      });

      const settingsData = await res.json();

      setClient(anfrage);
      setSessions(sess || []);
      setInvoiceSettings(settingsData.settings);
    }

    load();
  }, [id]);

  if (!client || !invoiceSettings)
    return <div style={{ padding: 40 }}>Lade Rechnung…</div>;

  const vatRate = Number(invoiceSettings.default_vat_rate || 0);

  const totalNet = sessions.reduce(
    (sum, s) => sum + Number(s.price || 0),
    0
  );

  const vatAmount = vatRate > 0 ? totalNet * (vatRate / 100) : 0;
  const totalGross = totalNet + vatAmount;

  function generatePDF() {
    const doc = new jsPDF();
    const today = new Date();

    doc.setFontSize(10);
    doc.text(invoiceSettings.company_name || "", 14, 15);
    doc.text(invoiceSettings.address || "", 14, 20);

    doc.setFontSize(11);
    doc.text("Rechnung an:", 14, 35);
    doc.text(`${client.vorname} ${client.nachname}`, 14, 41);
    doc.text(client.strasse_hausnr || "", 14, 47);
    doc.text(client.plz_ort || "", 14, 53);
    doc.text(client.email || "", 14, 59);

    doc.text("Rechnung", 150, 35);
    doc.text(
      `Datum: ${today.toLocaleDateString("de-AT")}`,
      150,
      41
    );

    doc.autoTable({
      startY: 70,
      head: [["Datum", "Preis €"]],
      body: sessions.map((s) => [
        new Date(s.date).toLocaleDateString("de-AT"),
        Number(s.price || 0).toFixed(2),
      ]),
    });

    const finalY = doc.lastAutoTable.finalY + 10;

    doc.text(`Netto: ${totalNet.toFixed(2)} €`, 140, finalY);
    doc.text(
      `USt ${vatRate}%: ${vatAmount.toFixed(2)} €`,
      140,
      finalY + 6
    );
    doc.text(
      `Brutto: ${totalGross.toFixed(2)} €`,
      140,
      finalY + 12
    );

    doc.save(
      `Rechnung_${client.vorname}_${client.nachname}.pdf`
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
      <h2>Rechnung</h2>

      <h3>Klient</h3>
      <input
        value={client.vorname || ""}
        onChange={(e) =>
          setClient({ ...client, vorname: e.target.value })
        }
      />
      <input
        value={client.nachname || ""}
        onChange={(e) =>
          setClient({ ...client, nachname: e.target.value })
        }
      />
      <input
        value={client.strasse_hausnr || ""}
        onChange={(e) =>
          setClient({
            ...client,
            strasse_hausnr: e.target.value,
          })
        }
      />
      <input
        value={client.plz_ort || ""}
        onChange={(e) =>
          setClient({ ...client, plz_ort: e.target.value })
        }
      />

      <h3>Sitzungen</h3>
      {sessions.map((s, i) => (
        <div key={i}>
          {new Date(s.date).toLocaleDateString("de-AT")} –{" "}
          {Number(s.price || 0).toFixed(2)} €
        </div>
      ))}

      <h3>Summe</h3>
      <div>Netto: {totalNet.toFixed(2)} €</div>
      <div>USt: {vatAmount.toFixed(2)} €</div>
      <div>Brutto: {totalGross.toFixed(2)} €</div>

      <button onClick={generatePDF} style={{ marginTop: 20 }}>
        📄 PDF generieren
      </button>
    </div>
  );
}
