import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SELF_PAYMENT_NOTICE,
  buildInitialCoachingCostsHtml,
  getPublishedSessionPricing,
} from "../../app/lib/coachingCosts.js";

describe("initial coaching cost communication", () => {
  it("states free intake, mutual choice, paid sessions and self-payment explicitly", () => {
    const pricing = getPublishedSessionPricing({ preis_std: 150, preis_ermaessigt: 120 }, "einzel");
    const html = buildInitialCoachingCostsHtml({ coachName: "Testcoach", pricing });
    expect(html).toContain("kostenlosen Erstgespräch von 30 Minuten im Video-Call");
    expect(html).toContain("Danach entscheiden beide Seiten frei");
    expect(html).toContain("Weitere Sitzungen sind kostenpflichtig.");
    expect(html).toContain("Eine Sitzung (60 Min. Video-Call) kostet bei Testcoach 150 €.");
    expect(html).toContain("Für Studierende und Auszubildende beträgt der Preis 120 €.");
    expect(html).toContain(SELF_PAYMENT_NOTICE);
  });

  it.each([null, undefined, 0, -1, NaN])("omits an unavailable reduced rate (%s)", (reducedPrice) => {
    const pricing = getPublishedSessionPricing({ preis_std: 150, preis_ermaessigt: reducedPrice }, "einzel");
    const html = buildInitialCoachingCostsHtml({ coachName: "Testcoach", pricing });
    expect(html).not.toContain("Studierende");
    expect(html).not.toMatch(/null|undefined|NaN/);
  });

  it("uses the published couple duration and price, never the single/reduced tariff", () => {
    const pricing = getPublishedSessionPricing({
      preis_std: 150,
      preis_ermaessigt: 120,
      paarcoaching_preis: 240.5,
      paarcoaching_dauer_min: 90,
    }, "paar");
    const html = buildInitialCoachingCostsHtml({ coachName: "Testcoach", pricing });
    expect(html).toContain("Eine Sitzung (90 Min. Video-Call) kostet bei Testcoach 240,5 €.");
    expect(html).not.toContain("60 Min.");
    expect(html).not.toContain("Studierende");
  });

  it.each([null, undefined, 0, -1, NaN, Infinity])("rejects invalid mandatory rates (%s)", (price) => {
    expect(getPublishedSessionPricing({ preis_std: price }, "einzel")).toBeNull();
    expect(getPublishedSessionPricing({ paarcoaching_preis: price, paarcoaching_dauer_min: 90 }, "paar")).toBeNull();
  });

  it.each([null, undefined, 0, -1, NaN, Infinity])("rejects invalid couple durations (%s)", (durationMin) => {
    expect(getPublishedSessionPricing({ paarcoaching_preis: 240, paarcoaching_dauer_min: durationMin }, "paar")).toBeNull();
  });

  it("escapes the dynamically published coach name", () => {
    const html = buildInitialCoachingCostsHtml({
      coachName: '<Test & "Coach">',
      pricing: { price: 150, durationMin: 60, reducedPrice: null },
    });
    expect(html).toContain("&lt;Test &amp; &quot;Coach&quot;&gt;");
    expect(html).not.toContain("<Test");
  });

  it("uses the same unequivocal notice for both form coaching types", () => {
    const source = readFileSync("app/page-client.jsx", "utf8");
    expect(source.match(/\$\{SELF_PAYMENT_NOTICE\}/g)).toHaveLength(2);
    expect(source.match(/Das Erstgespräch \(30 Min\. Video-Call\) ist kostenlos\./g)).toHaveLength(2);
    expect(source).not.toContain("Eine Kostenübernahme kann möglich sein");
    expect(source).toContain("kostenpflichtige Selbstzahlerleistungen");
    expect(SELF_PAYMENT_NOTICE).toBe("Unsere Sitzungen werden nicht von der Krankenkasse übernommen und müssen selbst finanziert werden.");
  });
});
