"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function InvoicePage({ params }) {
  const { id } = params;

  const [request, setRequest] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Anfrage laden
      const { data: req } = await supabase
        .from("anfragen")
        .select("*")
        .eq("id", id)
        .single();

      // Sessions laden
      const { data: sess } = await supabase
        .from("sessions")
        .select("*")
        .eq("anfrage_id", id)
        .order("date");

      setRequest(req);
      setSessions(sess || []);
      setLoading(false);
    }

    load();
  }, [id]);

  if (loading) return <div>Lade Rechnung…</div>;

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1>Rechnung Vorschau</h1>

      <h3>Klient</h3>
      <input
        value={request.vorname || ""}
        onChange={(e) =>
          setRequest({ ...request, vorname: e.target.value })
        }
      />

      <input
        value={request.nachname || ""}
        onChange={(e) =>
          setRequest({ ...request, nachname: e.target.value })
        }
      />

      <h3>Adresse</h3>
      <input
        value={request.strasse_hausnr || ""}
        onChange={(e) =>
          setRequest({ ...request, strasse_hausnr: e.target.value })
        }
      />

      <input
        value={request.plz_ort || ""}
        onChange={(e) =>
          setRequest({ ...request, plz_ort: e.target.value })
        }
      />

      <h3>Sitzungen</h3>

      {sessions.map((s, i) => (
        <div key={s.id} style={{ marginBottom: 8 }}>
          {new Date(s.date).toLocaleDateString("de-AT")} — {s.price} €
        </div>
      ))}

      <button style={{ marginTop: 20 }}>
        🧾 PDF generieren
      </button>
    </div>
  );
}
