"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import { teamData } from "./lib/teamData";


 
// -------------------------------------
// Helfer & Konfiguration
// -------------------------------------

const getTherapistInfo = (name) =>
  teamData.find((t) => t.name === name) || {};

// ---- RED-FLAGS ----
const RED_FLAGS = [
  "suizid",
  "selbstmord",
  "selbstverletzung",
  "ritzen",
  "magersucht",
  "anorexie",
  "bulim",
  "erbrechen",
  "binge",
  "essstörung",
  "essstoerung",
  "borderline",
  "svv",
];
const THEMEN = [
  {
    key: "partnerschaft_beziehung",
    label: "Partnerschaft & Beziehung",
    description:
      "Trennung, Kinderwunsch, toxische Beziehungen, Konflikte, Freundschaften",
  },
  {
    key: "beruf_ziele_orientierung",
    label: "Beruf, Ziele & Orientierung",
    description:
      "Jobwechsel, Beförderung, Umzug, Orientierungslosigkeit",
  },
  {
    key: "emotionales_essen",
    label: "Emotionales Essen",
    description:
      "Fressanfälle, kontrolliertes Essen, Emotionsregulation",
  },
  {
    key: "depressive_verstimmung",
    label: "Depressive Verstimmung",
    description:
      "Erschöpfung, Antriebslosigkeit, Schlafstörungen, innere Leere",
  },
  {
    key: "stress",
    label: "Stress",
    description:
      "Schlafprobleme, körperliche Beschwerden, Gedankenkreisen",
  },
  {
    key: "burnout",
    label: "Burnout",
    description:
      "Überforderung, Leistungsabfall, Erschöpfung",
  },
  {
    key: "selbstwert_selbstliebe",
    label: "Selbstwert & Selbstliebe",
    description:
      "Selbstvertrauen, innere Kritiker, Gefühl nicht gut genug zu sein",
  },
  {
    key: "angst_panik",
    label: "Angst & Panikattacken",
    description:
      "Herzrasen, Atemnot, Prüfungsangst, Panik",
  },
  {
    key: "krankheit_psychosomatik",
    label: "Krankheit & Psychosomatik",
    description:
      "Umgang mit Diagnosen, Körper & Psyche stärken",
  },
  {
    key: "angehoerige",
    label: "Angehörige",
    description:
      "Grenzen setzen, Selbstfürsorge",
  },
  {
    key: "sexualitaet",
    label: "Sexualität",
    description:
      "Lustlosigkeit, Libido, Schmerzen, Orientierung",
  },
  {
    key: "trauer",
    label: "Trauer",
    description:
      "Verlust, Fehlgeburt, Abschied",
  },
];



const isRedFlag = (t) =>
  t && RED_FLAGS.some((x) => t.toLowerCase().includes(x));

// Matching-Gewichte
const TAG_WEIGHTS = {
  trauma: 5,
  ptbs: 5,
  essstörung: 5,
  essstoerung: 5,
  anorexie: 5,
  bulimie: 5,
  bulimia: 5,

  binge: 4,
  zwang: 4,
  panik: 3,
  angst: 3,
  depression: 3,

  selbstwert: 2,
  burnout: 2,
  erschöpfung: 2,

  beziehung: 1,
  partnerschaft: 1,
  stress: 1,
  arbeit: 1,
  studium: 0.5,
};

// ---- Format ----
const formatDate = (d) =>
  d.toLocaleDateString("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });


const formatTime = (d) =>
  d.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });
