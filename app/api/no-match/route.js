export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();
    const { anfrageId } = body;

    console.log("NO-MATCH BODY:", body);

    if (!anfrageId) {
      return new Response(
        JSON.stringify({ error: "missing_anfrageId" }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ status: "no_match" })
      .eq("id", anfrageId);

    if (error) {
      console.error("NO-MATCH UPDATE ERROR:", error);
      return new Response(
        JSON.stringify({ error: "update_failed", detail: error }),
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
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
