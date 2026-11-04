import { describe, expect, it } from "vitest";

import {
  MAX_MATCHING_SCORE,
  buildMatchingOverviewRows,
  buildTopicCoverage,
  getAvailabilityStatus,
  getCoverageLevel,
  normalizeScore,
  sortOverviewRows,
  sortTopicCoverage,
} from "../../app/lib/matchingOverview.js";
import { MATCHING_TOPIC_KEYS } from "../../app/lib/matchingTopics.js";

const TOPICS = [
  { key: "stress", label: "Stress" },
  { key: "burnout", label: "Burnout" },
  { key: "trauer", label: "Trauer" },
];

function member(overrides = {}) {
  return {
    id: "coach-a",
    name: "Coach A",
    profile_name: "",
    active: true,
    available_for_intake: true,
    matching_scores: {},
    ...overrides,
  };
}

describe("normalizeScore", () => {
  it("clamps values to the existing 0..5 range", () => {
    expect(normalizeScore(-2)).toBe(0);
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(3)).toBe(3);
    expect(normalizeScore(99)).toBe(MAX_MATCHING_SCORE);
  });

  it("treats missing or invalid values as 0", () => {
    expect(normalizeScore(undefined)).toBe(0);
    expect(normalizeScore(null)).toBe(0);
    expect(normalizeScore("abc")).toBe(0);
  });
});

describe("getAvailabilityStatus", () => {
  it("maps active + available_for_intake to available", () => {
    expect(getAvailabilityStatus(member())).toBe("available");
  });

  it("maps active without intake to paused", () => {
    expect(
      getAvailabilityStatus(member({ available_for_intake: false }))
    ).toBe("paused");
  });

  it("maps inactive members to inactive regardless of intake flag", () => {
    expect(
      getAvailabilityStatus(member({ active: false, available_for_intake: true }))
    ).toBe("inactive");
  });
});

