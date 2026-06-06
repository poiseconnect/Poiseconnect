export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function sendJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { anfrageId, invoice_with_vat } = body || {};

    if (!anfrageId || typeof invoice_with_vat !== "boolean") {
      return sendJson(
        { error: "MISSING_FIELDS", received: body },
        400
      );
    }

    const { data, error } = await supabase
      .from("anfragen")
      .update({ invoice_with_vat })
      .eq("id", anfrageId)
      .select("id, invoice_with_vat")
      .single();

    if (error) {
      console.error("UPDATE INVOICE SETTING SUPABASE ERROR:", error);
      return sendJson({ error: error.message }, 500);
    }

    return sendJson({ ok: true, data });
  } catch (error) {
    console.error("UPDATE INVOICE SETTING SERVER ERROR:", error);

    return sendJson(
      {
        error: "SERVER_ERROR",
        message: error?.message || String(error),
      },
      500
    );
  }
}
