import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
    const { proposed_at } = await req.json();

    const { data: proposal } = await supabase
      .from("appointment_proposals")
      .select("*")
      .eq("proposed_at", proposed_at)
      .single();

    if (!proposal) return json({ error: "NOT_FOUND" }, 404);

    // Session erzeugen
    await supabase.from("sessions").insert({
      anfrage_id: proposal.request_id,
      therapist_id: proposal.therapist_id,
      date: proposal.proposed_at,
      duration_min: 60,
    });

    // Status ändern
    await supabase
      .from("anfragen")
      .update({ status: "termin_bestaetigt" })
      .eq("id", proposal.request_id);

    // Proposal schließen
    await supabase
      .from("appointment_proposals")
      .update({ status: "accepted" })
      .eq("id", proposal.id);

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
