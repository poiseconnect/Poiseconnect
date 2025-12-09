"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const hash = window.location.hash;

      if (!hash) {
        router.push("/login");
        return;
      }

      const params = Object.fromEntries(
        new URLSearchParams(hash.substring(1))
      );

      const access_token = params.access_token;
      const refresh_token = params.refresh_token;

      if (!access_token || !refresh_token) {
        router.push("/login");
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.error("Session Fehler:", error);
        router.push("/login");
        return;
      }

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
