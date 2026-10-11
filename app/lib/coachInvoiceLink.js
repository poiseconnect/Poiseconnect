export const SEVDESK_LINK_CONFLICT_MESSAGE =
  "Diese sevDesk-Rechnung ist mehrfach oder ungeklärt zugeordnet. Schreiben und Erstellung sind gesperrt; bitte administrativ prüfen.";

export async function getCoachInvoiceLinkState(supabase, invoiceId) {
  const { data, error } = await supabase.rpc("check_coach_invoice_link", {
    p_invoice_id: invoiceId,
  });
  if (error || !["unlinked", "unique", "ambiguous", "quarantined", "missing"].includes(data)) {
    throw new Error("invoice_link_check_unavailable");
  }
  return data;
}

export function isCoachInvoiceLinkBlocked(state) {
  return ["ambiguous", "quarantined", "missing"].includes(state);
}
