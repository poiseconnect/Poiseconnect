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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const { data, error } = await supabase
      .from("sessions")
      .select(`
        id,
        date,
        duration_min,
        price,
        therapist,
        anfrage_id,
        anfragen (
          vorname,
          nachname,
          status
        )
      `)
      .eq("therapist", user.email)
      .order("date", { ascending: false });

    if (error) {
      console.error("THERAPIST BILLING ERROR:", error);
      return json({ error: error.message }, 500);
    }

    return json({ data });
  } catch (err) {
    console.error("THERAPIST BILLING SERVER ERROR:", err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
