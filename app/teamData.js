export const teamData = [
{
  name: "Ann",
  role: "Coach, Heilpraktikerin für Psychotherapie, Hypnose Coach",
  qualificationLevel: 5,

  image: "https://mypoise.de/wp-content/uploads/2023/01/DSC_0007-copy-2-1300x1300.jpg",

  short:
    "Ich begleite Menschen, die innere Anspannung, Unsicherheit oder emotionale Überforderung erleben. Mein Ansatz ist ruhig, direkt und klar strukturiert, mit Fokus auf Selbstregulation und Stärkung der persönlichen Handlungsfähigkeit.",

  video: "https://youtu.be/rWhc4JvVmaw",

  /*
   THEMEN-GEWICHTUNG
   3 = sehr spezialisiert (dunkel)
   2 = gut geeignet
   1 = begleitend möglich
  */
  themes: {
    selbstwert: 3,
    stress: 3,
    burnout: 2,
    angst_panik: 2,
    beziehung: 1,
    depressive_verstimmung: 1,
    beruf_orientierung: 1,
  },

  /*
   KEYWORDS = Herzstück des Matchings
   → ALLE Begriffe, Symptome, Untertexte, Synonyme
   → aus Tabelle + Profil + Alltagssprache
  */
  keywords: [
    // Selbstwert / Selbstliebe
    "selbstwert",
    "selbstvertrauen",
    "ich bin nicht gut genug",
    "selbstzweifel",
    "innere sicherheit",
    "selbstregulation",

    // Stress
    "stress",
    "innere anspannung",
    "druck",
    "gedankenkreisen",
    "überforderung",
    "schlafprobleme",
    "nackenschmerzen",
    "rückenschmerzen",
    "verdauungsprobleme",
    "tinnitus",

    // Burnout
    "burnout",
    "erschöpfung",
    "emotionale erschöpfung",
    "funktionieren",
    "keine energie",
    "leistungsdruck",

    // Angst / Panik
    "angst",
    "panik",
    "panikattacken",
    "herzrasen",
    "atemnot",
    "schwindel",
    "kontrollverlust",
    "innere unruhe",

    // Depressive Verstimmung
    "traurigkeit",
    "innere leere",
    "antriebslosigkeit",
    "hoffnungslosigkeit",

    // Beziehung
    "beziehung",
    "konflikte",
    "emotionale abhängigkeit",
    "abgrenzung",

    // Beruf / Orientierung
    "überforderung im job",
    "stress im beruf",
    "arbeitsbelastung",

    // Methoden / Arbeitsweise
    "hypnose",
    "systemisch",
    "ressourcenorientiert",
    "lösungsorientiert",
    "emotionale stabilisierung",
    "innere klarheit",
    "handlungsfähigkeit",
  ],

  /*
   KURZE TAGS
   → für UI, Filter, schnelle Anzeige
  */
  tags: ["selbstwert", "stress", "burnout", "panik"],

  preis_std: 150,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/75f62df4c63554a1436d49c3a381da84502728a0457c9c8b56d30e21fa5021c5%40group.calendar.google.com/public/basic.ics",

  email: "sebastian.kickinger@icloud.com",
},

{
  name: "Anna",
  role: "Psychologin, Psychotherapeutin",
  qualificationLevel: 1,

  image:
    "https://mypoise.de/wp-content/uploads/2023/06/Anna-Moser-scaled-e1739306168495-1300x1300.jpg",

  short:
    "Ich unterstütze Menschen in herausfordernden Lebensphasen, insbesondere bei emotionaler Belastung und Erschöpfung. Wir schaffen gemeinsam Orientierung und einen stabilen Raum, um innere Spannungen zu regulieren.",

  video: "https://youtu.be/I6a4ZUM5KiU",

  themes: {
    stress: 3,
    burnout: 3,
    depressive_verstimmung: 2,
    selbstwert: 2,
    angst_panik: 1,
    krankheit_verlust: 1,
    lebensphase: 2,
  },

  keywords: [
    // Stress & Erschöpfung
    "stress",
    "überforderung",
    "emotionale belastung",
    "erschöpfung",
    "dauerstress",
    "innere anspannung",
    "keine kraft mehr",

    // Burnout
    "burnout",
    "ausgebrannt",
    "funktionieren",
    "emotionale erschöpfung",
    "leistungsdruck",

    // Depression / Verstimmung
    "traurigkeit",
    "innere leere",
    "antriebslosigkeit",
    "hoffnungslosigkeit",
    "niedergeschlagen",

    // Selbstwert
    "selbstwert",
    "unsicherheit",
    "zweifel",
    "selbstkritik",

    // Lebensphase
    "lebenskrise",
    "umbruch",
    "neuorientierung",
    "veränderung",

    // Therapeutische Arbeit
    "therapie",
    "emotionale stabilisierung",
    "ressourcenaufbau",
    "struktur",
    "sicherheit",
    "alltagsbewältigung",
  ],

  tags: ["stress", "erschöpfung", "burnout", "stabilisierung"],

  preis_std: 200,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/db284e0dfb24a13214628dc2264f2e997617ef505a9da7a47d7c5b9d6dbd3b62%40group.calendar.google.com/public/basic.ics",
},


  {
  name: "Anja",
  role: "Psychologin, Psychotherapeutin in Ausbildung",
  qualificationLevel: 3,

  image:
    "https://mypoise.de/wp-content/uploads/2022/11/Vorstellungsfoto-1300x1300.jpg",

  short:
    "Ich begleite Menschen, die sich im inneren Konflikt befinden, sich emotional erschöpft fühlen oder eine Neuorientierung suchen. Mein Ansatz ist strukturiert, klar und zugleich wertschätzend.",

  video: "https://youtu.be/23tko9Jdr3A",

  themes: {
    selbstwert: 3,
    stress: 2,
    depressive_verstimmung: 2,
    beruf_orientierung: 2,
    beziehung: 2,
    angst_panik: 1,
  },

  keywords: [
    // Selbstwert
    "selbstwert",
    "selbstzweifel",
    "innere kritiker",
    "unsicherheit",
    "ich genüge nicht",

    // Stress
    "stress",
    "emotionale erschöpfung",
    "überforderung",
    "druck",

    // Depression
    "traurigkeit",
    "innere leere",
    "antriebslosigkeit",
    "niedergeschlagen",

    // Orientierung
    "neuorientierung",
    "lebensumstellung",
    "berufliche entscheidung",
    "sinnfrage",

    // Beziehung
    "beziehung",
    "verlusterfahrung",
    "konflikte",
    "bindung",

    // Methoden
    "kognitive verhaltenstherapie",
    "tiefenpsychologie",
    "lösungsorientiert",
    "selbstkontakt",
    "innere prioritäten",
  ],

  tags: ["selbstwert", "neuorientierung", "erschöpfung", "klarheit"],

  preis_std: 180,
  preis_ermaessigt: 150,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/67e9cf48e7519924f64e65591678c2a24c87f3f4cf7e66c79a5a6c856205083f%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Babette",
  role: "Psychologin, Hypnose Coach",
  qualificationLevel: 4,

  image:
    "https://mypoise.de/wp-content/uploads/2022/11/IMG_7891-scaled-e1669712492385-700x700.jpeg",

  short:
    "Ich arbeite schwerpunktmäßig mit Menschen, die unter Stress, Überforderung oder anhaltender innerer Anspannung leiden.",

  video: "https://youtu.be/ooreni-vA78",

  themes: {
    stress: 3,
    burnout: 2,
    angst_panik: 2,
    psychosomatik: 2,
    selbstwert: 1,
  },

  keywords: [
    // Stress
    "stress",
    "innere anspannung",
    "überforderung",
    "gedankenkreisen",
    "nervosität",

    // Burnout
    "burnout",
    "erschöpfung",
    "keine energie",
    "dauerbelastung",

    // Angst
    "angst",
    "panik",
    "innere unruhe",
    "anspannungszustände",

    // Psychosomatik
    "körperliche symptome",
    "spannung im körper",
    "magenprobleme",
    "schlafstörungen",

    // Methoden
    "hypnose",
    "verhaltenstherapie",
    "emotionsregulation",
    "achtsamkeit",
    "selbstwahrnehmung",
  ],

  tags: ["stress", "angst", "erschöpfung", "hypnose"],

  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/a950b84b7fcb581bf1de6d341275ffee44f3dc9ff3ea621833d9cd69edff56e0%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Carolin",
  role: "Psychologin, Systemischer Coach",
  qualificationLevel: 4,

  image:
    "https://mypoise.de/wp-content/uploads/2023/09/163_Portrait-Juni2023__pp-1300x1300.jpg",

  short:
    "Ich begleite Menschen in Umbruchphasen oder inneren Übergängen und unterstütze dabei, emotionale Orientierung und Stabilität zu entwickeln.",

  video: "https://youtu.be/bjJ76067_j0",

  themes: {
    lebensphase: 3,
    beruf_orientierung: 3,
    selbstwert: 2,
    stress: 2,
    depressive_verstimmung: 1,
    beziehung: 1,
  },

  keywords: [
    // Umbruch / Lebensphase
    "umbruch",
    "lebensveränderung",
    "zwischenphase",
    "neu anfangen",
    "orientierungslosigkeit",

    // Beruf & Entscheidungen
    "berufliche neuorientierung",
    "jobwechsel",
    "sinn im beruf",
    "entscheidung treffen",
    "überforderung im job",

    // Selbstwert
    "selbstwert",
    "unsicherheit",
    "innere klarheit",
    "selbstvertrauen",

    // Stress
    "stress",
    "gedankenkreisen",
    "innere unruhe",

    // Arbeitsweise
    "systemisch",
    "personzentriert",
    "struktur schaffen",
    "ressourcenorientiert",
    "nachhaltige entwicklung",
  ],

  tags: ["neuorientierung", "lebensphase", "klarheit", "systemisch"],

  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/93fad123ee38ccfa2f9a25423889e2b941c943c7679f2259dbb322387ce0f98b%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Caroline",
  role: "Ärztin (Gynäkologie), Psychotherapeutin",
  qualificationLevel: 1,

  image:
    "https://mypoise.de/wp-content/uploads/2023/12/IMG_7279-700x700.jpg",

  short:
    "Ich begleite Menschen bei psychosomatischen Themen, wenn Körper und Emotionen eng miteinander verbunden sind.",

  video: "https://youtu.be/xvDbQYWlpL8",

  themes: {
    psychosomatik: 3,
    stress: 2,
    angst_panik: 2,
    depressive_verstimmung: 2,
    selbstwert: 1,
    erschöpfung: 2,
  },

  keywords: [
    // Psychosomatik
    "psychosomatik",
    "körperliche symptome",
    "körper und psyche",
    "somatische beschwerden",

    // Gynäkologische Themen
    "zyklusbeschwerden",
    "hormone",
    "brustenge",
    "bauchschmerzen",

    // Stress & Erschöpfung
    "stress",
    "erschöpfung",
    "schlafprobleme",
    "innere anspannung",

    // Angst
    "angst",
    "panik",
    "innere unruhe",

    // Arbeitsweise
    "körperorientiert",
    "tiefenpsychologisch",
    "systemisch",
    "achtsamkeit",
    "nervensystem regulieren",
  ],

  tags: ["psychosomatik", "körper", "stress", "erschöpfung"],

  preis_std: 170,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/a6b036ba257178278f5c92b72e04e9120ea076157959112266c8ec220ed2217f%40group.calendar.google.com/public/basic.ics",
},

 {
  name: "Elena",
  role: "Psychologin, Coach",
  qualificationLevel: 4,

  image:
    "https://mypoise.de/wp-content/uploads/2025/02/Image-scaled-e1740223110391.jpeg",

  short:
    "Ich unterstütze Menschen, die funktionieren müssen, obwohl innerlich vieles schwer ist, und helfe dabei, wieder in Kontakt mit sich selbst zu kommen.",

  video: "https://youtu.be/Gbmggqdwl9M",

  themes: {
    stress: 3,
    burnout: 3,
    selbstwert: 2,
    depressive_verstimmung: 2,
    selbstkontakt: 3,
  },

  keywords: [
    // Stress & Funktionieren
    "funktionieren",
    "stress",
    "überforderung",
    "dauerbelastung",

    // Burnout
    "burnout",
    "erschöpfung",
    "keine energie",
    "ausgebrannt",

    // Selbstkontakt
    "selbstkontakt",
    "innere leere",
    "abgeschnitten von gefühlen",
    "keinen zugang zu mir",

    // Emotionen
    "zweifel",
    "hilflosigkeit",
    "wut",
    "traurigkeit",

    // Arbeitsweise
    "ressourcenorientiert",
    "stabilisierung",
    "emotionale sicherheit",
    "achtsamkeit",
  ],

  tags: ["erschöpfung", "stress", "selbstkontakt", "burnout"],

  preis_std: 150,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/3fa5a5955038a6f744313415c7f2052720ff0cc72cc61245dcfca9207e92411f%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Franziska",
  role: "Psychologin, Psychotherapeutin in Ausbildung, Psychoonkologin",
  qualificationLevel: 3,

  image:
    "https://mypoise.de/wp-content/uploads/2022/12/1654680310653.jpg",

  short:
    "Ich begleite Menschen bei Krankheit, Verlust oder seelischer Erschöpfung und biete Halt und Orientierung in belastenden Lebensphasen.",

  video: "https://youtu.be/kngeVsC0vec",

  themes: {
    krankheit_verlust: 3,
    trauer: 3,
    erschöpfung: 2,
    depressive_verstimmung: 2,
    stabilisierung: 3,
  },

  keywords: [
    // Krankheit & Krise
    "krankheit",
    "diagnose",
    "lebenskrise",
    "körperliche grenze",

    // Verlust & Trauer
    "verlust",
    "trauer",
    "abschied",
    "loslassen",

    // Erschöpfung
    "erschöpfung",
    "emotionale überlastung",
    "keine kraft",

    // Stabilisierung
    "halt",
    "sicherheit",
    "stabilisierung",
    "struktur",

    // Arbeitsweise
    "personzentriert",
    "empathisch",
    "achtsam",
    "schritt für schritt",
  ],

  tags: ["trauer", "krankheit", "stabilisierung", "erschöpfung"],

  preis_std: 150,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/ca7d425f824b9b777b6ba5697cc7b905d7bec811f7b4839a54fa1ce318587ed2%40group.calendar.google.com/public/basic.ics",
},
{
  name: "Gerhard",
  role: "Coach, systemischer Berater, Mediator",
  qualificationLevel: 6,

  image:
    "https://mypoise.de/wp-content/uploads/2025/04/Frontfoto-1024x1024.jpg",

  short:
    "Ich arbeite mit Menschen in inneren und zwischenmenschlichen Konflikten und unterstütze dabei, Klarheit und handlungsfähige Perspektiven zu entwickeln.",

  video: "https://youtu.be/sEhRwOirFZ0",

  themes: {
    beziehung: 3,
    konflikt: 3,
    selbstwert: 2,
    beruf_orientierung: 2,
    stress: 1,
  },

  keywords: [
    // Konflikte
    "konflikt",
    "streit",
    "spannung",
    "unausgesprochenes",
    "verstrickung",

    // Beziehungen
    "beziehung",
    "partnerschaft",
    "kommunikationsprobleme",
    "abgrenzung",
    "abhängigkeit",

    // Selbstwirksamkeit
    "selbstwirksamkeit",
    "handlungsfähigkeit",
    "klarheit gewinnen",

    // Beruf
    "konflikte im job",
    "teamkonflikte",
    "führung",
    "entscheidung treffen",

    // Arbeitsweise
    "systemisch",
    "mediation",
    "lösungsorientiert",
    "direkt",
    "strukturiert",
  ],

  tags: ["konflikt", "beziehung", "klarheit", "systemisch"],

  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/337c7badcffe966991eb34f4b885fcffffba011562b751a085383346708d6263%40group.calendar.google.com/public/basic.ics",
},
{
  name: "Gesine",
  role: "Psychologin, Psychotherapeutin",
  qualificationLevel: 2,

  image:
    "https://mypoise.de/wp-content/uploads/2025/08/Bildschirmfoto-2025-08-04-um-14.55.22.png",

  short:
    "Ich begleite Menschen mit innerer Anspannung, Traurigkeit oder emotionaler Überlastung und helfe dabei, wieder Stabilität und Sicherheit zu finden.",

  video: "https://youtu.be/oLn_qmHA2vk",

  themes: {
    depressive_verstimmung: 3,
    angst_panik: 2,
    stress: 2,
    selbstwert: 2,
    stabilisierung: 3,
  },

  keywords: [
    // Depression
    "depressive verstimmung",
    "traurigkeit",
    "hoffnungslosigkeit",
    "innere leere",
    "antriebslosigkeit",

    // Angst
    "angst",
    "innere unruhe",
    "überforderung",

    // Nervensystem
    "nervensystem",
    "emotionale sicherheit",
    "stabilisierung",

    // Selbstwert
    "selbstwert",
    "selbstkontakt",
    "selbstfürsorge",

    // Arbeitsweise
    "tiefenpsychologisch",
    "beziehungsorientiert",
    "ruhig",
    "haltgebend",
  ],

  tags: ["traurigkeit", "stabilität", "selbstwert", "überforderung"],

  preis_std: 180,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/f3f21fee63e77164d204d3fd0f296e64837dccf4242a6b3f9482f1ba842fedab%40group.calendar.google.com/public/basic.ics",
},
{
  name: "Isabella",
  role: "Klinische Psychologin",
  qualificationLevel: 2,

  image:
    "https://mypoise.de/wp-content/uploads/2024/08/IsabellaKusztrits%C2%A9DanielaGruber-13.jpeg-600x426.png",

  short:
    "Ich begleite hochsensible Menschen dabei, ihre Emotionen zu verstehen, gesunde Grenzen zu entwickeln und innere Stabilität aufzubauen.",

  video: "",

  themes: {
    hochsensibilität: 3,
    selbstwert: 3,
    emotionale_regulation: 3,
    beziehung: 2,
    stress: 1,
  },

  keywords: [
    // Hochsensibilität
    "hochsensibilität",
    "reizüberflutung",
    "zu sensibel",
    "zu viel fühlen",

    // Emotionale Regulation
    "emotionale regulation",
    "gefühle steuern",
    "überwältigende emotionen",

    // Selbstwert
    "selbstwert",
    "selbstannahme",
    "selbstvertrauen",

    // Grenzen
    "grenzen setzen",
    "abgrenzung",
    "nein sagen",

    // Arbeitsweise
    "wertschätzend",
    "ruhig",
    "klar",
    "stabilisierend",
  ],

  tags: ["hochsensibilität", "selbstwert", "emotionen", "grenzen"],

  preis_std: 170,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/8e6975d60569a919f44359f9e7272f66b2345b1aa29b2f391ac2237e092e7994%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Jennifer",
  role: "Psychologin, Systemischer Coach",
  qualificationLevel: 4,

  image:
    "https://mypoise.de/wp-content/uploads/2022/11/Screen-Shot-2022-11-22-at-09.59.06-700x700.png",

  short:
    "Ich unterstütze dich dabei, alte Beziehungsmuster zu erkennen, emotionale Trigger zu verstehen und neue Handlungsspielräume zu entwickeln.",

  video: "https://youtu.be/NwQ1ftS6YvM",

  themes: {
    beziehung: 3,
    selbstwert: 3,
    identität: 2,
    emotionale_regulation: 2,
    konflikt: 1,
  },

  keywords: [
    // Beziehungsmuster
    "beziehungsmuster",
    "bindungsmuster",
    "immer dieselben konflikte",

    // Trigger
    "trigger",
    "emotionale reaktionen",
    "überreaktion",

    // Selbstwert
    "selbstwert",
    "selbstvertrauen",
    "innere sicherheit",

    // Identität
    "identität",
    "wer bin ich",
    "selbstbild",

    // Arbeitsweise
    "systemisch",
    "klar",
    "strukturiert",
    "transformationsarbeit",
  ],

  tags: ["beziehung", "selbstwert", "trigger", "identität"],

  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/aa848084588fd6e79f8f7056180a78ca0602df5ec8e305cfc50c600a36da43e6%40group.calendar.google.com/public/basic.ics",
},

  {
    name: "Julius",
    role: "Psychologe, systemischer Coach und Mediator",
    image: "https://mypoise.de/wp-content/uploads/2023/09/Poise_bild-1300x1300.jpg",
    short:
      "Ich arbeite klar, realistisch und ressourcenorientiert — wir finden Schritte, die wirklich funktionieren.",
    video: "https://youtu.be/YNS5APSbV8Y",
    tags: ["neuorientierung", "entscheidungen", "identität", "struktur"],
    preis_std: 160,
    preis_ermaessigt: 120,
    status: "frei",
    ics: "https://calendar.google.com/calendar/ical/8a00eded0b43b92f02470e3ee4791aee343a9e4226c20e758b5ba2cbca2ba0fc%40group.calendar.google.com/public/basic.ics"
  },
  {
    name: "Kristin",
    role: "Trauerbegleiterin, Heilpraktikerin Psychotherapie",
    image:
      "https://mypoise.de/wp-content/uploads/2024/01/202411_CG_LiliKristin_276-1300x1300.jpg",
    short:
      "Ich begleite dich, wenn du Verlust erlebt hast — behutsam, würdevoll und klar.",
    video: "https://youtu.be/z7LUAXxzW7I",
    tags: ["trauer", "abschied", "verarbeitung", "neubeginn"],
    preis_std: 110,
    preis_ermaessigt: 120,
    status: "frei",
    ics: "https://calendar.google.com/calendar/ical/693a5cd58448b0e4b9bd86d347a9efc125ed2e8967778fb8386e99c25e4d761b%40group.calendar.google.com/public/basic.ics"
  },
  {
    name: "Kristin-Sofie",
    role: "Klinische Psychologin",
    image:
      "https://mypoise.de/wp-content/uploads/2024/07/DSCF6979-1300x1300.jpg",
    short:
      "Ich begleite dich dabei, innere Stabilität und emotionale Klarheit aufzubauen — ruhig, klar, strukturiert.",
    video: "https://youtu.be/pExhqepTZRQ",
    tags: ["selbstwert", "emotionale regulation", "unsicherheit", "klarheit"],
    preis_std: 160,
    preis_ermaessigt: 120,
    status: "frei",
    ics: "https://calendar.google.com/calendar/ical/0796b382bb757d367c469af13358ae1bba96756ee606c256bb1e5985cf7f4b82%40group.calendar.google.com/public/basic.ics"
  },
  {
  name: "Livia",
  role: "Psychologin, Psychotherapeutin in Ausbildung",
  image: "https://mypoise.de/wp-content/uploads/2025/10/Foto-11-1300x1300.jpg",
  short:
    "Ich helfe dir, wieder Nähe zu dir selbst aufzubauen — mit Feingefühl, Tiefgang und psychotherapeutischer Kompetenz.",
  video: "",
  tags: [
    "identität",
    "selbstfindung",
    "selbstkontakt",
    "emotionale nähe",
    "erschöpfung",
    "überforderung",
    "anpassung",
    "alte verletzungen",
    "innere leere",
    "selbstwert",
    "beziehung zu sich",
    "bindung",
    "innere stabilität",
    "achtsamkeit",
    "psychotherapie"
  ],
  preis_std: 180,
  preis_ermaessigt: 120,
  status: "frei",
  ics: "https://calendar.google.com/calendar/ical/e985ea19fe89a072bbef17114d85ffb8b49227dd9f0170b556c4b98fc55c5881%40group.calendar.google.com/public/basic.ics"
},

 {
  name: "Magdalena",
  role: "Klinische Psychologin, Kinder- & Jugendpsychologin",
  image: "https://mypoise.de/wp-content/uploads/2023/01/Magdalena-e1672744279356-700x700.jpg",
  short:
    "Ich begleite Kinder, Jugendliche, Familien und Erwachsene durch schwierige Entwicklungs- und Lebensphasen.",
  video: "https://youtu.be/b06MFP9AxTg",
  tags: [
    "familie",
    "familienkonflikte",
    "beziehung",
    "elternschaft",
    "kinder",
    "jugendliche",
    "entwicklung",
    "übergänge",
    "krisen",
    "trennung",
    "systemisch",
    "ressourcenorientiert",
    "bindung",
    "kommunikation",
    "schwangerschaft",
    "lebensphasen"
  ],
  preis_std: 150,
  preis_ermaessigt: 120,
  status: "frei",
  ics: "https://calendar.google.com/calendar/ical/857518f623143d4ba427588f9c5bf2d690fd3082137a06298b53c289d3046fb1%40group.calendar.google.com/public/basic.ics"


  },
  {
  name: "Marisa",
  role: "Psychologin, Psychotherapeutin",
  image: "https://mypoise.de/wp-content/uploads/2022/12/IMG_9908-e1669989498337-700x700.jpeg",
  short:
    "Ich unterstütze dich darin, deine eigenen Bedürfnisse ernst zu nehmen und deinen Weg selbstbewusst zu gehen.",
  video: "https://youtu.be/ge-l5t2V5WM",
  tags: [
    "selbstwert",
    "grenzen",
    "beziehungen",
    "selbstfürsorge",
    "bedürfnisse",
    "durchsetzung",
    "konflikte",
    "abhängigkeit",
    "anpassung",
    "emotionale klarheit",
    "selbstwirksamkeit",
    "identität",
    "psychotherapie"
  ],
  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",
  ics: "https://calendar.google.com/calendar/ical/a68d390ae0f3766da51d30eb7beab68d400dbbedae7343247cf2e87a57ab0fde%40group.calendar.google.com/public/basic.ics"
  },
  {
    name: "Sophie",
    role:
      "Klinische und Entwicklungspsychologin, Heilpraktikerin für Psychotherapie und Coach",
    image:
      "https://mypoise.de/wp-content/uploads/2022/11/Foto-sophie-crop-1-e1668080175188.png",
    short:
      "Ich helfe dir, deine Geschichte zu verstehen — und sie so umzuschreiben, dass sie dich stärkt.",
    video: "https://youtu.be/OA4nNWg1nq4",
    tags: ["biografie", "innere anteile", "selbstmitgefühl", "verarbeitung"],
    preis_std: 200,
    preis_ermaessigt: 150,
    status: "frei",
    ics: "https://calendar.google.com/calendar/ical/7de0d517cd8d5ca144fdca0b7c64c96550a43b9fdf0a6071e44bc8b4437aabae%40group.calendar.google.com/public/basic.ics"
  },
  {
    name: "Yanina",
    role:
      "Psychologische Psychotherapeutin (tiefenpsychologisch fundiert)",
    image:
      "https://mypoise.de/wp-content/uploads/2024/11/IMG_7943-scaled-e1732804924432-1022x1024.jpg",
    short:
      "Ich begleite dich fundiert, tief und klar — ohne Druck und ohne Bewertung.",
    video: "https://youtu.be/2axjVpI5vus",
    tags: ["tiefenpsychologie", "beziehung", "identität", "selbstklärung"],
    preis_std: 180,
    preis_ermaessigt: 120,
    status: "frei",
    ics: "https://calendar.google.com/calendar/ical/cf502bdfe6fe6de7fcfe7634f4dab305baaa01a1c04adf21781e4949ad6c0a62%40group.calendar.google.com/public/basic.ics"
  }
];
