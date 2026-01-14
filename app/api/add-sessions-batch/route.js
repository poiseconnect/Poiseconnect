import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const { anfrageId, therapist, sessions } = body;

    if (!anfrageId || !therapist || !Array.isArray(sessions)) {
      return Response.json(
        { error: "Ungültige Parameter" },
        { status: 400 }
      );
    }

    // 🔒 LEERE / UNGÜLTIGE SESSIONS ENTFERNEN
    const cleanSessions = sessions
      .filter((s) => s.date && String(s.date).trim() !== "")
      .map((s) => ({
        anfrage_id: anfrageId,
        therapist,
        date: new Date(s.date).toISOString(),
        duration_min: Number(s.duration),
        price: Number(s.price),
      }));

    if (!cleanSessions.length) {
      return Response.json(
        { error: "Keine gültigen Sitzungen übergeben" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("sessions")
      .insert(cleanSessions);

    if (error) {
      console.error("ADD SESSIONS ERROR", error);
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("ADD SESSIONS SERVER ERROR", err);
    return Response.json(
      { error: "Serverfehler" },
      { status: 500 }
    );
  }
}
