export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "NO_TOKEN" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    // ✅ USER AUS TOKEN HOLEN (STABIL)
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "INVALID_USER" }, 401);
    }

    // ✅ TEAM MEMBER LADEN
    const { data: member, error: memberError } = await supabaseAdmin
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return json({ error: "NO_TEAM_MEMBER" }, 403);
    }

    if (member.role !== "therapist") {
      return json({ error: "NOT_THERAPIST" }, 403);
    }

    if (!member.active) {
      return json({ error: "NOT_ACTIVE" }, 403);
    }

    // ✅ NUR EIGENE SESSIONS
    const { data, error } = await supabaseAdmin
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
.or(`therapist_id.eq.${member.id},therapist_id.eq.${user.id}`)
      .order("date", { ascending: false });

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ data: data || [] });

  } catch (err) {
    console.error("THERAPIST BILLING ERROR:", err);
    return json({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
