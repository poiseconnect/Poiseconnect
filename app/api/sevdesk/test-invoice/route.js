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
    throw new Error("SEVDESK_API_TOKEN fehlt in Vercel Environment Variables");
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

export async function POST() {
  try {
    // Dein Test-Contact aus dem Screenshot:
    const contactId = "129257609";

    const invoicePayload = {
      contact: {
        id: contactId,
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
      currency: "EUR",
      taxRate: 20,
      taxText: "20% USt",
      invoicePosSave: [
        {
          name: "API Testposition",
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
    };

    const { res, data } = await sevdeskFetch("/Invoice", {
      method: "POST",
      body: JSON.stringify(invoicePayload),
    });

    if (!res.ok) {
      return json(
        {
          ok: false,
          error: "sevdesk_create_invoice_failed",
          detail: data,
          sent_payload: invoicePayload,
        },
        500
      );
    }

    const invoiceId = extractId(data);

    return json({
      ok: true,
      message: "Testrechnung in sevDesk angelegt",
      sevdesk_invoice_id: invoiceId,
      raw: data,
    });
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
