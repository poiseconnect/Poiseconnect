import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const { sessionId, date, duration } = await req.json();

  if (!sessionId || !date) {
    return Response.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      date: new Date(date).toISOString(),
      duration_min: Number(duration),
    })
    .eq("id", sessionId);

  if (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
