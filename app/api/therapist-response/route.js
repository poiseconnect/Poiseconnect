export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

// ---------- Supabase Server Client ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------- Redirect Helper ----------
function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
    },
  });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const client = url.searchParams.get("client");
    const therapist = url.searchParams.get("therapist");
    const terminIso = url.searchParams.get("termin");

    console.log("Therapist response:", action, client, therapist, terminIso);

    const FRONTEND = "https://poiseconnect.vercel.app";

    // --- A) Termin bestätigen ---
    if (action === "confirm") {
      if (client && therapist && terminIso) {
        await supabase.from("confirmed_appointments").insert({
          therapist,
          client_email: client,
          termin_iso: terminIso,
        });
      }

      return redirect(
        `${FRONTEND}/?resume=confirmed&email=${encodeURIComponent(client)}`
      );
    }

    // --- B) Neuer Termin, gleiche Begleitung ---
    if (action === "rebook_same") {
      return redirect(
        `${FRONTEND}/?resume=10&email=${encodeURIComponent(
          client
        )}&therapist=${encodeURIComponent(therapist)}`
      );
    }

    // --- C) Anderes Teammitglied auswählen ---
    if (action === "rebook_other") {
      return redirect(
        `${FRONTEND}/?resume=5&email=${encodeURIComponent(client)}`
      );
    }

    // Fallback → JSON mit Error
    return new Response(
      JSON.stringify({ ok: false, error: "UNKNOWN_ACTION", action }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);

    return new Response(
      JSON.stringify({ ok: false, error: "SERVER_ERROR", detail: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
