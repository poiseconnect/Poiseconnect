export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔥 DEINE sevDesk Produkt-/Part-ID für "Provision"
const SEVDESK_PART_ID = "55040478";

// 🔥 Standard-Einheit in sevDesk
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

    const isReverseCharge = invoiceBundle.key === "reverse_charge";
    const vatRate = Number(invoiceBundle.vat_rate || 0);

    const invoiceName = isReverseCharge
      ? `Poise Provision ${periodLabel} Reverse Charge`
      : `Poise Provision ${periodLabel}`;

    const payload = {
      invoice: {
        contact: {
          id: String(coachMember.sevdesk_contact_id),
          objectName: "Contact",
        },
        invoiceDate: invoiceDateStr,
        invoiceType: "RE",
        status: 100,
        header: invoiceName,
        headText: isReverseCharge
          ? `Provision für ${periodLabel}. Reverse-Charge-Verfahren.`
          : `Provision für ${periodLabel}.`,
        footText: isReverseCharge
          ? "Reverse Charge – Steuerschuld geht auf den Leistungsempfänger über."
          : "",
        timeToPay: 14,
        discount: 0,
        address: poiseSettings?.address || "",
        taxRate: vatRate,
        taxText: isReverseCharge ? "Reverse Charge" : `${vatRate}% USt`,
        currency: "EUR",
        objectName: "Invoice",
      },

      invoicePosSave: invoiceBundle.rows.map((row, index) => ({
        part: {
          id: SEVDESK_PART_ID,
          objectName: "Part",
        },
        name: `${row.label} – ${periodLabel}`,
        text: `${Number(row.qty || 0)} x ${Number(
          row.unit_price_net || 0
        ).toFixed(2)} € netto`,
        quantity: Number(row.qty || 0),
        price: Number(row.unit_price_net || 0),
        taxRate: vatRate,
        unity: {
          id: SEVDESK_UNITY_ID,
          objectName: "Unity",
        },
        positionNumber: index + 1,
        objectName: "InvoicePos",
      })),

      invoicePosDelete: null,
    };

    const sevdeskRes = await fetch(
      "https://my.sevdesk.de/api/v1/Invoice/Factory/saveInvoice",
      {
        method: "POST",
        headers: {
          Authorization: apiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const sevdeskJson = await sevdeskRes.json();

    if (!sevdeskRes.ok) {
      console.error("SEVDESK EXPORT FEHLER:", sevdeskJson);
      return json(
        {
          error: "sevdesk_create_invoice_failed",
          detail: sevdeskJson,
          sent_payload: payload,
        },
        500
      );
    }

    const invoiceId =
      sevdeskJson?.objects?.id ||
      sevdeskJson?.object?.id ||
      sevdeskJson?.id ||
      null;

    return json({
      ok: true,
      invoiceId,
      coach: coachMember.profile_name || "Coach",
      sevdesk_contact_id: coachMember.sevdesk_contact_id,
      periodLabel,
      created_at: formatDateDE(invoiceDate),
      sevdesk_response: sevdeskJson,
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
