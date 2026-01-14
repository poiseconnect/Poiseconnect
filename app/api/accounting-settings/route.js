import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const body = await req.json();
  const {
    therapist_email,
    sevdesk_token,
    ust_pflichtig,
    ust_satz,
    uid_nummer,
  } = body;

  const { error } = await supabase
    .from("accounting_settings")
    .upsert(
      {
        therapist_email,
        sevdesk_token,
        ust_pflichtig,
        ust_satz,
        uid_nummer,
      },
      { onConflict: "therapist_email" }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

export async function GET(req) {
  const email = req.headers.get("x-user-email");
  if (!email) {
    return Response.json({ error: "Missing email" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("accounting_settings")
    .select("*")
    .eq("therapist_email", email)
    .single();

  if (error && error.code !== "PGRST116") {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ settings: data || null });
}
