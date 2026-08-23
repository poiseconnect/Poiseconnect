import { describe, expect, it } from "vitest";
import {
  clearCoachDependentFormFields,
  formatTimePreference,
  getProposalConstraintLabel,
  hasTimePreference,
  mayConflictWithPreference,
  resolveCalendarMode,
  resolveCoachSelectionResumeStep,
  resolveResumeStep,
  shouldUseLoadedRequestResumeDecision,
} from "../../app/lib/proposalTimePreference.js";
import {
  getInvalidNewClientCoachIds,
  isCoachAvailableForNewClient,
} from "../../app/lib/intakeAvailability.js";

describe("resolveCalendarMode", () => {
  it("profil proposal bleibt proposal trotz aktivierter Booking-Settings", () => {
    expect(resolveCalendarMode("proposal", "booking")).toBe("proposal");
  });

  it("profil booking ergibt booking", () => {
    expect(resolveCalendarMode("booking", "proposal")).toBe("booking");
  });

  it("profil ics ergibt ics", () => {
    expect(resolveCalendarMode("ics", "booking")).toBe("ics");
  });

  it("fehlender Profilmodus nutzt den statischen Legacy-Modus", () => {
    expect(resolveCalendarMode(null, "booking")).toBe("booking");
  });

  it("fehlende Modi fallen auf proposal zurück", () => {
    expect(resolveCalendarMode(null, null)).toBe("proposal");
  });

  it("ungültiger Profilmodus nutzt den gültigen Legacy-Modus", () => {
    expect(resolveCalendarMode("unknown", "ics")).toBe("ics");
  });
});

describe("intake availability", () => {
  const availableProposalCoach = {
    id: "proposal-1",
    profile_name: "Proposal Coach",
    active: true,
    available_for_intake: true,
  };

  const availableBookingCoach = {
    id: "booking-1",
    profile_name: "Booking Coach",
    active: true,
    available_for_intake: true,
  };

  it("verfügbarer Coach ist auswählbar, unabhängig vom Calendar Mode", () => {
    expect(
      isCoachAvailableForNewClient({
        member: { ...availableProposalCoach, calendar_mode: "proposal" },
      })
    ).toBe(true);
    expect(
      isCoachAvailableForNewClient({
        member: { ...availableBookingCoach, calendar_mode: "booking" },
      })
    ).toBe(true);
  });

  it("nicht verfügbare oder inactive Coaches sind nicht auswählbar", () => {
    expect(
      isCoachAvailableForNewClient({
        member: { ...availableProposalCoach, available_for_intake: false },
      })
    ).toBe(false);
    expect(
      isCoachAvailableForNewClient({
        member: { ...availableBookingCoach, active: false },
      })
    ).toBe(false);
  });

  it("schließt ausgeschlossene Coaches aus", () => {
    expect(
      isCoachAvailableForNewClient({
        member: availableProposalCoach,
        excludedTherapeuten: ["proposal-1"],
      })
    ).toBe(false);
    expect(
      isCoachAvailableForNewClient({
        member: availableBookingCoach,
        excludedTherapeuten: ["Booking Coach"],
      })
    ).toBe(false);
  });

  it("Proposal-Zeitgrenzen beeinflussen die Aufnahmeentscheidung nicht", () => {
    expect(
      isCoachAvailableForNewClient({
        member: {
          ...availableProposalCoach,
          proposal_earliest_time: "18:00",
          proposal_latest_time: "20:00",
        },
      })
    ).toBe(true);
  });

  it("Servervalidierung lehnt unbekannte, inaktive und nicht verfügbare IDs ab", () => {
    expect(
      getInvalidNewClientCoachIds({
        selectedIds: ["proposal-1", "missing", "booking-1"],
        members: [
          availableProposalCoach,
          { ...availableBookingCoach, available_for_intake: false },
        ],
      })
    ).toEqual(["missing", "booking-1"]);
  });

  it("eine Änderung auf nicht verfügbar wird beim erneuten Servercheck abgelehnt", () => {
    expect(
      getInvalidNewClientCoachIds({
        selectedIds: ["proposal-1"],
        members: [{ ...availableProposalCoach, available_for_intake: false }],
      })
    ).toEqual(["proposal-1"]);
  });
});

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