// ✅ Slot-Länge für Erstgespräch (30 Minuten)
const SLOT_MINUTES = 30;
// ----------------------
// ----------------------
// ICS PARSER
// ----------------------
function parseICSDate(line) {
  if (!line) return null;

  // akzeptiert:
  // DTSTART:20260305T100000
  // DTSTART;TZID=Europe/Vienna:20260305T100000
  const match = line.match(/:(\d{8}T\d{6})/);
  if (!match) return null;

  const raw = match[1];

  const iso =
    raw.slice(0, 4) + "-" +
    raw.slice(4, 6) + "-" +
    raw.slice(6, 8) + "T" +
    raw.slice(9, 11) + ":" +
    raw.slice(11, 13) + ":" +
    raw.slice(13, 15);

  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ----------------------
// ICS → Slots
// ----------------------
async function loadIcsSlots(icsUrl, daysAhead = null) {
  const decodedUrl = decodeURIComponent(icsUrl);

  const res = await fetch(
    `/api/ics?url=${encodeURIComponent(decodedUrl)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("ICS proxy failed (" + res.status + ")");
  }

  const text = await res.text();

  const now = new Date();
  now.setSeconds(0, 0);

  const until = daysAhead
    ? new Date(now.getTime() + daysAhead * 86400000)
    : null;

  const events = text.split(/BEGIN:VEVENT/i).slice(1);
  const slots = [];

  for (const ev of events) {
    const lines = ev.split(/\r?\n/);

    const startLine = lines.find((l) => l.startsWith("DTSTART"));
    const endLine = lines.find((l) => l.startsWith("DTEND"));

    if (!startLine || !endLine) continue;
const start = parseICSDate(startLine);
const end = parseICSDate(endLine);

if (!start || !end) {
  continue;
}

if (start >= end) {
  console.warn("⛔ START >= END", {
    rawStart: startLine,
    rawEnd: endLine,
    start,
    end,
  });
  continue;
}

    // 🔑 WICHTIG: Startpunkt nach vorne schieben
    let t = start < now ? new Date(now) : new Date(start);

    while (t < end) {
      const tEnd = new Date(t.getTime() + SLOT_MINUTES * 60000);

      if (tEnd > end) break;

      slots.push({ start: new Date(t) });
      t = new Date(t.getTime() + SLOT_MINUTES * 60000);
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}
// ----------------------
// CHECK: Therapeut hat freie Slots?
// ----------------------
async function therapistHasFreeSlots(therapist) {
  if (!therapist?.ics) return false;

  try {
    const slots = await loadIcsSlots(therapist.ics, 21);
    return slots.length > 0;
  } catch (e) {
    console.error("ICS error for", therapist?.name, e);
    return false;
  }
}
// --------------------------------------------------
// MATCHING – Checkboxen + Freitext
// --------------------------------------------------
function matchTeam(themen, text, team) {
  return [...team]
    .map((m) => {
      let score = 0;

      // 1️⃣ Checkboxen = starkes Signal
      themen.forEach((t) => {
        if (m.tags?.includes(t)) score += 5;
      });

      // 2️⃣ Freitext = schwaches Zusatzsignal
      if (text) {
        const words = text.toLowerCase().split(/\W+/);
        words.forEach((w) => {
          if (m.tags?.some((t) => t.includes(w))) {
            score += 1;
          }
        });
      }

      return { ...m, _score: score };
    })
    .filter((m) => m._score > 0)
    .sort((a, b) => b._score - a._score);
}
// --------------------------------------------------
// TOGGLE THEMA (Checkbox-Handling)
// --------------------------------------------------
function toggleThema(key, setForm) {
  setForm((prev) => {
    const exists = prev.themen.includes(key);

    return {
      ...prev,
      themen: exists
        ? prev.themen.filter((t) => t !== key)
        : [...prev.themen, key],
    };
  });
}

// --------------------------------------------------
// PAGE COMPONENT
// --------------------------------------------------
export default function PageClient() {
  const today = new Date();
  const searchParams = useSearchParams();
  const resumeMode = searchParams.get("resume");
  const therapistFromUrl = searchParams.get("therapist") || "";

  const [teamMembers, setTeamMembers] = useState(teamData);

  const therapistIdFromUrl =
    teamMembers.find(
      (t) => String(t.name).trim() === String(therapistFromUrl).trim()
    )?.id || null;

  console.log(
    "BROWSER TEAMDATA",
    teamMembers.map((t) => ({
      name: t.name,
      id: t.id,
      calendar_mode: t.calendar_mode,
      email: t.email,
    }))
  );
// ✅ Admin-Flow, wenn:
// - resume=admin (dein Admin-Link)
// - resume=5 oder resume=8 (deine bestehenden Buttons/Links)
// - ODER wenn die DB admin_therapeuten liefert (Sicherheits-Fallback)


const anfrageId =
  searchParams.get("anfrageId") || searchParams.get("rid");

  const [step, setStep] = useState(0);
  const [subStep9, setSubStep9] = useState(0);
  const totalSteps = 12;
  
const [draftRequestId, setDraftRequestId] = useState(null);
const [bookingToken, setBookingToken] = useState(null);
const [savingDraft, setSavingDraft] = useState(false);
const [submitting, setSubmitting] = useState(false);
 
// 🔑 WICHTIG: dieser State hat gefehlt
const [assignedTherapistId, setAssignedTherapistId] = useState(
  therapistIdFromUrl || null
);

const [form, setForm] = useState({
  admin_therapeuten: [],
  themen: [],
  anliegen: "",
  leidensdruck: "",
  verlauf: "",
  diagnose: "",
  ziel: "",
  wunschtherapeut: "",
  vorname: "",
  nachname: "",
  email: "",
  telefon: "",
  adresse: "",
  plz_ort: "",
  strasse_hausnr: "",
  geburtsdatum: "",
  beschaeftigungsgrad: "",
  check_datenschutz: false,
  check_online_setting: false,
  check_gesundheit: false,
  terminISO: "",
  terminDisplay: "",
  assigned_therapist_id: null,
});
const calendarMode = useMemo(() => {
  const effectiveTherapistId =
    assignedTherapistId ||
    form.assigned_therapist_id ||
    therapistIdFromUrl ||
    null;

  let therapist = null;

  if (effectiveTherapistId) {
therapist = teamMembers.find(
 (x) => String(x.id) === String(effectiveTherapistId)
    );
  }

  if (!therapist && form.wunschtherapeut) {
therapist = teamMembers.find(
 (x) => String(x.name).trim() === String(form.wunschtherapeut).trim()
    );
  }

  if (!therapist && therapistFromUrl) {
therapist = teamMembers.find(
 (x) => String(x.name).trim() === String(therapistFromUrl).trim()
    );
  }

  console.log("🧪 CALENDAR MODE CHECK", {
    assignedTherapistId,
    formAssignedTherapistId: form.assigned_therapist_id,
    therapistIdFromUrl,
    therapistFromUrl,
    formWunschtherapeut: form.wunschtherapeut,
    effectiveTherapistId,
    foundTherapist: therapist?.name,
    foundMode: therapist?.calendar_mode,
  });

  return therapist?.calendar_mode || "proposal";
}, [
  assignedTherapistId,
  form.assigned_therapist_id,
  form.wunschtherapeut,
  therapistIdFromUrl,
  therapistFromUrl,
]);
  const isAdminResume =
  resumeMode === "admin" ||
  resumeMode === "5" ||
  resumeMode === "8" ||
  (Array.isArray(form.admin_therapeuten) && form.admin_therapeuten.length > 0);

  // Validierungs-Fehler für Step "Kontaktdaten"
  const [errors, setErrors] = useState({});

// STEP 8 – Verfügbarkeit
const [availableTherapists, setAvailableTherapists] = useState([]);
const [loadingAvailability, setLoadingAvailability] = useState(false);

// STEP 10 – Termine
const [slots, setSlots] = useState([]);
const [loadingSlots, setLoadingSlots] = useState(false);
const [slotsError, setSlotsError] = useState("");
const [selectedDay, setSelectedDay] = useState(null);
const [blockedOldTerminISO, setBlockedOldTerminISO] = useState("");
  const [bookingWindowDays, setBookingWindowDays] = useState(21);
const [dbMatchingScores, setDbMatchingScores] = useState({});
 useEffect(() => {
  let isMounted = true;

  async function loadPublicTeamMembers() {
    try {
      const res = await fetch("/api/public-team-members", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("PUBLIC TEAM MEMBERS LOAD ERROR:", json);
        return;
      }

      if (isMounted && Array.isArray(json.members)) {
        setTeamMembers(json.members);
      }
    } catch (err) {
      console.error("PUBLIC TEAM MEMBERS LOAD ERROR:", err);
    }
  }

  loadPublicTeamMembers();

  return () => {
    isMounted = false;
  };
}, []);
  // -------------------------------------
  // Matching – Team-Sortierung nach Tags
  // -------------------------------------
  const sortedTeam = useMemo(() => {
if (!form.anliegen) return teamMembers || [];
   
    const words = form.anliegen
      .toLowerCase()
      .split(/[\s,.;!?]+/)
      .filter(Boolean);

return [...teamMembers].sort((a, b) => {
 const score = (member) =>
        member.tags?.reduce((sum, tag) => {
          tag = tag.toLowerCase();
          const matches = words.some((w) => tag.includes(w));
          if (!matches) return sum;
          const weight = TAG_WEIGHTS[tag] ?? 1;
          return sum + weight;
        }, 0) || 0;

      return score(b) - score(a);
    });
}, [form.anliegen, teamMembers]);
 
  // Volljährigkeit
  const isAdult = (d) => {
    const birth = new Date(d);
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    return age > 18 || (age === 18 && m >= 0);
  };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);
  // -------------------------------------
// -------------------------------------
// MATCHING – Checkboxen + Freitext
// -------------------------------------

// Ableitung Ausbildung aus role (role = Ausbildung)
const ROLE_TO_AUSBILDUNG = (role = "") => {
const r = (role || "").toLowerCase();


  if (r.includes("klinisch")) return "klinischer_psychologe";
  if (r.includes("psychotherapeut")) return "psychotherapeut";
  if (r.includes("heilpraktiker")) return "heilpraktiker_psychotherapie";
  if (r.includes("coach")) return "coach";

  return null;
};

const AUSBILDUNGS_BONUS = {
  klinischer_psychologe: {
    depressive_verstimmung: 2,
    angst_panik: 2,
    krankheit_psychosomatik: 2,
  },
  psychotherapeut: {
    depressive_verstimmung: 2,
    angst_panik: 2,
  },
  heilpraktiker_psychotherapie: {
    angst_panik: 1,
    stress: 1,
  },
  coach: {
    beruf_ziele_orientierung: 2,
    selbstwert_selbstliebe: 2,
    partnerschaft_beziehung: 1,
  },
};

const matchedTeam = useMemo(() => {
return [...teamMembers]
 .map((m) => {
      let score = 0;

      const dbScores = dbMatchingScores[String(m.id)] || {};
      const fallbackScores = m.scores || {};

      form.themen.forEach((t) => {
        const basisScore =
          dbScores[t] ?? fallbackScores[t] ?? 0;

        score += Number(basisScore) || 0;

        const ausbildung = ROLE_TO_AUSBILDUNG(m.role);
        score += AUSBILDUNGS_BONUS?.[ausbildung]?.[t] ?? 0;
      });

      const q = m.qualificationLevel ?? 0;
      score += q * 0.5;

      return {
        ...m,
        _score: score,
      };
    })
    .sort((a, b) => b._score - a._score);
}, [form.themen, dbMatchingScores, teamMembers]);



  // -------------------------------------
// -------------------------------------
const step8Members = useMemo(() => {
  // ⛔️ Solange Verfügbarkeiten noch laden → KEINE LISTE
  if (loadingAvailability) {
    return [];
  }

  let base = matchedTeam;

  // 🛂 Admin-Filter (wie bisher)
  if (
    isAdminResume &&
    Array.isArray(form.admin_therapeuten) &&
    form.admin_therapeuten.length > 0
  ) {
    const adminList = form.admin_therapeuten
      .map((v) => String(v).trim())
      .filter(Boolean);

    const adminUsesEmail = adminList.some((v) => v.includes("@"));

    base = base.filter((m) => {
      if (adminUsesEmail) {
        return adminList.includes(String(m.email).trim());
      }
      return adminList.includes(String(m.name).trim());
    });
  }

  // 🚫 Excluded
  if (
    Array.isArray(form.excluded_therapeuten) &&
    form.excluded_therapeuten.length > 0
  ) {
    base = base.filter(
      (m) => !form.excluded_therapeuten.includes(m.name)
    );
  }

  // ✅ NUR THERAPEUT:INNEN MIT VERFÜGBARKEIT
const filtered = base.filter((m) => {
  const ok = m.id && availableTherapists.includes(m.id);

  console.log("🧪 STEP 8 CHECK:", {
    name: m.name,
    id: m.id,
    inAvailable: availableTherapists.includes(m.id),
  });

  return ok;
});

console.log(
  "🧪 STEP 8 FINAL MEMBERS:",
  filtered.map((m) => m.name)
);

return filtered.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
}, [
  matchedTeam,
  availableTherapists,
  loadingAvailability,
  form.admin_therapeuten,
  form.excluded_therapeuten,
  isAdminResume,
]);






  // ----------------------------
// Validierung Step "Kontaktdaten"
// ----------------------------
function validateClientData(form) {
  const newErrors = {};

  if (!form.vorname?.trim()) {
    newErrors.vorname = "Bitte Vornamen eingeben.";
  }

  if (!form.nachname?.trim()) {
    newErrors.nachname = "Bitte Nachnamen eingeben.";
  }

  if (!form.email?.trim()) {
    newErrors.email = "Bitte E-Mail eingeben.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    newErrors.email = "Bitte eine gültige E-Mail-Adresse eingeben.";
  }

  if (!form.telefon?.trim()) {
    newErrors.telefon = "Bitte Telefonnummer eingeben.";
  }

  // ✅ Adresse besteht aus 2 Feldern
  if (!form.strasse_hausnr?.trim() || !form.plz_ort?.trim()) {
    newErrors.adresse = "Bitte Adresse eingeben.";
  }

  if (!form.geburtsdatum?.trim()) {
    newErrors.geburtsdatum = "Bitte Geburtsdatum eingeben.";
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}

// -------------------------------------
// -------------------------------------
// LOAD EXISTING REQUEST + RESUME LOGIC (🔥 ZENTRAL)
// -------------------------------------
useEffect(() => {
  if (!anfrageId) return;

  const params = new URLSearchParams(window.location.search);
  const resume = params.get("resume");

  let isMounted = true;

  async function loadExistingRequest() {
    try {
      const res = await fetch(
        `/api/public-request?id=${encodeURIComponent(anfrageId)}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error("LOAD ANFRAGE BY ID ERROR", json);
        return;
      }

      const data = json.request;
      if (!data || !isMounted) return;

      console.log("✅ LOADED EXISTING REQUEST", data);

      const rawOld =
        data?.terminISO ||
        data?.termin_iso ||
        data?.terminISO_erstgespraech ||
        data?.bevorzugte_zeit ||
        "";

      let oldIso = "";
      if (rawOld) {
        const d = new Date(rawOld);
        oldIso = Number.isNaN(d.getTime())
          ? String(rawOld)
          : d.toISOString();
      }

      setBlockedOldTerminISO(oldIso);

      let adminTherapeuten = data.admin_therapeuten;
      if (typeof adminTherapeuten === "string") {
        try {
          adminTherapeuten = JSON.parse(adminTherapeuten);
        } catch {
          adminTherapeuten = [];
        }
      }
      if (!Array.isArray(adminTherapeuten)) adminTherapeuten = [];
setForm((prev) => ({
  ...prev,
  ...data,
  assigned_therapist_id: data.assigned_therapist_id || null,
  admin_therapeuten: adminTherapeuten,
}));

setDraftRequestId(data.id || null);
setBookingToken(data.booking_token || null);

const fallbackTherapistId =
  data.assigned_therapist_id ||
  therapistIdFromUrl ||
  teamMembers.find(
    (t) => String(t.name).trim() === String(data.wunschtherapeut || "").trim()
  )?.id ||
  null;

setAssignedTherapistId(fallbackTherapistId);

      if (resume === "admin") {
        setStep(8);
        setSelectedDay(null);
        return;
      }

      const n = parseInt(resume, 10);

      if (!Number.isNaN(n)) {
        if (n === 5) {
          setStep(8);
          setSelectedDay(null);
          setForm((prev) => ({
            ...prev,
            terminISO: "",
            terminDisplay: "",
          }));
          return;
        }

        if (n === 10) {
          setStep(10);
          setSelectedDay(null);
          setForm((prev) => ({
            ...prev,
            terminISO: "",
            terminDisplay: "",
          }));
          return;
        }

        setStep(n);
      }
    } catch (err) {
      console.error("LOAD ANFRAGE FETCH ERROR", err);
    }
  }

  loadExistingRequest();

  return () => {
    isMounted = false;
  };
}, [anfrageId, therapistFromUrl, therapistIdFromUrl]);
 // -------------------------------------
