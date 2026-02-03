export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ✅ ANON Client (nur für Auth via Cookies)
function getAuthClient(req) {
  return createClient(
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
}

// ✅ SERVICE Client (für DB Queries, bypass RLS)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(req) {
  try {
    const auth = getAuthClient(req);
    const svc = getServiceClient();

    // 1) User via Cookie Session
    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser();

    if (authError || !user?.id) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    // 2) Team Member (service role, damit IMMER klappt)
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

    // 3) Sessions laden
    let query = svc
      .from("sessions")
      .select(
        `
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
      `
      )
      .order("date", { ascending: false });

    // ✅ Therapeut: nur eigene Sessions
    if (member.role === "therapist") {
      query = query.eq("therapist_id", member.id);
    }

    // ✅ Admin: alles sehen (kein Filter)
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
