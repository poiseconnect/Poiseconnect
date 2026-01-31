export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

// ❗ KEIN NextResponse hier
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
    const body = await req.json();
    const { anfrageId, tarif } = body || {};

    if (!anfrageId || tarif === undefined) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const value = Number(tarif);
    if (!Number.isFinite(value)) {
      return json({ error: "INVALID_TARIF" }, 400);
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ honorar_klient: value })
      .eq("id", anfrageId);

    if (error) {
      console.error("❌ UPDATE TARIF ERROR:", error);
      return json(
        { error: "DB_UPDATE_FAILED", detail: error.message },
        500
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error("🔥 UPDATE TARIF SERVER ERROR:", err);
    return json(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
