export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { teamData } from "../../lib/teamData";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromBearer(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

async function requireAdmin(req) {
  const user = await getUserFromBearer(req);
  if (!user) return { error: json({ error: "unauthorized" }, 401) };

  const { data: member, error } = await supabase
    .from("team_members")
    .select("id, email, role, active")
    .eq("email", user.email)
    .maybeSingle();

  if (error || !member || member.role !== "admin" || member.active !== true) {
    return { error: json({ error: "forbidden" }, 403) };
  }

  return { user, member };
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

function addIssue(list, level, message) {
  list.push({ level, message });
}

export async function GET(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const issues = [];
    const coachChecks = [];

    const siteUrl =
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      "";

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      addIssue(issues, "error", "NEXT_PUBLIC_SUPABASE_URL fehlt");
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      addIssue(issues, "error", "SUPABASE_SERVICE_ROLE_KEY fehlt");
    }

    if (!process.env.RESEND_API_KEY) {
      addIssue(issues, "warning", "RESEND_API_KEY fehlt");
    }

    if (!siteUrl) {
      addIssue(issues, "warning", "SITE_URL / NEXT_PUBLIC_SITE_URL / APP_URL fehlt");
    } else if (siteUrl.includes("poiseconnect.vercel.app")) {
      addIssue(issues, "warning", "SITE_URL zeigt noch auf poiseconnect.vercel.app");
    } else if (!siteUrl.includes("app.mypoise.de")) {
      addIssue(issues, "warning", `SITE_URL ist ungewöhnlich: ${siteUrl}`);
    }

    const tableChecks = [];

    for (const table of [
      "team_members",
      "therapist_booking_settings",
      "therapist_invoice_settings",
      "anfragen",
      "sessions",
    ]) {
      const { error } = await supabase.from(table).select("*").limit(1);
      tableChecks.push({
        table,
        ok: !error,
        error: error?.message || null,
      });

      if (error) {
        addIssue(issues, "error", `Tabelle nicht erreichbar: ${table} – ${error.message}`);
      }
    }

    const { data: dbMembers, error: membersError } = await supabase
      .from("team_members")
      .select(
        "id, email, role, active, available_for_intake, profile_name, profile_calendar_mode, sevdesk_contact_id, matching_scores"
      );

    if (membersError) {
      return json(
        {
          ok: false,
          error: "team_members_load_failed",
          detail: membersError.message,
        },
        500
      );
    }

    const { data: bookingSettings } = await supabase
      .from("therapist_booking_settings")
      .select("*");

    const { data: invoiceSettings } = await supabase
      .from("therapist_invoice_settings")
      .select("*");

    const dbById = new Map((dbMembers || []).map((m) => [String(m.id), m]));
    const dbByEmail = new Map(
      (dbMembers || [])
        .filter((m) => m.email)
        .map((m) => [String(m.email).toLowerCase(), m])
    );

    const bookingByTherapistId = new Map(
      (bookingSettings || []).map((b) => [String(b.therapist_id), b])
    );

    const invoiceByTherapistId = new Map(
      (invoiceSettings || []).map((i) => [String(i.therapist_id), i])
    );

    for (const t of teamData || []) {
      const rowIssues = [];

      const dbMember =
        (t.id && dbById.get(String(t.id))) ||
        (t.email && dbByEmail.get(String(t.email).toLowerCase())) ||
        null;

      if (!t.name) addIssue(rowIssues, "error", "Name fehlt");
      if (!t.id) addIssue(rowIssues, "error", "teamData.id fehlt");
      if (t.id && !isUuid(t.id)) addIssue(rowIssues, "error", `Ungültige UUID: ${t.id}`);
      if (!t.email) addIssue(rowIssues, "warning", "teamData.email fehlt");

      if (!dbMember) {
        addIssue(rowIssues, "error", "Kein passender Eintrag in Supabase team_members gefunden");
      } else {
        if (dbMember.active !== true) addIssue(rowIssues, "warning", "Coach ist nicht active=true");
        if (dbMember.available_for_intake !== true) {
          addIssue(rowIssues, "warning", "available_for_intake ist nicht true");
        }
      }

      const mode =
        dbMember?.profile_calendar_mode ||
        t.calendar_mode ||
        "booking";

      if (!["booking", "proposal", "ics"].includes(String(mode))) {
        addIssue(rowIssues, "error", `Unbekannter calendar_mode: ${mode}`);
      }

      const therapistId = dbMember?.id || t.id;

      if (mode === "booking") {
        const b = bookingByTherapistId.get(String(therapistId));

        if (!b) {
          addIssue(rowIssues, "error", "booking mode, aber keine therapist_booking_settings");
        } else {
          if (b.booking_enabled !== true) {
            addIssue(rowIssues, "warning", "booking_enabled ist nicht true");
          }
          if (!b.meeting_link) {
            addIssue(rowIssues, "warning", "meeting_link fehlt");
          }
          if (!b.selected_calendar_id && !b.google_calendar_id) {
            addIssue(rowIssues, "warning", "Google Kalender ID fehlt evtl.");
          }
        }
      }

      if (mode === "ics") {
        if (!t.ics) addIssue(rowIssues, "error", "ics mode, aber keine ICS URL in teamData");
      }

      const scores = dbMember?.matching_scores || t.scores || {};
      if (!scores || Object.keys(scores).length === 0) {
        addIssue(rowIssues, "warning", "Matching Scores fehlen");
      }

      const inv = invoiceByTherapistId.get(String(therapistId));
      if (!inv) {
        addIssue(rowIssues, "warning", "therapist_invoice_settings fehlen");
      } else {
        if (!inv.company_name) addIssue(rowIssues, "warning", "Rechnungsdaten: company_name fehlt");
        if (!inv.address) addIssue(rowIssues, "warning", "Rechnungsdaten: address fehlt");
        if (!inv.iban) addIssue(rowIssues, "warning", "Rechnungsdaten: IBAN fehlt");
      }

      if (!dbMember?.sevdesk_contact_id) {
        addIssue(rowIssues, "warning", "sevdesk_contact_id fehlt");
      }

      const status = rowIssues.some((x) => x.level === "error")
        ? "error"
        : rowIssues.some((x) => x.level === "warning")
        ? "warning"
        : "ok";

      coachChecks.push({
        id: therapistId || null,
        name: t.name || dbMember?.profile_name || "Unbekannt",
        email: t.email || dbMember?.email || "",
        calendar_mode: mode,
        status,
        issues: rowIssues,
      });
    }

    const errorCount =
      issues.filter((x) => x.level === "error").length +
      coachChecks.reduce(
        (sum, c) => sum + c.issues.filter((x) => x.level === "error").length,
        0
      );

    const warningCount =
      issues.filter((x) => x.level === "warning").length +
      coachChecks.reduce(
        (sum, c) => sum + c.issues.filter((x) => x.level === "warning").length,
        0
      );

    return json({
      ok: errorCount === 0,
      launch_ready: errorCount === 0,
      summary: {
        errorCount,
        warningCount,
        coachCount: coachChecks.length,
        okCoaches: coachChecks.filter((c) => c.status === "ok").length,
        warningCoaches: coachChecks.filter((c) => c.status === "warning").length,
        errorCoaches: coachChecks.filter((c) => c.status === "error").length,
      },
      siteUrl,
      systemIssues: issues,
      tableChecks,
      coachChecks,
    });
  } catch (err) {
    console.error("SYSTEM CHECK ERROR:", err);
    return json({ ok: false, error: "server_error", detail: String(err) }, 500);
  }
}
