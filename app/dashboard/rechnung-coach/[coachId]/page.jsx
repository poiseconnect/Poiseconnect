"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { SEVDESK_LINK_CONFLICT_MESSAGE } from "../../../lib/coachInvoiceLink.js";
import jsPDF from "jspdf";
import "jspdf-autotable";

const POISE_ADMIN_SETTINGS = {
  company_name: "Poise by Linda Leinweber GmbH",
  address: "Hamberg 21\n4813 Altmünster\nÖsterreich",
  iban: "AT04 3451 0000 0206 1224",
  bic: "RZOOAT2L510",
  vat_number: "ATU78817327",
  tax_number: "53 317 6657",
};

export default function RechnungCoachPage({ params, searchParams }) {
  const { coachId } = params;

  const billingYear = searchParams?.billingYear || "";
  const billingQuarter = searchParams?.billingQuarter || "";
  const billingMonth = searchParams?.billingMonth || "";
  const billingDate = searchParams?.billingDate || "";
  const billingMode = searchParams?.billingMode || "quartal";
  const bundleKey = searchParams?.bundleKey || "normal_ust";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const [savedCoachInvoiceId, setSavedCoachInvoiceId] = useState(null);
  const [invoiceUpdatedAt, setInvoiceUpdatedAt] = useState(null);
  const [sevdeskInvoiceId, setSevdeskInvoiceId] = useState("");
  const [sevdeskLinkState, setSevdeskLinkState] = useState("unavailable");
  const [quarterWorkflowAvailable, setQuarterWorkflowAvailable] = useState(false);
  const [quarterWorkflowMessage, setQuarterWorkflowMessage] = useState("");
  const [sevdeskDraftNumber, setSevdeskDraftNumber] = useState("");
  const [sevdeskStatusDetails, setSevdeskStatusDetails] = useState(null);
  const [checkingSevdeskStatus, setCheckingSevdeskStatus] = useState(false);

  const [coach, setCoach] = useState(null);
  const [poiseSettings, setPoiseSettings] = useState(POISE_ADMIN_SETTINGS);
  const [coachInvoiceSettings, setCoachInvoiceSettings] = useState(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [servicePeriod, setServicePeriod] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientZipCity, setClientZipCity] = useState("");
  const [clientCountry, setClientCountry] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [salutation, setSalutation] = useState("Sehr geehrte Damen und Herren,");
  const [introText, setIntroText] = useState(
    "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:"
  );
  const [paymentTerms, setPaymentTerms] = useState(
    "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ab Rechnungseingang ohne Abzüge."
  );
  const [closingText, setClosingText] = useState(
    "Herzlichen Dank für Dein Engagement und die angenehme Zusammenarbeit!\n\nLiebe Grüße\n\nSebastian Kickinger\nPoise by Linda Leinweber GmbH"
  );

  const [lineItemsState, setLineItemsState] = useState([]);
  const [invoiceWithVat, setInvoiceWithVat] = useState(true);
  const [vatRate, setVatRate] = useState(20);
  const [invoiceState, setInvoiceState] = useState("automatic_draft");
  const [sevdeskSendStatus, setSevdeskSendStatus] = useState(null);
  const [coachQuarterRelease, setCoachQuarterRelease] = useState(null);
  const [sendingCoachInvoice, setSendingCoachInvoice] = useState(false);
  const [taxTreatment, setTaxTreatment] = useState("review_required");
  const [taxReason, setTaxReason] = useState("");
  const [hasCalculationDifference, setHasCalculationDifference] = useState(false);
  const [currentCalculation, setCurrentCalculation] = useState(null);
  const [currentSessionCount, setCurrentSessionCount] = useState(null);
  const [storedSessionCount, setStoredSessionCount] = useState(null);
  const [calculationErrors, setCalculationErrors] = useState([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId, billingYear, billingQuarter, billingMonth, billingDate, billingMode, bundleKey]);

  async function loadData() {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const qs = new URLSearchParams({
        coachId: String(coachId || ""),
        billingMode: String(billingMode || ""),
        billingYear: String(billingYear || ""),
        billingQuarter: String(billingQuarter || ""),
        billingMonth: String(billingMonth || ""),
        billingDate: String(billingDate || ""),
        bundleKey: String(bundleKey || ""),
      });

      const res = await fetch(`/api/invoices/load-coach?${qs.toString()}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("LOAD COACH INVOICE DATA ERROR:", json);
        alert("Coach-Rechnung konnte nicht geladen werden");
        return;
      }

      const coachData = json.coach || null;
      const recipientSettings = json.coachInvoiceSettings || null;
      const rows = Array.isArray(json.lineItems) ? json.lineItems : [];
      const settingsFromApi = json.poiseSettings || POISE_ADMIN_SETTINGS;

      setCoach(coachData);
      setCoachInvoiceSettings(recipientSettings);
      setPoiseSettings(settingsFromApi);

      setInvoiceWithVat(json.invoice_with_vat === true);
      setVatRate(Number(json.vat_rate ?? 20));
      setInvoiceState(json.invoice_state || "automatic_draft");
      setTaxTreatment(
        json.tax_treatment ||
          "review_required"
      );
      setTaxReason(json.tax_reason || "");
      setHasCalculationDifference(json.has_calculation_difference === true);
      setCurrentCalculation(json.current_calculation || null);
      setCurrentSessionCount(json.current_session_count ?? null);
      setStoredSessionCount(json.stored_session_count ?? null);
      setCalculationErrors(
        Array.isArray(json.calculation_errors) ? json.calculation_errors : []
      );

      if (json.invoice_id) {
        setSavedCoachInvoiceId(json.invoice_id);
        setInvoiceUpdatedAt(json.invoice_updated_at || null);
      } else {
        setSavedCoachInvoiceId(null);
        setInvoiceUpdatedAt(null);
      }

      setSevdeskInvoiceId(json.sevdesk_invoice_id || "");
      setSevdeskLinkState(json.sevdesk_link_state || "unavailable");
      setQuarterWorkflowAvailable(json.quarter_workflow_available === true);
      setQuarterWorkflowMessage(json.quarter_workflow_message || "");
      setSevdeskDraftNumber(json.sevdesk_draft_invoice_number || "");
      setSevdeskStatusDetails(null);
      setSevdeskSendStatus(json.sevdesk_send_status || null);
      setCoachQuarterRelease(json.coach_quarter_release || null);

      const now = new Date();

      setInvoiceNumber(
        json.invoice_number ||
          `POISE-${bundleKey}-${billingYear || now.getFullYear()}-${Date.now()
            .toString()
            .slice(-5)}`
      );

      setInvoiceDate(json.invoice_date || now.toISOString().slice(0, 10));

      setServicePeriod(
        json.service_period ||
          buildCoachServicePeriod({
            billingMode,
            billingYear,
            billingQuarter,
            billingMonth,
          })
      );

      const recipientName =
        recipientSettings?.company_name ||
        coachData?.profile_name ||
        coachData?.name ||
        "Coach";

      const addressLines = String(recipientSettings?.address || "")
        .split("\n")
        .filter(Boolean);

      setClientName(json.client_name || recipientName);
      setClientStreet(json.client_street || addressLines[0] || "");
      setClientZipCity(json.client_city || addressLines.slice(1).join(" ") || "");
      setClientCountry(json.client_country || "");
      setClientEmail(json.client_email || coachData?.email || "");

      setContactPerson(json.contact_person || "");
      setCustomerNumber(json.customer_number || "");

      if (json.salutation) setSalutation(json.salutation);
      if (json.intro_text) setIntroText(json.intro_text);
      if (json.payment_terms) setPaymentTerms(json.payment_terms);
      if (json.closing_text) setClosingText(json.closing_text);

      setLineItemsState(
        rows.map((row, idx) => {
          const qty = Number(row.qty ?? 0);
          const unit = Number(
            row.unit ?? row.unit_price ?? row.unit_price_net ?? 0
          );
          return {
            id: row.id || `${idx + 1}`,
            description: row.description || row.label || "Provision",
            qty,
            unit,
            total: Number(row.total ?? row.total_net ?? qty * unit),
          };
        })
      );
    } finally {
      setLoading(false);
    }
  }

  const lineItems = useMemo(() => {
    return (lineItemsState || []).map((li) => {
      const qty = Number(li.qty || 0);
      const unit = Number(li.unit || 0);
      return {
        ...li,
        qty,
        unit,
        total: qty * unit,
      };
    });
  }, [lineItemsState]);

  const calculatedTotals = useMemo(() => {
    let net = 0;
    let vat = 0;
    let gross = 0;

    lineItems.forEach((li) => {
      const amount = Number(li.total || 0);

      if (invoiceWithVat) {
        net += amount;
        vat += amount * (vatRate / 100);
        gross += amount + amount * (vatRate / 100);
      } else {
        net += amount;
        gross += amount;
      }
    });

    return { net, vat, gross };
  }, [lineItems, invoiceWithVat, vatRate]);

  const totals = calculatedTotals;
async function saveInvoice() {
  setSaving(true);

  try {
    const payload = {
      type: "coach",
      coach_id: coachId,
      billing_mode: billingMode,
      billing_year: billingYear ? Number(billingYear) : null,
      billing_quarter: billingQuarter ? Number(billingQuarter) : null,
      billing_month: billingMonth ? Number(billingMonth) : null,
      billing_date: billingDate || null,
      bundle_key: bundleKey,
      bundle_type:
        bundleKey === "reverse_charge"
          ? "client_with_vat"
          : "client_without_vat",

      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      service_period: servicePeriod,
      customer_number: customerNumber,
      contact_person: contactPerson,

      client_name: clientName,
      client_street: clientStreet,
      client_city: clientZipCity,
      client_country: clientCountry,
      client_email: clientEmail,

      salutation,
      intro_text: introText,
      payment_terms: paymentTerms,
      closing_text: closingText,

      invoice_with_vat: invoiceWithVat,
      tax_treatment: taxTreatment,
      tax_reason: taxReason,
      vat_rate: vatRate,
      total_net: totals.net,
      vat_amount: totals.vat,
      total_gross: totals.gross,

      line_items: lineItems.map((li, idx) => ({
        id: li.id,
        pos: idx + 1,
        description: li.description,
        qty: li.qty,
        unit_price: li.unit,
        total: li.total,
      })),

      sevdesk_invoice_number: null,
      sevdesk_synced_at: null,
      expected_updated_at: invoiceUpdatedAt,
    };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/invoices/save-coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("SAVE COACH INVOICE ERROR:", { status: res.status });
      throw new Error(result?.error === "coach_quarter_workflow_unavailable"
        ? result.message
        : result?.error === "sevdesk_invoice_link_conflict"
        ? SEVDESK_LINK_CONFLICT_MESSAGE
        : result?.error === "invoice_concurrent_update"
        ? "Die Rechnung wurde zwischenzeitlich von einer anderen Person geändert. Bitte neu laden und die Änderungen prüfen."
        : result?.error === "billing_calculation_invalid"
          ? `Speichern blockiert: ungültige Sitzungspreise bei ${result.calculation_errors.map((item) => item.session_id || "unbekannter Sitzung").join(", ")}.`
        : "Fehler beim Speichern");
    }

    if (result?.data?.id) {
      setSavedCoachInvoiceId(result.data.id);
    }
    if (result?.data?.updated_at) setInvoiceUpdatedAt(result.data.updated_at);
    setInvoiceState("saved_draft");

    if (result?.data?.sevdesk_invoice_id) {
      setSevdeskInvoiceId(result.data.sevdesk_invoice_id);
    }

    return result;
  } finally {
    setSaving(false);
  }

}

async function recalculateFromSessions() {
  if (!savedCoachInvoiceId) return;
  setRecalculating(true);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/invoices/recalculate-coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        coach_id: coachId,
        billing_mode: billingMode,
        billing_year: billingYear,
        billing_quarter: billingQuarter,
        billing_month: billingMonth,
        billing_date: billingDate,
        bundle_type:
          bundleKey === "reverse_charge"
            ? "client_with_vat"
            : "client_without_vat",
        bundle_key: bundleKey,
        expected_updated_at: invoiceUpdatedAt,
      }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok) {
      const invalidSessionIds = (result?.calculation_errors || [])
        .map((item) => item.session_id)
        .filter(Boolean);
      throw new Error(result?.error === "coach_quarter_workflow_unavailable"
        ? result.message
        : result?.error === "sevdesk_invoice_link_conflict"
        ? SEVDESK_LINK_CONFLICT_MESSAGE
        : result?.error === "invoice_concurrent_update"
        ? "Die Rechnung wurde zwischenzeitlich geändert. Bitte neu laden und die Änderungen prüfen."
        : result?.error === "billing_calculation_invalid"
          ? `Neuberechnung blockiert: ungültige Sitzungspreise bei ${invalidSessionIds.join(", ") || "mindestens einer Sitzung"}.`
          : result?.error || "Neuberechnung fehlgeschlagen");
    }
    await loadData();
  } catch (error) {
    alert(error.message || "Neuberechnung fehlgeschlagen");
  } finally {
    setRecalculating(false);
  }
}

  async function createCoachInvoiceDraft() {
    setSendingCoachInvoice(true);
    try {
      const saveResult = sevdeskSendStatus && sevdeskSendStatus !== "creation_failed"
        ? null
        : await saveInvoice();
      const coachInvoiceId = saveResult?.data?.id || savedCoachInvoiceId;
      if (!coachInvoiceId) throw new Error("Draft konnte nicht gespeichert werden");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/sevdesk/create-and-send-coach-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ coachInvoiceId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        const messages = {
          sevdesk_invoice_link_conflict: SEVDESK_LINK_CONFLICT_MESSAGE,
          coach_quarter_workflow_unavailable: result?.message,
          invoice_link_check_unavailable: "Die Rechnungsverknüpfung konnte nicht sicher geprüft werden. Der Vorgang bleibt gesperrt.",
          sevdesk_live_workflow_blocked: "Die sevDesk-Rechnungserstellung ist bis zur Kontofreigabe serverseitig gesperrt.",
          test_coach_not_allowed: "Die sevDesk-Testfreigabe gilt nicht für diesen Coach.",
          billing_calculation_invalid: "Mindestens eine Sitzung hat einen ungültigen Preis. Bitte die angezeigten Sitzungsdaten korrigieren.",
          manual_reconciliation_required: "Der sevDesk-Status ist unklar. Bitte vor einem erneuten Versuch manuell in sevDesk prüfen.",
          sevdesk_period_invoice_exists: "Für diesen Coach und Zeitraum wurde bereits eine sevDesk-Rechnung gefunden. Bitte manuell prüfen; eine weitere Rechnung wurde nicht erstellt.",
          sevdesk_duplicate_check_unavailable: "Der sevDesk-Abgleich konnte nicht zuverlässig abgeschlossen werden. Der Vorgang ist blockiert; bitte manuell prüfen.",
          duplicate_check_failed_local_state_update_failed: "Der sevDesk-Abgleich ist fehlgeschlagen und der lokale Sperrstatus konnte nicht bestätigt werden. Bitte nicht erneut klicken; zuerst in sevDesk und Poise manuell prüfen.",
          duplicate_found_but_local_state_update_failed: "Eine mögliche sevDesk-Rechnung wurde gefunden, aber der lokale Sperrstatus konnte nicht gespeichert werden. Bitte nicht erneut klicken und manuell prüfen.",
          invoice_created_but_persistence_failed: "sevDesk hat möglicherweise einen Entwurf angelegt, dessen ID lokal nicht gespeichert werden konnte. Bitte nicht erneut klicken und den sevDesk-Kontakt/Zeitraum manuell prüfen.",
          invoice_creation_state_persistence_failed: "Das Ergebnis des sevDesk-Aufrufs ist unklar und der lokale Sperrstatus konnte nicht aktualisiert werden. Bitte nicht erneut klicken und den Vorgang manuell prüfen.",
          invoice_workflow_failed: "Der Vorgang ist unerwartet fehlgeschlagen. Bitte nicht erneut klicken, bevor der Request anhand der angezeigten ID geprüft wurde.",
          invoice_period_duplicate: "Für dieses Coach-Quartal und Steuer-Bundle existiert bereits ein lokaler Rechnungsentwurf. Bitte neu laden.",
          invoice_creation_result_unknown: "Das Ergebnis der Rechnungserstellung ist unklar. Es wurde kein automatischer Wiederholungsversuch gestartet.",
          sevdesk_invoice_creation_rejected: "sevDesk hat die Draft-Erstellung abgelehnt. Prüfe die Kontodaten; der Vorgang wurde nicht automatisch wiederholt.",
          creation_rejected_but_local_state_reset_failed: "sevDesk hat abgelehnt, aber der lokale Erstellungsstatus konnte nicht zurückgesetzt werden. Vor einem erneuten Versuch bitte manuell prüfen.",
          coach_quarter_release_stale: "Die Coach-Freigabe ist veraltet. Das Quartal muss erneut geprüft und freigegeben werden.",
          saved_draft_does_not_match_released_sessions: "Der gespeicherte Rechnungsentwurf passt nicht mehr zu den freigegebenen Sitzungen.",
          invoice_draft_changed: "Der Draft wurde währenddessen geändert. Bitte neu laden und prüfen.",
          invoice_operation_already_reserved: "Die Rechnungserstellung wurde bereits gestartet.",
          invoice_concurrent_update: "Die Rechnung wurde zwischenzeitlich geändert. Bitte neu laden und die Änderungen prüfen.",
        };
        throw new Error(messages[result?.error] || "Rechnungsentwurf konnte nicht erstellt werden.");
      }

      setSevdeskInvoiceId(result.invoiceId || "");
      setSevdeskDraftNumber(result.draftInvoiceNumber || "");
      await loadData();
      alert(result.existing
        ? "Der vorhandene sevDesk-Rechnungsentwurf wurde geladen."
        : "Der Rechnungsentwurf wurde in sevDesk erstellt. Er wurde weder finalisiert noch versendet.");
    } catch (error) {
      await loadData();
      alert(error.message || "Rechnungsentwurf konnte nicht erstellt werden.");
    } finally {
      setSendingCoachInvoice(false);
    }
  }

  async function readSevdeskStatus() {
    if (!savedCoachInvoiceId) return;
    setCheckingSevdeskStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const query = new URLSearchParams({ coachInvoiceId: savedCoachInvoiceId });
      const response = await fetch(`/api/sevdesk/create-and-send-coach-invoice?${query}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || result?.error || "sevDesk-Status konnte nicht gelesen werden");
      setSevdeskStatusDetails(result);
      if (result.invoiceNumber) setSevdeskDraftNumber(result.invoiceNumber);
    } catch (error) {
      alert(error.message || "sevDesk-Status konnte nicht gelesen werden");
    } finally {
      setCheckingSevdeskStatus(false);
    }
  }

  function exportPDF() {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      buildCoachPdf({
        doc,
        settings: poiseSettings,
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
        invoiceWithVat,
        lineItems,
        totals,
      });

      const safeName = (clientName || "Coach").replaceAll(" ", "_");
      doc.save(`Rechnung_${invoiceNumber}_${safeName}.pdf`);
    } catch (e) {
      console.error("COACH PDF ERROR:", e);
      alert("PDF konnte nicht erstellt werden");
    }
  }

  function updateLineItem(index, patch) {
    setLineItemsState((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  if (loading) return <div style={{ padding: 40 }}>Lade…</div>;
  if (!coach) return <div style={{ padding: 40 }}>Kein Coach gefunden</div>;
  if (!poiseSettings) {
    return <div style={{ padding: 40 }}>Keine Poise-Rechnungsdaten gefunden</div>;
  }

  const sevdeskLinkBlocked =
    quarterWorkflowAvailable && !["unlinked", "unique"].includes(sevdeskLinkState);
  const workflowWritesBlocked = !quarterWorkflowAvailable || sevdeskLinkBlocked;
  const downstreamProcessingBlocked =
    !taxTreatment || taxTreatment === "review_required" || calculationErrors.length > 0;
  const coachInvoiceSendLocked = [
    "creating",
    "creation_unknown",
    "created",
    "sending",
    "sent",
    "send_failed",
    "send_unknown",
    "finalized",
  ].includes(sevdeskSendStatus) || Boolean(sevdeskInvoiceId) || workflowWritesBlocked;

  const pageBg = {
    background: "#f0f0f0",
    minHeight: "100vh",
    padding: "50px 0",
  };

  const paper = {
    background: "#fff",
    width: 900,
    margin: "0 auto",
    padding: "70px 70px 55px 70px",
    fontFamily: "Helvetica, Arial, sans-serif",
    color: "#111",
    boxShadow: "0 1px 10px rgba(0,0,0,0.08)",
  };

  const small = { fontSize: 11, color: "#444", lineHeight: 1.35 };
  const hTitle = { fontSize: 26, fontWeight: 600, margin: 0 };
  const muted = { color: "#666" };

  const inputBase = {
    border: "none",
    borderBottom: "1px solid #ddd",
    padding: "2px 4px",
    fontSize: 12,
    width: "auto",
    outline: "none",
  };

  const rightMetaLabel = { fontSize: 10, color: "#666", width: 130 };
  const rightMetaValue = { fontSize: 10, color: "#111" };

  return (
    <div style={pageBg}>
      {!quarterWorkflowAvailable && (
        <div role="status" style={{ width: 900, margin: "0 auto 18px", color: "#444" }}>
          {quarterWorkflowMessage ||
            "Die Quartalsfreigabe ist noch nicht verfügbar. Bestehende Rechnungen bleiben sichtbar; Schreibaktionen sind vorübergehend gesperrt."}
        </div>
      )}
      {sevdeskLinkBlocked && (
        <div role="alert" style={{ width: 900, margin: "0 auto 18px", color: "#9b1c1c" }}>
          {sevdeskLinkState === "unavailable"
            ? "Die Rechnungsverknüpfung konnte nicht sicher geprüft werden. Schreibaktionen bleiben gesperrt."
            : SEVDESK_LINK_CONFLICT_MESSAGE}
        </div>
      )}
      {sevdeskInvoiceId && !sevdeskLinkBlocked && (
        <div style={{ width: 900, margin: "0 auto 18px" }}>
          Diese Rechnung ist bereits verknüpft und schreibgeschützt. Bitte den Entwurf
          ausschließlich manuell in sevDesk kontrollieren; Änderungen werden nicht synchronisiert.
        </div>
      )}
<div
  style={{
    width: 900,
    margin: "0 auto 18px auto",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  }}
>
  <button
    onClick={createCoachInvoiceDraft}
    disabled={
      sendingCoachInvoice || saving || !savedCoachInvoiceId ||
      downstreamProcessingBlocked || coachInvoiceSendLocked
    }
    style={{
      background: "#0B6E4F",
      color: "#fff",
      border: "none",
      padding: "12px 18px",
      cursor: sendingCoachInvoice || saving || !savedCoachInvoiceId || downstreamProcessingBlocked || coachInvoiceSendLocked ? "not-allowed" : "pointer",
      fontSize: 14,
      borderRadius: 6,
      opacity: sendingCoachInvoice || saving || !savedCoachInvoiceId || downstreamProcessingBlocked || coachInvoiceSendLocked ? 0.7 : 1,
      fontWeight: 600,
    }}
  >
    {sendingCoachInvoice
      ? "Erstelle sevDesk-Draft …"
      : sevdeskSendStatus === "created"
        ? "sevDesk-Draft erstellt"
        : "sevDesk-Rechnungsentwurf erstellen"}
  </button>
  {sevdeskInvoiceId && (
    <>
      <button
        type="button"
        onClick={readSevdeskStatus}
        disabled={checkingSevdeskStatus}
      >
        {checkingSevdeskStatus ? "Lese sevDesk-Status …" : "sevDesk-Status lesen"}
      </button>
      <a href="https://my.sevdesk.de" target="_blank" rel="noreferrer">
        sevDesk öffnen · ID {sevdeskInvoiceId}
      </a>
    </>
  )}

  <button
    onClick={() => saveInvoice().catch((error) => alert(error.message || "Speichern fehlgeschlagen"))}
    disabled={saving || Boolean(sevdeskInvoiceId) || workflowWritesBlocked || Boolean(sevdeskSendStatus) || calculationErrors.length > 0}
    style={{
      background: "#111",
      color: "#fff",
      border: "none",
      padding: "10px 16px",
      cursor: saving || Boolean(sevdeskInvoiceId) || workflowWritesBlocked || Boolean(sevdeskSendStatus) || calculationErrors.length > 0 ? "not-allowed" : "pointer",
      fontSize: 13,
      borderRadius: 6,
      opacity: saving || Boolean(sevdeskInvoiceId) || workflowWritesBlocked || Boolean(sevdeskSendStatus) || calculationErrors.length > 0 ? 0.7 : 1,
    }}
  >
    {saving ? "Speichere…" : "Rechnung speichern"}
  </button>

  {hasCalculationDifference && savedCoachInvoiceId && !sevdeskInvoiceId && !sevdeskLinkBlocked && (
    <button
      onClick={recalculateFromSessions}
      disabled={recalculating || saving || !quarterWorkflowAvailable || calculationErrors.length > 0}
      style={{
        background: "#0B6E4F",
        color: "#fff",
        border: "none",
        padding: "10px 16px",
        cursor: recalculating || saving || !quarterWorkflowAvailable || calculationErrors.length > 0 ? "not-allowed" : "pointer",
        fontSize: 13,
        borderRadius: 6,
        opacity: recalculating || saving || !quarterWorkflowAvailable || calculationErrors.length > 0 ? 0.7 : 1,
      }}
    >
      {recalculating ? "Berechne …" : "Aus aktuellen Sitzungen neu berechnen"}
    </button>
  )}

  <button
    onClick={exportPDF}
    style={{
      background: "#fff",
      color: "#111",
      border: "1px solid #111",
      padding: "10px 16px",
      cursor: "pointer",
      fontSize: 13,
      borderRadius: 6,
      opacity: 1,
    }}
  >
    PDF exportieren
  </button>
</div>

      <div style={paper}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ ...small, maxWidth: 520 }}>
            <div style={{ fontWeight: 700 }}>{poiseSettings.company_name}</div>
            <div style={{ whiteSpace: "pre-line" }}>{poiseSettings.address}</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>
              {invoiceState === "saved_draft"
                ? "Gespeicherter Rechnungsentwurf"
                : "Automatisch berechneter Ausgangsentwurf"}
              {taxTreatment === "vat"
                ? ` · Poise USt ${vatRate}%`
                : taxTreatment === "reverse_charge"
                  ? " · Reverse Charge"
                  : " · Steuerprüfung erforderlich"}
            </div>
            {sevdeskSendStatus && (
            <div style={{ marginTop: 6, color: "#8a4b08" }}>
              {sevdeskSendStatus === "created"
                ? "Rechnungsentwurf in sevDesk erstellt. Nicht finalisiert und nicht versendet."
                : ["creating", "creation_unknown"].includes(sevdeskSendStatus)
                  ? "Erstellungsergebnis unklar. Bitte sevDesk manuell prüfen; nicht erneut erstellen."
                  : "Rechnungserstellung blockiert. Status vor weiteren Aktionen prüfen."}
              {sevdeskDraftNumber ? ` sevDesk-Nummer: ${sevdeskDraftNumber}.` : ""}
            </div>
            )}
            {billingMode === "quartal" && (
            <div style={{ marginTop: 6, color: coachQuarterRelease?.release_status === "released" ? "#176b45" : "#8a4b08" }}>
              Coach-Freigabe: {coachQuarterRelease?.release_status === "released"
                ? `aktuell (Version ${coachQuarterRelease.release_version})`
                : coachQuarterRelease
                  ? "veraltet – erneute Freigabe erforderlich"
                  : "fehlt – Coach muss das Quartal freigeben"}
              {sevdeskSendStatus === "created" &&
                coachQuarterRelease?.release_status !== "released"
                ? " · Der bestehende sevDesk-Draft bleibt unverändert; bitte manuell prüfen."
                : ""}
            </div>
            )}
            {sevdeskStatusDetails && (
            <div style={{ marginTop: 6, color: "#555" }}>
              Gelesener sevDesk-Status: {sevdeskStatusDetails.invoiceStatus || "unbekannt"}.
              {` sevDesk meldet Status-100-Draft: ${sevdeskStatusDetails.isDraft ? "ja" : "nein"}.`}
              {sevdeskStatusDetails.invoiceNumber
                ? ` Rechnungsnummer: ${sevdeskStatusDetails.invoiceNumber}.`
                : ""}
              {sevdeskStatusDetails.sendDate
                ? ` Datum laut sevDesk: ${sevdeskStatusDetails.sendDate}.`
                : ""}
              {" "}Statusabfrage ist lesend; Poise-Draft und sevDesk-Rechnung wurden nicht verändert.
            </div>
            )}
            {hasCalculationDifference && (
              <div style={{ color: "#a12622", marginTop: 6 }}>
                Die aktuellen Sitzungsdaten weichen vom gespeicherten Rechnungsentwurf ab.
                {storedSessionCount !== null && currentSessionCount !== null
                  ? ` Gespeichert: ${storedSessionCount}, aktuell: ${currentSessionCount}.`
                  : ""}
                {currentCalculation?.totals
                  ? ` Aktuell berechnet: ${Number(currentCalculation.totals.net || 0).toFixed(2)} EUR netto.`
                  : ""}
              </div>
            )}
            {calculationErrors.length > 0 && (
              <div style={{ color: "#a12622", marginTop: 6 }}>
                <strong>Abrechnung blockiert:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                  {calculationErrors.map((item, index) => (
                    <li key={`${item.session_id || "unknown"}-${index}`}>
                      {item.code === "invalid_session_price"
                        ? `Sitzung ${item.session_id}: Preis fehlt, ist ungültig oder nicht positiv.`
                        : item.code === "session_id_missing"
                          ? `Sitzung vom ${item.session_date || "unbekannten Datum"} hat keine eindeutige ID.`
                          : item.code === "coach_vat_rate_missing"
                            ? `Sitzung ${item.session_id}: Coach-USt-Satz fehlt.`
                            : `Sitzung ${item.session_id || "unbekannt"}: ${item.code}.`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div style={{ width: 120, textAlign: "right" }}>
            {poiseSettings.logo_url ? (
              <img
                src={poiseSettings.logo_url}
                alt="Logo"
                style={{ maxWidth: 90, maxHeight: 60, objectFit: "contain" }}
              />
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 30,
          }}
        >
          <div style={{ ...small }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Rechnung an</div>

            <div>
              <input
                style={{ ...inputBase, width: 360 }}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <input
                style={{ ...inputBase, width: 360 }}
                value={clientStreet}
                onChange={(e) => setClientStreet(e.target.value)}
              />
            </div>
            <div>
              <input
                style={{ ...inputBase, width: 360 }}
                value={clientZipCity}
                onChange={(e) => setClientZipCity(e.target.value)}
              />
            </div>
            <div>
              <input
                style={{ ...inputBase, width: 360 }}
                value={clientCountry}
                onChange={(e) => setClientCountry(e.target.value)}
                placeholder="Land (optional)"
              />
            </div>

            <div style={{ marginTop: 8 }}>
              <input
                style={{ ...inputBase, width: 360 }}
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ width: 300 }}>
            <div style={{ textAlign: "right", marginBottom: 8 }}>
              <div style={hTitle}>Rechnung</div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                gap: "6px 10px",
              }}
            >
              <div style={rightMetaLabel}>Rechnungs-Nr.</div>
              <div style={rightMetaValue}>
                <input
                  style={{ ...inputBase, width: 140, textAlign: "right" }}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              <div style={rightMetaLabel}>Rechnungsdatum</div>
              <div style={rightMetaValue}>
                <input
                  style={{ ...inputBase, width: 140, textAlign: "right" }}
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>

              <div style={rightMetaLabel}>Leistungszeitraum</div>
              <div style={rightMetaValue}>
                <input
                  style={{ ...inputBase, width: 140, textAlign: "right" }}
                  value={servicePeriod}
                  onChange={(e) => setServicePeriod(e.target.value)}
                />
              </div>

              <div style={rightMetaLabel}>Kundennummer</div>
              <div style={rightMetaValue}>
                <input
                  style={{ ...inputBase, width: 140, textAlign: "right" }}
                  value={customerNumber}
                  onChange={(e) => setCustomerNumber(e.target.value)}
                  placeholder="optional"
                />
              </div>

              <div style={rightMetaLabel}>Ansprechpartner</div>
              <div style={rightMetaValue}>
                <input
                  style={{ ...inputBase, width: 140, textAlign: "right" }}
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="optional"
                />
              </div>

              <div style={rightMetaLabel}>sevDesk Invoice ID</div>
              <div style={rightMetaValue}>
                <input
                  style={{ ...inputBase, width: 140, textAlign: "right" }}
                  value={sevdeskInvoiceId}
                  readOnly
                  placeholder="Wird bei Entwurfserstellung vergeben"
                />
              </div>

              <div style={rightMetaLabel}>Poise Save ID</div>
              <div style={rightMetaValue}>
                <input
                  style={{
                    ...inputBase,
                    width: 140,
                    textAlign: "right",
                    color: "#777",
                  }}
                  value={savedCoachInvoiceId || ""}
                  readOnly
                  placeholder="wird nach Speichern gesetzt"
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            Rechnung Nr. {invoiceNumber}
          </div>

          <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
            {invoiceWithVat
              ? `Rechnung inkl. ${vatRate}% Umsatzsteuer`
              : "Rechnung ohne Umsatzsteuer / Reverse Charge"}
          </div>
        </div>

        <div style={{ marginTop: 18, ...small }}>
          <div>
            <input
              style={{ ...inputBase, width: "100%" }}
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #eee",
                padding: 10,
                fontSize: 12,
                minHeight: 60,
                resize: "vertical",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <table width="100%" style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <th align="left" style={{ padding: "8px 6px" }}>Pos.</th>
                <th align="left" style={{ padding: "8px 6px" }}>Beschreibung</th>
                <th align="right" style={{ padding: "8px 6px" }}>Menge</th>
                <th align="right" style={{ padding: "8px 6px" }}>Einzelpreis</th>
                <th align="right" style={{ padding: "8px 6px" }}>Gesamtpreis</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, idx) => (
                <tr key={li.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                    {idx + 1}.
                  </td>

                  <td style={{ padding: "10px 6px" }}>
                    <input
                      value={li.description}
                      onChange={(e) =>
                        updateLineItem(idx, { description: e.target.value })
                      }
                      style={{
                        border: "none",
                        borderBottom: "1px solid #eee",
                        width: "100%",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                  </td>

                  <td style={{ padding: "10px 6px" }} align="right">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={li.qty}
                      onChange={(e) =>
                        updateLineItem(idx, {
                          qty: Number(e.target.value || 0),
                        })
                      }
                      style={{ ...inputBase, width: 60, textAlign: "right" }}
                    />
                  </td>

                  <td style={{ padding: "10px 6px" }} align="right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={li.unit}
                      onChange={(e) =>
                        updateLineItem(idx, {
                          unit: Number(e.target.value || 0),
                        })
                      }
                      style={{ ...inputBase, width: 90, textAlign: "right" }}
                    />{" "}
                    EUR
                  </td>

                  <td style={{ padding: "10px 6px" }} align="right">
                    {li.total.toFixed(2)} EUR
                  </td>
                </tr>
              ))}

              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "10px 6px",
                    textAlign: "right",
                    fontWeight: 600,
                    background: "#fafafa",
                  }}
                >
                  Gesamtbetrag netto
                </td>
                <td
                  style={{
                    padding: "10px 6px",
                    textAlign: "right",
                    background: "#fafafa",
                  }}
                >
                  {totals.net.toFixed(2)} EUR
                </td>
              </tr>

              {invoiceWithVat ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "10px 6px",
                      textAlign: "right",
                      fontWeight: 600,
                      background: "#fafafa",
                    }}
                  >
                    zzgl. Umsatzsteuer {vatRate}%
                  </td>
                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "right",
                      background: "#fafafa",
                    }}
                  >
                    {totals.vat.toFixed(2)} EUR
                  </td>
                </tr>
              ) : null}

              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "10px 6px",
                    textAlign: "right",
                    fontWeight: 700,
                    background: "#f0f0f0",
                  }}
                >
                  Gesamtbetrag brutto
                </td>
                <td
                  style={{
                    padding: "10px 6px",
                    textAlign: "right",
                    fontWeight: 700,
                    background: "#f0f0f0",
                  }}
                >
                  {totals.gross.toFixed(2)} EUR
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 18, ...small }}>
          <textarea
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #eee",
              padding: 10,
              fontSize: 12,
              minHeight: 54,
              resize: "vertical",
            }}
          />

          <textarea
            value={closingText}
            onChange={(e) => setClosingText(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #eee",
              padding: 10,
              fontSize: 12,
              minHeight: 90,
              marginTop: 10,
              resize: "vertical",
              whiteSpace: "pre-line",
            }}
          />
        </div>

        <div
          style={{
            marginTop: 24,
            borderTop: "1px solid #eee",
            paddingTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
            ...small,
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>{poiseSettings.company_name}</div>
            <div style={{ whiteSpace: "pre-line" }}>{poiseSettings.address}</div>
          </div>

          <div>
            <div style={{ fontWeight: 700 }}>Rechtliches</div>
            <div style={muted}>UID:</div> {poiseSettings.vat_number || "—"}
            <br />
            <div style={muted}>Steuernr:</div> {poiseSettings.tax_number || "—"}
          </div>

          <div>
            <div style={{ fontWeight: 700 }}>Bank</div>
            <div>IBAN: {poiseSettings.iban || "—"}</div>
            <div>BIC: {poiseSettings.bic || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildCoachServicePeriod({
  billingMode,
  billingYear,
  billingQuarter,
  billingMonth,
}) {
  if (billingMode === "quartal") {
    return `Q${billingQuarter} ${billingYear}`;
  }
  if (billingMode === "monat") {
    return `${billingMonth}/${billingYear}`;
  }
  if (billingMode === "jahr") {
    return `${billingYear}`;
  }
  return new Date().toLocaleDateString("de-AT");
}

function buildCoachPdf({
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
  invoiceWithVat,
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
  doc.text(String(invoiceNumber || ""), pageWidth - marginX, metaY, {
    align: "right",
  });

  doc.text("Rechnungsdatum:", pageWidth - marginX - 70, metaY + 6);
  doc.text(String(invoiceDate || ""), pageWidth - marginX, metaY + 6, {
    align: "right",
  });

  doc.text("Leistungszeitraum:", pageWidth - marginX - 70, metaY + 12);
  doc.text(String(servicePeriod || ""), pageWidth - marginX, metaY + 12, {
    align: "right",
  });

  if (customerNumber) {
    doc.text("Kundennummer:", pageWidth - marginX - 70, metaY + 18);
    doc.text(String(customerNumber), pageWidth - marginX, metaY + 18, {
      align: "right",
    });
  }

  if (contactPerson) {
    doc.text("Ansprechpartner:", pageWidth - marginX - 70, metaY + 24);
    doc.text(String(contactPerson), pageWidth - marginX, metaY + 24, {
      align: "right",
    });
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

  const introLines = doc.splitTextToSize(
    String(introText || ""),
    pageWidth - 2 * marginX
  );
  doc.text(introLines, marginX, ry);
  ry += introLines.length * 5 + 4;

  const body = (lineItems || []).map((li, idx) => [
    `${idx + 1}.`,
    String(li.description || ""),
    String(li.qty ?? 1),
    `${Number(li.unit || 0).toFixed(2)} EUR`,
    `${Number(li.total || 0).toFixed(2)} EUR`,
  ]);

  doc.autoTable({
    startY: ry,
    head: [["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamtpreis"]],
    body,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 20,
      lineWidth: 0.1,
      lineColor: 200,
    },
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
  doc.text(`${totals.net.toFixed(2)} EUR`, pageWidth - marginX, fy, {
    align: "right",
  });

  fy += 6;

  if (invoiceWithVat) {
    doc.setFont("helvetica", "bold");
    doc.text(`zzgl. Umsatzsteuer ${vatRate}%`, pageWidth - marginX - 70, fy);
    doc.setFont("helvetica", "normal");
    doc.text(`${totals.vat.toFixed(2)} EUR`, pageWidth - marginX, fy, {
      align: "right",
    });
    fy += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Gesamtbetrag brutto", pageWidth - marginX - 70, fy);
  doc.text(`${totals.gross.toFixed(2)} EUR`, pageWidth - marginX, fy, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");

  fy += 10;

  if (!invoiceWithVat) {
    doc.setFontSize(9);
    doc.text(
      "Reverse Charge – Steuerschuld geht auf den Leistungsempfänger über.",
      marginX,
      fy
    );
    fy += 8;
    doc.setFontSize(10);
  }

  const payLines = doc.splitTextToSize(
    String(paymentTerms || ""),
    pageWidth - 2 * marginX
  );
  doc.text(payLines, marginX, fy);
  fy += payLines.length * 5 + 4;

  const closeLines = doc.splitTextToSize(
    String(closingText || ""),
    pageWidth - 2 * marginX
  );
  doc.text(closeLines, marginX, fy);

  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    const pageWidthInner = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const footerMarginX = 20;
    const footerTopY = pageHeight - 40;
    const lineGap = 4.5;

    const usableWidth = pageWidthInner - footerMarginX * 2;
    const colWidth = usableWidth / 3;

    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(
      footerMarginX,
      footerTopY - 8,
      pageWidthInner - footerMarginX,
      footerTopY - 8
    );

    doc.setFontSize(9);

    let x1 = footerMarginX;
    let y1 = footerTopY;

    doc.setFont("helvetica", "bold");
    doc.text(settings.company_name || "", x1, y1);

    doc.setFont("helvetica", "normal");
    y1 += lineGap;

    const addressLines = (settings.address || "").split("\n");
    addressLines.forEach((line) => {
      doc.text(line, x1, y1);
      y1 += lineGap;
    });

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
