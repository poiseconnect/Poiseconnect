const REQUEST_FILTER_TABS = new Set([
  "unbearbeitet",
  "erstgespraech",
  "aktiv",
  "beendet",
]);

const TERMINAL_MESSAGING_STATUSES = new Set([
  "beendet",
  "papierkorb",
  "kein_match",
  "abgelehnt",
]);

export function isTerminalMessagingStatus(status) {
  return TERMINAL_MESSAGING_STATUSES.has(String(status || ""));
}

export function canUseMessagingForRequest({ request, role, therapistId }) {
  return (
    role === "therapist" &&
    Boolean(therapistId) &&
    String(request?.assigned_therapist_id) === String(therapistId)
  );
}

export function addPersonalMessageAction(actions, { canUseMessaging, status, hint } = {}) {
  if (!canUseMessaging || isTerminalMessagingStatus(status)) return actions;
  if (actions.some((action) => action.key === "personal_message")) return actions;

  const insertAt = actions.findIndex((action) => action.key === "details");
  const messageAction = {
    key: "personal_message",
    label: "💬 Persönliche Nachricht senden",
    hint: hint || "Nachricht an Klient:in senden",
  };

  if (insertAt === -1) return [...actions, messageAction];
  return [
    ...actions.slice(0, insertAt),
    messageAction,
    ...actions.slice(insertAt),
  ];
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
