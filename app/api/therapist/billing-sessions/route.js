export const dynamic = "force-dynamic";

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
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
    // ✅ AUTH CLIENT (korrekt mit Cookies)
    const supabaseAuth = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    // ✅ SERVICE ROLE CLIENT (für DB)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Team Member laden
    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (!member || !member.active) {
      return json({ error: "NO_TEAM_MEMBER" }, 403);
    }

    // Sessions nur für diesen Therapeuten
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
