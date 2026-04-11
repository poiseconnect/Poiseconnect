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
    .select("id, role, active")
    .eq("email", user.email)
    .single();

  if (error || !member || member.active !== true || member.role !== "admin") {
    return { error: json({ error: "forbidden" }, 403) };
  }

  return { user, member };
}

function formatDateDE(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-AT");
}

export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const body = await req.json();

    const coach = body?.coach || null;
    const invoiceBundle = body?.invoiceBundle || null;
    const periodLabel = body?.periodLabel || "";
    const poiseSettings = body?.poiseSettings || null;

    if (!coach?.id) {
      return json({ error: "missing_coach_id" }, 400);
    }

    if (
      !invoiceBundle ||
      !Array.isArray(invoiceBundle.rows) ||
      !invoiceBundle.rows.length
    ) {
      return json({ error: "missing_invoice_bundle" }, 400);
    }

    const { data: coachMember, error: coachError } = await supabase
      .from("team_members")
      .select("id, profile_name, sevdesk_contact_id")
      .eq("id", String(coach.id))
      .single();

    if (coachError || !coachMember) {
      console.error("COACH LOAD ERROR:", coachError);
      return json(
        { error: "coach_not_found", detail: coachError?.message || null },
        404
      );
    }

    if (!coachMember.sevdesk_contact_id) {
      return json(
        {
          error: "missing_sevdesk_contact_id",
          detail:
            "Für diesen Coach ist keine sevdesk_contact_id in team_members hinterlegt.",
        },
        400
      );
    }

    const apiToken = process.env.SEVDESK_API_TOKEN;
    if (!apiToken) {
      return json(
        {
          error: "missing_env",
          detail: "SEVDESK_API_TOKEN fehlt in den Environment Variables.",
        },
        500
      );
    }

    const invoiceDate = new Date();
    const invoiceDateStr = invoiceDate.toISOString().slice(0, 10);

    const invoiceName =
      invoiceBundle.key === "reverse_charge"
        ? `Poise Provision ${periodLabel} Reverse Charge`
        : `Poise Provision ${periodLabel}`;

    const invoiceHeader = {
      contact: {
        id: String(coachMember.sevdesk_contact_id),
        objectName: "Contact",
      },
      invoiceDate: invoiceDateStr,
      header: invoiceName,
      headText:
        invoiceBundle.key === "reverse_charge"
          ? `Provision für ${periodLabel}. Reverse-Charge-Verfahren.`
          : `Provision für ${periodLabel}.`,
      footText:
        invoiceBundle.key === "reverse_charge"
          ? "Reverse Charge – Steuerschuld geht auf den Leistungsempfänger über."
          : "",
      timeToPay: 14,
      discount: 0,
      address: poiseSettings?.address || "",
      taxRate: Number(invoiceBundle.vat_rate || 0),
    taxText:
  invoiceBundle.key === "reverse_charge"
    ? "Reverse Charge"
    : `${Number(invoiceBundle.vat_rate || 0)}% USt`,
