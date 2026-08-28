export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

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

export async function POST(req) {
  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return json({ error: "missing_request_id" }, 400);
    }

    const { data: request, error } = await supabase
      .from("anfragen")
      .select("booking_token")
      .eq("id", requestId)
      .single();

    if (error || !request?.booking_token) {
      console.error("LEGACY LINK RESOLVE ERROR:", { code: error?.code || null });

      return json(
        { error: "request_not_found" },
        404
      );
    }

    return json({
      token: request.booking_token,
    });
  } catch (e) {
    console.error("LEGACY LINK SERVER ERROR");

    return json(
      {
        error: "server_error",
        detail: "INTERNAL_ERROR",
      },
      500
    );
  }
}
