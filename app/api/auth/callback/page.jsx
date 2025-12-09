"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleLogin() {
      // 1) Tokens aus URL-Hash holen
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      // Falls Tokens fehlen → zurück zum Login
      if (!access_token || !refresh_token) {
        router.replace("/login");
        return;
      }

      // 2) Session setzen (Supabase ohne Cookies)
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error || !data?.user) {
        console.error("Callback error:", error);
        router.replace("/login");
        return;
      }

      // 3) Team-Mail?
      const email = data.user.email?.toLowerCase();

      if (email === "hallo@mypoise.de") {
        router.replace("/dashboard");
      } else {
        router.replace("/");
      }
    }

    handleLogin();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      Login wird verarbeitet…
    </div>
  );
}
