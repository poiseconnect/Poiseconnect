export async function POST() {
  return Response.json(
    { ok: false, error: "NEWSLETTER_SIGNUP_DISABLED" },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
