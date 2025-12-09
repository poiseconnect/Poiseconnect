"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // 🔥 Wichtig: Session wird NUR über /auth/callback gesetzt
        emailRedirectTo: "https://poiseconnect.vercel.app/auth/callback",
      },
    });

    setLoading(false);

    if (error) {
      console.error(error);
      return alert("Fehler – Magic Link konnte nicht gesendet werden.");
    }

    alert("Magic Link wurde gesendet!");
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Team Login</h1>

      <form onSubmit={sendMagicLink} style={{ marginTop: 20 }}>
        <input
          type="email"
          placeholder="Deine Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            marginBottom: 12,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            background: "#c7afa4",
            color: "white",
            border: "none",
            width: "100%",
          }}
        >
          {loading ? "Senden…" : "Magic Link senden"}
        </button>
      </form>
    </div>
  );
}
