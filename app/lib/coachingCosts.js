export const SELF_PAYMENT_NOTICE =
  "Unsere Sitzungen werden nicht von der Krankenkasse übernommen und müssen selbst finanziert werden.";

export function getPublishedSessionPricing(coach, coachingType) {
  const isCouple = coachingType === "paar";
  const price = isCouple ? coach?.paarcoaching_preis : coach?.preis_std;
  const durationMin = isCouple ? coach?.paarcoaching_dauer_min : 60;

  if (
    !Number.isFinite(price) || price <= 0 ||
    !Number.isFinite(durationMin) || durationMin <= 0
  ) {
    return null;
  }

  const reducedPrice = !isCouple && Number.isFinite(coach?.preis_ermaessigt) &&
    coach.preis_ermaessigt > 0 ? coach.preis_ermaessigt : null;

  return { price, durationMin, reducedPrice };
}

export function buildInitialCoachingCostsHtml({ coachName, pricing }) {
  const safeCoachName = String(coachName)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const formatPrice = (value) => value.toLocaleString("de-AT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return `
    <p>
      Der Prozess startet mit einem kostenlosen Erstgespräch von 30 Minuten im Video-Call.
      Danach entscheiden beide Seiten frei, ob sie gemeinsam weiterarbeiten möchten.
    </p>
    <p>
      Weitere Sitzungen sind kostenpflichtig.
      Eine Sitzung (${pricing.durationMin} Min. Video-Call) kostet bei ${safeCoachName} ${formatPrice(pricing.price)} €.
      ${pricing.reducedPrice === null ? "" : `Für Studierende und Auszubildende beträgt der Preis ${formatPrice(pricing.reducedPrice)} €.`}
    </p>
    <p>${SELF_PAYMENT_NOTICE}</p>
  `;
}
