export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { recoveryHash, recoveryDestination, recoveryOrigin } from "../../../lib/clientLinkRecovery.js";

export async function POST(req) {
  const invalid = () => new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/recover-link?invalid=1", recoveryOrigin()).toString(),
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    },
  });
  try {
    const form = await req.formData();
    const secret = form.get("secret");
    if (typeof secret !== "string" || !/^[a-f0-9]{64}$/.test(secret)) return invalid();
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.rpc("consume_client_link_recovery", { p_secret_hash: recoveryHash(secret) });
    if (error || !data?.[0]) return invalid();
    return new Response(null, {
      status: 303,
      headers: {
        Location: recoveryDestination(data[0]),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return invalid();
  }
}
