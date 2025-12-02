import { supabase } from "../../../lib/supabase";

export async function POST(req) {
  try {
    const { requestId, client, therapist } = await req.json();

    const { error } = await supabase
      .from("anfragen")
      .update({
        status: "neuer-termin-angefragt",
        angefragt_von: therapist,
      })
      .eq("id", requestId);

    if (error) {
      console.error("New Appointment Error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("New Appointment Catch:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
