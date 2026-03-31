export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { teamData } from "@/app/lib/teamData";

function JSONResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const requestId = body.rid || body.anfrageId || null;

    const supabase = getSupabase();
    if (!supabase) {
      return JSONResponse({ error: "SUPABASE_NOT_CONFIGURED" }, 500);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const therapistName =
      body.wunschtherapeut || body.therapist_from_url || null;

    if (!therapistName) {
      return JSONResponse({ error: "THERAPIST_MISSING" }, 400);
    }

    const assignedTherapistId = body.assigned_therapist_id || null;
    if (!assignedTherapistId) {
      return JSONResponse(
        { error: "ASSIGNED_THERAPIST_ID_MISSING" },
        400
      );
    }

    const selectedTherapist =
      teamData.find(
        (t) => String(t.id) === String(assignedTherapistId)
      ) ||
      teamData.find(
        (t) =>
          String(t.name).trim() === String(therapistName).trim()
      ) ||
      null;

    const calendarMode = String(
      selectedTherapist?.calendar_mode || "proposal"
    ).toLowerCase();

    const finalTherapistName =
      selectedTherapist?.name || therapistName || "dein Coach";

    const safeVorname = String(body.vorname || "").trim() || "du";

    const terminISO = body.terminISO || null;
    const startAt = terminISO ? new Date(terminISO) : null;
    const endAt = startAt
      ? new Date(startAt.getTime() + 60 * 60000)
      : null;

    // Anliegen zusammenbauen wie früher (Checkbox + Freitext)
    let anliegenText = "";
    if (Array.isArray(body.themen) && body.themen.length) {
      anliegenText += "Ausgewählte Themen:\n";
      body.themen.forEach((t) => {
        anliegenText += `• ${t}\n`;
      });
    }
    if (body.anliegen?.trim()) {
      anliegenText +=
        (anliegenText ? "\n\n" : "") +
        "Freitext:\n" +
        body.anliegen.trim();
    }

    const payload = {
      vorname: body.vorname || null,
      nachname: body.nachname || null,
      email: body.email || null,
      telefon: body.telefon || null,

      strasse_hausnr: body.strasse_hausnr || null,
      plz_ort: body.plz_ort || null,
      geburtsdatum: body.geburtsdatum || null,
      beschaeftigungsgrad: body.beschaeftigungsgrad || null,

      leidensdruck: body.leidensdruck || null,
      verlauf: body.verlauf || null,
      ziel: body.ziel || null,
      diagnose: body.diagnose || null,

      anliegen: anliegenText || null,

      bevorzugte_zeit: terminISO,
      terminwunsch_text: body.terminwunsch_text || null,

      wunschtherapeut: finalTherapistName,
      assigned_therapist_id: assignedTherapistId,

      check_datenschutz: Boolean(body.check_datenschutz),
      check_online_setting: Boolean(body.check_online_setting),
      check_suizid: Boolean(
        body.check_suizid ?? body.check_gesundheit
      ),

      status: "neu",
      match_state: body.match_state || "pending",
    };

    let finalRequestId = requestId;

    if (requestId) {
      const { error: updateError } = await supabase
        .from("anfragen")
        .update({
          ...payload,
          admin_therapeuten: [],
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("UPDATE ERROR:", updateError);
        return JSONResponse({ error: updateError.message }, 500);
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("anfragen")
        .insert({
          ...payload,
          booking_token: crypto.randomUUID(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("INSERT ERROR:", insertError);
        return JSONResponse({ error: insertError.message }, 500);
      }

      finalRequestId = inserted.id;
    }

    // Mail (optional – darf DB nicht killen)
    try {
      const terminText = terminISO
        ? new Date(terminISO).toLocaleString("de-AT")
        : "noch offen";

      const bookingHtml = `
        <p>Hallo ${safeVorname},</p>

        <p>
          vielen Dank für dein Vertrauen – es bedeutet uns viel, dass du dich mit deinem Anliegen an uns wendest.
        </p>

        <p>
          Dein Erstgespräch mit <strong>${finalTherapistName}</strong> wurde erfolgreich angefragt.
        </p>

        <p>
          ${
            terminISO
              ? `Folgender Termin wurde für dich vorgemerkt:<br/><br/>
                 <strong>Coach:</strong> ${finalTherapistName}<br/>
                 <strong>Termin:</strong> ${terminText}`
              : `Dein Termin ist aktuell noch offen und wird intern geprüft.`
          }
        </p>

        <p>
          In diesem ersten Gespräch lernst du deine Begleitung in Ruhe kennen, kannst dein Anliegen besprechen
          und gemeinsam die nächsten Schritte für dich definieren.
          Natürlich ist auch Raum für alle Fragen, die dir wichtig sind.
        </p>

        <p>
          Wir prüfen deine Anfrage nun intern und melden uns in Kürze mit der finalen Bestätigung bei dir.
          <strong>In dieser Bestätigung erhältst du auch den Link für deinen Video-Call.</strong>
        </p>

        <p>
          Solltest du den Termin doch nicht wahrnehmen können, melde dich bitte kurz unter
          <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
        </p>

        <p>
          Wir freuen uns sehr, dich ein Stück auf deinem Weg begleiten zu dürfen 🤍
        </p>

        <p>
          Herzliche Grüße<br/>
          Sebastian<br/>
          Poise
        </p>
      `;

      const proposalHtml = `
        <p>Hallo ${safeVorname},</p>

        <p>
          vielen Dank für dein Vertrauen – es bedeutet uns viel, dass du dich mit deinem Anliegen an uns wendest.
        </p>

        <p>
          Wir haben deine Anfrage erhalten und an <strong>${finalTherapistName}</strong> weitergeleitet.
        </p>

        <p>
          ${finalTherapistName} wird sich mit passenden Terminvorschlägen für ein kostenloses Erstgespräch bei dir melden.
        </p>

        <p>
          Sobald die Vorschläge für dich bereitstehen, erhältst du von uns eine weitere E-Mail
          mit dem Link zur Auswahl deines Wunschtermins.
        </p>

        <p>
          Wenn du in der Zwischenzeit Fragen hast, erreichst du uns jederzeit unter
          <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
        </p>

        <p>
          Wir freuen uns sehr, dich ein Stück auf deinem Weg begleiten zu dürfen 🤍
        </p>

        <p>
          Herzliche Grüße<br/>
          Sebastian<br/>
          Poise
        </p>
      `;

      if (body.email) {
        await resend.emails.send({
          from: "Poise <noreply@mypoise.de>",
          to: body.email,
          subject: "Deine Anfrage bei Poise 🤍",
          html:
            calendarMode === "booking"
              ? bookingHtml
              : proposalHtml,
        });
      }
    } catch (mailErr) {
      console.warn("MAIL FAILED (but DB ok):", mailErr);
    }

    return JSONResponse({ ok: true, id: finalRequestId });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return JSONResponse(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
