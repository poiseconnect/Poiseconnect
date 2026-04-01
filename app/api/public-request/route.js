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

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({ error: "MISSING_ID" }, 400);
    }

    const supabase = getSupabase();
    if (!supabase) {
      return json({ error: "SUPABASE_NOT_CONFIGURED" }, 500);
    }

    const { data, error } = await supabase
      .from("anfragen")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    return json({ request: data });
  } catch (err) {
    console.error("PUBLIC REQUEST ERROR:", err);
    return json(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
