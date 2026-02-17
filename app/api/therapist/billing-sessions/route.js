export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET() {
  try {
    // ✅ AUTH CLIENT MIT NEXT COOKIES
    const auth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${
              cookies().get("sb-access-token")?.value || ""
            }`,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser();

    if (authError || !user?.id) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    // ✅ SERVICE ROLE CLIENT
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: member, error: memberError } = await svc
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member?.id) {
      return json({ error: "NO_TEAM_MEMBER" }, 403);
    }

    if (!member.active) {
      return json({ error: "NOT_ACTIVE" }, 403);
    }

    // ✅ NUR EIGENE SESSIONS
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
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
