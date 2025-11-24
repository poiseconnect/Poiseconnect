export const dynamic = "force-dynamic";

let booked = [];

export async function GET() {
  return Response.json(booked);
}

export async function POST(request) {
  const data = await request.json();
  const { iso } = data;

  if (!iso) return Response.json({ ok: false });

  if (!booked.includes(iso)) booked.push(iso);

  return Response.json({ ok: true });
}
