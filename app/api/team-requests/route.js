import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { teamData } from "../../../teamData";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body || {};

    if (!email) {
      return NextResponse.json(
        { error: "missing_email" },
        { status: 400 }
      );
    }

    // Teammitglied anhand der Email finden
    const member = teamData.find(
      (m) => m.email?.toLowerCase() === email.toLowerCase()
    );

    if (!member) {
      return NextResponse.json({ requests: [] });
    }

    // 👉 WICHTIG: wunschtherapeut ist die EMAIL, nicht der Name
    const { data, error } = await supabase
      .from("anfragen")
      .select("*")
      .eq("wunschtherapeut", member.email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("TEAM REQUEST DB ERROR:", error);
      return NextResponse.json(
        { error: "db_error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests: data });
  } catch (err) {
    console.error("TEAM REQUEST SERVER ERROR:", err);
    return NextResponse.json(
      { error: "server_error", detail: String(err) },
      { status: 500 }
    );
  }
}
