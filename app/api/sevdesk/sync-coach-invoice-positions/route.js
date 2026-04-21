export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SEVDESK_API_URL = "https://my.sevdesk.de/api/v1";
const TABLE_NAME = "coach_invoices";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
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

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function sevdeskFetchJson(path, options = {}) {
  const apiToken = process.env.SEVDESK_API_TOKEN;

  if (!apiToken) {
    throw new Error("SEVDESK_API_TOKEN fehlt in den Environment Variables");
  }

  const res = await fetch(`${SEVDESK_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: apiToken,
      Accept: "application/json",
      ...(options.headers || {}),
    },
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

async function sevdeskFetchForm(path, formBody, method = "POST") {
  const apiToken = process.env.SEVDESK_API_TOKEN;

  if (!apiToken) {
    throw new Error("SEVDESK_API_TOKEN fehlt in den Environment Variables");
  }

  const res = await fetch(`${SEVDESK_API_URL}${path}`, {
    method,
    headers: {
      Authorization: apiToken,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody,
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

function buildPositionText(item, invoice) {
  const servicePeriod = normalizeString(invoice.service_period);
  const description = normalizeString(item.description) || "Provision";
  const qty = safeNumber(item.qty, 0);
  const unit = safeNumber(item.unit_price, 0).toFixed(2);

  if (servicePeriod) {
    return `${description} (${servicePeriod}) – ${qty} x ${unit} EUR`;
  }

  return `${description} – ${qty} x ${unit} EUR`;
}

async function getExistingInvoicePositions(invoiceId) {
  const { res, data } = await sevdeskFetchJson(
    `/InvoicePos?limit=1000&invoice[id]=${encodeURIComponent(
      invoiceId
    )}&invoice[objectName]=Invoice`
  );

  if (!res.ok) {
    throw new Error(
      `Bestehende InvoicePos konnten nicht geladen werden: ${JSON.stringify(data)}`
    );
  }

  const rows =
    data?.objects ||
    data?.object ||
    data?.data ||
    [];

  return Array.isArray(rows) ? rows : [];
}

async function deleteInvoicePos(posId) {
  const { res, data } = await sevdeskFetchJson(`/InvoicePos/${posId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(
      `InvoicePos ${posId} konnte nicht gelöscht werden: ${JSON.stringify(data)}`
    );
  }
}

async function createInvoicePos(invoiceId, item, positionNumber, taxRate) {
  const form = new URLSearchParams();

  form.set("invoice[id]", String(invoiceId));
  form.set("invoice[objectName]", "Invoice");
  form.set("name", normalizeString(item.description) || "Provision");
  form.set("text", buildPositionText(item, { service_period: "" }));
  form.set("quantity", String(safeNumber(item.qty, 0)));
  form.set("price", String(safeNumber(item.unit_price, 0)));
  form.set("taxRate", String(safeNumber(taxRate, 0)));
  form.set("positionNumber", String(positionNumber));
  form.set("unity[id]", "1");
  form.set("unity[objectName]", "Unity");

  const { res, data } = await sevdeskFetchForm("/InvoicePos", form.toString(), "POST");

  if (!res.ok) {
    throw new Error(
      `InvoicePos konnte nicht angelegt werden: ${JSON.stringify(data)}`
    );
  }

  return data;
}

export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const coachInvoiceId = normalizeString(body.coachInvoiceId);

    if (!coachInvoiceId) {
      return json({ error: "missing_coach_invoice_id" }, 400);
    }

    const { data: coachInvoice, error: invoiceError } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("id", coachInvoiceId)
      .single();

    if (invoiceError || !coachInvoice) {
      return json(
        {
          error: "coach_invoice_not_found",
          detail: invoiceError?.message || null,
        },
        404
      );
    }

    if (!coachInvoice.sevdesk_invoice_id) {
      return json(
        {
          error: "missing_sevdesk_invoice_id",
          detail: "In coach_invoices fehlt sevdesk_invoice_id.",
        },
        400
      );
    }

    const sevdeskInvoiceId = String(coachInvoice.sevdesk_invoice_id);
    const lineItems = Array.isArray(coachInvoice.line_items)
      ? coachInvoice.line_items
      : [];

    const taxRate = coachInvoice.invoice_with_vat === true
      ? safeNumber(coachInvoice.vat_rate, 20)
      : 0;

    // 1) Alte sevDesk-Positionen laden
    const existingPositions = await getExistingInvoicePositions(sevdeskInvoiceId);

    // 2) Alte Positionen löschen
    for (const pos of existingPositions) {
      const posId = pos?.id || pos?.object?.id;
      if (posId) {
        await deleteInvoicePos(posId);
      }
    }

    // 3) Neue Positionen aus Poise anlegen
    const created = [];
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      const result = await createInvoicePos(
        sevdeskInvoiceId,
        item,
        i + 1,
        taxRate
      );
      created.push(result);
    }

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        sevdesk_synced_at: new Date().toISOString(),
        updated_by: auth.member.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", coachInvoiceId);

    if (updateError) {
      return json(
        {
          ok: false,
          error: "supabase_sync_update_failed",
          detail: updateError.message,
          created_count: created.length,
        },
        500
      );
    }

    return json({
      ok: true,
      message: "sevDesk-Positionen erfolgreich synchronisiert",
      sevdesk_invoice_id: sevdeskInvoiceId,
      deleted_count: existingPositions.length,
      created_count: created.length,
    });
  } catch (err) {
    console.error("SYNC COACH INVOICE POSITIONS ERROR:", err);
    return json(
      {
        ok: false,
        error: "server_error",
        detail: String(err),
      },
      500
    );
  }
}
