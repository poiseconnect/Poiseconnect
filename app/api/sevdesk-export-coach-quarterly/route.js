export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    cache: "no-store",
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

function buildOrderPayload({ coachMember, periodLabel, orderDateStr }) {
  const [y, m, d] = String(orderDateStr).split("-");
  const sevDate = `${d}.${m}.${y}`;

  return {
    orderDate: sevDate,
    status: 100,
    header: `Poise Provision ${periodLabel}`,
    headText: `Provision für ${periodLabel}.`,
    contact: {
      id: String(coachMember.sevdesk_contact_id),
      objectName: "Contact",
    },
  };
}

function buildOrderPosPayload({
  orderId,
  row,
  index,
  periodLabel,
  invoiceBundle,
}) {
  const qty = safeNumber(row.qty, 0);
  const unitPrice = safeNumber(row.unit_price_net, 0);
  const vatRate = safeNumber(invoiceBundle?.vat_rate, 0);

  return {
    order: {
      id: String(orderId),
      objectName: "Order",
    },
    part: {
      id: String(SEVDESK_PART_ID),
      objectName: "Part",
    },
    name: `Provision ${row.label} – ${periodLabel}`,
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

function buildCreateInvoiceFromOrderPayload({
  orderId,
  invoiceDateStr,
}) {
  return {
    order: {
      id: String(orderId),
      objectName: "Order",
    },
    invoiceDate: invoiceDateStr,
    status: 100,
    invoiceType: "RE",
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

    const orderDateStr = toDateOnly(new Date());

    // 1) Auftrag ultraminimal anlegen
    const orderPayload = buildOrderPayload({
      coachMember,
      periodLabel,
      orderDateStr,
    });

    await sleep(300);

    const { res: orderRes, data: orderJson } = await sevdeskFetch(
      "https://my.sevdesk.de/api/v1/Order",
      apiToken,
      orderPayload
    );

    if (!orderRes.ok) {
      console.error("SEVDESK CREATE ORDER ERROR:", orderJson);
      return json(
        {
          error: "sevdesk_create_order_failed",
          detail: orderJson,
          sent_payload: orderPayload,
        },
        500
      );
    }

    const orderId = extractId(orderJson);

    if (!orderId) {
      return json(
        {
          error: "missing_order_id",
          detail: orderJson,
        },
        500
      );
    }

    await sleep(300);

    // 2) Auftragspositionen anlegen
    const createdPositions = [];

    for (let i = 0; i < invoiceBundle.rows.length; i++) {
      const row = invoiceBundle.rows[i];

      const orderPosPayload = buildOrderPosPayload({
        orderId,
        row,
        index: i,
        periodLabel,
        invoiceBundle,
      });

      const { res: posRes, data: posJson } = await sevdeskFetch(
        "https://my.sevdesk.de/api/v1/OrderPos",
        apiToken,
        orderPosPayload
      );

      if (!posRes.ok) {
        console.error("SEVDESK CREATE ORDER POSITION ERROR:", posJson);
        return json(
          {
            error: "sevdesk_create_order_position_failed",
            orderId,
            detail: posJson,
            sent_payload: orderPosPayload,
          },
          500
        );
      }

      createdPositions.push(posJson);
      await sleep(250);
    }

    await sleep(500);

    // 3) Rechnung aus Auftrag erzeugen
    const createInvoicePayload = buildCreateInvoiceFromOrderPayload({
      orderId,
      invoiceDateStr: orderDateStr,
    });

    const { res: invoiceRes, data: invoiceJson } = await sevdeskFetch(
      "https://my.sevdesk.de/api/v1/Invoice/Factory/createInvoiceFromOrder",
      apiToken,
      createInvoicePayload
    );

    if (!invoiceRes.ok) {
      console.error("SEVDESK CREATE INVOICE FROM ORDER ERROR:", invoiceJson);
      return json(
        {
          error: "sevdesk_create_invoice_from_order_failed",
          orderId,
          detail: invoiceJson,
          sent_payload: createInvoicePayload,
        },
        500
      );
    }

    const invoiceId = extractId(invoiceJson);

    return json({
      ok: true,
      orderId: String(orderId),
      invoiceId: invoiceId ? String(invoiceId) : null,
      coach: coachMember.profile_name || "Coach",
      sevdesk_contact_id: coachMember.sevdesk_contact_id,
      periodLabel,
      created_at: formatDateDE(orderDateStr),
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
