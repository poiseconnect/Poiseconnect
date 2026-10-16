export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import {
  decryptRecoverySecret,
  recoveryOrigin,
} from "../../../lib/clientLinkRecovery.js";

const BATCH_SIZE = 5;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function retryJob(supabase, job) {
  const { error, data } = await supabase.rpc("retry_client_link_recovery_queue", {
    p_job_id: job.job_id,
    p_claim_token: job.claim_token,
  });
  if (error || data !== true) console.error("CLIENT_LINK_RECOVERY_RETRY_UNAVAILABLE");
}

async function finishJob(supabase, job, outcome) {
  const { error, data } = await supabase.rpc("finish_client_link_recovery_queue", {
    p_job_id: job.job_id,
    p_claim_token: job.claim_token,
    p_outcome: outcome,
  });
  if (error || data !== true) throw new Error("CLIENT_LINK_RECOVERY_FINISH_FAILED");
}

async function processJob(supabase, job) {
  const { data, error } = await supabase.rpc("process_client_link_recovery_queue", {
    p_job_id: job.job_id,
    p_claim_token: job.claim_token,
  });
  if (error) throw new Error("CLIENT_LINK_RECOVERY_PROCESS_FAILED");

  const recipient = data?.[0]?.recipient;
  if (!recipient) {
    await finishJob(supabase, job, "no_match");
    return "no_match";
  }

  const secret = decryptRecoverySecret(job.encrypted_secret);
  const link = `${recoveryOrigin()}/recover-link#${secret}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `client-link-recovery-${job.job_id}`,
    },
    body: JSON.stringify({
      from: "Poise <noreply@mypoise.de>",
      to: recipient,
      subject: "Dein angeforderter Zugang zu Poise",
      text: `Du hast einen neuen Zugang angefordert.\n\nÖffne diesen Link und bestätige dort, dass du fortfahren möchtest:\n${link}\n\nDer Link ist 15 Minuten gültig und kann einmal verwendet werden. Wenn du dies nicht angefordert hast, ignoriere diese E-Mail.`,
    }),
  });
  if (!response.ok) throw new Error("CLIENT_LINK_RECOVERY_MAIL_FAILED");

  await finishJob(supabase, job, "sent");
  return "sent";
}

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CLIENT_LINK_RECOVERY_CRON_UNCONFIGURED");
    return json({ error: "unavailable" }, 503);
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const supabase = adminClient();
    const { data: jobs, error } = await supabase.rpc("claim_client_link_recovery_queue", {
      p_limit: BATCH_SIZE,
    });
    if (error) {
      console.error("CLIENT_LINK_RECOVERY_QUEUE_UNAVAILABLE");
      return json({ error: "unavailable" }, 503);
    }

    const results = { sent: 0, noMatch: 0, retrying: 0 };
    for (const job of jobs || []) {
      try {
        const outcome = await processJob(supabase, job);
        if (outcome === "sent") results.sent += 1;
        else results.noMatch += 1;
      } catch {
        console.error("CLIENT_LINK_RECOVERY_DELIVERY_RETRY");
        await retryJob(supabase, job);
        results.retrying += 1;
      }
    }
    return json({ ok: true, ...results });
  } catch {
    console.error("CLIENT_LINK_RECOVERY_WORKER_UNAVAILABLE");
    return json({ error: "unavailable" }, 503);
  }
}
