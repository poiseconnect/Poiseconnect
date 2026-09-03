const REQUEST_FILTER_TABS = new Set([
  "unbearbeitet",
  "erstgespraech",
  "aktiv",
  "beendet",
]);

export function canUseMessagingForRequest({ request, role, therapistId }) {
  return (
    role === "therapist" &&
    Boolean(therapistId) &&
    String(request?.assigned_therapist_id) === String(therapistId)
  );
}

export function matchesCoachFilter({
  request,
  tab,
  therapistId,
  sessions = [],
}) {
  if (!therapistId || therapistId === "alle") return true;
  if (!REQUEST_FILTER_TABS.has(tab)) return true;

  const selectedId = String(therapistId);
  if (String(request?.assigned_therapist_id) === selectedId) {
    return true;
  }

  if (tab !== "aktiv") return false;

  return sessions.some(
    (session) => String(session?.therapist_id) === selectedId
  );
}
