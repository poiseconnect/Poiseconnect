"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();

      // Falls keine Session → Login
      if (!session?.user) {
        router.push("/login");
        return;
      }

      const email = session.user.email?.toLowerCase();

      // HIER alle Team-Mails eintragen
      const teamEmails = [
        "hallo@mypoise.de",
        "support@mypoise.de",
        "linda@mypoise.de",
        "anna@mypoise.de",
        "ann@mypoise.de",
        // … ergänzen, so wie im Google Sheet
      ];

      // Team → Dashboard
      if (teamEmails.includes(email)) {
        router.push("/dashboard");
        return;
      }

      // Alle anderen → Klientenformular
      router.push("/");
    }

    checkUser();
  }, []);

  return <p>Bitte warten…</p>;
}
