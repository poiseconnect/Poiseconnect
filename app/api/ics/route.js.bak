export const dynamic = "force-dynamic"; // verhindert Prerendering

const ICS_BY_MEMBER = {
  Ann: "https://calendar.google.com/calendar/ical/75f62df4c63554a1436d49c3a381da84502728a0457c9c8b56d30e21fa5021c5%40group.calendar.google.com/public/basic.ics",
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const member = searchParams.get("member");

    if (!member || !ICS_BY_MEMBER[member]) {
      return new Response("Unknown member", { status: 400 });
    }

    // ICS laden (als TEXT — nicht JSON!)
    const res = await fetch(ICS_BY_MEMBER[member]);
    const text = await res.text();

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("Failed to load ICS", { status: 500 });
  }
}
