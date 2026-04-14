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

  if (error || !user) return null;
  return user;
}

async function requireAdmin(req) {
  const user = await getUserFromBearer(req);
  if (!user) return { error: json({ error: "unauthorized" }, 401) };

  const { data: member } = await supabase
    .from("team_members")
    .select("id, role, active")
    .eq("email", user.email)
    .single();

  if (!member || member.active !== true || member.role !== "admin") {
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

    const coach = body?.coach;
    const invoiceBundle = body?.invoiceBundle;
    const periodLabel = body?.periodLabel || "";
    const poiseSettings = body?.poiseSettings || {};

    if (!coach?.id) {
      return json({ error: "missing_coach_id" }, 400);
    }

    if (!invoiceBundle?.rows?.length) {
      return json({ error: "missing_invoice_bundle" }, 400);
    }

    // ✅ Coach laden (ID!)
    const { data: coachMember } = await supabase
      .from("team_members")
      .select("id, profile_name, sevdesk_contact_id")
      .eq("id", String(coach.id))
      .single();

    if (!coachMember?.sevdesk_contact_id) {
      return json({ error: "missing_sevdesk_contact_id" }, 400);
    }

    const apiToken = process.env.SEVDESK_API_TOKEN;
    if (!apiToken) {
      return json({ error: "missing_env" }, 500);
    }

    const invoiceDate = new Date().toISOString().slice(0, 10);

    const params = new URLSearchParams();

    // =========================
    // INVOICE
    // =========================
    params.append("invoice[header]", `Poise Provision ${periodLabel}`);
    params.append("invoice[invoiceType]", "RE");
    params.append("invoice[invoiceDate]", invoiceDate);
    params.append("invoice[status]", "100");

    params.append(
      "invoice[headText]",
      `Provision für ${periodLabel}.`
    );

    params.append("invoice[timeToPay]", "14");
    params.append("invoice[discount]", "0");

    params.append("invoice[address]", poiseSettings.address || "");

    params.append(
      "invoice[taxRate]",
      String(Number(invoiceBundle.vat_rate || 0))
    );

    params.append(
      "invoice[taxText]",
      `${Number(invoiceBundle.vat_rate || 0)}% USt`
    );

    params.append("invoice[currency]", "EUR");
    params.append("invoice[objectName]", "Invoice");

    params.append(
      "invoice[contact][id]",
      String(coachMember.sevdesk_contact_id)
    );
    params.append("invoice[contact][objectName]", "Contact");

    // =========================
    // POSITIONEN
    // =========================
    invoiceBundle.rows.forEach((row, i) => {
      params.append(`invoicePosSave[${i}][part][id]`, "1");
      params.append(`invoicePosSave[${i}][part][objectName]`, "Part");

      params.append(
        `invoicePosSave[${i}][name]`,
        `${row.label} – ${periodLabel}`
      );

      params.append(
        `invoicePosSave[${i}][text]`,
        `${row.qty} x ${Number(row.unit_price_net).toFixed(2)} € netto`
      );

      params.append(
        `invoicePosSave[${i}][quantity]`,
        String(row.qty)
      );

      params.append(
        `invoicePosSave[${i}][price]`,
        String(row.unit_price_net)
      );

      params.append(
        `invoicePosSave[${i}][taxRate]`,
        String(invoiceBundle.vat_rate || 0)
      );

      params.append(`invoicePosSave[${i}][unity][id]`, "1");
      params.append(`invoicePosSave[${i}][unity][objectName]`, "Unity");

      params.append(
        `invoicePosSave[${i}][positionNumber]`,
        String(i + 1)
      );

      params.append(`invoicePosSave[${i}][mapAll]`, "true");
      params.append(`invoicePosSave[${i}][objectName]`, "InvoicePos");
    });

    params.append("invoicePosDelete", "null");

    // =========================
    // SEVDESK CALL
    // =========================
    const res = await fetch(
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

    const data = await res.json();

    if (!res.ok) {
      console.error("SEVDESK ERROR:", data);
      return json({
        error: "sevdesk_create_invoice_failed",
        detail: data,
        sent_payload: params.toString(),
      }, 500);
    }

    return json({
      ok: true,
      invoiceId:
        data?.objects?.id ||
        data?.object?.id ||
        data?.id ||
        null,
      coach: coachMember.profile_name,
      created_at: formatDateDE(invoiceDate),
      sevdesk: data,
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return json({ error: "server_error", detail: String(err) }, 500);
  }
}
