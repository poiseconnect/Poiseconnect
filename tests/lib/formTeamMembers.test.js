import { describe, expect, it } from "vitest";
import {
  mergeFormTeamMembers,
  toFormTeamMember,
} from "../../app/lib/formTeamMembers.js";

describe("form team member contract", () => {
  it("serializes only fields needed by the request flow", () => {
    const member = toFormTeamMember({
      id: "coach-1",
      email: "coach@example.invalid",
      active: true,
      available_for_intake: true,
      matching_scores: { stress: 5 },
      profile_name: "Coach One",
      profile_role: "Psychologin",
      profile_calendar_mode: "proposal",
      profile_short: "Kurzprofil",
      profile_keywords: ["stress"],
      profile_preis_std: "150,50",
      profile_preis_ermaessigt: 120,
      paarcoaching: true,
      paarcoaching_preis: 200,
      paarcoaching_dauer_min: 90,
      proposal_earliest_time: "09:00",
      proposal_latest_time: "17:00",
    });

    expect(member).toMatchObject({
      id: "coach-1",
      name: "Coach One",
      role: "Psychologin",
      calendar_mode: "proposal",
      tags: ["stress"],
      preis_std: 150.5,
      paarcoaching: true,
    });
    expect(member).not.toHaveProperty("email");
    expect(member).not.toHaveProperty("active");
    expect(member).not.toHaveProperty("available_for_intake");
    expect(member).not.toHaveProperty("matching_scores");
  });

  it("applies available profile overrides without replacing static matching data", () => {
    const team = [
      {
        id: "coach-1",
        qualificationLevel: 1,
        scores: { stress: 4 },
        calendar_mode: "booking",
        preis_std: 100,
      },
    ];

    const merged = mergeFormTeamMembers(team, [
      {
        id: "coach-1",
        calendar_mode: "proposal",
        preis_std: 150,
        short: null,
      },
    ]);

    expect(merged[0]).toMatchObject({
      calendar_mode: "proposal",
      preis_std: 150,
      qualificationLevel: 1,
      scores: { stress: 4 },
    });
  });
});