"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function Badge({ status }) {
  const map = {
    ok: { text: "✅ OK", bg: "#E8FFF0" },
    warning: { text: "⚠️ Prüfen", bg: "#FFF4D6" },
    error: { text: "❌ Fehler", bg: "#FFE5E5" },
  };

  const item = map[status] || map.warning;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: 999,
        background: item.bg,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {item.text}
    </span>
  );
}

export default function SystemCheckPage() {
  const [loading, setLoading] = useState(true);
  const [check, setCheck] = useState(null);

  async function loadCheck() {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/system-check", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("SYSTEM CHECK ERROR:", json);
        alert("Systemcheck konnte nicht geladen werden");
        return;
      }

      setCheck(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCheck();
  }, []);

  if (loading) return <div style={{ padding: 40 }}>Systemcheck läuft…</div>;
  if (!check) return <div style={{ padding: 40 }}>Keine Daten geladen</div>;

  return (
    <div
      style={{
        padding: 32,
        maxWidth: 1200,
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Poise Systemcheck</h1>

      <div
        style={{
          padding: 18,
          borderRadius: 14,
          background: check.launch_ready ? "#E8FFF0" : "#FFECEC",
          border: check.launch_ready ? "1px solid #9AD8AA" : "1px solid #F0A0A0",
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          {check.launch_ready ? "🟢 Launch Ready" : "🔴 Noch nicht launch-ready"}
        </h2>

        <div>
          Fehler: <strong>{check.summary.errorCount}</strong> · Warnungen:{" "}
          <strong>{check.summary.warningCount}</strong> · Coaches:{" "}
          <strong>{check.summary.coachCount}</strong>
        </div>

        <div style={{ fontSize: 13, marginTop: 8, color: "#555" }}>
          Site URL: {check.siteUrl || "–"}
        </div>
      </div>

      <button
        onClick={loadCheck}
        style={{
          marginBottom: 20,
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        🔄 Neu prüfen
      </button>

      <h2>System</h2>

      {check.systemIssues?.length === 0 ? (
        <div style={{ color: "#0B6E4F", marginBottom: 20 }}>✅ Keine Systemprobleme</div>
      ) : (
        <ul>
          {check.systemIssues.map((i, idx) => (
            <li key={idx}>
              {i.level === "error" ? "❌" : "⚠️"} {i.message}
            </li>
          ))}
        </ul>
      )}

      <h2>Tabellen</h2>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
        <thead>
          <tr>
            <th align="left">Tabelle</th>
            <th align="left">Status</th>
            <th align="left">Fehler</th>
          </tr>
        </thead>
        <tbody>
          {check.tableChecks.map((t) => (
            <tr key={t.table} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{t.table}</td>
              <td style={{ padding: 8 }}>{t.ok ? "✅ OK" : "❌ Fehler"}</td>
              <td style={{ padding: 8 }}>{t.error || "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Coaches</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Coach</th>
            <th align="left">E-Mail</th>
            <th align="left">Kalender</th>
            <th align="left">Status</th>
            <th align="left">Hinweise</th>
          </tr>
        </thead>

        <tbody>
          {check.coachChecks.map((c) => (
            <tr key={c.id || c.name} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: 8, fontWeight: 700 }}>{c.name}</td>
              <td style={{ padding: 8 }}>{c.email || "–"}</td>
              <td style={{ padding: 8 }}>{c.calendar_mode || "–"}</td>
              <td style={{ padding: 8 }}>
                <Badge status={c.status} />
              </td>
              <td style={{ padding: 8 }}>
                {c.issues.length === 0 ? (
                  <span style={{ color: "#0B6E4F" }}>Alles gut</span>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {c.issues.map((i, idx) => (
                      <li key={idx}>
                        {i.level === "error" ? "❌" : "⚠️"} {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
