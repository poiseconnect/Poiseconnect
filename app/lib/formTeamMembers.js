function normalizePrice(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(
    typeof value === "string" ? value.replace(",", ".").trim() : value
  );

  return Number.isFinite(number) ? number : fallback;
}

export function toFormTeamMember(member = {}) {
  return {
    id: member.id,
    name: member.profile_name?.trim() || null,
    role: member.profile_role?.trim() || null,
    calendar_mode: member.profile_calendar_mode?.trim() || null,
    short: member.profile_short?.trim() || null,
    tags: Array.isArray(member.profile_keywords) ? member.profile_keywords : null,
    preis_std: normalizePrice(member.profile_preis_std),
    preis_ermaessigt: normalizePrice(member.profile_preis_ermaessigt),
    paarcoaching: member.paarcoaching === true,
    paarcoaching_preis: normalizePrice(member.paarcoaching_preis),
    paarcoaching_dauer_min:
      member.paarcoaching_dauer_min == null
        ? null
        : Number(member.paarcoaching_dauer_min),
    proposal_earliest_time: member.proposal_earliest_time || null,
    proposal_latest_time: member.proposal_latest_time || null,
  };
}

export function mergeFormTeamMembers(team = [], overrides = []) {
  const overridesById = new Map(
    overrides
      .filter((member) => member?.id != null)
      .map((member) => [String(member.id), member])
  );

  return team.map((member) => {
    const override = overridesById.get(String(member.id));

    if (!override) {
      return member;
    }

    return {
      ...member,
      ...Object.fromEntries(
        Object.entries(override).filter(([, value]) => value !== null)
      ),
    };
  });
}
