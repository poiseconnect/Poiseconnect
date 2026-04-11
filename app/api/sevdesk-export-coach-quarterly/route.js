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

function buildFormBody(obj) {
  const params = new URLSearchParams();

  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    params.append(key, String(value));
  });

  return params.toString();
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

async function createInvoiceDraft({
  apiToken,
  contactId,
  invoiceName,
  periodLabel,
  poiseSettings,
  invoiceBundle,
}) {
  const invoiceDate = new Date();
  const invoiceDateStr = invoiceDate.toISOString().slice(0, 10);

  const formBody = buildFormBody({
    "invoice[header]": invoiceName,
    "invoice[invoiceType]": "RE",
    "invoice[invoiceDate]": invoiceDateStr,
    "invoice[status]": 100,

    "invoice[contact][id]": String(contactId),
    "invoice[contact][objectName]": "Contact",

    "invoice[timeToPay]": 14,
    "invoice[discount]": 0,
    "invoice[address]": poiseSettings?.address || "",
    "invoice[taxRate]": Number(invoiceBundle.vat_rate || 0),
    "invoice[taxText]":
      invoiceBundle.key === "reverse_charge"
        ? "Reverse Charge"
        : `${Number(invoiceBundle.vat_rate || 0)}% USt`,
    "invoice[currency]": "EUR",
    "invoice[headText]":
      invoiceBundle.key === "reverse_charge"
        ? `Provision für ${periodLabel}. Reverse-Charge-Verfahren.`
        : `Provision für ${periodLabel}.`,
    "invoice[footText]":
      invoiceBundle.key === "reverse_charge"
        ? "Reverse Charge – Steuerschuld geht auf den Leistungsempfänger über."
        : "",
    "invoice[objectName]": "Invoice",
  });

  let lastJson = null;
  let lastStatus = 500;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://my.sevdesk.de/api/v1/Invoice/Factory/saveInvoice", {
      method: "POST",
      headers: {
        Authorization: apiToken,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: formBody,
    });

    const responseJson = await res.json().catch(() => null);
    lastJson = responseJson;
    lastStatus = res.status;

    if (res.ok) {
      const invoiceId =
        responseJson?.objects?.id ||
        responseJson?.object?.id ||
        responseJson?.id ||
        null;

      if (!invoiceId) {
        return {
          ok: false,
          status: 500,
          body: {
            error: "missing_invoice_id",
            detail: responseJson,
            sent_payload: formBody,
          },
        };
      }

      return {
        ok: true,
        invoiceId,
        invoiceDate,
        invoiceDateStr,
        raw: responseJson,
      };
    }

    const message = responseJson?.error?.message || "";

    if (!message.toLowerCase().includes("timeout") || attempt === 3) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
  }

  return {
    ok: false,
    status: lastStatus || 500,
    body: {
      error: "sevdesk_create_invoice_failed",
      detail: lastJson,
      sent_payload: formBody,
    },
  };
}

async function createInvoicePosition({
  apiToken,
  invoiceId,
  row,
  periodLabel,
  vatRate,
  positionNumber,
}) {
  const formBody = buildFormBody({
    "invoice[id]": String(invoiceId),
    "invoice[objectName]": "Invoice",
    name: `${row.label} – ${periodLabel}`,
    text: `${Number(row.qty || 0)} x ${Number(row.unit_price_net || 0).toFixed(2)} € netto`,
    quantity: Number(row.qty || 0),
    price: Number(row.unit_price_net || 0),
    taxRate: Number(vatRate || 0),
    positionNumber: Number(positionNumber || 1),
    "unity[id]": "1",
    "unity[objectName]": "Unity",
  });

  const res = await fetch("https://my.sevdesk.de/api/v1/InvoicePos", {
    method: "POST",
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: formBody,
  });

  const responseJson = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      body: {
        error: "sevdesk_position_failed",
        detail: responseJson,
        sent_payload: formBody,
        invoiceId,
      },
    };
  }

  return {
    ok: true,
    raw: responseJson,
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

    const invoiceName =
      invoiceBundle.key === "reverse_charge"
        ? `Poise Provision ${periodLabel} Reverse Charge`
        : `Poise Provision ${periodLabel}`;

    const invoiceResult = await createInvoiceDraft({
      apiToken,
      contactId: coachMember.sevdesk_contact_id,
      invoiceName,
      periodLabel,
      poiseSettings,
      invoiceBundle,
    });

    if (!invoiceResult.ok) {
      return json(invoiceResult.body, invoiceResult.status || 500);
    }

    const { invoiceId, invoiceDate } = invoiceResult;

    for (let i = 0; i < invoiceBundle.rows.length; i++) {
      const row = invoiceBundle.rows[i];

      const posResult = await createInvoicePosition({
        apiToken,
        invoiceId,
        row,
        periodLabel,
        vatRate: invoiceBundle.vat_rate,
        positionNumber: i + 1,
      });

      if (!posResult.ok) {
        return json(posResult.body, posResult.status || 500);
      }
    }

    return json({
      ok: true,
      invoiceId,
      coach: coachMember.profile_name || "Coach",
      sevdesk_contact_id: coachMember.sevdesk_contact_id,
      periodLabel,
      created_at: formatDateDE(invoiceDate),
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
