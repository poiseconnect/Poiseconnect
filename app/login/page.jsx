"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e) {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      alert("Bitte gültige Email eingeben.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // WICHTIG: Hier darf NICHT das Dashboard stehen!
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
    <div
      style={{
        padding: 40,
        maxWidth: 360,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 20 }}>Team Login</h1>

      <form onSubmit={sendMagicLink}>
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
            marginBottom: 16,
            fontSize: 15,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 18px",
            borderRadius: 8,
            background: "#A27C77",
            color: "white",
            fontSize: 15,
            border: "none",
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Senden…" : "Magic Link senden"}
        </button>
      </form>
    </div>
  );
}
