// Reine, UI-unabhängige Hilfsfunktionen für die frühe Zeitpräferenz der
// Klient:in und optionale Proposal-Zeitrahmen pro Coach.
//
// WICHTIG: Dies ist ausschließlich ein UX-Hinweis (Version 1), keine
// verbindliche serverseitige Zeitvalidierung. Freitext-Zeitwünsche
// (terminwunsch_text / preferred_times) werden hier nicht interpretiert.

export const TIME_PREFERENCE_OPTIONS = [
  { key: "vormittags", label: "vormittags" },
  { key: "nachmittags", label: "nachmittags" },
  { key: "abends", label: "abends" },
  { key: "flexibel", label: "flexibel" },
];

const TIME_PREFERENCE_KEYS = TIME_PREFERENCE_OPTIONS.map((o) => o.key);

// Grobe, rein heuristische Uhrzeitfenster für den UX-Hinweis.
// "flexibel" hat bewusst kein Fenster und kann nie in Konflikt stehen.
const PREFERENCE_WINDOWS = {
  vormittags: { startMinutes: 6 * 60, endMinutes: 12 * 60 },
  nachmittags: { startMinutes: 12 * 60, endMinutes: 18 * 60 },
  abends: { startMinutes: 18 * 60, endMinutes: 22 * 60 },
  flexibel: null,
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CALENDAR_MODES = new Set(["booking", "proposal", "ics"]);

export function resolveCalendarMode(profileMode, legacyMode) {
  const normalizedProfileMode = String(profileMode || "").trim().toLowerCase();
  if (CALENDAR_MODES.has(normalizedProfileMode)) return normalizedProfileMode;

  const normalizedLegacyMode = String(legacyMode || "").trim().toLowerCase();
  if (CALENDAR_MODES.has(normalizedLegacyMode)) return normalizedLegacyMode;

  return "proposal";
}

function isValidTime(value) {
  return typeof value === "string" && TIME_PATTERN.test(value.trim());
}

function timeToMinutes(value) {
  if (!isValidTime(value)) return null;
  const [hours, minutes] = value.trim().split(":").map(Number);
  return hours * 60 + minutes;
}

export function sanitizeTimePreference(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v) => TIME_PREFERENCE_KEYS.includes(v)))];
}

export function hasTimePreference(value) {
  return sanitizeTimePreference(value).length > 0;
}

export function resolveCoachSelectionResumeStep({
  resume,
  hasAnfrageId,
  timePreference,
} = {}) {
  if (!resume) return null;

  const n = Number.parseInt(resume, 10);
  const isCoachSelectionResume = resume === "admin" || n === 5 || n === 8;

  if (!isCoachSelectionResume) return null;
  if (!hasAnfrageId) return 7;
  return hasTimePreference(timePreference) ? 8 : 7;
}

export function shouldUseLoadedRequestResumeDecision({ resume, hasAnfrageId } = {}) {
  if (!resume) return false;

  const n = Number.parseInt(resume, 10);
  const isCoachSelectionResume = resume === "admin" || n === 5 || n === 8;
  return isCoachSelectionResume && Boolean(hasAnfrageId);
}

// Bestimmt den Ziel-Step für einen Resume-Link, ohne bestehende Step-Nummern
// zu verschieben. Coach-Auswahl-Resumes (admin/5/8) fragen die grobe
// Zeitpräferenz zuerst ab (Step 7), wenn sie noch fehlt und keine Anfrage
// geladen werden kann bzw. die geladene Anfrage keine Präferenz besitzt.
// Bereits vorhandene Präferenz wird nicht erneut abgefragt.
export function resolveResumeStep({ resume, hasAnfrageId, timePreference } = {}) {
  if (!resume) return null;

  const n = Number.parseInt(resume, 10);
  const coachSelectionStep = resolveCoachSelectionResumeStep({
    resume,
    hasAnfrageId,
    timePreference,
  });

  if (coachSelectionStep !== null) return coachSelectionStep;

  if (n === 10) return 10;
  if (!Number.isNaN(n)) return n;

  return null;
}

export function formatTimePreference(value) {
  const preferences = sanitizeTimePreference(value);
  if (preferences.length === 0) return null;
  if (preferences.length === 1 && preferences[0] === "flexibel") {
    return "zeitlich flexibel bist";
  }

  const labels = preferences.map(
    (key) => TIME_PREFERENCE_OPTIONS.find((option) => option.key === key)?.label || key
  );

  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} und ${labels[1]}`;

  return `${labels.slice(0, -1).join(", ")} und ${labels.at(-1)}`;
}

// Menschlich lesbarer Hinweis auf die optionale Proposal-Zeitgrenze eines Coaches.
// Gibt null zurück, wenn keine Constraint gesetzt ist.
export function getProposalConstraintLabel({ earliestTime, latestTime } = {}) {
  const hasEarliest = isValidTime(earliestTime);
  const hasLatest = isValidTime(latestTime);

  if (!hasEarliest && !hasLatest) return null;

  if (hasEarliest && hasLatest) {
    return `Termine grundsätzlich zwischen ${earliestTime} und ${latestTime} Uhr`;
  }

  if (hasLatest) {
    return `Termine grundsätzlich bis spätestens ${latestTime} Uhr`;
  }

  return `Termine grundsätzlich ab ${earliestTime} Uhr`;
}

// Rein heuristischer UX-Hinweis, ob die frühe Zeitpräferenz der Klient:in
// möglicherweise nicht zur optionalen Proposal-Constraint des Coaches passt.
// Wird nur für calendarMode === "proposal" angewendet; Booking bleibt unberührt.
export function mayConflictWithPreference({
  calendarMode,
  earliestTime,
  latestTime,
  timePreference,
} = {}) {
  if (String(calendarMode || "").toLowerCase() !== "proposal") return false;

  const earliestMinutes = timeToMinutes(earliestTime);
  const latestMinutes = timeToMinutes(latestTime);
  if (earliestMinutes == null && latestMinutes == null) return false;

  const preferences = sanitizeTimePreference(timePreference);
  if (preferences.length === 0) return false;

  return preferences.some((key) => {
    const window = PREFERENCE_WINDOWS[key];
    if (!window) return false;

    if (latestMinutes != null && window.startMinutes >= latestMinutes) {
      return true;
    }

    if (earliestMinutes != null && window.endMinutes <= earliestMinutes) {
      return true;
    }

    return false;
  });
}

// Setzt beim Coachwechsel ausschließlich coachabhängige Felder zurück.
// Anliegen, Kontaktdaten, frühe Zeitpräferenz und übrige Formulardaten bleiben erhalten.
export function clearCoachDependentFormFields(form) {
  return {
    ...form,
    wunschtherapeut: "",
    assigned_therapist_id: null,
    terminISO: "",
    terminDisplay: "",
    preferred_times: "",
  };
}
