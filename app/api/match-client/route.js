export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(req) {
  let body;

  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "INVALID_JSON" }),
      { status: 400 }
    );
  }

  console.log("MATCH BODY:", body);

  const {
    anfrageId,
    honorar,
    therapistEmail,
    nextDate,
    duration,
  } = body || {};

  if (
    !anfrageId ||
    honorar == null ||
    !therapistEmail ||
    !nextDate ||
    !duration
  ) {
    return new Response(
      JSON.stringify({
        error: "MISSING_FIELDS",
        received: body,
      }),
      { status: 400 }
    );
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
