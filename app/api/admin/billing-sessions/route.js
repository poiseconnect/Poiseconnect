import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { user, error: authError } = await getUserFromBearer(req);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    const supabase = supabaseAdmin();
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (
      memberError ||
      !member ||
      member.active !== true ||
      member.role !== "admin"
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const [sessionsResult, settingsResult] = await Promise.all([
      supabase
        .from("sessions")
        .select(`
        id,
        date,
        duration_min,
        price,
        therapist_id,
        anfrage_id,
        anfragen (
          vorname,
          nachname,
          email,
          strasse_hausnr,
          plz_ort,
          status,
          invoice_with_vat,
          beschaeftigungsgrad
        ),
        team_members (
          id,
          name,
          email
        )
      `)
        .order("date", { ascending: false }),
      supabase
        .from("therapist_invoice_settings")
        .select(`
          therapist_id,
          default_vat_rate,
          business_country_code,
          vat_number,
          uid_confirmed_at
        `),
    ]);

    if (sessionsResult.error || settingsResult.error) {
      console.error("ADMIN BILLING ERROR:", {
        code: sessionsResult.error?.code || settingsResult.error?.code || null,
      });
      return json({ error: "INTERNAL_ERROR" }, 500);
    }

    return json({
      data: sessionsResult.data || [],
      coachInvoiceSettings: settingsResult.data || [],
    });
  } catch {
    console.error("ADMIN BILLING SERVER ERROR");
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
