export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import {
  loadCoachInvoice,
  normalizeBillingPeriod,
} from "../_lib/coachInvoice";
import {
  toSemanticBundleType,
} from "../../../lib/coachBilling.js";
import { buildEditableCoachInvoicePayload } from "../../../lib/coachInvoiceDraft.js";

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
    console.error("GET USER FROM TOKEN ERROR:", { code: error?.code || null });
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
    const bundleType =
      normalizeString(body.bundle_type) || toSemanticBundleType(bundleKey);

    if (!coachId) {
      return json({ error: "missing_coach_id" }, 400);
    }

    if (!billingMode) {
      return json({ error: "missing_billing_mode" }, 400);
    }

    if (!bundleType) {
      return json({ error: "missing_bundle_key" }, 400);
    }

    const period = normalizeBillingPeriod({
      billingMode,
      billingYear,
      billingQuarter,
      billingMonth,
      billingDate: body.billing_date,
    });
    if (!period.invoiceSupported) {
      return json({ error: "single_day_invoice_not_supported" }, 400);
    }

    const invoiceLookup = {
      coachId,
      period,
      bundleType,
    };
    const { data: existing, error: existingError } =
      await loadCoachInvoice(supabase, invoiceLookup);
    if (existingError) {
      return json(
        {
          error:
            existingError.code === "AMBIGUOUS_INVOICE_PERIOD"
              ? "ambiguous_legacy_invoice_period"
              : "existing_invoice_load_failed",
        },
        existingError.code === "AMBIGUOUS_INVOICE_PERIOD" ? 409 : 500
      );
    }

    const now = new Date().toISOString();
    let payload;
    try {
      payload = buildEditableCoachInvoicePayload({
        body: { ...body, coach_id: coachId },
        existing,
        period,
        bundleType,
        updatedBy: auth.member.id,
        updatedAt: now,
      });
    } catch (error) {
      return json({ error: error.message || "invalid_invoice_data" }, 400);
    }

    let result;
    let saveError;
    if (existing) {
      const updateResult = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      result = updateResult.data;
      saveError = updateResult.error;
    } else {
      const insertResult = await supabase
        .from(TABLE_NAME)
        .insert({
          ...payload,
          created_by: auth.member.id,
          created_at: now,
        })
        .select()
        .maybeSingle();
      result = insertResult.data;
      saveError = insertResult.error;
    }

    if (saveError || !result) {
      return json(
        {
          error: saveError?.code === "23505"
            ? "draft_already_exists_reload_required"
            : "save_failed",
        },
        saveError?.code === "23505" ? 409 : 500
      );
    }

    return json({ ok: true, data: result, bundle_type: bundleType });
  } catch (err) {
    console.error("SAVE COACH INVOICE SERVER ERROR");
    return json(
      {
        error: "server_error",
        detail: "INTERNAL_ERROR",
      },
      500
    );
  }
}
