import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  derivePublicTopics,
  filterPublicCoaches,
  isPubliclyVisibleCoach,
  normalizeEducationRole,
  parseEducationCategories,
  toPublicCoachMember,
} from "../../app/lib/publicCoachDirectory.js";

function dbMember(overrides = {}) {
  return {
    id: "coach-1",
    active: true,
    available_for_intake: true,
    profile_name: "Coach One",
    profile_role: "Psychologin, Coach",
    profile_short: "Kurzbeschreibung",
    matching_scores: {
      stress: 4,
      selbstwert_selbstliebe: 0,
    },
    ...overrides,
  };
}

function teamMember(overrides = {}) {
  return {
    id: "coach-1",
    name: "Coach One",
    role: "Psychologin, Coach",
    short: "Fallback short",
    image: "https://example.invalid/coach.jpg",
    video: "https://youtu.be/example",
    email: "coach@example.invalid",
    ics: "https://calendar.example.invalid/basic.ics",
    qualificationLevel: 1,
    booking_enabled: true,
    selected_calendar_id: "calendar-1",
    scores: {
      stress: 3,
      angst_panik: 0,
    },
    ...overrides,
  };
}

describe("public coach visibility", () => {
  it("active=true und available_for_intake=true ist öffentlich verfügbar", () => {
    expect(isPubliclyVisibleCoach(dbMember())).toBe(true);
  });

  it("active=true und available_for_intake=false ist nicht öffentlich", () => {
    expect(isPubliclyVisibleCoach(dbMember({ available_for_intake: false }))).toBe(false);
  });

  it("active=false und available_for_intake=true ist nicht öffentlich", () => {
    expect(isPubliclyVisibleCoach(dbMember({ active: false }))).toBe(false);
  });
});

describe("public education normalization", () => {
  it("Psychologin, Coach ergibt Psycholog:in und Coach", () => {
    expect(parseEducationCategories("Psychologin, Coach")).toEqual([
      "Psycholog:in",
      "Coach",
    ]);
  });

  it("Heilpraktikerin für Psychotherapie wird korrekt normalisiert", () => {
    expect(normalizeEducationRole("Heilpraktikerin für Psychotherapie")).toBe(
      "Heilpraktiker:in für Psychotherapie"
    );
  });

  it("Ärztin (Gynäkologie) ist unter Ärzt:in filterbar", () => {
    expect(normalizeEducationRole("Ärztin (Gynäkologie)")).toBe("Ärzt:in");
  });

  it("mehrere kommaseparierte Rollen werden getrennt und normalisiert", () => {
    expect(
      parseEducationCategories(
        "Coach, Heilpraktikerin für Psychotherapie, Hypnose Coach"
      )
    ).toEqual([
      "Coach",
      "Heilpraktiker:in für Psychotherapie",
      "Hypnose Coach",
    ]);
  });

  it("unbekannte Rolle erzeugt keine öffentliche Filterkategorie", () => {
    expect(normalizeEducationRole("Unbekannte Fantasierolle")).toBe(null);
  });

  it("Psychologe (Test) erzeugt keine öffentliche Filterkategorie", () => {
    expect(normalizeEducationRole("Psychologe (Test)")).toBe(null);
  });
});

describe("public topic derivation", () => {
  it("positiver Themen-Score erzeugt den Topic-Key", () => {
    expect(derivePublicTopics({ stress: 1 })).toContain("stress");
  });

  it("Themen-Score = 0 erzeugt keinen Topic-Key", () => {
    expect(derivePublicTopics({ stress: 0 })).not.toContain("stress");
  });

  it("höhere Themen-Scores bleiben positive Passung ohne Invertierung", () => {
    expect(derivePublicTopics({ stress: 5 })).toEqual(["stress"]);
  });
});

