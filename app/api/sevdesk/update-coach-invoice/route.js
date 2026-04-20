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

async function sevdeskFetch(path, options = {}) {
  const apiToken = process.env.SEVDESK_API_TOKEN;

  if (!apiToken) {
    throw new Error("SEVDESK_API_TOKEN fehlt in den Environment Variables");
  }

  const res = await fetch(`${SEVDESK_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
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

function buildHeader(invoice) {
  const servicePeriod = normalizeString(invoice.service_period) || "";
  return servicePeriod
    ? `Provision ${servicePeriod}`
    : "Provision";
}

function buildHeadText(invoice) {
  return (
    normalizeString(invoice.intro_text) ||
    "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:"
  );
}

function buildFootText(invoice) {
  const paymentTerms = normalizeString(invoice.payment_terms) || "";
  const closingText = normalizeString(invoice.closing_text) || "";

  if (paymentTerms && closingText) {
    return `${paymentTerms}\n\n${closingText}`;
  }

  return paymentTerms || closingText || "";
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
      console.error("LOAD COACH INVOICE ERROR:", invoiceError);
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
          detail:
            "In dieser Coach-Rechnung ist noch keine sevDesk Invoice ID gespeichert.",
        },
        400
      );
    }

    const sevdeskInvoiceId = String(coachInvoice.sevdesk_invoice_id);

    const payload = {
      invoice: {
        id: sevdeskInvoiceId,
        objectName: "Invoice",
        header: buildHeader(coachInvoice),
        headText: buildHeadText(coachInvoice),
        footText: buildFootText(coachInvoice),
      },
    };

    const { res, data } = await sevdeskFetch("/Invoice/Factory/saveInvoice", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("SEVDESK UPDATE COACH INVOICE ERROR:", data);
      return json(
        {
          ok: false,
          error: "sevdesk_update_invoice_failed",
          detail: data,
          sent_payload: payload,
        },
        500
      );
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
      console.error("UPDATE COACH INVOICE SYNC ERROR:", updateError);
      return json(
        {
          ok: false,
          error: "supabase_sync_update_failed",
          detail: updateError.message,
          raw: data,
        },
        500
      );
    }

    return json({
      ok: true,
      message: "sevDesk-Rechnung erfolgreich aktualisiert",
      sevdesk_invoice_id: sevdeskInvoiceId,
      raw: data,
    });
  } catch (err) {
    console.error("UPDATE COACH INVOICE SERVER ERROR:", err);
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
