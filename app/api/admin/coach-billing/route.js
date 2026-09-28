import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";
import {
  loadCoachBillingContext,
  loadCoachInvoicesForPeriod,
} from "../../invoices/_lib/coachInvoice";
import {
  toSemanticBundleType,
} from "../../../lib/coachBilling.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { user, error: authError } = await getUserFromBearer(req);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    const supabase = supabaseAdmin();
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member || member.active !== true || member.role !== "admin") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const searchParams = new URL(req.url).searchParams;
    const coachId = String(searchParams.get("coachId") || "").trim();
    if (!coachId) return json({ error: "missing_coach_id" }, 400);

    const periodInput = {
      billingMode: searchParams.get("billingMode"),
      billingYear: searchParams.get("billingYear"),
      billingQuarter: searchParams.get("billingQuarter"),
      billingMonth: searchParams.get("billingMonth"),
      billingDate: searchParams.get("billingDate"),
    };
    const context = await loadCoachBillingContext(supabase, {
      coachId,
      periodInput,
    });

    if (context.error) {
      const status = context.error.code === "PGRST116" ? 404 : 500;
      return json({ error: "billing_context_load_failed" }, status);
    }

    const { data: invoices, error: invoicesError } =
      await loadCoachInvoicesForPeriod(supabase, {
        coachId,
        period: context.period,
      });

    if (invoicesError) {
      return json({ error: "invoice_state_load_failed" }, 500);
    }

    const invoicesByBundleType = new Map();
    for (const invoice of invoices || []) {
      const bundleType = toSemanticBundleType(invoice.bundle_key);
      if (!bundleType) continue;
      const group = invoicesByBundleType.get(bundleType) || [];
      group.push(invoice);
      invoicesByBundleType.set(bundleType, group);
    }

    return json({
      coach: context.coach,
      billingPeriod: context.period,
      bundles: context.bundles.map((bundle) => {
        const matches = invoicesByBundleType.get(bundle.bundle_type) || [];
        const invoice = matches[0] || null;
        const invoiceConflict = matches.length > 1;
        return {
          ...bundle,
          key: bundle.bundle_key,
          invoice_id: invoice?.id || null,
          invoice_state: invoiceConflict
            ? "ambiguous"
            : invoice
              ? "saved_draft"
              : "automatic_draft",
          invoice_conflict: invoiceConflict,
          invoice_supported: context.period.invoiceSupported && !invoiceConflict,
        };
      }),
    });
  } catch (error) {
    return json(
      { error: "invalid_billing_period_or_server_error" },
      error instanceof TypeError ? 400 : 500
    );
  }
}