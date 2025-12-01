import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { teamData } from "../../teamData";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { email } = await req.json();

    // Herausfinden, welches Teammitglied diese Email hat:
    const member = teamData.find(
      (m) => m.email?.toLowerCase() === email.toLowerCase()
    );

    if (!member) {
      return NextResponse.json({ requests: [] });
    }

    const { data, error } = await supabase
      .from("anfragen")
      .select("*")
      .eq("wunschtherapeut", member.name);

    if (error) {
      console.error("DB ERROR", error);
      return NextResponse.json({ requests: [] });
    }

    return NextResponse.json({ requests: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
