import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const {
      therapist,
      sessions,
      invoiceSettings,
      periodLabel,
    } = await req.json();

    const apiKey = process.env.SEVDESK_API_KEY;

    // 🔹 Position berechnen
    const totalProvision = sessions.reduce(
      (sum, s) => sum + Number(s.provision || 0),
      0
    );

    const isReverseCharge = invoiceSettings.therapist_is_vat_registered === true;

    const payload = {
      invoice: {
        objectName: "Invoice",
        invoiceType: "RE",
        status: 100,
        header: `Poise Provision ${periodLabel}`,
        contact: therapist.sevdesk_contact_id,
        invoiceDate: new Date().toISOString().slice(0, 10),
        currency: "EUR",
        taxType: isReverseCharge ? "reverseCharge" : "default",
        taxRate: isReverseCharge
          ? 0
          : invoiceSettings.default_vat_rate,
      },
      positions: [
        {
          name: "Vermittlungsprovision (30 %)",
          quantity: 1,
          price: totalProvision,
          taxRate: isReverseCharge
            ? 0
            : invoiceSettings.default_vat_rate,
        },
      ],
    };

    const res = await fetch("https://my.sevdesk.de/api/v1/Invoice", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
