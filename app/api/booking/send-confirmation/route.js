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
    const { anfrageId, sessionId } = await req.json();

    if (!anfrageId || !sessionId) {
      return json({ error: "missing_data" }, 400);
    }

    // Anfrage laden
    const { data: anfrage, error: anfrageError } = await supabase
      .from("anfragen")
      .select(`
        id,
        vorname,
        nachname,
        email,
        telefon,
        assigned_therapist_id
      `)
      .eq("id", anfrageId)
      .single();

    if (anfrageError || !anfrage) {
      console.error("anfrage_not_found", anfrageError);
      return json({ error: "anfrage_not_found" }, 404);
    }

    // Session laden
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        id,
        date,
        duration_min,
        therapist_id
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.error("session_not_found", sessionError);
      return json({ error: "session_not_found" }, 404);
    }

    // Therapeut laden
    const { data: therapist, error: therapistError } = await supabase
      .from("team_members")
      .select("id, name, email")
      .eq("id", anfrage.assigned_therapist_id)
      .single();

    if (therapistError || !therapist) {
      console.error("therapist_not_found", therapistError);
      return json({ error: "therapist_not_found" }, 404);
    }

    const start = new Date(session.date);
    if (Number.isNaN(start.getTime())) {
      return json({ error: "invalid_session_date" }, 400);
    }

    const dateString = start.toLocaleDateString("de-AT", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Vienna",
    });

    const timeString = start.toLocaleTimeString("de-AT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Vienna",
    });

    // ------------------------------------------------
    // HIER DEIN BESTEHENDES MAIL-SYSTEM AUFRUFEN
    // ------------------------------------------------
    // Beispiel:
    // await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-mail`, { ... })

    console.log("MAIL CLIENT:", {
      to: anfrage.email,
      subject: "Dein Poise Termin wurde bestätigt",
      text: `
Hallo ${anfrage.vorname || ""},

dein Termin wurde erfolgreich gebucht.

Datum: ${dateString}
Uhrzeit: ${timeString}

Liebe Grüße
Poise
      `,
    });

    console.log("MAIL THERAPIST:", {
      to: therapist.email,
      subject: "Neue Poise Buchung",
      text: `
Hallo ${therapist.name || ""},

ein neuer Termin wurde gebucht.

Klient: ${anfrage.vorname || ""} ${anfrage.nachname || ""}
E-Mail: ${anfrage.email || ""}
Telefon: ${anfrage.telefon || ""}
Datum: ${dateString}
Uhrzeit: ${timeString}
      `,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("SEND CONFIRMATION ERROR:", e);
    return json({ error: "server_error" }, 500);
  }
}
