export const dynamic = "force-dynamic";

const SEVDESK_API_URL = "https://my.sevdesk.de/api/v1";

// HIER DEINE ECHTE sevDesk Invoice-ID EINTRAGEN
const TEST_INVOICE_ID = "DEINE_ECHTE_INVOICE_ID";

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
  if (
    !TEST_INVOICE_ID ||
    TEST_INVOICE_ID === "DEINE_ECHTE_INVOICE_ID"
  ) {
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
      header: "UPDATED VIA API",
      headText: "Test Update funktioniert",
      footText: "API Test ohne invoicePosSave",
    },
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
