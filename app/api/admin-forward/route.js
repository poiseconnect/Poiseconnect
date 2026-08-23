export const dynamic = "force-dynamic";

import {
  getUserFromBearer,
  json,
  supabaseAdmin,
} from "../_lib/server";
import { getInvalidNewClientCoachIds } from "../../lib/intakeAvailability";

export async function POST(request) {
  try {
    const { user, error: authError } = await getUserFromBearer(request);
    if (!user) {
      return json({ error: authError || "NO_TOKEN" }, 401);
    }

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true || member.role !== "admin") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { requestId, excludedTherapist } = body || {};

    if (!requestId) {
      return json({ error: "MISSING_REQUEST_ID" }, 400);
    }

    const rawSelected = Array.isArray(body?.admin_therapeuten)
      ? body.admin_therapeuten
      : Array.isArray(body?.therapists)
        ? body.therapists
        : [];

    const normalizedSelected = [...new Set(
      rawSelected
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )].slice(0, 3);

    if (normalizedSelected.length === 0) {
      return json({ error: "NO_COACHES_SELECTED" }, 400);
    }

    const { data: validMembers, error: validMembersErr } = await sb
      .from("team_members")
      .select("id, profile_name, active, available_for_intake");

    if (validMembersErr) {
      return json({ error: "TEAM_LOAD_FAILED" }, 500);
    }

    const { data: requestData, error: requestErr } = await sb
      .from("anfragen")
      .select("id, email, vorname, excluded_therapeuten")
      .eq("id", requestId)
      .single();

    if (requestErr || !requestData) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    const invalidCoachIds = getInvalidNewClientCoachIds({
      selectedIds: normalizedSelected,
      members: validMembers || [],
      excludedTherapeuten: requestData.excluded_therapeuten,
    });

    if (invalidCoachIds.length > 0) {
      return json({ error: "INVALID_COACHES" }, 400);
    }

    const approvedCoachIds = normalizedSelected;

    if (!requestData.email) {
      return json({ error: "CLIENT_EMAIL_MISSING" }, 400);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

    const link = `${baseUrl}?resume=8&rid=${requestId}`;

    const { error: updateError } = await sb
      .from("anfragen")
      .update({
        status: "admin_weiterleiten",
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        assigned_therapist_id: null,
        admin_therapeuten: approvedCoachIds,
        excluded_therapeuten: excludedTherapist
          ? [excludedTherapist]
          : [],
      })
      .eq("id", requestId);

    if (updateError) {
      return json({ error: "UPDATE_FAILED", detail: updateError.message }, 500);
    }

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: requestData.email,
        subject: "Bitte wähle eine neue Begleitung 🤍",
        html: `
          <p>Hallo ${requestData.vorname || ""},</p>

          <p>
            deine ursprünglich ausgewählte Begleitung hat aktuell leider keine Kapazitäten.
          </p>

          <p>
            Deshalb kannst du jetzt eine neue passende Begleitung aus unserem Team auswählen.
          </p>

          <p>
            <a href="${link}" style="color:#6f4f49; font-weight:bold;">
              👉 Neue Begleitung auswählen
            </a>
          </p>

          <p>
            Danach kannst du deinen Prozess direkt fortsetzen.
          </p>

          <p>
            Wenn du Fragen hast, melde dich jederzeit gerne bei uns unter
            <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
          </p>

          <p>
            Herzliche Grüße<br />
            dein Poise-Team 🤍
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      const mailText = await mailRes.text();
      console.warn("FORWARD MAIL FAILED – DB UPDATE OK:", mailText);
      return json({ error: "FORWARD_MAIL_FAILED" }, 502);
    }

    const { error: sentStatusError } = await sb
      .from("anfragen")
      .update({ status: "admin_vorschlaege_gesendet" })
      .eq("id", requestId);

    if (sentStatusError) {
      return json({ error: "STATUS_UPDATE_FAILED" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
