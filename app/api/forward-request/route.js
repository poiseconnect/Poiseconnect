import { supabase } from "../../../lib/supabase";

export async function POST(req) {
  try {
    const { requestId, client, vorname } = await req.json();

    const { error } = await supabase
      .from("anfragen")
      .update({
        status: "weitergeleitet",
      })
      .eq("id", requestId);

    if (error) {
      console.error("Forward Error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("Forward Catch:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
