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
  name: "Judith",
  role: "Klinische Psychologin",
  qualificationLevel: 2,

  image: "https://mypoise.de/wp-content/uploads/2022/11/Judith_Gross-1300x1300.jpg",

  short:
    "Ich unterstütze dich dabei, innere Belastung zu verstehen, einzuordnen und wieder mehr Stabilität & Leichtigkeit zu finden.",

  video: "https://youtu.be/-BBED_bocu0",

  themes: {
    selbstwert: 3,
    stress: 3,
    depressive_verstimmung: 3,
    emotionales_essen: 3,
    angehoerige: 3,
    krankheit_psychosomatik: 3,
    beziehung_partnerschaft: 3,
    angst_panikattacken: 3,
    beruf_ziele_orientierung: 3,
    burnout: 3,
    trauer: 3,
    sexualitaet: 3,
  },

  keywords: [
    // Selbstwert / Selbstliebe
    "selbstwert", "selbstliebe", "selbstbewusstsein", "selbstvertrauen",
    "ich bin nicht gut genug", "selbstzweifel", "unsicherheit",

    // Stress
    "stress", "überforderung", "innerer druck", "gedankenkreisen", "gereiztheit",
    "schlafprobleme", "schlafstörungen", "nackenschmerzen", "rückenschmerzen",
    "tinnitus", "verdauungsprobleme", "viren anfälligkeit", "libidoverlust", "ausbleibende periode",

    // Depressive Verstimmung
    "depressive verstimmung", "krisen", "erschöpfung", "antriebslosigkeit",
    "leistungsabfall", "konzentrationsprobleme", "innere leere", "soziale isolation",
    "interessenverlust", "gewichtszunahme", "gewichtsabnahme", "aggression", "traurigkeit",

    // Emotionales Essen
    "emotionales essen", "fressanfälle", "binge", "kontrolliertes essen",
    "emotionsregulation", "essverhalten",

    // Angehörige
    "angehörige", "grenzen ziehen", "abgrenzung", "selbstfürsorge", "für andere da sein",
    "verantwortung", "carearbeit",

    // Krankheit / Psychosomatik
    "psychosomatik", "krankheit", "diagnose", "akzeptanz", "körper und psyche",
    "ganzheitlich", "symptome", "schmerzen", "erschöpfung durch krankheit",

    // Beziehung / Partnerschaft
    "beziehung", "partnerschaft", "trennung", "kinderwunsch", "toxische beziehung",
    "freundschaften", "konflikte", "unzufriedener single", "bindung", "nähe", "distanz",

    // Angst / Panik
    "angst", "panik", "panikattacken", "atemnot", "herzrasen", "schwindel",
    "durchfall", "erbrechen", "prüfungsangst", "präsentationsangst",

    // Beruf / Ziele / Orientierung
    "beruf", "job", "arbeitsstress", "umzug", "jobeinstieg", "beförderung",
    "orientierungslos", "ziele", "entscheidungen", "überforderung im job",

    // Burnout
    "burnout", "emotionale erschöpfung", "funktionieren müssen", "dauerstress",
    "keine energie", "ausgebrannt", "überlastung",

    // Trauer
    "trauer", "verlust", "abschied", "fehlgeburt",

    // Sexualität
    "sexualität", "lustlosigkeit", "libido", "schmerzen beim gv",
    "sexuelle orientierungslosigkeit", "erektionsprobleme",

    // Arbeitsstil (aus Profil)
    "stabilität", "struktur", "halt", "emotionaler halt", "leichtigkeit", "erdend", "tempo",
  ],

  tags: ["stress", "stabilität", "erschöpfung", "beziehung"],

  preis_std: 170,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/75c37902f254fc6e9b8e4c73238eb7bd74d1e11a7709a144683a092097335781%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Julius",
  role: "Psychologe, Coach",
  qualificationLevel: 4,

  image: "https://mypoise.de/wp-content/uploads/2023/09/Poise_bild-1300x1300.jpg",

  short:
    "Ich arbeite ressourcenorientiert und klar — wir finden gemeinsam praktikable Schritte, die sich nicht nur gut anhören, sondern wirklich funktionieren.",

  video: "https://youtu.be/YNS5APSbV8Y",

  themes: {
    selbstwert: 1,
    stress: 3,
    depressive_verstimmung: 3,
    angehoerige: 1,
    krankheit_psychosomatik: 1,
    beziehung_partnerschaft: 1,
    angst_panikattacken: 1,
    beruf_ziele_orientierung: 3,
    burnout: 3,
  },

  keywords: [
    // Beruf / Ziele / Orientierung (Tabelle)
    "beruf", "job", "karriere", "umzug", "jobeinstieg", "beförderung",
    "orientierungslos", "ziele", "entscheidungen", "neuorientierung",
    "was ist mir wirklich wichtig", "werte", "prioritäten",

    // Stress (Tabelle)
    "stress", "gedankenkreisen", "druck", "schlafprobleme", "schlafstörungen",
    "gereiztheit", "nacken", "rücken", "tinnitus", "verdauungsprobleme",
    "überforderung", "arbeitsbelastung",

    // Burnout (Tabelle)
    "burnout", "erschöpfung", "ausgebrannt", "funktionieren", "keine energie",
    "leistungsabfall", "konzentrationsprobleme", "dauerstress",

    // Depressive Verstimmung (Tabelle)
    "depressive verstimmung", "krise", "antriebslosigkeit", "innere leere",
    "interessenverlust", "soziale isolation", "hoffnungslosigkeit",

    // Angst / Panik (Tabelle – begleitend möglich)
    "angst", "panik", "prüfungsangst", "präsentationsangst", "herzrasen", "atemnot", "schwindel",

    // Beziehung (Tabelle – begleitend möglich)
    "beziehung", "konflikte", "trennung", "freundschaften",

    // Arbeitsweise (Profil)
    "ressourcenorientiert", "klar", "strukturiert", "praktikable schritte",
    "lösungsorientiert", "auf augenhöhe",
  ],

  tags: ["neuorientierung", "entscheidungen", "stress", "burnout"],

  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/8a00eded0b43b92f02470e3ee4791aee343a9e4226c20e758b5ba2cbca2ba0fc%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Kristin",
  role: "Coach, Heilpraktikerin für Psychotherapie, Trauerbegleiterin",
  qualificationLevel: 5,

  image: "https://mypoise.de/wp-content/uploads/2024/01/202411_CG_LiliKristin_276-1300x1300.jpg",

  short:
    "Ich begleite dich, wenn du Verlust erlebt hast — behutsam, würdevoll und klar.",

  video: "https://youtu.be/z7LUAXxzW7I",

  themes: {
    trauer: 3,
    selbstwert: 1,
    depressive_verstimmung: 1,
  },

  keywords: [
    // Trauer (Tabelle)
    "trauer", "verlust", "abschied", "fehlgeburt", "loslösung",
    "lebensumbrüche", "neubeginn", "transformation", "wellen", "prozess",

    // Depressive Verstimmung (begleitend möglich – Tabelle Begriffe)
    "krise", "traurigkeit", "antriebslosigkeit", "innere leere",
    "schlafstörungen", "interessenverlust", "soziale isolation",

    // Selbstwert (begleitend möglich)
    "selbstwert", "selbstvertrauen", "ich bin nicht gut genug", "selbstzweifel",

    // Arbeitsstil (Profil)
    "weich", "getragen", "würdevoll", "menschlich", "nicht alleine", "halt", "begleitung",
  ],

  tags: ["trauer", "verlust", "abschied", "neubeginn"],

  preis_std: 110,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/693a5cd58448b0e4b9bd86d347a9efc125ed2e8967778fb8386e99c25e4d761b%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Kristin-Sofie",
  role: "Psychologin, Psychotherapeutin",
  qualificationLevel: 1,

  image: "https://mypoise.de/wp-content/uploads/2024/07/DSCF6979-1300x1300.jpg",

  short:
    "Ich begleite dich dabei, Klarheit über deine Gefühle zu bekommen und innere Stabilität aufzubauen — achtsam, ruhig und strukturiert.",

  video: "https://youtu.be/pExhqepTZRQ",

  themes: {
    selbstwert: 1,
    stress: 2,
    depressive_verstimmung: 3,
    emotionales_essen: 2,
    angehoerige: 3,
    krankheit_psychosomatik: 2,
    angst_panikattacken: 3,
    beruf_ziele_orientierung: 3,
    burnout: 3,
    trauer: 2,
  },

  keywords: [
    // Depressive Verstimmung (Tabelle)
    "depressive verstimmung", "krisen", "erschöpfung", "antriebslosigkeit",
    "leistungsabfall", "konzentrationsprobleme", "schlafstörungen",
    "innere leere", "soziale isolation", "interessenverlust",

    // Burnout (Tabelle)
    "burnout", "ausgebrannt", "dauerstress", "funktionieren müssen", "keine energie",
    "überlastung", "emotionale erschöpfung",

    // Angst / Panik (Tabelle)
    "angst", "panik", "panikattacken", "atemnot", "herzrasen", "schwindel",
    "durchfall", "erbrechen", "prüfungsangst", "präsentationsangst", "kontrollverlust",

    // Stress (Tabelle)
    "stress", "gedankenkreisen", "gereiztheit", "schlafprobleme",
    "nackenschmerzen", "rückenschmerzen", "tinnitus", "verdauungsprobleme",

    // Beruf / Ziele / Orientierung (Tabelle)
    "beruf", "job", "umzug", "jobeinstieg", "beförderung", "orientierungslos",
    "ziele", "entscheidung", "neuorientierung",

    // Angehörige (Tabelle)
    "angehörige", "grenzen ziehen", "abgrenzung", "selbstfürsorge", "verantwortung",

    // Krankheit / Psychosomatik (Tabelle)
    "psychosomatik", "krankheit", "diagnose", "körper und psyche", "akzeptanz", "ganzheitlich",

    // Emotionales Essen (Tabelle)
    "emotionales essen", "fressanfälle", "binge", "kontrolliertes essen", "emotionsregulation",

    // Trauer (Tabelle – 2)
    "trauer", "verlust", "abschied", "fehlgeburt",

    // Selbstwert (1)
    "selbstwert", "selbstliebe", "selbstvertrauen", "selbstzweifel", "unsicherheit",

    // Arbeitsstil (Profil)
    "innere stabilität", "emotionale klarheit", "selbstführung", "ruhig", "achtsam", "auf augenhöhe",
  ],

  tags: ["burnout", "angst", "stabilität", "klarheit"],

  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",

  ics: "https://calendar.google.com/calendar/ical/0796b382bb757d367c469af13358ae1bba96756ee606c256bb1e5985cf7f4b82%40group.calendar.google.com/public/basic.ics",
},


 {
  name: "Magdalena",
  role: "Klinische Psychologin, Kinder- und Jugendpsychologin",
  qualificationLevel: 2,

  image:
    "https://mypoise.de/wp-content/uploads/2023/01/Magdalena-e1672744279356-700x700.jpg",

  short:
    "Ich begleite Kinder, Jugendliche, Familien und Erwachsene durch schwierige Entwicklungs- und Lebensphasen.",

  video: "https://youtu.be/b06MFP9AxTg",

  themes: {
    familie: 3,
    beziehung: 3,
    entwicklung: 3,
    stress: 2,
    konfliktthemen: 2,
    trauer: 1,
  },

  keywords: [
    // Familie
    "familie",
    "familienkonflikte",
    "elternschaft",
    "kindererziehung",
    "belastung in der familie",

    // Beziehung
    "beziehung",
    "paarprobleme",
    "konflikte",

    // Entwicklung
    "entwicklung",
    "lebensphasen",
    "übergänge",
    "veränderung",

    // Stress
    "stress",
    "überforderung",

    // Trauer
    "verlust",
    "abschied",

    // Arbeitsweise
    "systemisch",
    "ressourcenorientiert",
    "zugewandt",
    "klar",
  ],

  tags: ["familie", "beziehung", "entwicklung"],

  preis_std: 150,
  preis_ermaessigt: 120,
  status: "frei",

  ics:
    "https://calendar.google.com/calendar/ical/857518f623143d4ba427588f9c5bf2d690fd3082137a06298b53c289d3046fb1%40group.calendar.google.com/public/basic.ics",
},
{
  name: "Marleen",
  role: "Ärztin, Psychotherapeutin",
  qualificationLevel: 1,

  image:
    "https://mypoise.de/wp-content/uploads/2022/11/Foto-Homepage-1300x1300.jpg",

  short:
    "Ich verbinde medizinische Erfahrung, Psychotherapie und Kommunikation – ganzheitlich und reflektiert.",

  video: "https://youtu.be/yXHYgCmN2ug",

  themes: {
    psychosomatik: 3,
    stress: 3,
    depressive_verstimmung: 2,
    burnout: 2,
    selbstführung: 2,
    angst_panik: 1,
  },

  keywords: [
    // Psychosomatik
    "psychosomatik",
    "körperliche symptome",
    "magen",
    "brustenge",
    "schmerzen ohne befund",

    // Stress
    "stress",
    "überlastung",
    "anspannung",

    // Depressive Verstimmung
    "traurigkeit",
    "erschöpfung",

    // Burnout
    "burnout",
    "ausgebrannt",

    // Selbstführung
    "selbstführung",
    "selbstwirksamkeit",
    "klarheit",

    // Arbeitsweise
    "medizinisch",
    "ganzheitlich",
    "reflektiert",
  ],

  tags: ["psychosomatik", "stress", "ganzheitlich"],

  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",

  ics:
    "https://calendar.google.com/calendar/ical/f04835be069493481a3237bc58af0993bebf5ebf93267c8be3a1c2b77ba54800%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Marisa",
  role: "Psychologin, Psychotherapeutin",
  qualificationLevel: 1,

  image:
    "https://mypoise.de/wp-content/uploads/2022/12/IMG_9908-e1669989498337-700x700.jpeg",

  short:
    "Ich unterstütze dich darin, deine eigenen Bedürfnisse ernst zu nehmen, Grenzen zu setzen und deinen Weg selbstbewusst zu gehen.",

  video: "https://youtu.be/ge-l5t2V5WM",

  themes: {
    selbstwert: 3,
    beziehung: 3,
    grenzsetzung: 3,
    depressive_verstimmung: 2,
    stress: 2,
    identität: 1,
  },

  keywords: [
    // Selbstwert
    "selbstwert",
    "selbstvertrauen",
    "sich klein machen",
    "nicht genug sein",
    "innere sicherheit",

    // Grenzen
    "grenzen",
    "abgrenzung",
    "nein sagen",
    "für sich einstehen",
    "überangepasst",

    // Beziehung
    "beziehung",
    "beziehungsprobleme",
    "emotionale abhängigkeit",
    "konflikte",

    // Depressive Verstimmung
    "traurigkeit",
    "erschöpfung",
    "innere leere",

    // Stress
    "stress",
    "überforderung",
    "daueranspannung",

    // Arbeitsweise
    "klar",
    "ermutigend",
    "stärkend",
    "ressourcenorientiert",
  ],

  tags: ["selbstwert", "grenzen", "beziehung"],

  preis_std: 160,
  preis_ermaessigt: 120,
  status: "frei",

  ics:
    "https://calendar.google.com/calendar/ical/a68d390ae0f3766da51d30eb7beab68d400dbbedae7343247cf2e87a57ab0fde%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Sophie",
  role: "Psychologin, Heilpraktikerin für Psychotherapie",
  qualificationLevel: 3,

  image:
    "https://mypoise.de/wp-content/uploads/2022/11/Foto-sophie-crop-1-e1668080175188.png",

  short:
    "Ich helfe dir, deine Geschichte zu verstehen und emotionale Muster liebevoll zu verändern.",

  video: "https://youtu.be/OA4nNWg1nq4",

  themes: {
    identität: 3,
    innere_anteile: 3,
    selbstmitgefühl: 3,
    depressive_verstimmung: 2,
    beziehung: 2,
  },

  keywords: [
    // Identität
    "identität",
    "wer bin ich",
    "selbstbild",

    // Innere Anteile
    "innere anteile",
    "inneres kind",
    "innere konflikte",

    // Selbstmitgefühl
    "selbstmitgefühl",
    "selbstannahme",
    "freundlich mit sich sein",

    // Depressive Verstimmung
    "traurigkeit",
    "innere leere",

    // Beziehung
    "beziehung",
    "bindung",

    // Arbeitsweise
    "biografisch",
    "achtsam",
    "tiefgehend",
  ],

  tags: ["identität", "innere anteile", "selbstmitgefühl"],

  preis_std: 200,
  preis_ermaessigt: 150,
  status: "frei",

  ics:
    "https://calendar.google.com/calendar/ical/7de0d517cd8d5ca144fdca0b7c64c96550a43b9fdf0a6071e44bc8b4437aabae%40group.calendar.google.com/public/basic.ics",
},

  {
  name: "Yanina",
  role: "Psychologin, Psychotherapeutin",
  qualificationLevel: 1,

  image:
    "https://mypoise.de/wp-content/uploads/2024/11/IMG_7943-scaled-e1732804924432-1022x1024.jpg",

  short:
    "Ich begleite dich fundiert, tiefenpsychologisch und klar durch emotionale Prozesse.",

  video: "https://youtu.be/2axjVpI5vus",

  themes: {
    tiefenpsychologie: 3,
    beziehung: 3,
    identität: 3,
    selbstwert: 2,
    depressive_verstimmung: 2,
    angst_panik: 1,
  },

  keywords: [
    // Tiefenpsychologie
    "tiefenpsychologie",
    "unbewusste muster",
    "frühe prägungen",

    // Beziehung
    "beziehung",
    "bindung",
    "beziehungsdynamiken",

    // Identität
    "identität",
    "selbstbild",
    "innere konflikte",

    // Selbstwert
    "selbstwert",
    "selbstzweifel",

    // Depressive Verstimmung
    "traurigkeit",
    "innere leere",

    // Arbeitsweise
    "tief",
    "klar",
    "therapeutisch",
    "sicherer rahmen",
  ],

  tags: ["tiefenpsychologie", "beziehung", "identität"],

  preis_std: 180,
  preis_ermaessigt: 120,
  status: "frei",

  ics:
    "https://calendar.google.com/calendar/ical/cf502bdfe6fe6de7fcfe7634f4dab305baaa01a1c04adf21781e4949ad6c0a62%40group.calendar.google.com/public/basic.ics",
},

];
