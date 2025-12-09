"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const hash = window.location.hash;

      // Wenn kein Hash → zurück zum Login
      if (!hash) {
        router.push("/login");
        return;
      }

      // Hash (#...) zu richtigen Parametern umwandeln
      const params = Object.fromEntries(
        new URLSearchParams(hash.substring(1))
      );

      const access_token = params.access_token;
      const refresh_token = params.refresh_token;

      if (!access_token || !refresh_token) {
        router.push("/login");
        return;
      }

      // Session setzen
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.error("Session Fehler:", error);
        router.push("/login");
        return;
      }

      // Erfolgreich → Dashboard
      router.push("/dashboard");
    }

    run();
  }, [router]);

  return (
    <div style={{ padding: 40 }}>
      <p>Wird geladen…</p>
    </div>
  );
}
