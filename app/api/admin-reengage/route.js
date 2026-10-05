export const dynamic = "force-dynamic";

import { getUserFromBearer, json, supabaseAdmin } from "../_lib/server";
import {
  buildReengagementEmail,
  isUuid,
  isValidEmail,
  classifySendOutcome,
  MAX_BATCH_SIZE,
} from "../../lib/reengagement";

// Admin-Aktion "Erneut Kontakt aufnehmen" im Tab "Wartet auf Klient:in".
// Ändert bewusst NICHT anfragen.status oder anfragen.assigned_therapist_id –
// die bestehende Formular-, Matching- und Statuslogik bleibt unberührt.
// Mehr Laufzeit-Spielraum für den sequentiellen Versand mehrerer Mails.
export const maxDuration = 60;

const REQUIRED_STATUS = "admin_vorschlaege_gesendet";

// Markiert eine bereits erteilte Reservierung als abgeschlossen (terminal),
// wenn vor dem eigentlichen Mailaufruf noch kein Versand ausgelöst wurde
// (z. B. weil die Anfrage inzwischen nicht mehr passt). Verhindert, dass der
// Vorgang fälschlich als "läuft noch" (status='queued') stehen bleibt.
// Gibt zurück, ob das Abschließen selbst gespeichert werden konnte.
async function finalizeWithoutSending(sb, logId, errorCode) {
  const { error } = await sb
    .from("anfragen_reengagement_log")
    .update({ status: "failed", error_code: errorCode, finished_at: new Date().toISOString() })
    .eq("id", logId);
  return { finalizeFailed: Boolean(error) };
}

// Liest den aktuellen Stand eines bereits vorhandenen Log-Eintrags, damit die
// Ablehnung einer Reservierung (sent/queued/unknown) im Ergebnis
// unterschieden werden kann, statt pauschal "ALREADY_HANDLED" zu melden.
// Bei einem Lesefehler wird ehrlich "nicht feststellbar" zurückgegeben statt
// eine Annahme über den gespeicherten Zustand zu treffen.
async function lookupExistingLogStatus(sb, batchId, anfrageId) {
  const { data, error } = await sb
    .from("anfragen_reengagement_log")
    .select("status")
    .eq("batch_id", batchId)
    .eq("anfrage_id", anfrageId)
    .maybeSingle();

  if (error || !data) {
    return { priorStatus: null, priorStatusKnown: false };
  }
  return { priorStatus: data.status, priorStatusKnown: true };
}

