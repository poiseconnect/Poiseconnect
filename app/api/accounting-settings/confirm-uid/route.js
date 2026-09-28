import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";
import { resolveCoachInvoiceTax } from "../../../lib/coachBilling.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
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

    const body = await req.json();
    const coachId = String(body.therapist_id || "").trim();
    if (!coachId) return json({ error: "THERAPIST_ID_MISSING" }, 400);

    const { data: settings, error: settingsError } = await supabase
      .from("therapist_invoice_settings")
      .select("therapist_id, business_country_code, vat_number")
      .eq("therapist_id", coachId)
      .maybeSingle();

    if (settingsError) return json({ error: "SETTINGS_LOAD_FAILED" }, 500);
    if (!settings) return json({ error: "SETTINGS_NOT_FOUND" }, 404);

    const uid = String(settings.vat_number || "").trim();
    if (!uid) return json({ error: "UID_REQUIRED" }, 400);

    const taxCheck = resolveCoachInvoiceTax({
      coachTaxProfile: {
        business_country_code: settings.business_country_code,
        vat_number: uid,
      },
      bundleType: "client_with_vat",
    });
    if (taxCheck.tax_reason !== "de_uid_not_confirmed") {
      return json({ error: "UID_CONFIRMATION_NOT_APPLICABLE" }, 400);
    }

    const confirmedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("therapist_invoice_settings")
      .update({
        uid_confirmed_at: confirmedAt,
        uid_confirmed_by: member.id,
      })
      .eq("therapist_id", coachId)
      .eq("vat_number", uid)
      .eq("business_country_code", settings.business_country_code)
      .select("therapist_id, business_country_code, vat_number, uid_confirmed_at, uid_confirmed_by")
      .maybeSingle();

    if (updateError) return json({ error: "UID_CONFIRMATION_FAILED" }, 500);
    if (!updated) return json({ error: "PROFILE_CHANGED_RETRY" }, 409);

    return json({ ok: true, settings: updated });
  } catch {
    return json({ error: "SERVER_ERROR" }, 500);
  }
}