describe("hasTimePreference", () => {
  it("leeres Array -> false", () => {
    expect(hasTimePreference([])).toBe(false);
  });

  it("null/undefined -> false (alte Anfragen)", () => {
    expect(hasTimePreference(null)).toBe(false);
    expect(hasTimePreference(undefined)).toBe(false);
  });

  it("gültiger Wert -> true", () => {
    expect(hasTimePreference(["abends"])).toBe(true);
  });
});

describe("resolveResumeStep", () => {
  it("kein resume-Parameter -> kein Zielstep", () => {
    expect(
      resolveResumeStep({ resume: null, hasAnfrageId: true, timePreference: [] })
    ).toBeNull();
  });

  it("Resume zur Coach-Auswahl (n=8) ohne structured_time_preference -> Step 7 zuerst", () => {
    expect(
      resolveResumeStep({
        resume: "8",
        hasAnfrageId: true,
        timePreference: [],
      })
    ).toBe(7);
  });

  it("Resume zur Coach-Auswahl (n=8) mit vorhandener Präferenz -> keine erneute Abfrage", () => {
    expect(
      resolveResumeStep({
        resume: "8",
        hasAnfrageId: true,
        timePreference: ["vormittags"],
      })
    ).toBe(8);
  });

  it("resume=admin ohne Präferenz -> Step 7", () => {
    expect(
      resolveResumeStep({ resume: "admin", hasAnfrageId: true, timePreference: [] })
    ).toBe(7);
  });

  it("resume=admin mit Präferenz -> Step 8", () => {
    expect(
      resolveResumeStep({
        resume: "admin",
        hasAnfrageId: true,
        timePreference: ["abends"],
      })
    ).toBe(8);
  });

  it("resume=5 ohne Anfrage-ID -> Step 7 (keine Präferenz ladbar)", () => {
    expect(
      resolveResumeStep({
        resume: "5",
        hasAnfrageId: false,
        timePreference: ["abends"],
      })
    ).toBe(7);
  });

  it("Resume ohne Coach-Auswahl (n=10) -> keine unnötige Verfügbarkeitsabfrage", () => {
    expect(
      resolveResumeStep({ resume: "10", hasAnfrageId: true, timePreference: [] })
    ).toBe(10);
  });

  it("sonstiger numerischer Resume-Wert bleibt unverändert", () => {
    expect(
      resolveResumeStep({ resume: "3", hasAnfrageId: true, timePreference: [] })
    ).toBe(3);
  });
});

describe("single-source resume gate", () => {
  it("resume=8 mit geladener Anfrage und fehlender Präferenz -> Step 7", () => {
    expect(
      resolveCoachSelectionResumeStep({
        resume: "8",
        hasAnfrageId: true,
        timePreference: null,
      })
    ).toBe(7);
  });

  it("resume=8 mit geladener Anfrage und vorhandener Präferenz -> Step 8", () => {
    expect(
      resolveCoachSelectionResumeStep({
        resume: "8",
        hasAnfrageId: true,
        timePreference: ["abends"],
      })
    ).toBe(8);
  });

  it("resume=admin mit fehlender Präferenz -> Step 7", () => {
    expect(
      resolveCoachSelectionResumeStep({
        resume: "admin",
        hasAnfrageId: true,
        timePreference: [],
      })
    ).toBe(7);
  });

  it("resume=5 mit fehlender Präferenz -> Step 7", () => {
    expect(
      resolveCoachSelectionResumeStep({
        resume: "5",
        hasAnfrageId: true,
        timePreference: undefined,
      })
    ).toBe(7);
  });

  it("resume=10 darf niemals durch den Coach-Gate ersetzt werden", () => {
    expect(
      resolveCoachSelectionResumeStep({
        resume: "10",
        hasAnfrageId: true,
        timePreference: [],
      })
    ).toBeNull();
  });

  it("bei vorhandener Anfrage-ID darf der generische Resume-Fallback nicht erneut entscheiden", () => {
    expect(
      shouldUseLoadedRequestResumeDecision({
        resume: "8",
        hasAnfrageId: true,
      })
    ).toBe(true);
    expect(
      shouldUseLoadedRequestResumeDecision({
        resume: "8",
        hasAnfrageId: false,
      })
    ).toBe(false);
  });
});