// Resume-Flow (NUR STEP STEUERN, KEINE DATEN ÄNDERN)
// -------------------------------------
useEffect(() => {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const resume = params.get("resume");
  if (!resume) return;

  let targetStep = null;
  const n = parseInt(resume, 10);

  if (!Number.isNaN(n)) {
    if (n === 5) targetStep = 8;
    else if (n === 10) targetStep = 10;
    else targetStep = n;
  } else if (resume === "admin") {
    targetStep = 8;
  }

  if (targetStep === null) return;

  setSelectedDay(null);
  setStep(targetStep);

  // ❌ URL HIER NICHT mehr aufräumen
}, []);

  // -------------------------------------
// -------------------------------------
// STEP 8 – Verfügbarkeit der Therapeut:innen laden
// -------------------------------------
// -------------------------------------
// -------------------------------------
// AVAILABILITY – EINMAL BEIM PAGE LOAD
// -------------------------------------
useEffect(() => {
  let isMounted = true;

  async function loadAvailability() {
    setLoadingAvailability(true);

    try {
      const result = [];

      const res = await fetch("/api/public-availability", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("PUBLIC AVAILABILITY ERROR:", json);
        if (isMounted) setAvailableTherapists([]);
        return;
      }

      const members = json.members || [];
      const bookingSettings = json.bookingSettings || [];
      const matchingScoresMap = {};

members.forEach((m) => {
  matchingScoresMap[String(m.id)] = m.matching_scores || {};
});

if (isMounted) {
  setDbMatchingScores(matchingScoresMap);
}

      console.log("SUPABASE MEMBERS", members);
      console.log("SUPABASE BOOKING SETTINGS", bookingSettings);

      const membersMap = new Map(
        members.map((m) => [String(m.id), m])
      );

      const bookingMap = new Map(
        bookingSettings.map((b) => [
          String(b.therapist_id),
          !!b.booking_enabled,
        ])
      );

for (const therapist of teamMembers) {
 if (!therapist.id) continue;

        const dbMember = membersMap.get(String(therapist.id)) || null;

        console.log("CHECK THERAPIST", {
          name: therapist.name,
          id: therapist.id,
          dbMember,
          calendar_mode: therapist.calendar_mode,
          booking_enabled: bookingMap.get(String(therapist.id)),
        });

        const intakeAllowed =
          dbMember == null
            ? true
            : dbMember.active === false
            ? false
            : !!dbMember.available_for_intake;

        if (!intakeAllowed) {
          console.log("⛔ NOT AVAILABLE:", therapist.name);
          continue;
        }

        let hasAvailability = false;
        const mode = String(therapist.calendar_mode || "").toLowerCase();

        if (mode === "proposal") {
          hasAvailability = true;
        }

        if (mode === "booking") {
          hasAvailability = bookingMap.has(String(therapist.id))
            ? !!bookingMap.get(String(therapist.id))
            : true;
        }

        if (mode === "ics") {
          hasAvailability = true;
        }

        if (hasAvailability) {
          result.push(String(therapist.id));
        }
      }

      console.log("FINAL AVAILABLE IDS", result);
      console.log(
        "FINAL AVAILABLE NAMES",
        teamMembers
  .filter((t) => result.includes(String(t.id)))
          .map((t) => t.name)
      );

      if (isMounted) {
        setAvailableTherapists(result);
      }
    } catch (e) {
      console.error("Availability error", e);
      if (isMounted) setAvailableTherapists([]);
    } finally {
      if (isMounted) setLoadingAvailability(false);
    }
  }

  loadAvailability();

  return () => {
    isMounted = false;
  };
}, [teamMembers]);
 // STEP 10 – ICS + Supabase (blocked_slots)
