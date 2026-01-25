export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { confirmAppointment } from "@/lib/handlers/confirmAppointment";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, status, client, vorname } = body;

    if (!requestId || !status) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       1️⃣ SPEZIELLE STATUS-LOGIK
    -------------------------------------------------- */
    if (status === "termin_bestaetigt") {
      await confirmAppointment({
        supabase,
        requestId,
        client,
        vorname,
      });

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200 }
      );
    }

    /* --------------------------------------------------
       2️⃣ STANDARD-STATUS (kein Spezialfall)
    -------------------------------------------------- */
    const { error } = await supabase
      .from("anfragen")
      .update(
        { status },
        { returning: "minimal" }
      )
      .eq("id", requestId);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {
    console.error("🔥 update-status error:", err);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500 }
    );
  }
}
