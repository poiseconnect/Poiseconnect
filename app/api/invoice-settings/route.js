import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "hallo@mypoise.de";

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

// POST = load own settings
export async function POST(req) {
  try {
    const body = await req.json();
    const { user_email } = body || {};
    if (!user_email) return json({ error: "MISSING_USER" }, 400);

    const { data, error } = await supabase
      .from("therapist_invoice_settings")
      .select("*")
      .eq("therapist_email", user_email)
      .maybeSingle();

    if (error) {
      console.error("LOAD INVOICE SETTINGS ERROR:", error);
      return json({ error: "LOAD_FAILED" }, 500);
    }

    return json({ ok: true, settings: data || null });
  } catch (err) {
    console.error("INVOICE SETTINGS POST ERROR:", err);
    return json({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}

// PUT = save (own) settings (admin can save for all)
export async function PUT(req) {
  try {
    const body = await req.json();
    const { user_email, therapist_email, settings } = body || {};

    const target = therapist_email || user_email;
    if (!user_email || !target) return json({ error: "MISSING_USER" }, 400);

    const isAdmin = user_email === ADMIN_EMAIL;
    const isOwner = user_email === target;

    if (!isAdmin && !isOwner) return json({ error: "FORBIDDEN" }, 403);

    const payload = {
      therapist_email: target,
      company_name: settings?.company_name || null,
      address: settings?.address || null,
      iban: settings?.iban || null,
      bic: settings?.bic || null,
      logo_url: settings?.logo_url || null,
      default_vat_country: settings?.default_vat_country || null,
      default_vat_rate: settings?.default_vat_rate ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("therapist_invoice_settings")
      .upsert(payload, { onConflict: "therapist_email" });

    if (error) {
      console.error("SAVE INVOICE SETTINGS ERROR:", error);
      return json({ error: "SAVE_FAILED" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("INVOICE SETTINGS PUT ERROR:", err);
    return json({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
