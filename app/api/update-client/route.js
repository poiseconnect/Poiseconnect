export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

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
      anfrageId,
      email,
      telefon,
      strasse_hausnr,
      plz_ort,
      geburtsdatum,
      beschaeftigungsgrad,
    } = body || {};

    if (!anfrageId) {
      return json({ error: "MISSING_ID" }, 400);
    }

    const { error } = await supabase
      .from("anfragen")
      .update({
        email: email || null,
        telefon: telefon || null,
        strasse_hausnr: strasse_hausnr || null,
        plz_ort: plz_ort || null,
        geburtsdatum: geburtsdatum || null,
        beschaeftigungsgrad: beschaeftigungsgrad || null,
      })
      .eq("id", anfrageId);

    if (error) {
      console.error("UPDATE CLIENT DB ERROR:", error);
      return json(
        { error: "DB_ERROR", detail: error.message },
        500
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error("UPDATE CLIENT SERVER ERROR:", err);
    return json(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