describe("buildMatchingOverviewRows", () => {
  it("normalizes scores for every topic key and prefers profile_name", () => {
    const rows = buildMatchingOverviewRows(
      [
        member({
          profile_name: "Profilname",
          matching_scores: { stress: 4, burnout: "7", unbekanntes_thema: 5 },
        }),
      ],
      TOPICS
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Profilname");
    expect(rows[0].scores).toEqual({ stress: 4, burnout: 5, trauer: 0 });
    expect(rows[0].acceptsNewClients).toBe(true);
  });

  it("covers all shared matching topic keys by default", () => {
    const rows = buildMatchingOverviewRows([member()]);
    expect(Object.keys(rows[0].scores).sort()).toEqual(
      [...MATCHING_TOPIC_KEYS].sort()
    );
  });

  it("uses the existing intake availability logic", () => {
    const rows = buildMatchingOverviewRows(
      [
        member({ id: "a" }),
        member({ id: "b", available_for_intake: false }),
        member({ id: "c", active: false }),
      ],
      TOPICS
    );

    expect(rows.map((r) => r.acceptsNewClients)).toEqual([true, false, false]);
    expect(rows.map((r) => r.availabilityStatus)).toEqual([
      "available",
      "paused",
      "inactive",
    ]);
  });

  it("applies the matching fallback rule dbScores[key] ?? fallback[key] ?? 0", () => {
    const rows = buildMatchingOverviewRows(
      [
        member({
          id: "coach-a",
          // stress fehlt in den DB-Scores, burnout ist explizit 0
          matching_scores: { burnout: 0, trauer: 2 },
        }),
        member({ id: "coach-b", matching_scores: null }),
      ],
      TOPICS,
      {
        "coach-a": { stress: 3, burnout: 5, trauer: 5 },
        "coach-b": { stress: 1 },
      }
    );

    // DB-Wert 0 gewinnt gegen Fallback (?? greift nur bei null/undefined)
    expect(rows[0].scores).toEqual({ stress: 3, burnout: 0, trauer: 2 });
    expect(rows[0].fallbackTopicKeys).toEqual(["stress"]);

    // Ohne DB-Scores kommt alles aus dem Fallback
    expect(rows[1].scores).toEqual({ stress: 1, burnout: 0, trauer: 0 });
    expect(rows[1].fallbackTopicKeys).toEqual(["stress"]);
  });

  it("works without a fallback map (missing keys become 0)", () => {
    const rows = buildMatchingOverviewRows(
      [member({ matching_scores: { stress: 2 } })],
      TOPICS
    );

    expect(rows[0].scores).toEqual({ stress: 2, burnout: 0, trauer: 0 });
    expect(rows[0].fallbackTopicKeys).toEqual([]);
  });
});

describe("sortOverviewRows", () => {
  const rows = buildMatchingOverviewRows(
    [
      member({ id: "b", name: "Berta", matching_scores: { stress: 5 } }),
      member({
        id: "a",
        name: "Anna",
        available_for_intake: false,
        matching_scores: { stress: 2 },
      }),
      member({ id: "c", name: "Clara", matching_scores: { stress: 2 } }),
    ],
    TOPICS
  );

  it("sorts by name ascending and descending", () => {
    expect(sortOverviewRows(rows, { sortBy: "name" }).map((r) => r.name)).toEqual([
      "Anna",
      "Berta",
      "Clara",
    ]);
    expect(
      sortOverviewRows(rows, { sortBy: "name", direction: "desc" }).map(
        (r) => r.name
      )
    ).toEqual(["Clara", "Berta", "Anna"]);
  });

  it("sorts by availability with available coaches first", () => {
    expect(
      sortOverviewRows(rows, { sortBy: "availability" }).map((r) => r.name)
    ).toEqual(["Berta", "Clara", "Anna"]);
  });

  it("sorts by topic score with name as tiebreaker", () => {
    expect(
      sortOverviewRows(rows, { sortBy: "stress", direction: "desc" }).map(
        (r) => r.name
      )
    ).toEqual(["Berta", "Anna", "Clara"]);
  });

  it("does not mutate the input array", () => {
    const before = rows.map((r) => r.id);
    sortOverviewRows(rows, { sortBy: "stress", direction: "desc" });
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("buildTopicCoverage", () => {
  it("only counts coaches with weight > 0 and separates available coaches", () => {
    const rows = buildMatchingOverviewRows(
      [
        member({ id: "a", matching_scores: { stress: 4, burnout: 1 } }),
        member({
          id: "b",
          available_for_intake: false,
          matching_scores: { stress: 5 },
        }),
        member({ id: "c", active: false, matching_scores: { stress: 3 } }),
        member({ id: "d", matching_scores: { stress: 0 } }),
      ],
      TOPICS
    );

    const coverage = buildTopicCoverage(rows, TOPICS);
    const stress = coverage.find((c) => c.key === "stress");
    const trauer = coverage.find((c) => c.key === "trauer");
    const burnout = coverage.find((c) => c.key === "burnout");

    expect(stress).toMatchObject({
      availableCoachCount: 1,
      totalCoachCount: 3,
      availableWeightSum: 4,
      availableMaxScore: 4,
      coverageLevel: "low",
    });
    expect(burnout).toMatchObject({
      availableCoachCount: 1,
      totalCoachCount: 1,
      availableWeightSum: 1,
    });
    expect(trauer).toMatchObject({
      availableCoachCount: 0,
      totalCoachCount: 0,
      coverageLevel: "none",
    });
  });
});

describe("getCoverageLevel", () => {
  it("classifies coverage by number of available coaches", () => {
    expect(getCoverageLevel(0)).toBe("none");
    expect(getCoverageLevel(1)).toBe("low");
    expect(getCoverageLevel(2)).toBe("ok");
    expect(getCoverageLevel(3)).toBe("ok");
    expect(getCoverageLevel(4)).toBe("strong");
  });
});

describe("sortTopicCoverage", () => {
  it("sorts by available coach count, then weight sum", () => {
    const sorted = sortTopicCoverage([
      { key: "a", label: "A", availableCoachCount: 1, availableWeightSum: 2 },
      { key: "b", label: "B", availableCoachCount: 3, availableWeightSum: 5 },
      { key: "c", label: "C", availableCoachCount: 1, availableWeightSum: 4 },
    ]);

    expect(sorted.map((c) => c.key)).toEqual(["b", "c", "a"]);
  });
});
