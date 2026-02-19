export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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
    if (!supabase) return JSONResponse({ error: "SUPABASE_NOT_CONFIGURED" }, 500);

    const resend = new Resend(process.env.RESEND_API_KEY);

    const therapistName = body.wunschtherapeut || body.therapist_from_url || null;
    if (!therapistName) return JSONResponse({ error: "THERAPIST_MISSING" }, 400);

    const assignedTherapistId = body.assigned_therapist_id || null;
    if (!assignedTherapistId) {
      return JSONResponse({ error: "ASSIGNED_THERAPIST_ID_MISSING" }, 400);
    }

    const terminISO = body.terminISO || null;
    const startAt = terminISO ? new Date(terminISO) : null;
    const endAt = startAt ? new Date(startAt.getTime() + 60 * 60000) : null;

    // Anliegen zusammenbauen wie früher (Checkbox + Freitext)
    let anliegenText = "";
    if (Array.isArray(body.themen) && body.themen.length) {
      anliegenText += "Ausgewählte Themen:\n";
      body.themen.forEach((t) => (anliegenText += `• ${t}\n`));
    }
    if (body.anliegen?.trim()) {
      anliegenText += (anliegenText ? "\n\n" : "") + "Freitext:\n" + body.anliegen.trim();
    }

    const payload = {
      // Basis
      vorname: body.vorname || null,
      nachname: body.nachname || null,
      email: body.email || null,
      telefon: body.telefon || null,

      // (wieder drin, weil Dashboard/DB oft drauf angewiesen)
      strasse_hausnr: body.strasse_hausnr || null,
      plz_ort: body.plz_ort || null,
      geburtsdatum: body.geburtsdatum || null,
      beschaeftigungsgrad: body.beschaeftigungsgrad || null,

      leidensdruck: body.leidensdruck || null,
      verlauf: body.verlauf || null,
      ziel: body.ziel || null,
      diagnose: body.diagnose || null,

      anliegen: anliegenText || null,

      // Termin
      bevorzugte_zeit: terminISO,
      terminwunsch_text: body.terminwunsch_text || null,

      // Zuweisung
      wunschtherapeut: therapistName,
      assigned_therapist_id: assignedTherapistId,

      // Checks + Status/Defaults (wichtig!)
      check_datenschutz: Boolean(body.check_datenschutz),
      check_online_setting: Boolean(body.check_online_setting),
      check_suizid: Boolean(body.check_suizid), // falls du so ein Feld hast
      status: "neu",
      match_state: body.match_state || "pending",
    };

    let finalRequestId = requestId;

    if (requestId) {
      const { error: updateError } = await supabase
        .from("anfragen")
        .update({ ...payload, admin_therapeuten: [] })
        .eq("id", requestId);

      if (updateError) {
        console.error("UPDATE ERROR:", updateError);
        return JSONResponse({ error: updateError.message }, 500);
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("anfragen")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        console.error("INSERT ERROR:", insertError);
        return JSONResponse({ error: insertError.message }, 500);
      }

      finalRequestId = inserted.id;
    }

    if (startAt && endAt) {
      const { error: blockError } = await supabase.from("blocked_slots").insert({
        anfrage_id: finalRequestId,
        therapist_id: assignedTherapistId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        reason: "client_submit",
      });
      if (blockError) console.warn("blocked_slots insert failed:", blockError);
    }

    // Mail (optional – aber darf DB nicht killen)
    try {
      const terminText = terminISO
        ? new Date(terminISO).toLocaleString("de-AT")
        : "noch offen";

      if (body.email) {
        await resend.emails.send({
          from: "Poise <noreply@mypoise.de>",
          to: body.email,
          subject: "Deine Anfrage bei Poise 🤍",
          html: `<p>Hallo ${body.vorname || ""},</p><p>Therapeut: ${therapistName}</p><p>Termin: ${terminText}</p>`,
        });
      }
    } catch (mailErr) {
      console.warn("MAIL FAILED (but DB ok):", mailErr);
    }

    return JSONResponse({ ok: true, id: finalRequestId });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return JSONResponse({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
