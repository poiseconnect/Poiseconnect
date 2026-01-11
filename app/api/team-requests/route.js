export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { teamData } from "../../lib/teamData";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// kleine Helper-Funktion (optional, aber sauber)
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body || {};

    if (!email) {
      return json({ error: "missing_email" }, 400);
    }

    // Teammitglied anhand der Email finden
    const member = teamData.find(
      (m) => m.email?.toLowerCase() === email.toLowerCase()
    );

    if (!member) {
      return json({ requests: [] });
    }

    // wunschtherapeut = EMAIL (richtig 👍)
    const { data, error } = await supabase
      .from("anfragen")
      .select("*")
      .eq("wunschtherapeut", member.email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("TEAM REQUEST DB ERROR:", error);
      return json({ error: "db_error" }, 500);
    }

    return json({ requests: data });
  } catch (err) {
    console.error("TEAM REQUEST SERVER ERROR:", err);
    return json(
      { error: "server_error", detail: String(err) },
      500
    );
  }
}
