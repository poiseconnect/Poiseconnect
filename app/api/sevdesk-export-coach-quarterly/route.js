export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Optional per ENV überschreibbar
const SEVDESK_PART_ID = process.env.SEVDESK_PART_ID || "55040478";
const SEVDESK_UNITY_ID = process.env.SEVDESK_UNITY_ID || "1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toDateOnly(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateDE(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-AT");
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

async function sevdeskFetch(url, apiToken, payload, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { res, data };
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

function buildHeadText({ periodLabel, invoiceBundle }) {
  const isReverseCharge = invoiceBundle?.key === "reverse_charge";

  const lines = [
    "Projekt: Klienten-Vermittlung für psychologische Beratung und Mental Coaching",
    "",
  ];

  for (const row of invoiceBundle?.rows || []) {
    lines.push(`Anzahl der vermittelten Sitzungen ${row.label}: ${safeNumber(row.qty, 0)}`);
  }

  lines.push("");
  lines.push("Sehr geehrte Frau xxx,");
  lines.push("");
  lines.push("liebe xxx,");
  lines.push("");
  lines.push("Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:");

  if (isReverseCharge) {
    lines.push("");
    lines.push("Abrechnung im Reverse-Charge-Verfahren.");
  }

  return lines.join("\n");
}

function buildFootText() {
  return [
    "zahlbar: 14 Tage nach Rechnungseingang ohne Abzug.",
    "",
    "Herzlichen Dank für Dein Engagement und die angenehme Zusammenarbeit!",
    "",
    "Liebe Grüße",
    "",
    "Sebastian Kickinger Poise by Linda Leinweber GmbH",
  ].join("\n");
}

function buildInvoiceHeader({
  coachMember,
  periodLabel,
  invoiceDateStr,
  invoiceBundle,
  poiseSettings,
}) {
  const paymentDueDate = addDays(invoiceDateStr, 14);

  return {
    contact: {
      id: String(coachMember.sevdesk_contact_id),
      objectName: "Contact",
    },

    invoiceDate: invoiceDateStr,
    deliveryDate: invoiceDateStr,
    timeToPay: 14,
    // Manche sevDesk-Setups reagieren besser, wenn beides da ist
    dueDate: paymentDueDate,

    invoiceType: "RE",
    status: 100, // Entwurf
    header: `Poise Provision ${periodLabel}`,
    headText: buildHeadText({ periodLabel, invoiceBundle }),
    footText: buildFootText(),

    address: poiseSettings?.address || "Hamberg 21\n4813 Altmünster\nÖsterreich",
    currency: "EUR",
    discount: 0,

    // an deinen Screens orientiert
    taxRate: safeNumber(invoiceBundle?.vat_rate, 0),
    taxText:
      invoiceBundle?.key === "reverse_charge"
        ? "Reverse Charge"
        : `${safeNumber(invoiceBundle?.vat_rate, 0)}% USt`,
  };
}

function buildPositionPayload({
  invoiceId,
  row,
  index,
  periodLabel,
  invoiceBundle,
}) {
  const qty = safeNumber(row.qty, 0);
  const unitPrice = safeNumber(row.unit_price_net, 0);
  const vatRate = safeNumber(invoiceBundle?.vat_rate, 0);

  const isReverseCharge = invoiceBundle?.key === "reverse_charge";
  const positionName = isReverseCharge
    ? `Provision ${row.label} – ${periodLabel} (Reverse Charge)`
    : `Provision ${row.label} – ${periodLabel}`;

  return {
    invoice: {
      id: String(invoiceId),
      objectName: "Invoice",
    },
    part: {
      id: String(SEVDESK_PART_ID),
      objectName: "Part",
    },
    name: positionName,
    text: `${qty} x ${unitPrice.toFixed(2)} € netto`,
    quantity: qty,
    price: unitPrice,
    taxRate: vatRate,
    unity: {
      id: String(SEVDESK_UNITY_ID),
      objectName: "Unity",
    },
    positionNumber: index + 1,
  };
}

export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const body = await req.json();

    const coach = body?.coach || null;
    const invoiceBundle = body?.invoiceBundle || null;
    const periodLabel = body?.periodLabel || "";
    const poiseSettings = body?.poiseSettings || {};

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

    const invoiceDateStr = toDateOnly(new Date());

    // 1) Rechnungskopf anlegen
    const invoicePayload = buildInvoiceHeader({
      coachMember,
      periodLabel,
      invoiceDateStr,
      invoiceBundle,
      poiseSettings,
    });

    await sleep(400);

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

    await sleep(350);

    // 2) Positionen anlegen
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
      await sleep(250);
    }

    return json({
      ok: true,
      invoiceId: String(invoiceId),
      coach: coachMember.profile_name || "Coach",
      sevdesk_contact_id: coachMember.sevdesk_contact_id,
      periodLabel,
      created_at: formatDateDE(invoiceDateStr),
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
