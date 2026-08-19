import { describe, expect, it } from "vitest";
import {
  clearCoachDependentFormFields,
  formatTimePreference,
  getProposalConstraintLabel,
  mayConflictWithPreference,
} from "../../app/lib/proposalTimePreference.js";

describe("formatTimePreference", () => {
  it("leere Auswahl -> kein Text", () => {
    expect(formatTimePreference([])).toBeNull();
  });

  it("flexibel -> natürlicher flexibler Text", () => {
    expect(formatTimePreference(["flexibel"])).toBe("zeitlich flexibel bist");
  });

  it("eine Auswahl -> einzelnes Label", () => {
    expect(formatTimePreference(["vormittags"])).toBe("vormittags");
  });

  it("zwei Werte -> Ausgabe mit und", () => {
    expect(formatTimePreference(["vormittags", "nachmittags"])).toBe(
      "vormittags und nachmittags"
    );
  });

  it("drei Werte -> natürliche Aufzählung mit und", () => {
    expect(
      formatTimePreference(["vormittags", "nachmittags", "abends"])
    ).toBe("vormittags, nachmittags und abends");
  });
});

describe("mayConflictWithPreference", () => {
  it("Coach ohne Constraint -> kein Hinweis", () => {
    expect(
      mayConflictWithPreference({
        calendarMode: "proposal",
        earliestTime: null,
        latestTime: null,
        timePreference: ["abends"],
      })
    ).toBe(false);
  });

  it("latest_time 16:00 + Klient flexibel -> normal auswählbar", () => {
    expect(
      mayConflictWithPreference({
        calendarMode: "proposal",
        earliestTime: null,
        latestTime: "16:00",
        timePreference: ["flexibel"],
      })
    ).toBe(false);
  });

  it("latest_time 16:00 + Klient abends -> Hinweis", () => {
    expect(
      mayConflictWithPreference({
        calendarMode: "proposal",
        earliestTime: null,
        latestTime: "16:00",
        timePreference: ["abends"],
      })
    ).toBe(true);
  });

  it("earliest_time 17:00 + Klient vormittags -> Hinweis", () => {
    expect(
      mayConflictWithPreference({
        calendarMode: "proposal",
        earliestTime: "17:00",
        latestTime: null,
        timePreference: ["vormittags"],
      })
    ).toBe(true);
  });

  it("Booking Coach -> Proposal-Constraint wird nicht angewendet", () => {
    expect(
      mayConflictWithPreference({
        calendarMode: "booking",
        earliestTime: null,
        latestTime: "16:00",
        timePreference: ["abends"],
      })
    ).toBe(false);
  });

  it("alte Anfrage ohne Zeitpräferenz -> kein Fehler", () => {
    expect(
      mayConflictWithPreference({
        calendarMode: "proposal",
        earliestTime: null,
        latestTime: "16:00",
        timePreference: undefined,
      })
    ).toBe(false);
  });

  it("null Constraints -> bestehender Flow", () => {
    expect(
      mayConflictWithPreference({
        calendarMode: "proposal",
        earliestTime: null,
        latestTime: null,
        timePreference: null,
      })
    ).toBe(false);
  });
});

describe("getProposalConstraintLabel", () => {
  it("liefert null ohne Constraint", () => {
    expect(
      getProposalConstraintLabel({ earliestTime: null, latestTime: null })
    ).toBeNull();
  });

  it("beschreibt eine Latest-Time-Constraint", () => {
    expect(
      getProposalConstraintLabel({ earliestTime: null, latestTime: "16:00" })
    ).toBe("Termine grundsätzlich bis spätestens 16:00 Uhr");
  });
});

describe("clearCoachDependentFormFields", () => {
  it("löscht coachabhängige Felder, aber keine allgemeinen Formulardaten", () => {
    const form = {
      vorname: "Test",
      anliegen: "Stress",
      structured_time_preference: ["abends"],
      wunschtherapeut: "Babette",
      assigned_therapist_id: "coach-1",
      terminISO: "2026-08-20T10:00:00.000Z",
      terminDisplay: "Do. 10:00",
      preferred_times: "abends",
    };

    const result = clearCoachDependentFormFields(form);

    expect(result.vorname).toBe("Test");
    expect(result.anliegen).toBe("Stress");
    expect(result.structured_time_preference).toEqual(["abends"]);
    expect(result.wunschtherapeut).toBe("");
    expect(result.assigned_therapist_id).toBeNull();
    expect(result.terminISO).toBe("");
    expect(result.terminDisplay).toBe("");
    expect(result.preferred_times).toBe("");
  });
});
