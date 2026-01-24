export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    // 🔹 BODY – GENAU EINMAL
    const body = await req.json();
    const { anfrageId } = body || {};

    console.log("📥 FINISH BODY:", body);

    if (!anfrageId) {
      return new Response(
        JSON.stringify({ error: "missing_anfrageId" }),
        { status: 400 }
      );
    }

    // 🔒 Prüfen: gibt es Sitzungen?
    const { count, error: countError } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("anfrage_id", anfrageId);

    if (countError) {
      console.error("❌ SESSION COUNT ERROR:", countError);
      return new Response(
        JSON.stringify({ error: "SESSION_CHECK_FAILED" }),
        { status: 500 }
      );
    }

    if (!count || count === 0) {
      return new Response(
        JSON.stringify({
          error: "BEENDET_NUR_ERLAUBT_WENN_SITZUNGEN_EXISTIEREN",
        }),
        { status: 400 }
      );
    }

    // ✅ Status auf beendet setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "beendet" })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("❌ FINISH UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({
          error: "UPDATE_FAILED",
          detail: updateError.message,
        }),
        { status: 500 }
      );
    }

    console.log("✅ COACHING BEENDET");

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {
    console.error("🔥 FINISH SERVER ERROR:", err);
    return new Response(
      JSON.stringify({
        error: "SERVER_ERROR",
        detail: String(err),
      }),
      { status: 500 }
    );
  }
}
