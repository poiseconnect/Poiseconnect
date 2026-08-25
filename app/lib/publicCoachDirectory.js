import { MATCHING_TOPIC_KEYS } from "./matchingTopics.js";

export const PUBLIC_EDUCATION_FILTERS = [
  "Psycholog:in",
  "Klinische Psycholog:in",
  "Psychotherapeut:in",
  "Psychotherapeut:in in Ausbildung",
  "Heilpraktiker:in für Psychotherapie",
  "Coach",
  "Hypnose Coach",
  "Systemischer Coach",
  "Systemische:r Berater:in",
  "Ärzt:in",
  "Kinder- und Jugendpsycholog:in",
  "Mediator:in",
  "Psychoonkolog:in",
  "Trauerbegleiter:in",
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function hasTestMarker(value) {
  const normalized = normalizeText(value);
  return normalized.includes("(test)") || normalized.startsWith("test ");
}

export function isPubliclyVisibleCoach(member = {}) {
  return (
    member.active === true &&
    member.available_for_intake === true &&
    !hasTestMarker(member.name || member.profile_name) &&
    !hasTestMarker(member.role || member.profile_role)
  );
}

export function normalizeEducationRole(rolePart) {
  const normalized = normalizeText(rolePart);

  if (!normalized || hasTestMarker(normalized)) {
    return null;
  }

  if (normalized.includes("kinder- und jugendpsycholog")) {
    return "Kinder- und Jugendpsycholog:in";
  }

  if (normalized.includes("klinische psycholog") || normalized.includes("klinischer psycholog")) {
    return "Klinische Psycholog:in";
  }

  if (normalized.includes("psychotherapeut") && normalized.includes("ausbildung")) {
    return "Psychotherapeut:in in Ausbildung";
  }

  if (normalized.includes("psychotherapeut")) {
    return "Psychotherapeut:in";
  }

  if (normalized.includes("heilpraktiker") && normalized.includes("psychotherapie")) {
    return "Heilpraktiker:in für Psychotherapie";
  }

  if (normalized.includes("hypnose coach")) {
    return "Hypnose Coach";
  }

  if (normalized.includes("systemischer coach")) {
    return "Systemischer Coach";
  }

  if (normalized.includes("systemischer berater") || normalized.includes("systemische berater")) {
    return "Systemische:r Berater:in";
  }

  if (normalized === "coach") {
    return "Coach";
  }

  if (normalized.includes("ärzt") || normalized.includes("arzt")) {
    return "Ärzt:in";
  }

  if (normalized.includes("psycholog")) {
    return "Psycholog:in";
  }

  if (normalized.includes("mediator")) {
    return "Mediator:in";
  }

  if (normalized.includes("psychoonkolog")) {
    return "Psychoonkolog:in";
  }

  if (normalized.includes("trauerbegleiter")) {
    return "Trauerbegleiter:in";
  }

  return null;
}

export function parseEducationCategories(role = "") {
  return unique(
    String(role || "")
      .split(",")
      .map((part) => normalizeEducationRole(part))
  );
}

export function derivePublicTopics(scores = {}) {
  return MATCHING_TOPIC_KEYS.filter((topicKey) => {
    const value = Number(scores?.[topicKey] ?? 0);
    return Number.isFinite(value) && value > 0;
  });
}

function chooseScores(dbMember, teamMember) {
  const dbScores = dbMember?.matching_scores;

  if (dbScores && typeof dbScores === "object" && Object.keys(dbScores).length > 0) {
    return dbScores;
  }

  return teamMember?.scores || {};
}

function buildRequestUrl(name) {
  const url = new URL("https://app.mypoise.de/");
  url.searchParams.set("therapist", name);
  return url.toString();
}

export function toPublicCoachMember(teamMember = {}, dbMember = {}) {
  const role = dbMember?.profile_role?.trim() || teamMember.role || "";
  const name = dbMember?.profile_name?.trim() || teamMember.name || "";
  const publicVisibilitySource = {
    ...dbMember,
    name,
    role,
  };

  if (!isPubliclyVisibleCoach(publicVisibilitySource)) {
    return null;
  }

  const id = dbMember?.id ?? teamMember.id ?? name;
  const topics = derivePublicTopics(chooseScores(dbMember, teamMember));

  return {
    id,
    name,
    role,
    educationCategories: parseEducationCategories(role),
    short: dbMember?.profile_short?.trim() || teamMember.short || "",
    image: teamMember.image || "",
    video: teamMember.video || "",
    topics,
    requestUrl: buildRequestUrl(name),
  };
}

export function filterPublicCoaches(
  members = [],
  { selectedTopics = [], selectedEducations = [] } = {}
) {
  return members.filter((member) => {
    const topicMatch =
      selectedTopics.length === 0 ||
      selectedTopics.some((topic) => member.topics?.includes(topic));

    const educationMatch =
      selectedEducations.length === 0 ||
      selectedEducations.some((education) =>
        member.educationCategories?.includes(education)
      );

    return topicMatch && educationMatch;
  });
}
