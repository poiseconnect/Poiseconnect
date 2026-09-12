export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

export const PUBLIC_REQUEST_SELECT_FIELDS = [
  "id",
  "booking_token",
  "vorname",
  "nachname",
  "email",
  "telefon",
  "strasse_hausnr",
  "plz_ort",
  "geburtsdatum",
  "beschaeftigungsgrad",
  "themen",
  "anliegen",
  "leidensdruck",
  "verlauf",
  "diagnose",
  "ziel",
  "coaching_typ",
  "wunschtherapeut",
  "assigned_therapist_id",
  "admin_therapeuten",
  "structured_time_preference",
  "bevorzugte_zeit",
].join(", ");

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const token = url.searchParams.get("token");

    if (!id) {
      return json({ error: "MISSING_ID" }, 400);
    }

    const supabase = getSupabase();
    if (!supabase) {
      return json({ error: "SUPABASE_NOT_CONFIGURED" }, 500);
    }

    let query = supabase
      .from("anfragen")
      .select(PUBLIC_REQUEST_SELECT_FIELDS)
      .eq("id", id);

    if (token) {
      query = query.eq("booking_token", token);
    } else {
      // LEGACY_RESUME_WITHOUT_TOKEN: Allow backwards compatibility for existing links without token parameter.
      // Strictly limited to whitelisted fields.
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    return json({ request: data });
  } catch (err) {
    console.error("PUBLIC REQUEST ERROR");
    return json(
      { error: "SERVER_ERROR", detail: "INTERNAL_ERROR" },
      500
    );
  }
}
