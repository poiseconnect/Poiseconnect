export const dynamic = "force-dynamic";

import { Resend } from "resend";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

export async function POST(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const body = await req.json();
    const invoiceId = body.invoiceId;
    const to = body.to;
    const subject = body.subject;
    const message = body.message;

    if (!invoiceId) {
      return json({ error: "MISSING_INVOICE_ID" }, 400);
    }
    if (!to) {
      return json({ error: "MISSING_TO" }, 400);
    }

    if (!subject) {
      return json({ error: "MISSING_SUBJECT" }, 400);
    }
    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { data: invoice, error: invoiceErr } = await sb
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceErr || !invoice) {
      return json({ error: "INVOICE_NOT_FOUND" }, 404);
    }

    if (
      member.role === "therapist" &&
      String(invoice.therapist_id) !== String(member.id)
    ) {
      return json({ error: "NO_ACCESS_TO_INVOICE" }, 403);
    }

    const { data: anfrage, error: anfrageErr } = await sb
      .from("anfragen")
      .select("*")
      .eq("id", invoice.anfrage_id)
      .single();

    if (anfrageErr || !anfrage) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    const { data: settings, error: settingsErr } = await sb
      .from("therapist_invoice_settings")
      .select("*")
      .eq("therapist_id", invoice.therapist_id)
      .single();

    if (settingsErr || !settings) {
      return json({ error: "INVOICE_SETTINGS_NOT_FOUND" }, 404);
    }

    const { data: coachMember, error: coachErr } = await sb
      .from("team_members")
      .select("id, name, email")
      .eq("id", invoice.therapist_id)
      .single();

    if (coachErr || !coachMember) {
      return json({ error: "COACH_NOT_FOUND" }, 404);
    }

    const coachEmail = coachMember.email || null;
    const coachName =
      coachMember.name ||
      settings.company_name ||
      "Coach";

    if (!invoice.client_email) {
      return json({ error: "CLIENT_EMAIL_MISSING" }, 400);
    }

    const doc = new jsPDF("p", "mm", "a4");

    const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];

    buildPdf({
      doc,
      settings,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      servicePeriod: invoice.service_period,
      customerNumber: invoice.customer_number,
      contactPerson: invoice.contact_person,
      clientName: invoice.client_name,
      clientStreet: invoice.client_street,
      clientZipCity: invoice.client_city,
      clientCountry: invoice.client_country,
      clientEmail: invoice.client_email,
      salutation: invoice.salutation,
      introText: invoice.intro_text,
      paymentTerms: invoice.payment_terms,
      closingText: invoice.closing_text,
      vatRate: Number(invoice.vat_rate || 0),
      lineItems: lineItems.map((li) => ({
        id: li.session_id,
        date: li.date,
        description: li.description,
        qty: Number(li.qty || 1),
        unit: Number(li.unit_price || 0),
        total: Number(li.total || 0),
      })),
      totals: {
        net: Number(invoice.total_net || 0),
        vat: Number(invoice.vat_amount || 0),
        gross: Number(invoice.total_gross || 0),
      },
    });

    const pdfBase64 = doc.output("datauristring").split(",")[1];

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.RESEND_FROM || "Poise <noreply@mypoise.de>",
      reply_to: coachEmail || process.env.RESEND_FROM,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          ${String(message || "")
            .split("\n")
            .map((line) => `<p>${line || "&nbsp;"}</p>`)
            .join("")}

          <br/>

          <p>
            Herzliche Grüße<br/>
            ${coachName}
          </p>
        </div>
      `,
      attachments: [
        {
filename: `Rechnung_${invoice.invoice_number || "rechnung"}.pdf`,
          content: pdfBase64,
        },
      ],
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}

function buildPdf({
  doc,
  settings,
  invoiceNumber,
  invoiceDate,
  servicePeriod,
  customerNumber,
  contactPerson,
  clientName,
  clientStreet,
  clientZipCity,
  clientCountry,
  clientEmail,
  salutation,
  introText,
  paymentTerms,
  closingText,
  vatRate,
  lineItems,
  totals,
}) {
  const marginX = 15;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(String(settings.company_name || ""), marginX, 18);
  const addrLines = String(settings.address || "").split("\n");
  let y = 23;
  for (const ln of addrLines) {
    doc.text(ln, marginX, y);
    y += 5;
  }

  doc.setFontSize(18);
  doc.text("RECHNUNG", pageWidth - marginX, 22, { align: "right" });

  doc.setFontSize(10);
  const metaY = 32;
  doc.text("Rechnungs-Nr.:", pageWidth - marginX - 70, metaY);
  doc.text(String(invoiceNumber || ""), pageWidth - marginX, metaY, { align: "right" });

  doc.text("Rechnungsdatum:", pageWidth - marginX - 70, metaY + 6);
  doc.text(String(invoiceDate || ""), pageWidth - marginX, metaY + 6, { align: "right" });

  doc.text("Leistungszeitraum:", pageWidth - marginX - 70, metaY + 12);
  doc.text(String(servicePeriod || ""), pageWidth - marginX, metaY + 12, { align: "right" });

  if (customerNumber) {
    doc.text("Kundennummer:", pageWidth - marginX - 70, metaY + 18);
    doc.text(String(customerNumber), pageWidth - marginX, metaY + 18, { align: "right" });
  }
  if (contactPerson) {
    doc.text("Ansprechpartner:", pageWidth - marginX - 70, metaY + 24);
    doc.text(String(contactPerson), pageWidth - marginX, metaY + 24, { align: "right" });
  }

  let ry = 50;
  doc.setFontSize(10);
  doc.text("Rechnung an:", marginX, ry);
  ry += 6;
  doc.text(String(clientName || ""), marginX, ry);
  ry += 5;
  doc.text(String(clientStreet || ""), marginX, ry);
  ry += 5;
  doc.text(String(clientZipCity || ""), marginX, ry);
  ry += 5;
  if (clientCountry) {
    doc.text(String(clientCountry), marginX, ry);
    ry += 5;
  }
  if (clientEmail) {
    doc.text(String(clientEmail), marginX, ry);
    ry += 5;
  }

  ry += 8;
  doc.setFont("helvetica", "bold");
  doc.text(`Rechnung Nr. ${invoiceNumber}`, marginX, ry);
  doc.setFont("helvetica", "normal");

  ry += 10;
  doc.setFontSize(10);
  doc.text(String(salutation || ""), marginX, ry);
  ry += 6;

  const introLines = doc.splitTextToSize(String(introText || ""), pageWidth - 2 * marginX);
  doc.text(introLines, marginX, ry);
  ry += introLines.length * 5 + 4;

  const body = (lineItems || []).map((li, idx) => {
    const dateStr = li.date ? new Date(li.date).toLocaleDateString("de-AT") : "";
    const desc = li.description ? `${li.description}\nTermin: ${dateStr}` : `Termin: ${dateStr}`;
    return [
      `${idx + 1}.`,
      desc,
      String(li.qty ?? 1),
      `${Number(li.unit || 0).toFixed(2)} EUR`,
      `${Number(li.total || 0).toFixed(2)} EUR`,
    ];
  });

  doc.autoTable({
    startY: ry,
    head: [["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamtpreis"]],
    body,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [255, 255, 255], textColor: 20, lineWidth: 0.1, lineColor: 200 },
    tableLineWidth: 0.1,
    tableLineColor: 200,
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 95 },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  });

  let fy = doc.lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "bold");
  doc.text("Gesamtbetrag netto", pageWidth - marginX - 70, fy);
  doc.setFont("helvetica", "normal");
  doc.text(`${Number(totals.net || 0).toFixed(2)} EUR`, pageWidth - marginX, fy, { align: "right" });

  fy += 6;

  if (vatRate > 0) {
    doc.setFont("helvetica", "bold");
    doc.text(`zzgl. Umsatzsteuer ${vatRate}%`, pageWidth - marginX - 70, fy);
    doc.setFont("helvetica", "normal");
    doc.text(`${Number(totals.vat || 0).toFixed(2)} EUR`, pageWidth - marginX, fy, { align: "right" });
    fy += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Gesamtbetrag brutto", pageWidth - marginX - 70, fy);
  doc.text(`${Number(totals.gross || 0).toFixed(2)} EUR`, pageWidth - marginX, fy, { align: "right" });
  doc.setFont("helvetica", "normal");

  fy += 10;

  const payLines = doc.splitTextToSize(String(paymentTerms || ""), pageWidth - 2 * marginX);
  doc.text(payLines, marginX, fy);
  fy += payLines.length * 5 + 4;

  const closeLines = doc.splitTextToSize(String(closingText || ""), pageWidth - 2 * marginX);
  doc.text(closeLines, marginX, fy);

  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    const footerPageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const footerMarginX = 20;
    const footerTopY = pageHeight - 40;
    const lineGap = 4.5;

    const usableWidth = footerPageWidth - footerMarginX * 2;
    const colWidth = usableWidth / 3;

    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(footerMarginX, footerTopY - 8, footerPageWidth - footerMarginX, footerTopY - 8);

    doc.setFontSize(9);

    let x1 = footerMarginX;
    let y1 = footerTopY;

    doc.setFont("helvetica", "bold");
    doc.text(settings.company_name || "", x1, y1);

    doc.setFont("helvetica", "normal");
    y1 += lineGap;

    const addressLinesFooter = (settings.address || "").split("\n");
    addressLinesFooter.forEach((line) => {
      doc.text(line, x1, y1);
      y1 += lineGap;
    });

    if (settings.email) {
      doc.text(`E-Mail: ${settings.email}`, x1, y1);
    }

    let x2 = footerMarginX + colWidth;
    let y2 = footerTopY;

    doc.setFont("helvetica", "bold");
    doc.text("Rechtliches", x2, y2);

    doc.setFont("helvetica", "normal");
    y2 += lineGap;
    doc.text(`UID: ${settings.vat_number || "—"}`, x2, y2);
    y2 += lineGap;
    doc.text(`Steuernr: ${settings.tax_number || "—"}`, x2, y2);

    let x3 = footerMarginX + colWidth * 2;
    let y3 = footerTopY;

    doc.setFont("helvetica", "bold");
    doc.text("Bank", x3, y3);

    doc.setFont("helvetica", "normal");
    y3 += lineGap;
    doc.text(`IBAN: ${settings.iban || "—"}`, x3, y3);
    y3 += lineGap;
    doc.text(`BIC: ${settings.bic || "—"}`, x3, y3);
  }
}
