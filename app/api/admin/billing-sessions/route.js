import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("sessions")
.select(`
  id,
  date,
  duration_min,
  price,
  therapist_id,
  anfrage_id,
anfragen (
  vorname,
  nachname,
  email,
  strasse_hausnr,
  plz_ort,
  status
),
  team_members (
    id,
    name,
    email
  )
`)
      .order("date", { ascending: false });

    if (error) {
      console.error("ADMIN BILLING ERROR:", error);
      return json({ error: error.message }, 500);
    }

    return json({ data });
  } catch (err) {
    console.error("ADMIN BILLING SERVER ERROR:", err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