// -------------------------------------
useEffect(() => {
  if (step !== 10) return;
  if (calendarMode !== "booking") return;
  if (!bookingToken) return;

  let isMounted = true;

  async function loadBookingSlots() {
    setLoadingSlots(true);
    setSlotsError("");

    try {
const from = new Date().toISOString();

const res = await fetch(
  `/api/booking/free-slots?token=${encodeURIComponent(
    bookingToken
  )}&from=${encodeURIComponent(from)}`,
  { cache: "no-store" }
);

const json = await res.json();

if (json.booking_window_days) {
  setBookingWindowDays(Number(json.booking_window_days));
}

      if (!res.ok) {
console.error("FREE SLOTS ERROR FULL:", JSON.stringify(json, null, 2));        if (isMounted) {
          setSlots([]);
          setSlotsError("Kalender konnte nicht geladen werden.");
        }
        return;
      }

      const flatSlots = [];

      for (const dayGroup of json.slots || []) {
        for (const slot of dayGroup.slots || []) {
          flatSlots.push({
            start: new Date(slot.start),
            end: new Date(slot.end),
            googleEventId: slot.googleEventId,
          });
        }
      }

      if (blockedOldTerminISO) {
        const filtered = flatSlots.filter(
          (s) => s.start.toISOString() !== blockedOldTerminISO
        );
        if (isMounted) setSlots(filtered);
      } else {
        if (isMounted) setSlots(flatSlots);
      }
    } catch (err) {
      console.error("BOOKING SLOT LOAD ERROR:", err);
      if (isMounted) {
        setSlots([]);
        setSlotsError("Kalender konnte nicht geladen werden.");
      }
    } finally {
      if (isMounted) setLoadingSlots(false);
    }
  }

  loadBookingSlots();

  return () => {
    isMounted = false;
  };
}, [step, calendarMode, bookingToken, blockedOldTerminISO]);



  // Slots nach Tagen gruppieren
  
 const groupedSlots = useMemo(() => {
  const map = new Map();

  for (const s of slots) {
    const key = s.start.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }

  return Array.from(map.entries()); // [ [day, slots[]], ... ]
}, [slots]);
  // 🔹 Slots nach MONAT → TAG gruppieren
