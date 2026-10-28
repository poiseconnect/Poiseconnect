// Billing ownership never grants access to the current care record.
export const BILLING_SESSION_FIELDS =
  "id, date, duration_min, price, therapist_id, anfrage_id";
export const BILLING_REQUEST_FIELDS =
  "id, vorname, nachname, email, strasse_hausnr, plz_ort, assigned_therapist_id, honorar_klient, invoice_with_vat";

export const CLIENT_INVOICE_TEXT_FIELDS = [
  "invoice_number", "service_period", "customer_number", "contact_person",
  "client_name", "client_street", "client_city", "client_country", "client_email",
  "salutation", "intro_text", "payment_terms", "closing_text",
];
export const CLIENT_INVOICE_NUMBER_FIELDS = [
  "vat_rate", "total_net", "vat_amount", "total_gross",
];

export function validClientInvoiceBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const allowed = new Set([
    "id", "anfrage_id", "therapist_id", "invoice_date", "line_items",
    ...CLIENT_INVOICE_TEXT_FIELDS, ...CLIENT_INVOICE_NUMBER_FIELDS,
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return false;
  for (const key of ["id", "anfrage_id", "therapist_id", ...CLIENT_INVOICE_TEXT_FIELDS]) {
    if (key in body && body[key] !== null && typeof body[key] !== "string") return false;
  }
  for (const key of CLIENT_INVOICE_NUMBER_FIELDS) {
    if (key in body && body[key] !== null &&
        (typeof body[key] !== "number" || !Number.isFinite(body[key]))) return false;
  }
  if ("invoice_date" in body && body.invoice_date !== null &&
      (typeof body.invoice_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.invoice_date))) {
    return false;
  }
  if ("line_items" in body) {
    if (!Array.isArray(body.line_items)) return false;
    const text = ["session_id", "date", "description"];
    const numeric = ["pos", "qty", "unit_price", "total"];
    const lineKeys = new Set([...text, ...numeric]);
    for (const item of body.line_items) {
      if (!item || typeof item !== "object" || Array.isArray(item) ||
          Object.keys(item).some((key) => !lineKeys.has(key))) return false;
      if (text.some((key) => key in item && item[key] !== null && typeof item[key] !== "string")) {
        return false;
      }
      if (numeric.some((key) => key in item &&
          (typeof item[key] !== "number" || !Number.isFinite(item[key])))) return false;
    }
  }
  return true;
}

export function billingOwnerIds(member, user) {
  const ids = member?.id ? [String(member.id)] : [];
  if (member?.user_id && String(member.user_id) === String(user?.id)) {
    ids.push(String(member.user_id));
  }
  return [...new Set(ids)];
}

export function ownsBillingRow(row, ownerIds) {
  return ownerIds.includes(String(row?.therapist_id || ""));
}

export async function resolveBillingOwner(sb, ownerId) {
  if (!ownerId) return null;
  for (const column of ["id", "user_id"]) {
    const { data, error } = await sb
      .from("team_members")
      .select("id, user_id, role, name, email")
      .eq(column, ownerId)
      .maybeSingle();
    if (error) return null;
    if (data) return data.role === "therapist" || data.role === "admin" ? data : null;
  }
  return null;
}

export function ownerAliases(owner) {
  return [...new Set([owner?.id, owner?.user_id].filter(Boolean).map(String))];
}

export function viennaBillingDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((value) => value.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function validateInvoiceSessions(sb, invoice, ownerIds) {
  if (invoice.line_items != null && !Array.isArray(invoice.line_items)) return false;
  const ids = [...new Set((invoice.line_items || [])
    .map((item) => item?.session_id).filter(Boolean))];
  if (!ids.length) return true; // Manual/neutral billing has no session reference.
  const { data, error } = await sb
    .from("sessions")
    .select("id, anfrage_id, therapist_id")
    .in("id", ids)
    .eq("anfrage_id", invoice.anfrage_id)
    .in("therapist_id", ownerIds);
  return !error && data?.length === ids.length;
}

export function invoiceRecipientMatches(to, storedEmail) {
  return typeof to === "string" && typeof storedEmail === "string" &&
    /^[^\s<>@,;]+@[^\s<>@,;]+$/.test(storedEmail.trim()) &&
    to.trim().toLowerCase() === storedEmail.trim().toLowerCase();
}

export function billingCareVersion(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) &&
      BigInt(value) <= 9223372036854775807n) return value;
  return null;
}

export function billingMutationError(error) {
  const code = error?.message;
  if (code === "INVALID_INVOICE_PAYLOAD") return { error: code, status: 400 };
  if (code === "CARE_VERSION_CONFLICT") return { error: code, status: 409 };
  if (["NO_ACCESS", "HISTORICAL_INVOICE_READ_ONLY", "HISTORICAL_SESSION_READ_ONLY",
    "INVALID_INVOICE_SESSIONS", "INVOICE_REQUEST_IMMUTABLE"].includes(code)) {
    return { error: code, status: 403 };
  }
  if (["INVOICE_NOT_FOUND", "SESSION_NOT_FOUND", "ANFRAGE_NOT_FOUND"].includes(code)) {
    return { error: code, status: 404 };
  }
  return { error: "BILLING_MUTATION_UNAVAILABLE", status: 503 };
}
