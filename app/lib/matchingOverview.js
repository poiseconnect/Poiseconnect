// app/lib/matchingOverview.js
//
// Rein lesende Aufbereitung der Themengewichtungen (team_members.matching_scores)
// und der Intake-Verfügbarkeit für die Admin-Übersicht.
// Themenquelle ist ausschließlich app/lib/matchingTopics.js.
// Verfügbarkeit nutzt ausschließlich die bestehende Logik aus
// app/lib/intakeAvailability.js (active + available_for_intake).

import { MATCHING_TOPICS } from "./matchingTopics";
import { isCoachAvailableForNewClient } from "./intakeAvailability";

export const MAX_MATCHING_SCORE = 5;

export function normalizeScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_MATCHING_SCORE, n));
}

export function getAvailabilityStatus(member = {}) {
  if (member.active !== true) return "inactive";
  return isCoachAvailableForNewClient({ member }) ? "available" : "paused";
}

export function buildMatchingOverviewRows(members = [], topics = MATCHING_TOPICS) {
  return (Array.isArray(members) ? members : [])
    .map((member) => {
      const rawScores = member?.matching_scores || {};
      const scores = {};
      for (const topic of topics) {
        scores[topic.key] = normalizeScore(rawScores[topic.key]);
      }

      return {
        id: member?.id ?? null,
        name:
          String(member?.profile_name || "").trim() ||
          String(member?.name || "").trim() ||
          "Unbekannt",
        active: member?.active === true,
        availableForIntake: member?.available_for_intake === true,
        availabilityStatus: getAvailabilityStatus(member),
        acceptsNewClients: isCoachAvailableForNewClient({ member }),
        scores,
      };
    });
}

const AVAILABILITY_ORDER = { available: 0, paused: 1, inactive: 2 };

export function sortOverviewRows(rows = [], { sortBy = "name", direction = "asc" } = {}) {
  const dir = direction === "desc" ? -1 : 1;
  const sorted = [...rows];

  sorted.sort((a, b) => {
    if (sortBy === "name") {
      return dir * String(a.name).localeCompare(String(b.name), "de");
    }

    if (sortBy === "availability") {
      const diff =
        (AVAILABILITY_ORDER[a.availabilityStatus] ?? 9) -
        (AVAILABILITY_ORDER[b.availabilityStatus] ?? 9);
      if (diff !== 0) return dir * diff;
      return String(a.name).localeCompare(String(b.name), "de");
    }

    // Sortierung nach einem Themen-Key (Gewichtung)
    const diff = (a.scores?.[sortBy] ?? 0) - (b.scores?.[sortBy] ?? 0);
    if (diff !== 0) return dir * diff;
    return String(a.name).localeCompare(String(b.name), "de");
  });

  return sorted;
}

export function buildTopicCoverage(rows = [], topics = MATCHING_TOPICS) {
  return topics.map((topic) => {
    let availableCoachCount = 0;
    let totalCoachCount = 0;
    let availableWeightSum = 0;
    let availableMaxScore = 0;

    for (const row of rows) {
      const score = row?.scores?.[topic.key] ?? 0;
      if (score <= 0) continue;

      totalCoachCount += 1;

      if (row.acceptsNewClients) {
        availableCoachCount += 1;
        availableWeightSum += score;
        if (score > availableMaxScore) availableMaxScore = score;
      }
    }

    return {
      key: topic.key,
      label: topic.label,
      availableCoachCount,
      totalCoachCount,
      availableWeightSum,
      availableMaxScore,
      coverageLevel: getCoverageLevel(availableCoachCount),
    };
  });
}

export function getCoverageLevel(availableCoachCount) {
  if (availableCoachCount <= 0) return "none";
  if (availableCoachCount === 1) return "low";
  if (availableCoachCount <= 3) return "ok";
  return "strong";
}

export function sortTopicCoverage(coverage = []) {
  return [...coverage].sort((a, b) => {
    if (b.availableCoachCount !== a.availableCoachCount) {
      return b.availableCoachCount - a.availableCoachCount;
    }
    if (b.availableWeightSum !== a.availableWeightSum) {
      return b.availableWeightSum - a.availableWeightSum;
    }
    return String(a.label).localeCompare(String(b.label), "de");
  });
}
