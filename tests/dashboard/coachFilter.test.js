import { describe, expect, it } from "vitest";
import {
  canUseMessagingForRequest,
  matchesCoachFilter,
} from "../../app/dashboard/coachFilter.js";

const coachId = "coach-a";
const otherCoachId = "coach-b";
const request = {
  id: "request-1",
  assigned_therapist_id: coachId,
  wunschtherapeut: "Unrelated legacy name",
};

function matches(tab, therapistId, overrides = {}) {
  return matchesCoachFilter({
    request: { ...request, ...overrides },
    tab,
    therapistId,
    sessions: overrides.sessions || [],
  });
}

describe("matchesCoachFilter", () => {
  it.each(["unbearbeitet", "erstgespraech", "beendet"])(
    "%s matches assigned therapist ID",
    (tab) => {
      expect(matches(tab, coachId)).toBe(true);
    }
  );

  it.each(["unbearbeitet", "erstgespraech", "beendet"])(
    "%s rejects a different assigned therapist ID",
    (tab) => {
      expect(matches(tab, otherCoachId)).toBe(false);
    }
  );

  it("shows active requests when a session belongs to the selected coach", () => {
    expect(
      matches("aktiv", coachId, {
        assigned_therapist_id: otherCoachId,
        sessions: [{ therapist_id: coachId }],
      })
    ).toBe(true);
  });

  it("hides active requests without an assigned or session match", () => {
    expect(
      matches("aktiv", coachId, {
        assigned_therapist_id: otherCoachId,
        sessions: [{ therapist_id: "coach-c" }],
      })
    ).toBe(false);
  });

  it.each(["admin_pruefen", "admin_vorschlaege_gesendet"])(
    "%s is not affected by the normal coach filter",
    (tab) => {
      expect(matches(tab, coachId, {
        assigned_therapist_id: otherCoachId,
      })).toBe(true);
    }
  );

  it("does not use a coincidentally matching display name", () => {
    expect(
      matches("unbearbeitet", coachId, {
        assigned_therapist_id: otherCoachId,
        wunschtherapeut: "Coach A",
      })
    ).toBe(false);
  });

  it("matches equivalent string and ID representations", () => {
    expect(matches("erstgespraech", String(coachId))).toBe(true);
  });

  it("does not filter when all coaches are selected", () => {
    expect(matches("unbearbeitet", "alle", {
      assigned_therapist_id: otherCoachId,
    })).toBe(true);
  });

  it("does not filter unknown tabs", () => {
    expect(matches("papierkorb", coachId, {
      assigned_therapist_id: otherCoachId,
    })).toBe(true);
  });
});

describe("canUseMessagingForRequest", () => {
  function canUse(status, overrides = {}) {
    return canUseMessagingForRequest({
      request: { ...request, status, ...overrides },
      role: overrides.role || "therapist",
      therapistId: overrides.therapistId || coachId,
    });
  }

  it.each(["active", "termin_bestaetigt", "termin_neu", "future_status"])(
    "permits assigned therapists to use messaging for %s",
    (status) => {
      expect(canUse(status)).toBe(true);
    }
  );

  it("rejects another therapist", () => {
    expect(canUse("active", { therapistId: otherCoachId })).toBe(false);
  });

  it("rejects requests without an assigned therapist", () => {
    expect(canUse("active", { assigned_therapist_id: null })).toBe(false);
  });

  it("rejects admin access", () => {
    expect(canUse("active", { role: "admin" })).toBe(false);
  });
});
