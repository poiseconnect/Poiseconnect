"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // ---------------------------------------------------
  // 1) USER LADEN (Magic Link Auth)
  // ---------------------------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        window.location.href = "/login"; // nicht eingeloggt → Login
      } else {
        setUser(data.user);
      }
      setLoadingUser(false);
    });
  }, []);

  // ---------------------------------------------------
  // 2) ANFRAGEN LADEN (vom eingeloggten Teammitglied)
  // ---------------------------------------------------
  useEffect(() => {
    if (!user) return;

    async function loadRequests() {
      setLoadingRequests(true);

      const res = await fetch("/api/team-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });

      const json = await res.json();
      setRequests(json.requests || []);

      setLoadingRequests(false);
    }

    loadRequests();
  }, [user]);

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------
  if (loadingUser) return <p>Wird geladen…</p>;
  if (!user) return null;

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
      <h1>Team Dashboard</h1>

      <p>
        Eingeloggt als: <strong>{user.email}</strong>
      </p>

      <hr style={{ margin: "24px 0" }} />

      <h2>Deine aktuellen Anfragen</h2>

      {loadingRequests && <p>Wird geladen…</p>}

      {!loadingRequests && requests.length === 0 && (
        <p>Keine offenen Anfragen.</p>
      )}

      {/* LISTE ALLER ANFRAGEN */}
      {!loadingRequests &&
        requests.map((r) => (
          <div
            key={r.id}
            style={{
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 12,
              marginBottom: 16,
              background: "#fafafa",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              {r.vorname} {r.nachname}
            </h3>

            <p>
              <strong>Anliegen:</strong>
              <br />
              {r.anliegen}
            </p>

            <p>
              <strong>Wunschtermin:</strong>{" "}
              {r.bevorzugte_zeit || "Kein Termin ausgewählt"}
            </p>

            <div style={{ marginTop: 12 }}>
              <button
                style={{
                  padding: "6px 12px",
                  marginRight: 8,
                  background: "#c8e6c9",
                  border: "1px solid #8bc34a",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onClick={() => alert("Termin bestätigen — folgt in Schritt 4")}
              >
                Termin bestätigen
              </button>

              <button
                style={{
                  padding: "6px 12px",
                  marginRight: 8,
                  background: "#ffcdd2",
                  border: "1px solid #e57373",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onClick={() => alert("Absagen — folgt in Schritt 4")}
              >
                Absagen
              </button>

              <button
                style={{
                  padding: "6px 12px",
                  marginRight: 8,
                  background: "#bbdefb",
                  border: "1px solid #64b5f6",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onClick={() =>
                  alert("Neuen Termin vorschlagen — folgt in Schritt 4")
                }
              >
                Neuen Termin
              </button>

              <button
                style={{
                  padding: "6px 12px",
                  background: "#e1bee7",
                  border: "1px solid #ba68c8",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onClick={() =>
                  alert("Anderes Teammitglied — folgt in Schritt 4")
                }
              >
                Weiterleiten
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