const slotsByMonth = useMemo(() => {
  const map = new Map();

  groupedSlots.forEach(([dayKey, daySlots]) => {
    const date = daySlots[0].start;
    const monthKey = date.toLocaleDateString("de-AT", {
      month: "long",
      year: "numeric",
    });

    if (!map.has(monthKey)) map.set(monthKey, []);
    map.get(monthKey).push([dayKey, daySlots]);
  });

  return Array.from(map.entries());
}, [groupedSlots]);

async function createOrUpdateDraft(selectedMember) {
  setSavingDraft(true);

  try {
    const res = await fetch("/api/create-request-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
body: JSON.stringify({
  anfrageId: draftRequestId || anfrageId || null,
  wunschtherapeut: selectedMember.name,
  assigned_therapist_id: selectedMember.id,
}),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error("DRAFT SAVE ERROR:", json);
      alert("Fehler beim Vorbereiten der Anfrage");
      return false;
    }

setDraftRequestId(json.id);
setBookingToken(json.booking_token);
setAssignedTherapistId(
  json.assigned_therapist_id || selectedMember.id
);

console.log("✅ DRAFT RESPONSE", {
  id: json.id,
  booking_token: json.booking_token,
  assigned_therapist_id: json.assigned_therapist_id,
  fallback_member_id: selectedMember.id,
});

    return true;
  } catch (err) {
    console.error("DRAFT SAVE FAILED:", err);
    alert("Fehler beim Vorbereiten der Anfrage");
    return false;
  } finally {
    setSavingDraft(false);
  }
}
  // -------------------------------------
  // Formular absenden
  // -------------------------------------
const send = async () => {
  if (submitting) return;
  setSubmitting(true);

  if (!assignedTherapistId) {
    alert("Bitte wähle eine Therapeutin oder einen Therapeuten aus.");
    setSubmitting(false);
    return;
  }

  try {
    // 1) Bei booking: echten Termin zuerst buchen
    if (calendarMode === "booking") {
if (!bookingToken || !form.terminISO) {
  alert("Bitte wähle zuerst einen Termin.");
  setSubmitting(false);
  return;
}

      const bookingRes = await fetch("/api/booking/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: bookingToken,
          start: form.terminISO,
          durationMin: 30,
          bookingType: "erstgespraech",
        }),
      });

      const bookingData = await bookingRes.json().catch(() => null);

      if (!bookingRes.ok) {
if (bookingData?.error === "slot_taken") {
  alert("Dieser Termin wurde gerade vergeben.");
  setStep(10);
  setSubmitting(false);
  return;
}

        console.error("BOOKING ERROR:", bookingData);
        alert("Der Termin konnte nicht gebucht werden.");
        return;
      }
    }

    // 2) Danach Anfrage final speichern
    const res = await fetch("/api/form-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        anfrageId: draftRequestId || anfrageId || null,
        booking_token: bookingToken || null,
        assigned_therapist_id: assignedTherapistId,
        therapist_from_url: form.wunschtherapeut,
        terminwunsch_text: form.preferred_times || null,
      }),
    });

    const data = await res.json().catch(() => null);

