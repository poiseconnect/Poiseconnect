export const dynamic = "force-dynamic";

import { google } from "googleapis";
import {
  json,
  oauthClient,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member) return json({ error: "NO_TEAM_MEMBER" }, 403);
    if (member.role !== "therapist" || !member.active) {
      return json({ error: "NOT_ALLOWED" }, 403);
    }

    const { data: tokens, error: tokErr } = await sb
      .from("therapist_google_tokens")
      .select("*")
      .eq("therapist_id", member.id)
      .single();

    if (tokErr || !tokens) {
      return json({ error: "GOOGLE_NOT_CONNECTED" }, 400);
    }

    const oauth = oauthClient();
    oauth.setCredentials({
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth });
    const res = await calendar.calendarList.list();

    const calendars = (res.data.items || []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: !!c.primary,
      accessRole: c.accessRole,
    }));

    return json({ calendars });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
