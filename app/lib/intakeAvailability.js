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

export function findCoachAvailabilityMember({ member, availability = [] } = {}) {
  const normalizedName = String(member?.name || "").trim().toLowerCase();

  return availability.find((candidate) => {
    return (
      String(candidate?.id || "").trim() === String(member?.id || "").trim() ||
      String(candidate?.profile_name || "").trim().toLowerCase() === normalizedName
    );
  }) || null;
}

export function getAdminCoachOptions({
  teamMembers = [],
  availability = [],
  selectedIds = [],
  excludedTherapeuten = [],
} = {}) {
  return availability
    .filter((member) =>
      isCoachAvailableForNewClient({ member, excludedTherapeuten }) ||
      isHistoricallySelectedCoach({ member, selectedIds })
    )
    .map((member) => {
      const staticMember = teamMembers.find((candidate) =>
        findCoachAvailabilityMember({
          member: candidate,
          availability: [member],
        })
      );

      return {
        ...staticMember,
        ...member,
        name: member.profile_name || staticMember?.name || "Unbekannter Coach",
      };
    });
}

export function isHistoricallySelectedCoach({ member, selectedIds = [] } = {}) {
  const selectedValues = Array.isArray(selectedIds)
    ? selectedIds
    : typeof selectedIds === "string"
      ? [selectedIds]
      : [];
  const selected = selectedValues
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  return selected.includes(String(member?.id || "").trim()) ||
    selected.includes(String(member?.profile_name || member?.name || "").trim());
}

export function shouldShowAdminCoach({
  member,
  selectedIds = [],
  excludedTherapeuten = [],
} = {}) {
  return isHistoricallySelectedCoach({ member, selectedIds }) ||
    isCoachAvailableForNewClient({
    member,
    excludedTherapeuten,
  });
}