export async function POST(req) {
  try {
    const data = await req.json(); // <-- WICHTIG: await

    // 1) In Supabase speichern
    const { error } = await supabase.from("anfragen").insert([data]);
    if (error) throw error;

    // 2) Bestätigungsmail an den Klienten
    await resend.emails.send({
      from: "Poise Connect <no-reply@mypoise.de>",
      to: data.email,
      subject: "Deine Anfrage bei Poise Connect",
      html: `
        <h2>Hallo ${data.vorname},</h2>
        <p>Danke für deine Anfrage bei Poise Connect.</p>
        <p>Wir melden uns so schnell wie möglich bei dir.</p>
      `,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("API ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