if (!res.ok) {
  alert("Fehler – Anfrage konnte nicht gesendet werden.");
  setSubmitting(false);
  return;
}

    alert("Danke – deine Anfrage wurde erfolgreich gesendet 🤍");
} catch (err) {
  console.error("Client Fehler:", err);
  alert("Unerwarteter Fehler – bitte später erneut versuchen.");
  setSubmitting(false);
}
};



  // -------------------------------------
  // Render
  // -------------------------------------

  return (
    <div className="form-wrapper">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Image
          src="/IMG_7599.png"
          width={160}
          height={160}
          alt="Poise Logo"
          priority
        />
      </div>

      <StepIndicator step={step} total={totalSteps} />
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            height: 8,
            background: "#eee",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round(((step + 1) / totalSteps) * 100)}%`,
              background: "#111",
            }}
          />
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
          Schritt {step + 1} von {totalSteps}
        </div>
      </div>

{step === 0 && (
  <div className="step-container">
    <h2>Was ist dein aktuelles Anliegen?</h2>
    <p style={{ opacity: 0.7 }}>
      Du kannst mehrere Themen auswählen und dein Anliegen beschreiben.
    </p>

    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {THEMEN.map((t) => {
        const active = form.themen.includes(t.key);

        return (
          <button
            key={t.key}
            type="button"
            onClick={() =>
              setForm({
                ...form,
                themen: active
                  ? form.themen.filter((x) => x !== t.key)
                  : [...form.themen, t.key],
              })
            }
            style={{
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: 16,
              border: active
                ? "2px solid #A27C77"
                : "1px solid #ddd",
             background: active ? "#F3E9E7" : "#fff",
color: "#000", // ✅ FIX: Text IMMER schwarz
            }}
          >
            <strong>{t.label}</strong>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
              {t.description}
            </div>
          </button>
        );
      })}
    </div>

    {/* 🧠 FREITEXT-ANLIEGEN */}
    <textarea
      placeholder="Beschreibe dein Anliegen gerne in eigenen Worten…"
      value={form.anliegen}
      onChange={(e) =>
        setForm({ ...form, anliegen: e.target.value })
      }
      style={{
        marginTop: 16,
        width: "100%",
        minHeight: 120,
      }}
    />

    <div className="footer-buttons">
      <button
        disabled={form.themen.length === 0 && !form.anliegen}
        onClick={next}
      >
        Weiter
      </button>
    </div>
  </div>
)}


      {/* STEP 1 – Leidensdruck */}
      {step === 1 && (
        <div className="step-container">
          <h2>Wie hoch ist dein Leidensdruck?</h2>
          <select
            value={form.leidensdruck}
            onChange={(e) =>
              setForm({ ...form, leidensdruck: e.target.value })
            }
          >
            <option value="">Bitte auswählen…</option>
            <option>niedrig</option>
            <option>mittel</option>
            <option>hoch</option>
            <option>sehr hoch</option>
          </select>
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.leidensdruck} onClick={next}>
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 – Verlauf */}
      {step === 2 && (
        <div className="step-container">
          <h2>Wie lange beschäftigt dich dein Anliegen schon?</h2>
          <textarea
            value={form.verlauf}
            onChange={(e) =>
              setForm({ ...form, verlauf: e.target.value })
            }
          />
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.verlauf} onClick={next}>
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 – Diagnose */}
      {step === 3 && (
        <div className="step-container">
          <h2>Gibt es eine Diagnose?</h2>
          <select
            value={form.diagnose}
            onChange={(e) =>
              setForm({ ...form, diagnose: e.target.value })
            }
          >
            <option value="">Bitte auswählen…</option>
            <option>Ja</option>
            <option>Nein</option>
          </select>
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.diagnose} onClick={next}>
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 – Ziel */}
{step === 4 && (
  <div className="step-container">
    <h2>Was ist dein Ziel?</h2>

    <textarea
      value={form.ziel}
      onChange={(e) =>
        setForm({ ...form, ziel: e.target.value })
      }
      placeholder="Zum Beispiel: mehr innere Ruhe, besser mit Stress umgehen, Klarheit gewinnen …"
    />

    <div className="footer-buttons">
      <button onClick={back}>Zurück</button>
      <button disabled={!form.ziel} onClick={next}>
        Weiter
      </button>
    </div>
  </div>
)}


      {/* STEP 5 – Kontaktdaten */}
      {step === 5 && (
        <div className="step-container">
          <h2>Kontaktdaten</h2>

          <input
            placeholder="Vorname"
            value={form.vorname}
            onChange={(e) =>
              setForm({ ...form, vorname: e.target.value })
            }
            style={
              errors.vorname
                ? { borderColor: "#d33", borderWidth: 2 }
                : {}
            }
          />
          {errors.vorname && (
            <p style={{ color: "#d33", fontSize: 14 }}>{errors.vorname}</p>
          )}

          <input
            placeholder="Nachname"
            value={form.nachname}
            onChange={(e) =>
              setForm({ ...form, nachname: e.target.value })
            }
            style={
              errors.nachname
                ? { borderColor: "#d33", borderWidth: 2 }
                : {}
            }
          />
          {errors.nachname && (
            <p style={{ color: "#d33", fontSize: 14 }}>{errors.nachname}</p>
          )}

          <input
            placeholder="E-Mail"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
            style={
              errors.email
                ? { borderColor: "#d33", borderWidth: 2 }
                : {}
            }
          />
          {errors.email && (
            <p style={{ color: "#d33", fontSize: 14 }}>{errors.email}</p>
          )}

          <input
            placeholder="Telefonnummer"
            type="tel"
            value={form.telefon}
            onChange={(e) =>
              setForm({ ...form, telefon: e.target.value })
            }
            style={
              errors.telefon
                ? { borderColor: "#d33", borderWidth: 2 }
                : {}
            }
          />
          {errors.telefon && (
            <p style={{ color: "#d33", fontSize: 14 }}>{errors.telefon}</p>
          )}

         <input
  placeholder="Straße & Hausnummer"
  value={form.strasse_hausnr}
  onChange={(e) =>
    setForm({ ...form, strasse_hausnr: e.target.value })
  }
/>

<input
  placeholder="PLZ & Ort"
  value={form.plz_ort}
  onChange={(e) =>
    setForm({ ...form, plz_ort: e.target.value })
  }
/>

          {errors.adresse && (
            <p style={{ color: "#d33", fontSize: 14 }}>{errors.adresse}</p>
          )}

          <input
            type="date"
            value={form.geburtsdatum}
            onChange={(e) =>
              setForm({ ...form, geburtsdatum: e.target.value })
            }
            style={
              errors.geburtsdatum
                ? { borderColor: "#d33", borderWidth: 2 }
                : {}
            }
          />
          {errors.geburtsdatum && (
            <p style={{ color: "#d33", fontSize: 14 }}>
              {errors.geburtsdatum}
            </p>
          )}

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button
              onClick={() => {
                if (validateClientData(form)) next();
              }}
            >
              Weiter
            </button>
          </div>
        </div>
      )}
{/* STEP 6 – Beschäftigungsgrad */}
{step === 6 && (
  <div className="step-container">
    <h2>Beschäftigungsgrad</h2>

    <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
      {/* Berufstätig */}
      <button
        type="button"
        onClick={() =>
          setForm({
            ...form,
            beschaeftigungsgrad: "berufstaetig",
          })
        }
        style={{
          textAlign: "left",
          padding: "14px 16px",
          borderRadius: 16,
          border:
            form.beschaeftigungsgrad === "berufstaetig"
              ? "2px solid #A27C77"
              : "1px solid #ddd",
          background:
            form.beschaeftigungsgrad === "berufstaetig"
              ? "#F3E9E7"
              : "#fff",
          color: "#000", // ✅ WICHTIG: Textfarbe erzwingen
          cursor: "pointer",
        }}
      >
        <strong>Berufstätig</strong>
      </button>

      {/* In Ausbildung */}
      <button
        type="button"
        onClick={() =>
          setForm({
            ...form,
            beschaeftigungsgrad: "ausbildung",
          })
        }
        style={{
          textAlign: "left",
          padding: "14px 16px",
          borderRadius: 16,
          border:
            form.beschaeftigungsgrad === "ausbildung"
              ? "2px solid #A27C77"
              : "1px solid #ddd",
          background:
            form.beschaeftigungsgrad === "ausbildung"
              ? "#F3E9E7"
              : "#fff",
          color: "#000", // ✅ auch hier
          cursor: "pointer",
        }}
      >
        <strong>In Ausbildung</strong>
        <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
          beziehe kein Einkommen
        </div>
      </button>
    </div>

    <div className="footer-buttons">
      <button onClick={back}>Zurück</button>
      <button disabled={!form.beschaeftigungsgrad} onClick={next}>
        Weiter
      </button>
    </div>
  </div>
)}


      {/* STEP 7 – Hinweise / Datenschutz */}
      {step === 7 && (
        <div className="step-container">
          <h2>Wichtige Hinweise</h2>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.check_datenschutz}
              onChange={() =>
                setForm({
                  ...form,
                  check_datenschutz: !form.check_datenschutz,
                })
              }
            />
<span>
  Ich akzeptiere die{" "}
  <a
    href="https://mypoise.de/privacy-policy/"
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    style={{
      color: "#111",
      textDecoration: "underline",
      fontWeight: 600,
    }}
  >
    Datenschutzerklärung
  </a>
  .
</span>
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.check_online_setting}
              onChange={() =>
                setForm({
                  ...form,
                  check_online_setting:
                    !form.check_online_setting,
                })
              }
            />
            Ich habe Kamera & Mikrofon und sorge für ruhige
            Umgebung.
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.check_gesundheit}
              onChange={() =>
                setForm({
                  ...form,
                  check_gesundheit: !form.check_gesundheit,
                })
              }
            />
            Ich habe keine akuten Suizidgedanken /
            akute Selbstgefährdung.
          </label>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button
              disabled={
                !form.check_datenschutz ||
                !form.check_online_setting ||
                !form.check_gesundheit
              }
              onClick={next}
            >
              Weiter
            </button>
          </div>
        </div>
      )}

{step === 8 && (
  <div className="step-container">
    {loadingAvailability ? (
      <p>Verfügbarkeiten werden geprüft…</p>
    ) : step8Members.length === 0 ? (
      <>
        <h2>Aktuell keine freien Termine</h2>
        <p>
          Im Moment hat leider niemand aus unserem Team freie Termine im Kalender.
          Bitte versuche es später erneut oder kontaktiere uns direkt.
        </p>
        <div className="footer-buttons">
          <button onClick={back}>Zurück</button>
        </div>
      </>
    ) : (
      <>
        <h2>
          {isAdminResume
            ? "Diese Therapeut:innen wurden für dich ausgewählt"
            : "Wer könnte gut zu dir passen?"}
        </h2>

        <p style={{ marginBottom: 24 }}>
          Es werden ausschließlich Therapeut:innen angezeigt,
          die aktuell freie Termine haben.
        </p>
<TeamCarousel
  members={step8Members}
  onSelect={async (member) => {
    if (savingDraft) return;

    setAssignedTherapistId(member.id);

    const ok = await createOrUpdateDraft(member);
    if (!ok) return;

    setSelectedDay(null);
    setSlots([]);

    setForm((prev) => ({
      ...prev,
      wunschtherapeut: member.name,
      assigned_therapist_id: member.id,
      terminISO: "",
      terminDisplay: "",
    }));

    next();
  }}
/>

        <div className="footer-buttons">
          <button onClick={back}>Zurück</button>
        </div>
      </>
    )}
  </div>
)}




      {/* STEP 9 – Story / Infos zum Ablauf */}
      {step === 9 &&
        (() => {
const t =
  teamMembers.find((x) => x.name === form.wunschtherapeut) || {};
         
          const slides = [
            {
              title: "Schön, dass du da bist 🤍",
              text: `Danke für dein Vertrauen.

