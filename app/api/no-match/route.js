export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ WICHTIG:
 * In app/api/** IMMER eigenen Supabase-Client verwenden
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { anfrageId } = body || {};

    console.log("NO-MATCH BODY:", body);

    if (!anfrageId) {
      return new Response(
        JSON.stringify({ error: "missing_anfrageId" }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ status: "kein_match" }) // ⚠️ konsistent mit deinem Frontend
      .eq("id", anfrageId);

    if (error) {
      console.error("NO-MATCH UPDATE ERROR:", error);
      return new Response(
        JSON.stringify({
          error: "update_failed",
          detail: error.message,
        }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error("NO-MATCH SERVER ERROR:", err);
    return new Response(
      JSON.stringify({
        error: "server_error",
        detail: String(err),
      }),
      { status: 500 }
    );
  }
}
