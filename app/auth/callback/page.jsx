"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    async function handleLogin() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      const email = session.user.email;

      // Liste deiner Team-E-Mails
      const teamEmails = [
        "hallo@mypoise.de",
        "support@mypoise.de",
        "linda@mypoise.de",
        "anna@mypoise.de",
        "ann@mypoise.de"
        // … alle aus deinem Sheets
      ];

      // Wenn Team-Mitglied → Dashboard
      if (teamEmails.includes(email.toLowerCase())) {
        router.push("/dashboard");
        return;
      }

      // Sonst → Formular Step 1
      router.push("/");
    }

    handleLogin();
  }, []);

  return <p>Bitte warten…</p>;
}
