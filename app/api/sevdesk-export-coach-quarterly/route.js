export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SEVDESK_PART_ID = "55040478";
const SEVDESK_UNITY_ID = "1";

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

function buildInvoiceHeader({ invoiceBundle, periodLabel, invoiceDateStr }) {
  const isReverseCharge = invoiceBundle.key === "reverse_charge";
  const vatRate = Number(invoiceBundle.vat_rate || 0);

  const header = isReverseCharge
    ? `Poise Provision ${periodLabel} Reverse Charge`
    : `Poise Provision ${periodLabel}`;

  return {
    invoiceDate: invoiceDateStr,
    invoiceType: "RE",
    status: 100,
    header,
    headText: isReverseCharge
      ? `Provision für ${periodLabel}. Reverse-Charge-Verfahren.`
      : `Provision für ${periodLabel}.`,
    footText: isReverseCharge
      ? "Reverse Charge – Steuerschuld geht auf den Leistungsempfänger über."
      : "",
    timeToPay: 14,
    discount: 0,
    taxRate: vatRate,
    taxText: isReverseCharge ? "Reverse Charge" : `${vatRate}% USt`,
    currency: "EUR",
  };
}

function buildPositionPayload({
  invoiceId,
  row,
  index,
  periodLabel,
  invoiceBundle,
}) {
  return {
    invoice: {
      id: String(invoiceId),
      objectName: "Invoice",
    },
    part: {
      id: String(SEVDESK_PART_ID),
      objectName: "Part",
    },
    name: `${row.label} – ${periodLabel}`,
    text: `${Number(row.qty || 0)} x ${Number(row.unit_price_net || 0).toFixed(
      2
    )} € netto`,
    quantity: Number(row.qty || 0),
    price: Number(row.unit_price_net || 0),
    taxRate: Number(invoiceBundle.vat_rate || 0),
    unity: {
      id: String(SEVDESK_UNITY_ID),
      objectName: "Unity",
    },
    positionNumber: index + 1,
  };
}

async function sevdeskFetch(url, apiToken, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    console.error("SEVDESK JSON PARSE ERROR:", err);
  }

  return { res, data };
}

function extractId(apiResponse) {
  return (
    apiResponse?.objects?.id ||
    apiResponse?.object?.id ||
    apiResponse?.objects?.[0]?.id ||
    apiResponse?.object?.[0]?.id ||
    apiResponse?.id ||
    null
  );
}

export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const body = await req.json();

    const coach = body?.coach || null;
    const invoiceBundle = body?.invoiceBundle || null;
    const periodLabel = body?.periodLabel || "";

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
        {
          error: "coach_not_found",
          detail: coachError?.message || null,
        },
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

    // 1) Rechnung minimal anlegen
    const invoicePayload = buildInvoiceHeader({
      invoiceBundle,
      periodLabel,
      invoiceDateStr,
    });

    const { res: invoiceRes, data: invoiceJson } = await sevdeskFetch(
      "https://my.sevdesk.de/api/v1/Invoice",
      apiToken,
      invoicePayload
    );

    if (!invoiceRes.ok) {
      console.error("SEVDESK CREATE INVOICE ERROR:", invoiceJson);
      return json(
        {
          error: "sevdesk_create_invoice_failed",
          detail: invoiceJson,
          sent_payload: invoicePayload,
        },
        500
      );
    }

    const invoiceId = extractId(invoiceJson);

    if (!invoiceId) {
      return json(
        {
          error: "missing_invoice_id",
          detail: invoiceJson,
        },
        500
      );
    }

    // 2) Kontakt auf die erzeugte Rechnung setzen
    const contactPatchPayload = {
      id: String(invoiceId),
      contact: {
        id: String(coachMember.sevdesk_contact_id),
        objectName: "Contact",
      },
    };

    const { res: contactRes, data: contactJson } = await sevdeskFetch(
      `https://my.sevdesk.de/api/v1/Invoice/${invoiceId}`,
      apiToken,
      contactPatchPayload
    );

    if (!contactRes.ok) {
      console.error("SEVDESK SET CONTACT ERROR:", contactJson);
      return json(
        {
          error: "sevdesk_set_contact_failed",
          invoiceId,
          detail: contactJson,
          sent_payload: contactPatchPayload,
        },
        500
      );
    }

    // 3) Positionen separat anlegen
    const createdPositions = [];

    for (let i = 0; i < invoiceBundle.rows.length; i++) {
      const row = invoiceBundle.rows[i];

      const positionPayload = buildPositionPayload({
        invoiceId,
        row,
        index: i,
        periodLabel,
        invoiceBundle,
      });

      const { res: posRes, data: posJson } = await sevdeskFetch(
        "https://my.sevdesk.de/api/v1/InvoicePos",
        apiToken,
        positionPayload
      );

      if (!posRes.ok) {
        console.error("SEVDESK CREATE POSITION ERROR:", posJson);
        return json(
          {
            error: "sevdesk_create_position_failed",
            invoiceId,
            detail: posJson,
            sent_payload: positionPayload,
          },
          500
        );
      }

      createdPositions.push(posJson);
    }

    return json({
      ok: true,
      invoiceId: String(invoiceId),
      coach: coachMember.profile_name || "Coach",
      sevdesk_contact_id: coachMember.sevdesk_contact_id,
      periodLabel,
      created_at: formatDateDE(invoiceDate),
      positions_created: createdPositions.length,
    });
  } catch (err) {
    console.error("SEVDESK EXPORT COACH QUARTERLY ERROR:", err);
    return json(
      {
        error: "server_error",
        detail: String(err),
      },
      500
    );
  }
}
