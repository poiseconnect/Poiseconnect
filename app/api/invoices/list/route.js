import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { searchParams } = new URL(req.url);
  const therapistId = searchParams.get("therapist_id");

  if (!therapistId) {
    return new Response(JSON.stringify({ error: "NO_THERAPIST_ID" }), {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("therapist_id", therapistId)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
    });
  }

  return new Response(JSON.stringify({ data }), { status: 200 });
}
