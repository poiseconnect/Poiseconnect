import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return req.cookies.get(name)?.value;
          },
        },
      }
    );

    // 1️⃣ Auth User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    // 2️⃣ Team-Mitglied über user_id holen
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member?.id) {
      return json({ error: "NO_TEAM_MEMBER" }, 403);
    }

    // 3️⃣ Sessions laden
    let query = supabase
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
          status
        )
      `)
      .order("date", { ascending: false });

    // ✅ NUR Therapeut:innen filtern
    if (member.role === "therapist") {
      query = query.eq("therapist_id", member.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("BILLING QUERY ERROR:", error);
      return json({ error: error.message }, 500);
    }

    return json({ data });
  } catch (err) {
    console.error("BILLING SERVER ERROR:", err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
