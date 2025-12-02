import { supabase } from "../../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();
    const { requestId, therapist, client, slot } = body;

    // Anfrage in Supabase als bestätigt speichern
    const { error } = await supabase
      .from("anfragen")
      .update({
        status: "bestätigt",
        bestätigter_termin: slot,
        bestätigter_therapeut: therapist,
      })
      .eq("id", requestId);

    if (error) {
      console.error("Supabase Update Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    // Erfolg
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("API Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
