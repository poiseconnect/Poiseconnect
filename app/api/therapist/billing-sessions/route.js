export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

    // 🔐 1️⃣ Bearer Token lesen
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return json({ error: "NO_TOKEN" }, 401);
    }

    // 🔐 2️⃣ User via Anon Client prüfen
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const {
      data: { user },
      error: authError,
    } = await anon.auth.getUser(token);

    if (authError || !user?.id) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    // 🔎 3️⃣ Team Member holen
    const { data: member, error: memberError } = await svc
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member?.id) {
      return json({ error: "NO_TEAM_MEMBER" }, 403);
    }

    if (member.role !== "therapist") {
      return json({ error: "NOT_THERAPIST" }, 403);
    }

    if (!member.active) {
      return json({ error: "NOT_ACTIVE" }, 403);
    }

    // 📊 4️⃣ Nur eigene Sessions laden
    const { data, error } = await svc
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
      .eq("therapist_id", member.id)
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
