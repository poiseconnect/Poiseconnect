import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const API = "https://my.sevdesk.de/api/v1";
export const INVOICE_IDS = ["135675889", "135833778"];
const STATUS = {
  "50": "sonderstatus_50_manuell_pruefen",
  "100": "entwurf",
  "200": "offen_ausgestellt",
  "750": "teilbezahlt",
  "1000": "bezahlt",
};

function id(value) {
  const text = String(value ?? "");
  return /^\d{1,30}$/.test(text) ? text : null;
}

function date(value) {
  if (value === null || value === undefined || value === "" || value === "0") return null;
  const text = String(value);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".");
    return date(`${year}-${month}-${day}`);
  }
  let parsed;
  if (/^\d{10}(\d{3})?$/.test(text)) {
    parsed = new Date(Number(text) * (text.length === 10 ? 1000 : 1));
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    parsed = new Date(`${text}T12:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) return null;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(text)) {
    parsed = new Date(text);
  } else {
    return null;
  }
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(parsed);
}

function safeError(code, status = null) {
  return Object.assign(new Error(code), { code, status });
}

export async function readJson(path, token, fetchImpl = fetch) {
  if (!/^\/(Invoice\/\d+(\/getPositions)?(\?limit=1000&offset=\d+)?|Tools\/bookkeepingSystemVersion)$/.test(path)) {
    throw safeError("endpoint_not_allowed");
  }
  let response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      method: "GET",
      headers: { Authorization: token, Accept: "application/json" },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw safeError("network_timeout_or_redirect");
  }
  if (!response.ok) throw safeError("provider_http_error", response.status);
  try {
    return await response.json();
  } catch {
    throw safeError("invalid_json_response");
  }
}

export function summarizeInvoice(invoice, expectedId) {
  if (!invoice || id(invoice.id) !== expectedId) throw safeError("invoice_response_mismatch");
  const contactId = id(invoice.contact?.id);
  const status = String(invoice.status ?? "");
  const sendDate = date(invoice.sendDate);
  const invoiceNumber = String(invoice.invoiceNumber ?? "");
  return {
    sevdesk_id: expectedId,
    existiert: true,
    status_code: Object.hasOwn(STATUS, status) ? status : "unbekannt",
    status: STATUS[status] || "unbekannt_manuell_pruefen",
    entwurf: status === "100",
    ausgestellt: ["200", "750", "1000"].includes(status) ? true : status === "100" ? false : null,
    versand: sendDate
      ? "sevdesk_sendDate_vorhanden_keine_zustellbestaetigung"
      : "nicht_belegt_keine_aussage_ueber_manuellen_versand",
    send_date_vienna: sendDate,
    kontakt_referenz: contactId
      ? `contact-${createHash("sha256").update(`sevdesk-contact:${contactId}`).digest("hex").slice(0, 16)}`
      : null,
    kontakt_typ: invoice.contact?.objectName === "Contact" ? "Contact" : "unbekannt",
    tax_rule_id: id(invoice.taxRule?.id),
    tax_type: ["default", "eu", "noteu", "custom", "ss"].includes(invoice.taxType) ? invoice.taxType : null,
    steuerbewertung: "technische_werte_keine_rechtliche_ableitung_aus_0_prozent_oder_bundle",
    invoice_date_vienna: date(invoice.invoiceDate),
    invoice_number: /^[A-Za-z0-9][A-Za-z0-9./_-]{0,79}$/.test(invoiceNumber) ? invoiceNumber : null,
    invoice_number_hinweis: status === "100" ? "entwurfsnummer_nicht_endgueltig" : "providerfeld",
  };
}

async function readPositionRates(invoiceId, token, fetchImpl) {
  const rates = new Set();
  let count = 0;
  for (let offset = 0; offset < 100000; offset += 1000) {
    const data = await readJson(`/Invoice/${invoiceId}/getPositions?limit=1000&offset=${offset}`, token, fetchImpl);
    if (!Array.isArray(data?.objects) || data.objects.length > 1000) {
      throw safeError("position_response_incomplete");
    }
    for (const position of data.objects) {
      if (position?.invoice?.id !== undefined && id(position.invoice.id) !== invoiceId) {
        throw safeError("position_invoice_mismatch");
      }
      const rate = position?.taxRate;
      if (rate === null || rate === undefined || String(rate).trim() === "" ||
          !Number.isFinite(Number(rate)) || Number(rate) < 0 || Number(rate) > 100) {
        throw safeError("position_tax_rate_unavailable");
      }
      rates.add(Number(rate));
      count += 1;
    }
    if (data.objects.length < 1000) {
      return { positionen: count, positionssteuersaetze: [...rates].sort((a, b) => a - b) };
    }
  }
  throw safeError("position_page_limit_reached");
}

export async function inspectInvoices(token, fetchImpl = fetch) {
  if (!String(token || "").trim()) throw safeError("sevdesk_api_token_missing");
  const results = [];
  let systemVersion = null;
  let systemError = null;
  try {
    const data = await readJson("/Tools/bookkeepingSystemVersion", token, fetchImpl);
    const version = data?.objects?.version;
    systemVersion = ["1.0", "2.0"].includes(String(version)) ? String(version) : null;
    if (!systemVersion) systemError = "account_version_response_unrecognized";
  } catch (error) {
    systemError = error.code;
  }
  for (const invoiceId of INVOICE_IDS) {
    let summary;
    try {
      const data = await readJson(`/Invoice/${invoiceId}`, token, fetchImpl);
      if (!Array.isArray(data?.objects) || data.objects.length !== 1) {
        throw safeError("invoice_response_incomplete");
      }
      summary = summarizeInvoice(data.objects[0], invoiceId);
    } catch (error) {
      results.push({
        sevdesk_id: invoiceId,
        existiert: error.status === 404 ? false : null,
        pruefung: error.status === 404 ? "provider_404_im_autorisierten_konto" : "nicht_verifizierbar",
        fehlercode: error.code,
        http_status: error.status,
      });
      continue;
    }
    try {
      Object.assign(summary, await readPositionRates(invoiceId, token, fetchImpl));
      summary.positionspruefung = "abgeschlossen";
    } catch (error) {
      summary.positionspruefung = "unvollstaendig_manuell_pruefen";
      summary.positionsfehler = error.code;
      summary.positions_http_status = error.status;
    }
    results.push(summary);
  }
  return {
    modus: "GET_ONLY_KEINE_RETRIES_KEINE_SPEICHERUNG",
    system_version: systemVersion,
    system_fehler: systemError,
    rechnungen: results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await inspectInvoices(process.env.SEVDESK_API_TOKEN);
    console.log(JSON.stringify(report, null, 2));
    if (report.system_fehler || report.rechnungen.some((item) =>
      item.existiert !== true || item.positionspruefung !== "abgeschlossen" ||
      item.status_code === "unbekannt" || !item.invoice_date_vienna || !item.kontakt_referenz
    )) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ fehlercode: error.code || "readonly_check_failed" }));
    process.exitCode = 1;
  }
}
