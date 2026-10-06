import { teamData } from "./teamData";
import { mergeFormTeamMembers, toFormTeamMember } from "./formTeamMembers";
import { buildInitialCoachingCostsHtml, getPublishedSessionPricing } from "./coachingCosts";

export async function loadPublishedCoachingCosts({ supabase, therapistId, coachingType }) {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, profile_name, profile_preis_std, profile_preis_ermaessigt, paarcoaching_preis, paarcoaching_dauer_min")
    .eq("id", therapistId)
    .maybeSingle();

  if (error) {
    return { error: "PUBLISHED_COACH_PRICES_LOAD_FAILED" };
  }

  const coach = mergeFormTeamMembers(
    teamData,
    data ? [toFormTeamMember(data)] : []
  ).find((member) => String(member.id) === String(therapistId));

  const pricing = getPublishedSessionPricing(coach, coachingType);
  if (!pricing) {
    return { error: "PUBLISHED_COACH_PRICE_MISSING" };
  }

  return { html: buildInitialCoachingCostsHtml({ coachName: coach.name, pricing }) };
}
