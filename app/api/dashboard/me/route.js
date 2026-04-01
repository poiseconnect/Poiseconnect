export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const sb = supabaseAdmin();

    await sb
      .from("team_members")
      .update({ user_id: user.id })
      .eq("email", user.email)
      .is("user_id", null);

    let { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active, available_for_intake")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      const { data: byMail } = await sb
        .from("team_members")
        .select("id")
        .eq("email", user.email)
        .single();

      if (byMail?.id) {
        await sb
          .from("team_members")
          .update({ user_id: user.id })
          .eq("id", byMail.id);

        const { data: linkedMember } = await sb
          .from("team_members")
          .select("id, role, active, available_for_intake")
          .eq("user_id", user.id)
          .single();

        member = linkedMember || null;
        memberErr = null;
      }
    }

    return json({
      user: {
        id: user.id,
        email: user.email,
      },
      member: member || null,
      error: memberErr ? memberErr.message : null,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
