export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE_NAME = "coach_invoices";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromBearer(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error("GET USER FROM TOKEN ERROR:", error);
    return null;
  }

  return user;
}

async function requireAdmin(req) {
  const user = await getUserFromBearer(req);
  if (!user) return { error: json({ error: "unauthorized" }, 401) };

  const { data: member, error } = await supabase
    .from("team_members")
    .select("id, email, role, active")
    .eq("email", user.email)
    .single();

  if (error || !member || member.active !== true || member.role !== "admin") {
    return { error: json({ error: "forbidden" }, 403) };
  }

  return { user, member };
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function normalizeIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const body = await req.json();

    const coachId = normalizeString(body.coach_id);
    const billingMode = normalizeString(body.billing_mode);
    const billingYear = normalizeIntegerOrNull(body.billing_year);
    const billingQuarter = normalizeIntegerOrNull(body.billing_quarter);
    const billingMonth = normalizeIntegerOrNull(body.billing_month);
    const bundleKey = normalizeString(body.bundle_key);

    if (!coachId) {
      return json({ error: "missing_coach_id" }, 400);
    }

    if (!billingMode) {
      return json({ error: "missing_billing_mode" }, 400);
    }

    if (!bundleKey) {
      return json({ error: "missing_bundle_key" }, 400);
    }

    const lineItems = Array.isArray(body.line_items) ? body.line_items : [];

    const payload = {
      coach_id: coachId,
      billing_mode: billingMode,
      billing_year: billingYear,
      billing_quarter: billingQuarter,
      billing_month: billingMonth,
      bundle_key: bundleKey,

      invoice_number: normalizeString(body.invoice_number),
      invoice_date: normalizeString(body.invoice_date),
      service_period: normalizeString(body.service_period),

      customer_number: normalizeString(body.customer_number),
      contact_person: normalizeString(body.contact_person),

      client_name: normalizeString(body.client_name),
      client_street: normalizeString(body.client_street),
      client_city: normalizeString(body.client_city),
      client_country: normalizeString(body.client_country),
      client_email: normalizeString(body.client_email),

      salutation: normalizeString(body.salutation),
      intro_text: normalizeString(body.intro_text),
      payment_terms: normalizeString(body.payment_terms),
      closing_text: normalizeString(body.closing_text),

      invoice_with_vat: body.invoice_with_vat === true,
      vat_rate: safeNumber(body.vat_rate, 0),
      total_net: safeNumber(body.total_net, 0),
      vat_amount: safeNumber(body.vat_amount, 0),
      total_gross: safeNumber(body.total_gross, 0),

      line_items: lineItems.map((item, idx) => ({
        id: normalizeString(item.id) || `${idx + 1}`,
        pos: safeNumber(item.pos, idx + 1),
        description: normalizeString(item.description) || "Provision",
        qty: safeNumber(item.qty, 0),
        unit_price: safeNumber(item.unit_price, 0),
        total: safeNumber(item.total, 0),
      })),

      sevdesk_invoice_id: normalizeString(body.sevdesk_invoice_id),
      sevdesk_invoice_number: normalizeString(body.sevdesk_invoice_number),
      sevdesk_synced_at: body.sevdesk_synced_at || null,

      updated_by: auth.member.id,
      updated_at: new Date().toISOString(),
    };

    const uniqueMatch = {
      coach_id: coachId,
      billing_mode: billingMode,
      billing_year: billingYear,
      billing_quarter: billingQuarter,
      billing_month: billingMonth,
      bundle_key: bundleKey,
    };

    const { data: existing, error: existingError } = await supabase
      .from(TABLE_NAME)
      .select("id")
      .match(uniqueMatch)
      .maybeSingle();

    if (existingError) {
      console.error("SAVE COACH INVOICE EXISTING CHECK ERROR:", existingError);
      return json(
        {
          error: "existing_check_failed",
          detail: existingError.message,
        },
        500
      );
    }

    let result;
    let saveError;

    if (existing?.id) {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();

      result = data;
      saveError = error;
    } else {
      const insertPayload = {
        ...payload,
        created_by: auth.member.id,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert(insertPayload)
        .select()
        .single();

      result = data;
      saveError = error;
    }

    if (saveError) {
      console.error("SAVE COACH INVOICE ERROR:", saveError);
      return json(
        {
          error: "save_failed",
          detail: saveError.message,
        },
        500
      );
    }

    return json({
      ok: true,
      data: result,
    });
  } catch (err) {
    console.error("SAVE COACH INVOICE SERVER ERROR:", err);
    return json(
      {
        error: "server_error",
        detail: String(err),
      },
      500
    );
  }
}
