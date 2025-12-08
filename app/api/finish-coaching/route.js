// /app/api/finish-coaching/route.js
import { supabase } from "@/app/lib/supabase";

export async function POST(req) {
  const { anfrageId } = await req.json();

  const { error } = await supabase
    .from("anfragen")
    .update({ status: "finished" })
    .eq("id", anfrageId);

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "update_failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
