import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authorizeMessagingContext,
  getMessagingDispatchAvailability,
} from "../app/lib/messaging/access.js";

// No SDK/provider: exercise the real JS adapter with literal denial payloads
// extracted from the prepared SQL, not enriched test-double contexts.
const migration = readFileSync(
  new URL("../supabase/migrations/20261028000000_privacy_phase1_access.sql", import.meta.url),
  "utf8",
);
const contextFunction = migration.split("create function public.privacy_messaging_context(")[1]
  ?.split("create function public.privacy_message_write_guard()")[0];
assert.ok(contextFunction, "Messaging SQL function must exist");
const denials = [...contextFunction.matchAll(/return '(\{"allowed":false[^']*\})'::jsonb/g)]
  .map((match) => JSON.parse(match[1]));
assert.ok(denials.some((payload) => payload.reason === "MESSAGING_CONTENT_PAUSED"));
assert.ok(denials.some((payload) => payload.reason === undefined));

assert.deepEqual(getMessagingDispatchAvailability(), {
  ok: false, error: "MESSAGING_CONTENT_PAUSED",
});
let blockers = 0;
for (const payload of new Map(denials.map((value) => [JSON.stringify(value), value])).values()) {
  const expected = payload.reason === "MESSAGING_CONTENT_PAUSED"
    ? "MESSAGING_CONTENT_PAUSED" : "MESSAGING_ACCESS_DENIED";
  const fakeDatabase = {
    async rpc(name) {
      assert.equal(name, "privacy_messaging_context");
      return { data: payload, error: null };
    },
    from() { throw new Error("Acceptance probe must not read any message bodies"); },
  };
  const result = await authorizeMessagingContext(fakeDatabase, {
    requestId: "00000000-0000-0000-0000-000000000012",
  });
  assert.equal(result.ok, false, "A denial must never authorize content");
  if (result.error !== expected) {
    blockers += 1;
    console.error(`BLOCKER: SQL ${JSON.stringify(payload)} -> JS ${result.error}; expected ${expected}`);
  }
}
console.log("Dispatch remains paused. No database connection, message read or provider action.");
if (blockers) process.exitCode = 1;
