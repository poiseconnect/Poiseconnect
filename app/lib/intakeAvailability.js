export function isCoachAvailableForNewClient({
  member,
  excludedTherapeuten = [],
} = {}) {
  if (member?.active !== true || member?.available_for_intake !== true) {
    return false;
  }

  const excludedValues = Array.isArray(excludedTherapeuten)
    ? excludedTherapeuten
    : typeof excludedTherapeuten === "string"
      ? [excludedTherapeuten]
      : [];
  const excluded = excludedValues
    .map((value) => String(value).trim())
    .filter(Boolean);

  return !excluded.includes(String(member.id || "").trim()) &&
    !excluded.includes(String(member.profile_name || member.name || "").trim());
}

export function getInvalidNewClientCoachIds({
  selectedIds = [],
  members = [],
  excludedTherapeuten = [],
} = {}) {
  const membersById = new Map(
    members.map((member) => [String(member.id || "").trim(), member])
  );

  return selectedIds.filter((id) => {
    const normalizedId = String(id || "").trim();
    return !isCoachAvailableForNewClient({
      member: membersById.get(normalizedId),
      excludedTherapeuten,
    });
  });
}