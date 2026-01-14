import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { anfrageId, tarif } = body;

    if (!anfrageId) {
      return new Response(
        JSON.stringify({ error: "Missing anfrageId" }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ honorar_klient: tarif })
      .eq("id", anfrageId);

    if (error) {
      console.error("UPDATE TARIF ERROR", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("UPDATE TARIF SERVER ERROR", e);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500 }
    );
  }
}
