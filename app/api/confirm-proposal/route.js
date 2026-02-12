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
    // Proposal holen
    // ------------------------------------------------
    const { data: proposal, error: pError } = await supabase
      .from("appointment_proposals")   // ✅ richtige Tabelle
      .select("*")
      .eq("id", proposalId)
      .single();

    if (pError || !proposal) {
      return json({ error: "proposal_not_found" }, 404);
    }

    const start = new Date(proposal.date);
    const end = new Date(start.getTime() + 60 * 60000);

    // ------------------------------------------------
    // Anfrage updaten → wandert ins Erstgespräch
    // ------------------------------------------------
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: proposal.date,
        assigned_therapist_id: proposal.therapist_id,
        status: "erstgespraech",   // 🔥 dein gewünschter Zielstatus
      })
      .eq("id", requestId);

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }

    // ------------------------------------------------
    // Slot blockieren
    // ------------------------------------------------
    const { error: blockError } = await supabase
      .from("blocked_slots")
      .insert({
        anfrage_id: requestId,
        therapist_id: proposal.therapist_id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        reason: "proposal_confirmed",
      });

    if (blockError) {
      return json({ error: blockError.message }, 500);
    }

    // ------------------------------------------------
    // Alle Vorschläge löschen
    // ------------------------------------------------
    await supabase
      .from("appointment_proposals")
      .delete()
      .eq("anfrage_id", requestId);

    return json({ ok: true });
  } catch (e) {
    console.error("CONFIRM ERROR:", e);
    return json({ error: "server_error" }, 500);
  }
}
