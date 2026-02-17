export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(req) {
  try {
    const svc = getServiceClient();

    // 🔥 TOKEN AUS HEADER HOLEN
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return json({ error: "NO_AUTH_HEADER" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    // 🔥 User über Token authentifizieren
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user?.id) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    // 🔥 Team Member laden (Service Role)
    const { data: member, error: memberError } = await svc
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member?.id) {
      return json({ error: "NO_TEAM_MEMBER" }, 403);
    }

    if (member.active !== true) {
      return json({ error: "NOT_ACTIVE" }, 403);
    }

    // 🔥 Sessions Query
    let query = svc
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

    // 🔒 Nur eigene Sessions wenn Therapeut
    if (member.role === "therapist") {
      query = query.eq("therapist_id", member.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("BILLING QUERY ERROR:", error);
      return json({ error: error.message }, 500);
    }

    return json({ data: data || [] });
  } catch (err) {
    console.error("THERAPIST BILLING SERVER ERROR:", err);
    return json({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
