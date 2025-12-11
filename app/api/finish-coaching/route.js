export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("FINISH COACHING BODY:", body);

    const { anfrageId } = body;

    if (!anfrageId) {
      return new Response(
        JSON.stringify({ error: "missing_anfrageId" }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ status: "beendet" }) // ⚠️ konsistent mit deinem Frontend
      .eq("id", anfrageId);

    if (error) {
      console.error("FINISH ERROR:", error);
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
    console.error("FINISH SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
