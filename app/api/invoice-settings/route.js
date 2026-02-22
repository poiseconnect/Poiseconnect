import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const { therapist_id } = await req.json();

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

    const { data, error } = await supabase
      .from("therapist_invoice_settings")
      .select("*")
      .eq("therapist_id", therapist_id)
      .single();

    if (error && error.code !== "PGRST116") {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ settings: data || {} }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "SERVER_ERROR" }),
      { status: 500 }
    );
  }
}
