export const HEALTH_DATA_CONSENT_VERSION = "2026-10-16-v1";

export const HEALTH_DATA_CONSENT_TEXT =
  "Ich willige ausdrücklich ein, dass die Poise by Linda Leinweber GmbH meine Angaben zu meinem Anliegen, einschließlich möglicher Angaben zu meiner psychischen oder körperlichen Gesundheit, zur Bearbeitung meiner Anfrage und Vermittlung an eine geeignete Fachperson verarbeitet. Ich kann meine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Weitere Informationen finde ich in der Datenschutzerklärung.";

export const HEALTH_DATA_RECIPIENT_NOTICE_VERSION = "2026-10-28-recipient-v1";

export function healthDataRecipientNotice(coachName) {
  return `Ich willige ausdrücklich ein, dass ${coachName} als meine ausgewählte Begleitung meine Angaben zum Anliegen einschließlich möglicher Gesundheitsdaten für die Weiterbetreuung meiner Anfrage erhält und verarbeitet. Diese Freigabe überträgt keinen bisherigen Nachrichtenverlauf und umfasst keine automatische Weiterleitung von Nachrichteninhalten. Ich kann die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.`;
}
