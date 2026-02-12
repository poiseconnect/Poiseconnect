export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const { requestId, proposalId } = await req.json();

    if (!requestId || !proposalId) {
      return json({ error: "missing_data" }, 400);
    }

    // ------------------------------------------------
    // Proposal holen (NEUE Tabelle!)
    // ------------------------------------------------
    const { data: proposal, error: pError } = await supabase
      .from("appointment_proposals")
      .select("id, anfrage_id, therapist_id, date")
      .eq("id", proposalId)
      .single();

    if (pError || !proposal) {
      console.error("proposal_not_found", pError);
      return json({ error: "proposal_not_found" }, 404);
    }

    // Sicherheitscheck: Proposal gehört wirklich zu dieser Anfrage
    if (String(proposal.anfrage_id) !== String(requestId)) {
      return json({ error: "proposal_request_mismatch" }, 400);
    }

    const start = new Date(proposal.date);
    if (Number.isNaN(start.getTime())) {
      return json({ error: "invalid_proposal_date" }, 400);
    }

    const end = new Date(start.getTime() + 60 * 60000);

    // ------------------------------------------------
    // Anfrage updaten (Erstgespräch Tab)
    // ------------------------------------------------
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: proposal.date,
        assigned_therapist_id: proposal.therapist_id,
        status: "termin_bestaetigt",
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("updateError", updateError);
      return json({ error: updateError.message }, 500);
    }

    // ------------------------------------------------
    // Slot blockieren
    // ------------------------------------------------
    const { error: blockError } = await supabase.from("blocked_slots").insert({
      anfrage_id: requestId,
      therapist_id: proposal.therapist_id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      reason: "proposal_confirmed",
    });

    if (blockError) {
      console.error("blockError", blockError);
      return json({ error: blockError.message }, 500);
    }

    // ------------------------------------------------
    // Andere Vorschläge löschen (weil KEIN status Feld)
    // ------------------------------------------------
    const { error: delError } = await supabase
      .from("appointment_proposals")
      .delete()
      .eq("anfrage_id", requestId)
      .neq("id", proposalId);

    if (delError) {
      console.error("delError", delError);
      // nicht hart failen – Termin ist ja schon gespeichert
    }

    return json({ ok: true });
  } catch (e) {
    console.error("CONFIRM ERROR:", e);
    return json({ error: "server_error" }, 500);
  }
}
