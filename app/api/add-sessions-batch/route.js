import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { anfrageId, therapist, sessions } = body;

    if (!anfrageId || !Array.isArray(sessions)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400 }
      );
    }

    const rows = sessions.map((s) => ({
      anfrage_id: anfrageId,
      therapist,
      date: s.date,
      duration_min: s.duration,
      price: s.price,
    }));

    const { error } = await supabase.from("sessions").insert(rows);

    if (error) {
      console.error("ADD SESSIONS ERROR", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("ADD SESSIONS SERVER ERROR", e);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500 }
    );
  }
}