export async function POST(request) {
  try {
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
      return json({ error: "NO_TOKEN" }, 401);
    }

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

    const { batchId, requestIds } = body || {};

    if (!isUuid(batchId)) {
      return json({ error: "INVALID_BATCH_ID" }, 400);
    }

    const normalizedIds = [
      ...new Set(Array.isArray(requestIds) ? requestIds.filter(isUuid) : []),
    ];

    if (normalizedIds.length === 0) {
      return json({ error: "NO_REQUESTS_SELECTED" }, 400);
    }

    if (normalizedIds.length > MAX_BATCH_SIZE) {
      return json({ error: "TOO_MANY_REQUESTS", limit: MAX_BATCH_SIZE }, 400);
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const results = [];

    for (const anfrageId of normalizedIds) {
      // 1) Atomare Reservierung ZUERST. Das FK-Constraint auf
      // anfragen_reengagement_log.anfrage_id prüft dabei zugleich, dass die
      // Anfrage existiert (Postgres-Fehlercode 23503 bei Nichtexistenz).
      // Dies ist zugleich der zentrale Schutz gegen Doppelversand bei
      // Doppelklick, parallelen Requests oder Wiederholung desselben Vorgangs.
      const { data: reservation, error: reserveErr } = await sb.rpc(
        "reserve_reengagement_attempt",
        {
          p_batch_id: batchId,
          p_anfrage_id: anfrageId,
          p_created_by: member.id,
        }
      );

      if (reserveErr) {
        const notFound = reserveErr.code === "23503";
        results.push({
          id: anfrageId,
          result: notFound ? "skipped" : "failed",
          reason: notFound ? "NOT_FOUND" : "RESERVATION_FAILED",
        });
        continue;
      }

      if (!reservation || !reservation.id) {
        // Im selben Vorgang bereits reserviert/in Bearbeitung/gesendet/
        // unbekannt. sent/queued/unknown werden NICHT pauschal gleich
        // behandelt, sondern als priorStatus mitgegeben, soweit feststellbar.
        const { priorStatus, priorStatusKnown } = await lookupExistingLogStatus(
          sb,
          batchId,
          anfrageId
        );
        results.push({
          id: anfrageId,
          result: "skipped",
          reason: "ALREADY_HANDLED",
          priorStatus,
          priorStatusKnown,
        });
        continue;
      }

      // 2) Unmittelbar vor dem eigentlichen Mailaufruf: frische Einzelprüfung
      // (nicht die einmalige Bulk-Prüfung vom Request-Beginn). Dies hält das
      // Zeitfenster zwischen letzter Prüfung und externem Versand so klein
      // wie möglich. Ein Restrisiko bleibt dennoch bestehen: zwischen diesem
      // Lesevorgang und der tatsächlichen Antwort von Resend kann sich die
      // Anfrage theoretisch noch ändern (siehe Dokumentation).
      const { data: freshRow, error: freshErr } = await sb
        .from("anfragen")
        .select("id, email, vorname, status, assigned_therapist_id")
        .eq("id", anfrageId)
        .maybeSingle();

      if (freshErr) {
        // Kein Versand auf Basis veralteter Daten bei Lesefehler.
        const { finalizeFailed } = await finalizeWithoutSending(sb, reservation.id, "REFRESH_READ_FAILED");
        results.push({
          id: anfrageId,
          result: "failed",
          reason: "REFRESH_READ_FAILED",
          ...(finalizeFailed ? { warning: "RESERVATION_FINALIZE_FAILED" } : {}),
        });
        continue;
      }

      if (!freshRow) {
        const { finalizeFailed } = await finalizeWithoutSending(sb, reservation.id, "NOT_FOUND_ON_REFRESH");
        results.push({
          id: anfrageId,
          result: "skipped",
          reason: "NOT_FOUND",
          ...(finalizeFailed ? { warning: "RESERVATION_FINALIZE_FAILED" } : {}),
        });
        continue;
      }

      if (freshRow.status !== REQUIRED_STATUS) {
        const { finalizeFailed } = await finalizeWithoutSending(sb, reservation.id, "STATUS_CHANGED");
        results.push({
          id: anfrageId,
          result: "skipped",
          reason: "STATUS_CHANGED",
          ...(finalizeFailed ? { warning: "RESERVATION_FINALIZE_FAILED" } : {}),
        });
        continue;
      }

      if (freshRow.assigned_therapist_id) {
        // Zwischenzeitlich einem Coach zugeordnet (unabhängig vom Statuswert):
        // kein Versand mehr, da die ursprüngliche Voraussetzung entfallen ist.
        const { finalizeFailed } = await finalizeWithoutSending(sb, reservation.id, "COACH_ALREADY_ASSIGNED");
        results.push({
          id: anfrageId,
          result: "skipped",
          reason: "COACH_ALREADY_ASSIGNED",
          ...(finalizeFailed ? { warning: "RESERVATION_FINALIZE_FAILED" } : {}),
        });
        continue;
      }

      if (!isValidEmail(freshRow.email)) {
        const { finalizeFailed } = await finalizeWithoutSending(sb, reservation.id, "INVALID_EMAIL");
        results.push({
          id: anfrageId,
          result: "failed",
          reason: "INVALID_EMAIL",
          ...(finalizeFailed ? { warning: "RESERVATION_FINALIZE_FAILED" } : {}),
        });
        continue;
      }

      if (!resendApiKey) {
        const { finalizeFailed } = await finalizeWithoutSending(sb, reservation.id, "NO_API_KEY");
        results.push({
          id: anfrageId,
          result: "failed",
          reason: "MAIL_NOT_CONFIGURED",
          ...(finalizeFailed ? { warning: "RESERVATION_FINALIZE_FAILED" } : {}),
        });
        continue;
      }

      const mail = buildReengagementEmail({ vorname: freshRow.vorname });

      let outcome;
      let httpStatus = null;
      let providerMessageId = null;

      try {
        const mailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
            // Zweite, von der DB-Reservierung unabhängige Schutzschicht beim
            // Provider selbst gegen versehentliche Mehrfachauslösung
            // desselben Versandvorgangs.
            "Idempotency-Key": `reengage:${batchId}:${anfrageId}`,
          },
          body: JSON.stringify({
            from: "Poise <noreply@mypoise.de>",
            to: freshRow.email,
            reply_to: "hallo@mypoise.de",
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          }),
        });

        httpStatus = mailRes.status;
        outcome = classifySendOutcome({ ok: mailRes.ok, status: mailRes.status });

        if (outcome === "sent") {
          const payload = await mailRes.json().catch(() => null);
          providerMessageId = payload?.id || null;
        }
      } catch {
        outcome = classifySendOutcome({ threwException: true });
      }

      const finishedAt = new Date().toISOString();

      if (outcome === "sent") {
        // Fall A: Provider hat angenommen. Ein fehlgeschlagenes Speichern des
        // Log-Abschlusses darf KEINEN erneuten Mailaufruf auslösen - die
        // Reservierung (Status "queued") bleibt als Schutz bestehen und
        // blockiert damit bewusst jeden weiteren Versandversuch in diesem
        // Vorgang, selbst wenn das als "stecken bleiben" erscheint. Das ist
        // sicherer als ein ungeschützter zweiter Versand.
        const { error: logErr } = await sb
          .from("anfragen_reengagement_log")
          .update({
            status: "sent",
            provider_message_id: providerMessageId,
            finished_at: finishedAt,
          })
          .eq("id", reservation.id);

        if (logErr) {
          results.push({ id: anfrageId, result: "sent", warning: "LOG_UPDATE_FAILED" });
          continue;
        }

        // Fall B: Log-Abschluss ist gespeichert (Provider-Annahme damit
        // bereits gesichert); nur der Anzeige-Timestamp kann fehlschlagen.
        // Das ist ein reines Anzeigeproblem, kein Versand-Sicherheitsproblem,
        // und löst daher ausdrücklich keinen erneuten Versand aus.
        const { error: tsErr } = await sb
          .from("anfragen")
          .update({ reengagement_last_sent_at: finishedAt })
          .eq("id", anfrageId);

        results.push(
          tsErr
            ? { id: anfrageId, result: "sent", warning: "TIMESTAMP_UPDATE_FAILED" }
            : { id: anfrageId, result: "sent" }
        );
      } else if (outcome === "failed") {
        const { error: logErr } = await sb
          .from("anfragen_reengagement_log")
          .update({
            status: "failed",
            error_code: httpStatus ? String(httpStatus) : "SEND_FAILED",
            finished_at: finishedAt,
          })
          .eq("id", reservation.id);

        results.push(
          logErr
            ? { id: anfrageId, result: "failed", reason: "SEND_FAILED", warning: "LOG_UPDATE_FAILED" }
            : { id: anfrageId, result: "failed", reason: "SEND_FAILED" }
        );
      } else {
        // Fall C: Unbekanntes Ergebnis (z. B. 429/5xx, Timeout,
        // Verbindungsabbruch): bewusst NICHT als "failed" markiert, damit
        // kein automatischer Retry-Mechanismus diesen Fall fälschlich als
        // sicher wiederholbar behandelt. Schlägt sogar das Speichern von
        // "unknown" fehl, bleibt die Reservierung bei "queued" stehen und
        // blockiert damit weiterhin jeden blinden Retry in diesem Vorgang.
        const { error: logErr } = await sb
          .from("anfragen_reengagement_log")
          .update({
            status: "unknown",
            error_code: httpStatus ? String(httpStatus) : "UNKNOWN",
            finished_at: finishedAt,
          })
          .eq("id", reservation.id);

        results.push(
          logErr
            ? { id: anfrageId, result: "unknown", reason: "SEND_RESULT_UNKNOWN", warning: "LOG_UPDATE_FAILED" }
            : { id: anfrageId, result: "unknown", reason: "SEND_RESULT_UNKNOWN" }
        );
      }
    }

    return json({ batchId, results });
  } catch {
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
}
