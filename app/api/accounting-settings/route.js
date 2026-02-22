import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json();
    const { therapist_id, ...settings } = body;

    if (!therapist_id) {
      return new Response(
        JSON.stringify({ error: "THERAPIST_ID_REQUIRED" }),
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from("therapist_invoice_settings")
      .upsert(
        {
          therapist_id,
          ...settings,
        },
        {
          onConflict: "therapist_id",
        }
      );

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "SERVER_ERROR" }),
      { status: 500 }
    );
  }
}
