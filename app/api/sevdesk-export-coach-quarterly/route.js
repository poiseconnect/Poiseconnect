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

// =========================
// AUTH
// =========================

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

// =========================
// HELPERS
// =========================

function formatDateDE(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-AT");
}

// =========================
// MAIN
// =========================

export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    console.log("SEVDESK EXPORT BODY:", JSON.stringify(body, null, 2));

    const coach = body?.coach || null;
    const invoiceBundle = body?.invoiceBundle || null;
    const periodLabel = body?.periodLabel || "";
    const poiseSettings = body?.poiseSettings || null;

    // =========================
    // VALIDATION
    // =========================

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

    // =========================
    // LOAD COACH (BY ID ✅)
    // =========================

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
            "Für diesen Coach ist keine sevdesk_contact_id hinterlegt.",
        },
        400
      );
    }

    // =========================
    // ENV
    // =========================

    const apiToken = process.env.SEVDESK_API_TOKEN;

    if (!apiToken) {
      return json(
        {
          error: "missing_env",
          detail: "SEVDESK_API_TOKEN fehlt.",
        },
        500
      );
    }

    // =========================
    // INVOICE HEADER
    // =========================

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
  invoiceType: "RE",
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
  status: "DRAFT",
  smallSettlement: 0,
  currency: "EUR",
  objectName: "Invoice",
};

    console.log(
      "SEVDESK INVOICE HEADER:",
      JSON.stringify(invoiceHeader, null, 2)
    );

    // =========================
    // CREATE INVOICE
    // =========================

    const createInvoiceRes = await fetch(
      "https://my.sevdesk.de/api/v1/Invoice",
      {
        method: "POST",
        headers: {
          Authorization: apiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoiceHeader),
      }
    );

    const createInvoiceJson = await createInvoiceRes.json();

    console.log(
      "SEVDESK CREATE INVOICE RESPONSE:",
      createInvoiceJson
    );

    if (!createInvoiceRes.ok) {
      return json(
        {
          error: "sevdesk_create_invoice_failed",
          detail: createInvoiceJson,
        },
        500
      );
    }

    const invoiceId =
      createInvoiceJson?.objects?.id ||
      createInvoiceJson?.object?.id ||
      createInvoiceJson?.id;

    if (!invoiceId) {
      return json(
        {
          error: "missing_invoice_id",
          detail: createInvoiceJson,
        },
        500
      );
    }

    // =========================
    // CREATE POSITIONS
    // =========================

    for (let i = 0; i < invoiceBundle.rows.length; i++) {
      const row = invoiceBundle.rows[i];

      const positionPayload = {
        invoice: {
          id: String(invoiceId),
          objectName: "Invoice",
        },
        name: `${row.label} – ${periodLabel}`,
        text: `${row.qty} x ${Number(
          row.unit_price_net || 0
        ).toFixed(2)} € netto`,
        quantity: Number(row.qty || 0),
        price: Number(row.unit_price_net || 0),
        taxRate: Number(invoiceBundle.vat_rate || 0),
        positionNumber: i + 1,
        objectName: "InvoicePos",
      };

      console.log(
        "SEVDESK POSITION PAYLOAD:",
        JSON.stringify(positionPayload, null, 2)
      );

      const posRes = await fetch(
        "https://my.sevdesk.de/api/v1/InvoicePos",
        {
          method: "POST",
          headers: {
            Authorization: apiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(positionPayload),
        }
      );

      const posJson = await posRes.json();

      console.log("SEVDESK POSITION RESPONSE:", posJson);

      if (!posRes.ok) {
        return json(
          {
            error: "sevdesk_position_failed",
            invoiceId,
            detail: posJson,
          },
          500
        );
      }
    }

    // =========================
    // SUCCESS
    // =========================

    return json({
      ok: true,
      invoiceId,
      coach: coachMember.profile_name || coachMember.id,
      sevdesk_contact_id: coachMember.sevdesk_contact_id,
      periodLabel,
      created_at: formatDateDE(invoiceDate),
    });
  } catch (err) {
    console.error("SEVDESK EXPORT ERROR:", err);

    return json(
      {
        error: "server_error",
        detail: String(err),
      },
      500
    );
  }
}
