export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("BODY RECEIVED:", body);

    const { therapist_id, ...settings } = body;

    if (!therapist_id) {
      return new Response(
        JSON.stringify({ error: "THERAPIST_ID_MISSING", body }),
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("therapist_invoice_settings")
      .upsert(
        {
          therapist_id,
          ...settings,
        },
        { onConflict: "therapist_id" }
      )
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({
          error: "SUPABASE_ERROR",
          detail: error.message,
          hint: error.hint,
        }),
        { status: 400 }
      );
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
    });

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "SERVER_ERROR",
        detail: String(err),
      }),
      { status: 500 }
    );
  }
}
