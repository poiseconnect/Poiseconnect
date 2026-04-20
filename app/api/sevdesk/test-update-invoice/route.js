export const dynamic = "force-dynamic";

const SEVDESK_API_URL = "https://my.sevdesk.de/api/v1";

// HIER deine vorhandene sevDesk-Rechnungs-ID eintragen
const TEST_INVOICE_ID = "142946459";

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

async function runTest() {
  if (!TEST_INVOICE_ID || TEST_INVOICE_ID === "HIER_DEINE_INVOICE_ID") {
    return json(
      {
        ok: false,
        error: "missing_test_invoice_id",
        detail: "Bitte TEST_INVOICE_ID in der Datei setzen.",
      },
      400
    );
  }

  const payload = {
    invoice: {
      id: String(TEST_INVOICE_ID),
      objectName: "Invoice",
    },
    invoicePosSave: [
      {
        name: "API Testposition 1",
        text: "1 x 10.00 EUR netto",
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
      {
        name: "API Testposition 2",
        text: "2 x 5.00 EUR netto",
        quantity: 2,
        price: 5,
        taxRate: 20,
        positionNumber: 2,
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
    message: "Bestehende sevDesk-Rechnung erfolgreich aktualisiert",
    raw: data,
  });
}

export async function GET() {
  try {
    return await runTest();
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
    return await runTest();
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
