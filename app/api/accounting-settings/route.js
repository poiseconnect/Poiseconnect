export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "INVALID_JSON" }, 400);

    const therapist_email = String(body.therapist_email || "").trim().toLowerCase();
    if (!therapist_email) {
      return json({ error: "MISSING_THERAPIST_EMAIL" }, 400);
    }

    // ✅ OPTIONAL: du kannst hier Pflichtfelder definieren.
    // Ich mache es absichtlich "weich", damit Speichern nicht dauernd scheitert.
    // Wenn du es strenger willst: company_name/address/iban checken.
    const payload = {
      therapist_email,
      company_name: body.company_name ?? "",
      address: body.address ?? "",
      iban: body.iban ?? "",
      bic: body.bic ?? "",
      logo_url: body.logo_url ?? "",
      tax_number: body.tax_number ?? "",
      vat_number: body.vat_number ?? "",
      default_vat_country: body.default_vat_country ?? "AT",
      default_vat_rate: Number(body.default_vat_rate ?? 0),
      sevdesk_token: body.sevdesk_token ?? null,
      updated_at: new Date().toISOString(),
    };

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ Upsert anhand therapist_email
    const { data, error } = await supabaseAdmin
      .from("therapist_invoice_settings")
      .upsert(payload, { onConflict: "therapist_email" })
      .select()
      .single();

    if (error) {
      console.error("❌ SUPABASE upsert error:", error);
      return json(
        { error: "SUPABASE_ERROR", detail: error.message, hint: error.hint },
        400
      );
    }

    return json({ ok: true, settings: data });
  } catch (err) {
    console.error("ACCOUNTING-SETTINGS SERVER ERROR:", err);
    return json({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
