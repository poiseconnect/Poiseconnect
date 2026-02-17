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

  if (!url || !key) {
    console.error("ENV fehlt");
    return null;
  }

  return createClient(url, key);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const requestId = body.rid || body.anfrageId || null;

    const supabase = getSupabase();
    const resend = new Resend(process.env.RESEND_API_KEY);

    if (!supabase) {
      return JSONResponse({ error: "SUPABASE_NOT_CONFIGURED" }, 500);
    }

    const therapistName =
      body.wunschtherapeut ||
      body.therapist_from_url ||
      null;

    if (!therapistName) {
      return JSONResponse({ error: "THERAPIST_MISSING" }, 400);
    }

    const assignedTherapistId = body.assigned_therapist_id;

    if (!assignedTherapistId) {
      return JSONResponse(
        { error: "ASSIGNED_THERAPIST_ID_MISSING" },
        400
      );
    }

    const terminISO = body.terminISO || null;
    const startAt = terminISO ? new Date(terminISO) : null;
    const endAt =
      startAt ? new Date(startAt.getTime() + 60 * 60000) : null;

    let anliegenText = "";

    if (Array.isArray(body.themen)) {
      body.themen.forEach((t) => {
        anliegenText += `• ${t}\n`;
      });
    }

    if (body.anliegen?.trim()) {
      anliegenText += "\n" + body.anliegen.trim();
    }

    const payload = {
      vorname: body.vorname || null,
      nachname: body.nachname || null,
      email: body.email || null,
      telefon: body.telefon || null,
      anliegen: anliegenText || null,
      wunschtherapeut: therapistName,
      assigned_therapist_id: assignedTherapistId,
      bevorzugte_zeit: terminISO,
      status: "neu",
    };

    let finalRequestId;

    if (requestId) {
      const { error: updateError } = await supabase
        .from("anfragen")
        .update({
          ...payload,
          admin_therapeuten: [],
        })
        .eq("id", requestId);

      if (updateError) {
        return JSONResponse(
          { error: updateError.message },
          500
        );
      }

      finalRequestId = requestId;
    } else {
      const {
        data: inserted,
        error: insertError,
      } = await supabase
        .from("anfragen")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        return JSONResponse(
          { error: insertError.message },
          500
        );
      }

      finalRequestId = inserted.id;
    }

    if (startAt && endAt) {
      await supabase.from("blocked_slots").insert({
        anfrage_id: finalRequestId,
        therapist_id: assignedTherapistId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        reason: "client_submit",
      });
    }

    const terminText = terminISO
      ? new Date(terminISO).toLocaleString("de-AT")
      : "noch offen";

    if (body.email) {
      await resend.emails.send({
        from: "Poise <noreply@mypoise.de>",
        to: body.email,
        subject: "Deine Anfrage bei Poise 🤍",
        html: `
          <p>Hallo ${body.vorname || ""},</p>
          <p>Therapeut: ${therapistName}</p>
          <p>Termin: ${terminText}</p>
        `,
      });
    }

    return JSONResponse({ ok: true });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return JSONResponse(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
