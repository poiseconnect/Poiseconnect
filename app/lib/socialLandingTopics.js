import { MATCHING_TOPIC_KEYS } from "./matchingTopics.js";

export const SOCIAL_LANDING_SOURCE = "poise_social_landingpage";

export const UTM_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export const socialLandingTopics = [
  {
    slug: "beziehung",
    landingTopic: "beziehung",
    parentTopic: "partnerschaft_beziehung",
    relatedMatchingTopics: ["partnerschaft_beziehung"],
    klaviyoInterest: "beziehung",
    seoTitle: "Beziehungsimpulse von Poise",
    seoDescription:
      "Kostenlose psychologische Impulse zu Beziehungen, Kommunikation und Bindung.",
    logo: {
      src: "/Poise Logo Transparent Druck.png",
      alt: "Poise by Linda Leinweber",
    },
    image: {
      src: "/linda-beziehung.jpg",
      alt: "Linda Leinweber",
      objectPosition: "center center",
    },
    eyebrow: "Psychologische Impulse für Beziehungen",
    headline: "Impulse für mehr Nähe und Verbindung in deiner Beziehung",
    intro:
      "Trag dich ein und erhalte von Linda psychologisch fundierte, verständliche und alltagstaugliche Impulse zu Kommunikation, Bindung und Konflikten.",
    emailLabel: "Deine E-Mail-Adresse",
    emailPlaceholder: "deine@email.at",
    cta: "Kostenlose Beziehungsimpulse erhalten",
    loadingText: "Wird angemeldet …",
    trustItems: [
      "Psychologisch fundiert",
      "Kostenlos",
      "Jederzeit abbestellbar",
    ],
    privacyText:
      "Mit deiner Anmeldung erhältst du psychologische Impulse, Angebote und Neuigkeiten von Poise per E-Mail. Du kannst dich jederzeit wieder abmelden.",
    successIcon: "💛",
    successHeadline: "Danke für deine Anmeldung!",
    successText:
      "Schau jetzt in dein E-Mail-Postfach. Dort erhältst du in Kürze deine ersten Beziehungsimpulse.",
    note:
      "Die Inhalte ersetzen keine individuelle psychologische Beratung, Psychotherapie oder medizinische Behandlung.",
  },
  {
    slug: "verlustangst",
    landingTopic: "verlustangst",
    parentTopic: "partnerschaft_beziehung",
    relatedMatchingTopics: ["partnerschaft_beziehung", "angst_panik"],
    klaviyoInterest: "verlustangst",
    seoTitle: "Impulse zu Verlustangst in Beziehungen",
    seoDescription:
      "Kostenlose psychologische Impulse zu Verlustangst, Beziehungsmustern und Nähe.",
    logo: {
      src: "/Poise Logo Transparent Druck.png",
      alt: "Poise by Linda Leinweber",
    },
    image: {
      src: "/linda-beziehung.jpg",
      alt: "Linda Leinweber",
      objectPosition: "center center",
    },
    eyebrow: "Psychologische Impulse zu Verlustangst",
    headline:
      "Warum fühlt sich die Angst, jemanden zu verlieren, manchmal so überwältigend an?",
    intro:
      "Trag dich ein und erhalte von Linda verständliche psychologische Impulse rund um Verlustangst, Beziehungsmuster, Selbstwert und mehr Sicherheit in Beziehungen.",
    emailLabel: "Deine E-Mail-Adresse",
    emailPlaceholder: "deine@email.at",
    cta: "Kostenlose Impulse zu Verlustangst erhalten",
    loadingText: "Wird angemeldet …",
    trustItems: [
      "Psychologisch fundiert",
      "Kostenlos",
      "Jederzeit abbestellbar",
    ],
    privacyText:
      "Mit deiner Anmeldung erhältst du psychologische Impulse, Angebote und Neuigkeiten von Poise per E-Mail. Du kannst dich jederzeit wieder abmelden.",
    successIcon: "💛",
    successHeadline: "Danke für deine Anmeldung!",
    successText:
      "Schau jetzt in dein E-Mail-Postfach. Dort erhältst du in Kürze deine ersten Impulse zu Verlustangst und Beziehungen.",
    note:
      "Die Inhalte ersetzen keine individuelle psychologische Beratung, Psychotherapie oder medizinische Behandlung.",
  },
];

export const socialLandingTopicBySlug = Object.fromEntries(
  socialLandingTopics.map((topic) => [topic.slug, topic])
);

export const socialLandingTopicsByLandingTopic = Object.fromEntries(
  socialLandingTopics.map((topic) => [topic.landingTopic, topic])
);

export function getSocialLandingTopic(slug) {
  return socialLandingTopicBySlug[slug] || null;
}

export function isValidSocialLandingTopic(topic) {
  return Boolean(topic && socialLandingTopicsByLandingTopic[topic]);
}

export function isValidParentTopic(topic) {
  return MATCHING_TOPIC_KEYS.includes(topic);
}