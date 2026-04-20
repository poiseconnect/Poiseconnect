export const dynamic = "force-dynamic";

const SEVDESK_API_URL = "https://my.sevdesk.de/api/v1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

function extractId(payload) {
  return (
    payload?.objects?.id ||
    payload?.object?.id ||
    payload?.objects?.[0]?.id ||
    payload?.object?.[0]?.id ||
    payload?.id ||
    null
  );
}

async function runTestInvoice() {
  const contactId = "129257609";

  const payload = {
    invoice: {
      contact: {
        id: String(contactId),
        objectName: "Contact",
      },
      invoiceDate: new Date().toISOString().slice(0, 10),
      invoiceType: "RE",
      status: 100,
      header: "TEST Rechnung Poise API",
      headText: "Dies ist eine automatisch erzeugte Testrechnung aus Poise.",
      footText: "Bitte nicht buchen oder versenden. Nur API-Test.",
      timeToPay: 14,
      discount: 0,
      taxRate: 20,
      taxText: "20% USt",
      currency: "EUR",
      objectName: "Invoice",
    },
    invoicePosSave: [
      {
        name: "API Testposition",
        text: "1 x 10.00 € netto",
        quantity: 1,
        price: 10,
        taxRate: 20,
        positionNumber: 1,
        unity: {
          id: "1",
          objectName: "Unity",
        },
        objectName: "InvoicePos",
      },
    ],
    invoicePosDelete: null,
  };

  const { res, data } = await sevdeskFetch("/Invoice/Factory/saveInvoice", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return json(
      {
        ok: false,
        error: "sevdesk_save_invoice_failed",
        detail: data,
        sent_payload: payload,
      },
      500
    );
  }

  return json({
    ok: true,
    message: "Testrechnung in sevDesk angelegt",
    sevdesk_invoice_id: extractId(data),
    raw: data,
  });
}

export async function GET() {
  try {
    return await runTestInvoice();
  } catch (err) {
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

export async function POST() {
  try {
    return await runTestInvoice();
  } catch (err) {
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
