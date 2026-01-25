export async function confirmAppointment({
  supabase,
  requestId,
  client,
  vorname,
}) {
  /* --------------------------------------------------
     1️⃣ AKTUELLE ANFRAGE LADEN (SICHERHEIT)
  -------------------------------------------------- */
  const { data: existing, error: loadError } = await supabase
    .from("anfragen")
    .select("id, status")
    .eq("id", requestId)
    .single();

  if (loadError || !existing) {
    throw new Error("request_not_found");
  }

  // ❗ Schon bestätigt → nichts tun (idempotent)
  if (existing.status === "termin_bestaetigt") {
    return { alreadyConfirmed: true };
  }

  /* --------------------------------------------------
     2️⃣ STATUS → termin_bestaetigt
  -------------------------------------------------- */
  const { error: updateError } = await supabase
    .from("anfragen")
    .update(
      { status: "termin_bestaetigt" },
      { returning: "minimal" }
    )
    .eq("id", requestId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  /* --------------------------------------------------
     3️⃣ MAIL AN KLIENT:IN
  -------------------------------------------------- */
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://poiseconnect.vercel.app";

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Dein Termin ist bestätigt 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>
          <p>dein Termin wurde bestätigt.</p>
          <p>
            <a href="${baseUrl}?resume=confirmed"
               style="color:#6f4f49; font-weight:bold;">
              Zur Bestätigung
            </a>
          </p>
        `,
      }),
    });
  } catch {
    console.warn("⚠️ Mail fehlgeschlagen – Status aber korrekt");
  }

  return { success: true };
}
