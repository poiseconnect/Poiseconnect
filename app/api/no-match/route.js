export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { anfrageId } = await req.json();

    if (!anfrageId) {
      return new Response(
        JSON.stringify({ error: "missing_anfrageId" }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ status: "papierkorb" })
      .eq("id", anfrageId);

    if (error) {
      console.error("NO-MATCH ERROR:", error);
      return new Response(
        JSON.stringify({ error: "update_failed" }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("NO-MATCH SERVER ERROR:", e);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500 }
    );
  }
}