Du hast **${t.name || "deine Begleitung"}** ausgewählt — eine sehr gute Wahl.

Wir führen dich jetzt ganz kurz durch den Ablauf,
bevor du deinen Termin auswählst.`,
            },
            {
              title: "Wie startet der Prozess?",
              text: `Ihr beginnt mit einem **kostenlosen Erstgespräch (30 Min)** im Video-Call.

Ihr lernt euch kennen, besprecht das Anliegen
und klärt organisatorische Fragen.

Danach entscheiden beide frei, ob ihr weiter zusammenarbeitet.`,
            },
            {
              title: "Wie geht es danach weiter?",
              text: `Wenn ihr weitermacht:

• Sitzungen à **60 Minuten**
• Online per Video-Call
• Ca. 8–10 Sitzungen im Durchschnitt
• Offenes Tempo & Anpassung jederzeit möglich`,
            },
            {
              title: `Kosten bei ${t.name || "deiner Begleitung"}`,
              text: `Standardtarif: **${t.preis_std ?? "–"}€ / 60 Min**
Ermäßigt (Studierende / Azubi): **${t.preis_ermaessigt ?? "–"}€**

Unser Angebot richtet sich grundsätzlich an Selbstzahler.
Eine Kostenübernahme kann möglich sein — individuell klären.`,
            },
          ];

          const isLast = subStep9 === slides.length - 1;

          return (
            <div className="step-container">
              <h2>{slides[subStep9].title}</h2>

              <p
                style={{
                  whiteSpace: "pre-line",
                  lineHeight: 1.55,
                }}
              >
                {slides[subStep9].text}
              </p>

              <div className="footer-buttons">
                {subStep9 > 0 ? (
                  <button
                    onClick={() => setSubStep9((v) => v - 1)}
                  >
                    Zurück
                  </button>
                ) : (
                  <button onClick={back}>Zurück</button>
                )}

                {!isLast ? (
                  <button
                    onClick={() => setSubStep9((v) => v + 1)}
                  >
                    Weiter
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSubStep9(0);
                      next();
                    }}
                  >
                    Weiter zur Terminwahl
                  </button>
                )}
              </div>
            </div>
          );
        })()}

     {/* STEP 10 – Terminwahl */}
{step === 10 && (
  <div className="step-container">
    <h2>Erstgespräch – Termin wählen</h2>

    {/* ================================================= */}
    {/* =============== PROPOSAL MODE =================== */}
    {/* ================================================= */}
    {calendarMode === "proposal" && (
      <>
        <h3>Wann hättest du grundsätzlich Zeit?</h3>

        <textarea
          placeholder="z.B. Montag Nachmittag, Dienstag Vormittag…"
          value={form.preferred_times || ""}
          onChange={(e) =>
            setForm({ ...form, preferred_times: e.target.value })
          }
          style={{
            marginTop: 12,
            width: "100%",
            minHeight: 120,
          }}
        />

        <div className="footer-buttons" style={{ marginTop: 16 }}>
          <button onClick={back}>Zurück</button>
          <button disabled={!form.preferred_times} onClick={next}>
            Weiter zur Zusammenfassung
          </button>
        </div>
      </>
    )}

    {/* ================================================= */}
    {/* ================== booking MODE ===================== */}
    {/* ================================================= */}
    {calendarMode === "booking" && (
      <>
        {loadingSlots && <p>Kalender wird geladen…</p>}
        {slotsError && <p style={{ color: "red" }}>{slotsError}</p>}

        {!loadingSlots && !slotsError && groupedSlots.length === 0 && (
          <p>Keine freien Termine verfügbar.</p>
        )}

        {/* 📅 DATUM */}
        {!loadingSlots && groupedSlots.length > 0 && (
          <>
            <h3>Datum auswählen</h3>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {groupedSlots.map(([day, list]) => (
                <button
                  key={day}
                  onClick={() => {
                    setSelectedDay(day);
                    setForm({ ...form, terminISO: "", terminDisplay: "" });
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 12,
                    border:
                      selectedDay === day ? "2px solid #A27C77" : "1px solid #ddd",
                    background: selectedDay === day ? "#F3E9E7" : "#fff",
                  }}
                >
                  {formatDate(list[0].start)}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ⏰ UHRZEIT */}
        {selectedDay && (
          <>
            <h3 style={{ marginTop: 16 }}>Uhrzeit auswählen</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginTop: 8,
              }}
            >
              {(groupedSlots.find(([day]) => day === selectedDay)?.[1] ?? []).map((s) => (
                <button
                  key={s.start.toISOString()}
                  onClick={() =>
                    setForm({
                      ...form,
                      terminISO: s.start.toISOString(),
                      terminDisplay: `${formatDate(s.start)} ${formatTime(s.start)}`,
                    })
                  }
                  style={{
                    padding: "10px 0",
                    borderRadius: 999,
                    border:
                      form.terminISO === s.start.toISOString()
                        ? "2px solid #A27C77"
                        : "1px solid #ddd",
                    background:
                      form.terminISO === s.start.toISOString()
                        ? "#F3E9E7"
                        : "#fff",
                  }}
                >
                  {formatTime(s.start)}
                </button>
              ))}
            </div>
          </>
        )}

        {form.terminISO && (
          <p style={{ marginTop: 12 }}>
            Gewählt: <strong>{form.terminDisplay}</strong>
          </p>
        )}

        <div className="footer-buttons" style={{ marginTop: 16 }}>
          <button onClick={back}>Zurück</button>
          <button disabled={!form.terminISO} onClick={next}>
            Weiter zur Zusammenfassung
          </button>
        </div>
      </>
    )}
  </div>
)}

{/* STEP 11 – Zusammenfassung */}
{step === 11 && (
  <div className="step-container">
    <h2>Zusammenfassung</h2>

    <div style={{ fontSize: 14, lineHeight: 1.6 }}>
      <p><strong>Name:</strong> {form.vorname} {form.nachname}</p>
      <p><strong>E-Mail:</strong> {form.email}</p>
      <p><strong>Telefon:</strong> {form.telefon}</p>
<p><strong>Adresse:</strong> {form.strasse_hausnr}, {form.plz_ort}</p>
      <p><strong>Geburtsdatum:</strong> {form.geburtsdatum}</p>
      <hr style={{ margin: "12px 0" }} />
      <p><strong>Anliegen:</strong> {form.anliegen}</p>
      <p><strong>Leidensdruck:</strong> {form.leidensdruck}</p>
      <p><strong>Verlauf:</strong> {form.verlauf}</p>
      <p><strong>Diagnose (optional):</strong> {form.diagnose || "—"}</p>
      <p><strong>Ziel:</strong> {form.ziel}</p>
      <p><strong>Beschäftigungsgrad:</strong> {form.beschaeftigungsgrad}</p>
      <hr style={{ margin: "12px 0" }} />
      <p><strong>Wunschtherapeut:in:</strong> {form.wunschtherapeut || "—"}</p>
      {/* Termin / Wunschzeiten */}
{calendarMode === "booking" && (
  <p>
    <strong>Erstgespräch-Termin:</strong>{" "}
    {form.terminDisplay || "—"}
  </p>
)}

{calendarMode === "proposal" && (
  <p>
    <strong>Gewünschte Zeiten:</strong><br />
    {form.preferred_times || "—"}
  </p>
)}
    </div>

    <div className="footer-buttons" style={{ marginTop: 16 }}>
      <button onClick={back}>Zurück</button>
<button
  onClick={send}
  disabled={submitting}
  style={{
    opacity: submitting ? 0.6 : 1,
    cursor: submitting ? "not-allowed" : "pointer",
  }}
>
  {submitting ? "Wird gesendet…" : "Anfrage senden"}
</button>    </div>
  </div>
)}


    </div>
  );
}
