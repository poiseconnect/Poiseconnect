import { NextResponse } from "next/server";

const SEVDESK_API_BASE = "https://my.sevdesk.de/api/v1";

function getApiToken() {
  const token = process.env.SEVDESK_API_TOKEN;
  if (!token) {
    throw new Error("SEVDESK_API_TOKEN fehlt");
  }
  return token;
}

async function sevdeskFetch(path, options = {}) {
  const token = getApiToken();

  const res = await fetch(`${SEVDESK_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error("SEVDESK ERROR", path, json);
    throw new Error(
      `sevDesk API Fehler bei ${path}: ${JSON.stringify(json)}`
    );
  }

  return json;
}

async function findContactByName(name) {
  if (!name) return null;

  const encoded = encodeURIComponent(name);

  const json = await sevdeskFetch(`/Contact?name=${encoded}`);

  const contacts = json?.objects || json?.data || [];

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return null;
  }

  // exakter Treffer bevorzugt
  const exact =
    contacts.find(
      (c) =>
        String(c.name || "").trim().toLowerCase() ===
        String(name).trim().toLowerCase()
    ) || contacts[0];

  return exact;
}

function buildInvoicePositions(invoiceBundle) {
  return (invoiceBundle?.rows || []).map((row, index) => ({
    id: null,
    objectName: "InvoicePos",
    mapAll: true,
    quantity: Number(row.qty || 0),
    price: Number(row.unit_price_net || 0),
    name: `${row.label} – Provision`,
    unity: {
      id: 1,
      objectName: "Unity",
    },
    positionNumber: index + 1,
    text: `${row.label}, ${Number(row.qty || 0)} Sitzung(en), Provision netto pro Einheit`,
    discount: 0,
    optional: false,
    taxRate: Number(invoiceBundle?.vat_rate || 0),
  }));
}

export async function POST(req) {
  try {
    const body = await req.json();

    const coach = body?.coach || null;
    const coachInvoiceSettings = body?.coachInvoiceSettings || {};
    const poiseSettings = body?.poiseSettings || {};
    const invoiceBundle = body?.invoiceBundle || null;
    const periodLabel = body?.periodLabel || "";

    if (!coach || !invoiceBundle) {
      return NextResponse.json(
        { error: "coach oder invoiceBundle fehlt" },
        { status: 400 }
      );
    }

    const contactSearchName =
      coachInvoiceSettings.company_name ||
      coach.name ||
      "";

    const contact = await findContactByName(contactSearchName);

    if (!contact?.id) {
      return NextResponse.json(
        {
          error: `Kein sevDesk-Kontakt gefunden für: ${contactSearchName}`,
        },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const invoicePositions = buildInvoicePositions(invoiceBundle);

    if (!invoicePositions.length) {
      return NextResponse.json(
        { error: "Keine Rechnungspositionen vorhanden" },
        { status: 400 }
      );
    }

    const invoicePayload = {
      contact: {
        id: contact.id,
        objectName: "Contact",
      },
      invoiceDate: today,
      header: `Provision ${periodLabel}`,
      headText: `Rechnung von ${poiseSettings.company_name || "Poise by Linda Leinweber GmbH"}`,
      footText:
        invoiceBundle.key === "reverse_charge"
          ? "Reverse Charge – Steuerschuld geht auf den Leistungsempfänger über."
          : "",
      timeToPay: 14,
      discountTime: 0,
      discount: 0,
      taxRate: Number(invoiceBundle.vat_rate || 0),
      taxText:
        invoiceBundle.key === "reverse_charge"
          ? "Reverse Charge"
          : `${Number(invoiceBundle.vat_rate || 0)}% Umsatzsteuer`,
      invoiceType: "RE",
      status: "100",
      smallSettlement: 0,
      invoicePosSave: invoicePositions,
    };

    const result = await sevdeskFetch("/Invoice/Factory/saveInvoice", {
      method: "POST",
      body: JSON.stringify(invoicePayload),
    });

    return NextResponse.json({
      ok: true,
      contactId: contact.id,
      invoiceResult: result,
    });
  } catch (error) {
    console.error("sevdesk-export-coach-quarterly failed:", error);
    return NextResponse.json(
      {
        error: error.message || "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
