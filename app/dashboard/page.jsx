"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        // kein Login → zurück zu /login
        window.location.href = "/login";
      } else {
        setUser(data.user);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Wird geladen…</p>;
  if (!user) return null;

  return (
    <div style={{ padding: 24 }}>
      <h1>Team Dashboard</h1>
      <p>Eingeloggt als: <strong>{user.email}</strong></p>

      <hr style={{ margin: "20px 0" }} />

      <h2>Deine aktuellen Anfragen</h2>

      {/* hier kommt im nächsten Schritt die Liste */}
      <div id="requests-list">Wird geladen…</div>
    </div>
  );
}
