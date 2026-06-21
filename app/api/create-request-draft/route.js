export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const { anfrageId, wunschtherapeut, assigned_therapist_id } = body || {};

    if (!assigned_therapist_id) {
      return json({ error: "ASSIGNED_THERAPIST_ID_MISSING" }, 400);
    }

    const payload = {
      wunschtherapeut: wunschtherapeut || null,
      assigned_therapist_id,
      status: "draft",
      match_state: "draft",
    };

    if (anfrageId) {
      const { data, error } = await supabase
        .from("anfragen")
        .update(payload)
        .eq("id", anfrageId)
        .select("id, booking_token, assigned_therapist_id")
        .single();

      if (error) {
        console.error("DRAFT UPDATE ERROR:", error);
        return json({ error: error.message }, 500);
      }

      return json({
        ok: true,
        id: data.id,
        booking_token: data.booking_token,
        assigned_therapist_id: data.assigned_therapist_id,
      });
    }

    const { data, error } = await supabase
      .from("anfragen")
      .insert({
        ...payload,
        booking_token: crypto.randomUUID(),
      })
      .select("id, booking_token, assigned_therapist_id")
      .single();

    if (error) {
      console.error("DRAFT INSERT ERROR:", error);
      return json({ error: error.message }, 500);
    }

    return json({
      ok: true,
      id: data.id,
      booking_token: data.booking_token,
      assigned_therapist_id: data.assigned_therapist_id,
    });
  } catch (err) {
    console.error("CREATE REQUEST DRAFT ERROR:", err);
    return json({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
