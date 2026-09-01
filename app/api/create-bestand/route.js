export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { ensureOpenConversation } from "../../lib/messaging/conversations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      vorname,
      nachname,
      email,
      telefon,
      strasse_hausnr,
      plz_ort,
      geburtsdatum,
      beschaeftigungsgrad,
      wunschtherapeut,
      therapist_id,
    } = body || {};

    if (!vorname || !nachname || !wunschtherapeut || !therapist_id) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const { data: created, error } = await supabase.from("anfragen").insert({
      vorname,
      nachname,
      email: email || null,
      telefon: telefon || null,
      strasse_hausnr: strasse_hausnr || null,
      plz_ort: plz_ort || null,
      geburtsdatum: geburtsdatum || null,
      beschaeftigungsgrad: beschaeftigungsgrad || null,
      wunschtherapeut,
      assigned_therapist_id: therapist_id,
      status: "active",
      quelle: "bestand",
    }).select("id").single();

    if (error) {
      console.error("CREATE BESTAND DB ERROR:", { code: error?.code || null });
      return json(
        { error: "DB_ERROR", detail: "INTERNAL_ERROR" },
        500
      );
    }

    await ensureOpenConversation({
      supabase,
      anfrageId: created.id,
      therapistId: therapist_id,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("CREATE BESTAND SERVER ERROR");
    return json(
      { error: "SERVER_ERROR", detail: "INTERNAL_ERROR" },
      500
    );
  }
}
