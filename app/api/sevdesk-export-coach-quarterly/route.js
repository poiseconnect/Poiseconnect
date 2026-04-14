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

function addParam(params, key, value) {
  if (value === null || value === undefined || value === "") return;
  params.append(key, String(value));
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

    // WICHTIG:
    // saveInvoice erwartet application/x-www-form-urlencoded
    // mit invoice[...] und invoicePosSave[...]
    const params = new URLSearchParams();

    // ===== invoice[...] =====
    addParam(params, "invoice[header]", invoiceName);
    addParam(params, "invoice[invoiceType]", "RE");
    addParam(params, "invoice[invoiceDate]", invoiceDateStr);
    addParam(params, "invoice[status]", 100);

    addParam(
      params,
      "invoice[headText]",
      invoiceBundle.key === "reverse_charge"
        ? `Provision für ${periodLabel}. Reverse-Charge-Verfahren.`
        : `Provision für ${periodLabel}.`
    );

    addParam(
      params,
      "invoice[footText]",
      invoiceBundle.key === "reverse_charge"
        ? "Reverse Charge – Steuerschuld geht auf den Leistungsempfänger über."
        : ""
    );

    addParam(params, "invoice[timeToPay]", 14);
    addParam(params, "invoice[discount]", 0);
    addParam(params, "invoice[address]", poiseSettings?.address || "");
    addParam(params, "invoice[taxRate]", Number(invoiceBundle.vat_rate || 0));
    addParam(
      params,
      "invoice[taxText]",
      invoiceBundle.key === "reverse_charge"
        ? "Reverse Charge"
        : `${Number(invoiceBundle.vat_rate || 0)}% USt`
    );
    addParam(params, "invoice[currency]", "EUR");
    addParam(params, "invoice[objectName]", "Invoice");

    addParam(
      params,
      "invoice[contact][id]",
      String(coachMember.sevdesk_contact_id)
    );
    addParam(params, "invoice[contact][objectName]", "Contact");

    // ===== invoicePosSave[...] =====
    // Laut sevDesk quick reference sind part + unity + objectName + mapAll nötig.
    // Wir verwenden eine freie Textposition über einen Standard-Part.
    // Falls deine sevDesk-Instanz damit meckert, muss als Nächstes die echte Part-ID
    // aus deiner sevDesk-Installation verwendet werden.
    invoiceBundle.rows.forEach((row, i) => {
      const qty = Number(row.qty || 0);
      const unitPrice = Number(row.unit_price_net || 0);
      const taxRate = Number(invoiceBundle.vat_rate || 0);

      addParam(
        params,
        `invoicePosSave[${i}][part][id]`,
        1
      );
      addParam(
        params,
        `invoicePosSave[${i}][part][objectName]`,
        "Part"
      );

      addParam(
        params,
        `invoicePosSave[${i}][name]`,
        `${row.label} – ${periodLabel}`
      );
      addParam(
        params,
        `invoicePosSave[${i}][text]`,
        `${qty} x ${unitPrice.toFixed(2)} € netto`
      );
      addParam(
        params,
        `invoicePosSave[${i}][quantity]`,
        qty
      );
      addParam(
        params,
        `invoicePosSave[${i}][price]`,
        unitPrice
      );
      addParam(
        params,
        `invoicePosSave[${i}][taxRate]`,
        taxRate
      );

      addParam(
        params,
        `invoicePosSave[${i}][unity][id]`,
        1
      );
      addParam(
        params,
        `invoicePosSave[${i}][unity][objectName]`,
        "Unity"
      );

      addParam(
        params,
        `invoicePosSave[${i}][positionNumber]`,
        i + 1
      );
      addParam(
        params,
        `invoicePosSave[${i}][mapAll]`,
        true
      );
      addParam(
        params,
        `invoicePosSave[${i}][objectName]`,
        "InvoicePos"
      );
    });

    // sevDesk expects this key to exist in many factory calls
    addParam(params, "invoicePosDelete", "null");

    const sevdeskRes = await fetch(
      "https://my.sevdesk.de/api/v1/Invoice/Factory/saveInvoice",
      {
        method: "POST",
        headers: {
          Authorization: apiToken,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      }
    );

    const sevdeskJson = await sevdeskRes.json();

    if (!sevdeskRes.ok) {
      console.error("SEVDESK CREATE INVOICE ERROR:", sevdeskJson);
      return json(
        {
          error: "sevdesk_create_invoice_failed",
          detail: sevdeskJson,
          sent_payload: params.toString(),
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
