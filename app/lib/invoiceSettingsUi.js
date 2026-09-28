export function getInvoiceSettingsTargetId({
  isAdmin,
  selectedCoachId,
  coachId,
}) {
  if (isAdmin) {
    if (!selectedCoachId || selectedCoachId === "alle") return null;
    return String(selectedCoachId);
  }

  return coachId ? String(coachId) : null;
}

export function isInvoiceSettingsReady({ targetId, loadedForId, loading }) {
  return Boolean(targetId && loadedForId === targetId && !loading);
}

export function shouldShowInvoiceSettingsPrompt({ isAdmin, targetId }) {
  return Boolean(isAdmin && !targetId);
}