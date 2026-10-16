export const dynamic = "force-dynamic";

// Old clients must prove mailbox possession, never exchange a public ID for a credential.
export async function POST() {
  return Response.json(
    { error: "RECOVERY_REQUIRED" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
