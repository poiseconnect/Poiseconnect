export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ACCOUNTING_SETTINGS_TABLE = "therapist_invoice_settings";
const COACH_INVOICES_TABLE = "coach_invoices";

const POISE_ADMIN_SETTINGS = {
  company_name: "Poise by Linda Leinweber GmbH",
  address: "Hamberg 21\n4813 Altmünster\nÖsterreich",
  iban: "AT04 3451 0000 0206 1224",
  bic: "RZOOAT2L510",
  vat_number: "ATU78817327",
  tax_number: "53 317 6657",
};

const POISE_ADMIN_VAT_RATE = 20;

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
    .select("id, email, role, active")
    .eq("email", user.email)
    .single();

  if (error || !member || member.active !== true || member.role !== "admin") {
    return { error: json({ error: "forbidden" }, 403) };
  }

  return { user, member };
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getCoachClientVatRate(invoiceSettings) {
  const n = Number(invoiceSettings?.default_vat_rate || 0);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

function buildPeriodRange({ billingMode, billingYear, billingQuarter, billingMonth }) {
  const now = new Date();
  const year = safeNumber(billingYear, now.getFullYear());

  if (billingMode === "jahr") {
    return {
      start: `${year}-01-01T00:00:00.000Z`,
      end: `${year + 1}-01-01T00:00:00.000Z`,
    };
  }

  if (billingMode === "monat") {
    const month = Math.min(Math.max(safeNumber(billingMonth, now.getMonth() + 1), 1), 12);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  if (billingMode === "quartal") {
    const quarter = Math.min(
      Math.max(safeNumber(billingQuarter, Math.floor(now.getMonth() / 3) + 1), 1),
      4
    );
    const startMonth = (quarter - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, startMonth + 3, 1, 0, 0, 0, 0));
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  return {
    start: `${year}-01-01T00:00:00.000Z`,
    end: `${year + 1}-01-01T00:00:00.000Z`,
  };
}

function buildServicePeriodLabel({ billingMode, billingYear, billingQuarter, billingMonth }) {
  if (billingMode === "quartal") return `Q${billingQuarter} ${billingYear}`;
  if (billingMode === "monat") return `${billingMonth}/${billingYear}`;
  if (billingMode === "jahr") return `${billingYear}`;
  return new Date().toLocaleDateString("de-AT");
}

function buildAdminCoachQuarterInvoices({ sessions, coachInvoiceSettings }) {
  const coachClientVatRate = getCoachClientVatRate(coachInvoiceSettings);

  const buckets = {
    reverse_charge: {
      key: "reverse_charge",
      title: "Provision Reverse Charge",
      vat_rate: 0,
      rowsMap: {},
      subtotal_net: 0,
    },
    normal_ust: {
      key: "normal_ust",
      title: "Provision zzgl. 20% USt",
      vat_rate: POISE_ADMIN_VAT_RATE,
      rowsMap: {},
      subtotal_net: 0,
    },
  };

  (sessions || []).forEach((s) => {
    const req = s.anfragen || {};
    const coachInvoicesClientWithVat = req.invoice_with_vat === true;

    const bucket = coachInvoicesClientWithVat
      ? buckets.reverse_charge
      : buckets.normal_ust;

    const price = safeNumber(s.price, 0);
    if (price <= 0) return;

    const clientNet = coachInvoicesClientWithVat
      ? price / (1 + coachClientVatRate / 100)
      : price;

    const provisionNet = clientNet * 0.3;

    const groupLabel =
      req.beschaeftigungsgrad === "ausbildung"
        ? "Ausbildung"
        : "Berufstätig";

    const unitKey = `${groupLabel}__${provisionNet.toFixed(2)}`;

    if (!bucket.rowsMap[unitKey]) {
      bucket.rowsMap[unitKey] = {
        id: unitKey,
        label: groupLabel,
        qty: 0,
        unit_price_net: provisionNet,
        total_net: 0,
      };
    }

    bucket.rowsMap[unitKey].qty += 1;
    bucket.rowsMap[unitKey].total_net += provisionNet;
    bucket.subtotal_net += provisionNet;
  });

  return Object.values(buckets)
    .map((bucket) => {
      const rows = Object.values(bucket.rowsMap).sort((a, b) =>
        a.label.localeCompare(b.label)
      );

      const vat_amount = bucket.subtotal_net * (bucket.vat_rate / 100);
      const total_gross = bucket.subtotal_net + vat_amount;

      return {
        ...bucket,
        rows,
        vat_amount,
        total_gross,
      };
    })
    .filter((bucket) => bucket.rows.length > 0);
}

export async function GET(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);

    const coachId = String(searchParams.get("coachId") || "").trim();
    const billingMode = String(searchParams.get("billingMode") || "quartal").trim();
    const billingYear = String(searchParams.get("billingYear") || "").trim();
    const billingQuarter = String(searchParams.get("billingQuarter") || "").trim();
    const billingMonth = String(searchParams.get("billingMonth") || "").trim();
    const bundleKey = String(searchParams.get("bundleKey") || "normal_ust").trim();

    if (!coachId) {
      return json({ error: "missing_coach_id" }, 400);
    }

    const { data: coach, error: coachError } = await supabase
      .from("team_members")
      .select("id, email, profile_name")
      .eq("id", coachId)
      .single();

    if (coachError || !coach) {
      console.error("LOAD COACH ERROR:", coachError);
      return json(
        {
          error: "coach_not_found",
          detail: coachError?.message || null,
        },
        404
      );
    }

const { data: coachInvoiceSettings, error: settingsError } = await supabase
  .from(ACCOUNTING_SETTINGS_TABLE)
  .select("*")
  .eq("therapist_id", coachId)
  .maybeSingle();

    if (settingsError) {
      console.error("LOAD COACH ACCOUNTING SETTINGS ERROR:", settingsError);
      return json(
        {
          error: "settings_load_failed",
          detail: settingsError.message,
        },
        500
      );
    }

    // =========================================================
    // 1) ZUERST PRÜFEN: GIBT ES SCHON EINE GESPEICHERTE RECHNUNG?
    // =========================================================
    const uniqueMatch = {
      coach_id: coachId,
      billing_mode: billingMode,
      billing_year:
        billingYear === "" || billingYear == null ? null : safeNumber(billingYear, null),
      billing_quarter:
        billingQuarter === "" || billingQuarter == null
          ? null
          : safeNumber(billingQuarter, null),
      billing_month:
        billingMonth === "" || billingMonth == null ? null : safeNumber(billingMonth, null),
      bundle_key: bundleKey,
    };

    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from(COACH_INVOICES_TABLE)
      .select("*")
      .match(uniqueMatch)
      .maybeSingle();

    if (existingInvoiceError) {
      console.error("LOAD EXISTING COACH INVOICE ERROR:", existingInvoiceError);
      return json(
        {
          error: "existing_invoice_load_failed",
          detail: existingInvoiceError.message,
        },
        500
      );
    }

    if (existingInvoice) {
      return json({
        coach: {
          id: coach.id,
          name: coach.profile_name || "Coach",
          email: coach.email || "",
        },
        poiseSettings: POISE_ADMIN_SETTINGS,
        coachInvoiceSettings: coachInvoiceSettings || {},
        from_saved_invoice: true,
        invoice_id: existingInvoice.id,
        bundle_key: existingInvoice.bundle_key,
        invoice_with_vat: existingInvoice.invoice_with_vat === true,
        vat_rate: Number(existingInvoice.vat_rate || 0),
        invoice_number: existingInvoice.invoice_number || "",
        invoice_date: existingInvoice.invoice_date || "",
        service_period: existingInvoice.service_period || "",
        customer_number: existingInvoice.customer_number || "",
        contact_person: existingInvoice.contact_person || "",
        salutation: existingInvoice.salutation || "Sehr geehrte Damen und Herren,",
        intro_text:
          existingInvoice.intro_text ||
          "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:",
        payment_terms:
          existingInvoice.payment_terms ||
          "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ab Rechnungseingang ohne Abzüge.",
        closing_text:
          existingInvoice.closing_text ||
          "Herzlichen Dank für Dein Engagement und die angenehme Zusammenarbeit!\n\nLiebe Grüße\n\nSebastian Kickinger\nPoise by Linda Leinweber GmbH",
        client_name: existingInvoice.client_name || "",
        client_street: existingInvoice.client_street || "",
        client_city: existingInvoice.client_city || "",
        client_country: existingInvoice.client_country || "",
        client_email: existingInvoice.client_email || "",
        lineItems: Array.isArray(existingInvoice.line_items)
          ? existingInvoice.line_items.map((item, idx) => ({
              id: item.id || `${idx + 1}`,
              description: item.description || "Provision",
              qty: Number(item.qty || 0),
              unit_price: Number(item.unit_price || 0),
              unit: Number(item.unit_price || 0),
              total: Number(item.total || 0),
            }))
          : [],
        totals: {
          net: Number(existingInvoice.total_net || 0),
          vat: Number(existingInvoice.vat_amount || 0),
          gross: Number(existingInvoice.total_gross || 0),
        },
      });
    }

    // =========================================================
    // 2) WENN NICHT: RECHNUNG FRISCH AUS SESSIONS AUFBAUEN
    // =========================================================
    const periodRange = buildPeriodRange({
      billingMode,
      billingYear,
      billingQuarter,
      billingMonth,
    });

    const { data: billingSessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(`
        id,
        date,
        price,
        therapist_id,
        anfrage_id,
        anfragen (
          id,
          vorname,
          nachname,
          email,
          beschaeftigungsgrad,
          invoice_with_vat
        )
      `)
      .eq("therapist_id", coachId)
      .gte("date", periodRange.start)
      .lt("date", periodRange.end)
      .order("date", { ascending: true });

    if (sessionsError) {
      console.error("LOAD COACH BILLING SESSIONS ERROR:", sessionsError);
      return json(
        {
          error: "billing_sessions_load_failed",
          detail: sessionsError.message,
        },
        500
      );
    }

    const bundles = buildAdminCoachQuarterInvoices({
      sessions: billingSessions || [],
      coachInvoiceSettings: coachInvoiceSettings || {},
    });

    const selectedBundle =
      bundles.find((b) => b.key === bundleKey) || bundles[0] || null;

    if (!selectedBundle) {
      return json(
        {
          error: "no_invoice_data",
          detail: "Keine Rechnungsdaten für Coach / Zeitraum gefunden.",
          coach: {
            id: coach.id,
            name: coach.profile_name || "Coach",
            email: coach.email || "",
          },
          poiseSettings: POISE_ADMIN_SETTINGS,
          coachInvoiceSettings: coachInvoiceSettings || {},
          lineItems: [],
          invoice_with_vat: false,
          vat_rate: 0,
          service_period: buildServicePeriodLabel({
            billingMode,
            billingYear,
            billingQuarter,
            billingMonth,
          }),
        },
        200
      );
    }

    const servicePeriod = buildServicePeriodLabel({
      billingMode,
      billingYear,
      billingQuarter,
      billingMonth,
    });

    const lineItems = selectedBundle.rows.map((row) => ({
      id: row.id,
      description: `${row.label} – Provision`,
      qty: Number(row.qty || 0),
      unit_price_net: Number(row.unit_price_net || 0),
      unit: Number(row.unit_price_net || 0),
      total_net: Number(row.total_net || 0),
      total: Number(row.total_net || 0),
    }));

    return json({
      coach: {
        id: coach.id,
        name: coach.profile_name || "Coach",
        email: coach.email || "",
      },
      poiseSettings: POISE_ADMIN_SETTINGS,
      coachInvoiceSettings: coachInvoiceSettings || {},
      from_saved_invoice: false,
      bundle_key: selectedBundle.key,
      invoice_with_vat: Number(selectedBundle.vat_rate || 0) > 0,
      vat_rate: Number(selectedBundle.vat_rate || 0),
      service_period: servicePeriod,
      salutation: "Sehr geehrte Damen und Herren,",
      intro_text: "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:",
      payment_terms:
        "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ab Rechnungseingang ohne Abzüge.",
      closing_text:
        "Herzlichen Dank für Dein Engagement und die angenehme Zusammenarbeit!\n\nLiebe Grüße\n\nSebastian Kickinger\nPoise by Linda Leinweber GmbH",
      lineItems,
      totals: {
        net: Number(selectedBundle.subtotal_net || 0),
        vat: Number(selectedBundle.vat_amount || 0),
        gross: Number(selectedBundle.total_gross || 0),
      },
    });
  } catch (err) {
    console.error("LOAD COACH INVOICE SERVER ERROR:", err);
    return json(
      {
        error: "server_error",
        detail: String(err),
      },
      500
    );
  }
}
