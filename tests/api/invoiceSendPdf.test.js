import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserFromBearer: vi.fn(),
  supabaseAdmin: vi.fn(),
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    constructor() {
      this.emails = { send: mocks.send };
    }
  },
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer: mocks.getUserFromBearer,
  json: (data, status = 200) =>
    new Response(JSON.stringify(data), { status }),
  supabaseAdmin: mocks.supabaseAdmin,
}));

import { POST } from "../../app/api/invoices/send/route.js";

const invoice = {
  id: "invoice-test",
  therapist_id: "coach-test",
  anfrage_id: "request-test",
  invoice_number: "TEST-2026-001",
  invoice_date: "2026-10-21",
  service_period: "Oktober 2026",
  customer_number: "CUSTOMER-TEST",
  client_email: "client@example.invalid",
  client_name: "Test Client",
  client_street: "Test Street 1",
  client_city: "4810 Test City",
  client_country: "Österreich",
  salutation: "Guten Tag",
  intro_text: "Danke für Ihr Vertrauen.",
  payment_terms: "Zahlbar innerhalb von 14 Tagen.",
  closing_text: "Freundliche Grüße",
  vat_rate: 20,
  line_items: [
    {
      session_id: "session-test-1",
      date: "2026-10-05",
      description: "Beratungseinheit A",
      qty: 1,
      unit_price: 50,
      total: 50,
    },
    {
      session_id: "session-test-2",
      date: "2026-10-12",
      description: "Beratungseinheit B",
      qty: 1,
      unit_price: 50,
      total: 50,
    },
  ],
  total_net: 100,
  vat_amount: 20,
  total_gross: 120,
};

function createMockSupabase() {
  const rows = {
    team_members: [
      { id: "coach-test", user_id: "user-test", role: "admin", active: true, name: "Test Coach", email: "coach@example.invalid" },
    ],
    invoices: [invoice],
    anfragen: [{ id: "request-test" }],
    therapist_invoice_settings: [
      {
        therapist_id: "coach-test",
        company_name: "Test Practice",
        address: "Test Street 1\n4810 Test City",
      },
    ],
  };

  return {
    from(table) {
      const filters = [];
      const query = {
        select() {
          return query;
        },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        async single() {
          const matches = (rows[table] || []).find((row) =>
            filters.every(([column, value]) => row[column] === value)
          );
          return { data: matches || null, error: matches ? null : new Error("Not found") };
        },
      };

      return query;
    },
  };
}

function request() {
  return new Request("https://app.example.invalid/api/invoices/send", {
    method: "POST",
    headers: { Authorization: "Bearer synthetic-test-token", "Content-Type": "application/json" },
    body: JSON.stringify({
      invoiceId: "invoice-test",
      to: "client@example.invalid",
      subject: "Ihre Rechnung",
      message: "Anbei die Rechnung.",
    }),
  });
}

describe("invoice PDF email attachment", () => {
  beforeEach(() => {
    mocks.getUserFromBearer.mockReset().mockResolvedValue({
      user: { id: "user-test" },
      error: null,
    });
    mocks.supabaseAdmin.mockReset().mockReturnValue(createMockSupabase());
    mocks.send.mockReset().mockResolvedValue({ data: { id: "email-test" }, error: null });
  });

  it("generates a valid multi-line-item PDF with invoice totals before sending", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.send).toHaveBeenCalledOnce();

    const [{ attachments }] = mocks.send.mock.calls[0];
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe("Rechnung_TEST-2026-001.pdf");

    const pdf = Buffer.from(attachments[0].content, "base64").toString("latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("%%EOF");
    expect(pdf).toContain("TEST-2026-001");
    expect(pdf).toContain("Beratungseinheit A");
    expect(pdf).toContain("Beratungseinheit B");
    expect(pdf).toContain("Gesamtbetrag netto");
    expect(pdf).toContain("100.00 EUR");
    expect(pdf).toContain("zzgl. Umsatzsteuer 20%");
    expect(pdf).toContain("20.00 EUR");
    expect(pdf).toContain("120.00 EUR");
  });
});
