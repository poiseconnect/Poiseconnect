"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const redirectUrl = "https://poiseconnect.vercel.app/auth/callback";

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    setLoading(false);

    if (error) {
      setError("Fehler – Magic Link konnte nicht gesendet werden.");
      return;
    }

    setMessage("Magic Link wurde gesendet! Bitte Posteingang prüfen.");
  }

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "60px auto",
        padding: "30px",
        border: "1px solid #ddd",
        borderRadius: 12,
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: 20 }}>Team Login</h1>

      <form onSubmit={sendMagicLink}>
        <label style={{ display: "block", marginBottom: 10 }}>
          Team E-Mail
        </label>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@mypoise.de"
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 20,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            background: "#b87c6a",
            color: "white",
            fontSize: 16,
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Sende…" : "Magic Link senden"}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: 20,
            color: "green",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          {message}
        </p>
      )}

      {error && (
        <p
          style={{
            marginTop: 20,
            color: "red",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
