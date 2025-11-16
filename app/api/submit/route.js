export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