describe("public coach filtering", () => {
  const coaches = [
    {
      id: "a",
      topics: ["stress", "angst_panik"],
      educationCategories: ["Psycholog:in"],
    },
    {
      id: "b",
      topics: ["selbstwert_selbstliebe"],
      educationCategories: ["Coach"],
    },
    {
      id: "c",
      topics: ["trauer"],
      educationCategories: ["Psychotherapeut:in"],
    },
  ];

  it("keine Filter zeigt alle verfügbaren Coaches", () => {
    expect(filterPublicCoaches(coaches).map((coach) => coach.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("ein Thema zeigt passende Coaches", () => {
    expect(
      filterPublicCoaches(coaches, { selectedTopics: ["stress"] }).map(
        (coach) => coach.id
      )
    ).toEqual(["a"]);
  });

  it("mehrere Themen verwenden OR", () => {
    expect(
      filterPublicCoaches(coaches, {
        selectedTopics: ["stress", "selbstwert_selbstliebe"],
      }).map((coach) => coach.id)
    ).toEqual(["a", "b"]);
  });

  it("eine Ausbildung zeigt passende Coaches", () => {
    expect(
      filterPublicCoaches(coaches, {
        selectedEducations: ["Psychotherapeut:in"],
      }).map((coach) => coach.id)
    ).toEqual(["c"]);
  });

  it("mehrere Ausbildungen verwenden OR", () => {
    expect(
      filterPublicCoaches(coaches, {
        selectedEducations: ["Psycholog:in", "Coach"],
      }).map((coach) => coach.id)
    ).toEqual(["a", "b"]);
  });

  it("Thema und Ausbildung verwenden AND zwischen Gruppen", () => {
    expect(
      filterPublicCoaches(coaches, {
        selectedTopics: ["stress"],
        selectedEducations: ["Coach"],
      }).map((coach) => coach.id)
    ).toEqual([]);
  });

  it("keine Kombination ergibt eine leere Liste", () => {
    expect(
      filterPublicCoaches(coaches, {
        selectedTopics: ["burnout"],
        selectedEducations: ["Ärzt:in"],
      })
    ).toEqual([]);
  });
});

describe("public API serialization", () => {
  it("gibt nur öffentliche Felder aus", () => {
    const publicMember = toPublicCoachMember(teamMember(), dbMember());

    expect(publicMember).toMatchObject({
      id: "coach-1",
      name: "Coach One",
      role: "Psychologin, Coach",
      educationCategories: ["Psycholog:in", "Coach"],
      short: "Kurzbeschreibung",
      image: "https://example.invalid/coach.jpg",
      video: "https://youtu.be/example",
      topics: ["stress"],
      requestUrl: "https://app.mypoise.de/?therapist=Coach+One",
    });

    expect(publicMember).not.toHaveProperty("email");
    expect(publicMember).not.toHaveProperty("ics");
    expect(publicMember).not.toHaveProperty("qualificationLevel");
    expect(publicMember).not.toHaveProperty("booking_enabled");
    expect(publicMember).not.toHaveProperty("selected_calendar_id");
    expect(publicMember).not.toHaveProperty("scores");
    expect(publicMember).not.toHaveProperty("matching_scores");
    expect(publicMember).not.toHaveProperty("calendar_mode");
  });

  it("erzeugt eine sichere absolute Anfrage-URL für Namen mit Sonderzeichen", () => {
    const publicMember = toPublicCoachMember(
      teamMember({ name: "Ånne & Co" }),
      dbMember({ profile_name: "Ånne & Co" })
    );

    expect(publicMember.requestUrl).toBe(
      "https://app.mypoise.de/?therapist=%C3%85nne+%26+Co"
    );
  });

  it("nicht sichtbare Coaches werden nicht serialisiert", () => {
    expect(
      toPublicCoachMember(teamMember(), dbMember({ available_for_intake: false }))
    ).toBe(null);
  });
});

describe("request form boundary", () => {
  it("uses a separate app-specific team contract instead of public team data", () => {
    const pageClientSource = readFileSync(
      new URL("../../app/page-client.jsx", import.meta.url),
      "utf8"
    );

    expect(pageClientSource).not.toContain("/api/public-team-members");
    expect(pageClientSource).toContain("/api/form-team-members");
  });
});
