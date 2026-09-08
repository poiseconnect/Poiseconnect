import { describe, expect, it } from "vitest";

/**
 * Mirrors the dashboard filter pipeline for validation:
 *  1) sessionsSafe
 *  2) filteredBillingSessions (Zeitraum + Coach)
 *  3) billingByClient (aggregation by anfrage_id)
 *  4) clientOptions (= billingByClient)
 *  5) filteredBillingSessionsByClient (+ Client)
 *  6) billingByTherapist (reacts to client filter)
 *  7) adminCoachInvoiceBundles (MUST NOT react to client filter)
 */

const sessions = [
  {
    id: "s1",
    date: "2026-07-15",
    therapist_id: "coach-anna",
    anfrage_id: "anfrage-x",
    price: 100,
    anfragen: { vorname: "Klientin", nachname: "X" },
  },
  {
    id: "s2",
    date: "2026-08-10",
    therapist_id: "coach-anna",
    anfrage_id: "anfrage-y",
    price: 150,
    anfragen: { vorname: "Klient", nachname: "Y" },
  },
  {
    id: "s3",
    date: "2026-07-20",
    therapist_id: "coach-berta",
    anfrage_id: "anfrage-x",
    price: 120,
    anfragen: { vorname: "Klientin", nachname: "X" },
  },
  {
    id: "s4",
    date: "2026-01-05", // Q1 2026
    therapist_id: "coach-anna",
    anfrage_id: "anfrage-x",
    price: 90,
    anfragen: { vorname: "Klientin", nachname: "X" },
  },
];

function filterBilling({
  sessions: list,
  billingMode = "quartal",
  billingYear = 2026,
  billingQuarter = 3,
  isAdmin = true,
  therapistFilter = "alle",
}) {
  return list.filter((s) => {
    if (!s?.date) return false;
    const d = new Date(s.date);

    if (
      isAdmin &&
      therapistFilter !== "alle" &&
      String(s.therapist_id) !== String(therapistFilter)
    ) {
      return false;
    }

    if (billingMode === "quartal") {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return d.getFullYear() === billingYear && q === billingQuarter;
    }
    return true;
  });
}

function aggregateByClient(filtered) {
  const map = {};
  filtered.forEach((s) => {
    if (!s?.anfrage_id) return;
    if (!map[s.anfrage_id]) {
      const a = s.anfragen || {};
      map[s.anfrage_id] = {
        anfrage_id: s.anfrage_id,
        klient: `${a.vorname || ""} ${a.nachname || ""}`.trim() || "Unbekannt",
        therapist_id: s.therapist_id,
        sessions: 0,
        umsatz: 0,
        provision: 0,
      };
    }
    map[s.anfrage_id].sessions += 1;
    const price = Number(s.price || 0);
    map[s.anfrage_id].umsatz += price;
    map[s.anfrage_id].provision += price * 0.3;
  });
  return Object.values(map);
}

function aggregateByTherapist(filteredByClient) {
  const map = {};
  filteredByClient.forEach((s) => {
    if (!map[s.therapist_id]) {
      map[s.therapist_id] = {
        therapist_id: s.therapist_id,
        sessions: 0,
        umsatz: 0,
        provision: 0,
      };
    }
    const price = Number(s.price || 0);
    map[s.therapist_id].sessions += 1;
    map[s.therapist_id].umsatz += price;
    map[s.therapist_id].provision += price * 0.3;
  });
  return Object.values(map);
}

describe("admin billing combined filter pipeline", () => {
  it("1. Quartal ohne weitere Filter zeigt alle Sessions des Zeitraums", () => {
    const filtered = filterBilling({ sessions });
    expect(filtered.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("2. Quartal + Coach filtert auf den Coach", () => {
    const filtered = filterBilling({ sessions, therapistFilter: "coach-anna" });
    expect(filtered.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("3. Quartal + Klient:in filtert über anfrage_id", () => {
    const filtered = filterBilling({ sessions });
    const byClient = filtered.filter((s) => s.anfrage_id === "anfrage-x");
    expect(byClient.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("4. Quartal + Coach + Klient:in kombiniert korrekt", () => {
    const filtered = filterBilling({ sessions, therapistFilter: "coach-anna" });
    const byClient = filtered.filter((s) => s.anfrage_id === "anfrage-x");
    expect(byClient.map((s) => s.id)).toEqual(["s1"]);
  });

  it("5. Client-Optionen reagieren auf Coach", () => {
    const anna = filterBilling({ sessions, therapistFilter: "coach-anna" });
    const berta = filterBilling({ sessions, therapistFilter: "coach-berta" });
    const annaClients = aggregateByClient(anna).map((c) => c.anfrage_id).sort();
    const bertaClients = aggregateByClient(berta).map((c) => c.anfrage_id);
    expect(annaClients).toEqual(["anfrage-x", "anfrage-y"]);
    expect(bertaClients).toEqual(["anfrage-x"]);
  });

  it("6. Client-Optionen reagieren auf Zeitraum", () => {
    const q3 = filterBilling({ sessions, billingQuarter: 3 });
    const q1 = filterBilling({ sessions, billingQuarter: 1 });
    expect(aggregateByClient(q3).map((c) => c.anfrage_id).sort()).toEqual([
      "anfrage-x",
      "anfrage-y",
    ]);
    expect(aggregateByClient(q1).map((c) => c.anfrage_id)).toEqual([
      "anfrage-x",
    ]);
  });

  it("7. ungültiger Client wird auf Alle zurückgesetzt", () => {
    const filtered = filterBilling({ sessions, therapistFilter: "coach-berta" });
    const options = aggregateByClient(filtered);
    const selected = "anfrage-y";
    const stillExists = options.some(
      (c) => String(c.anfrage_id) === String(selected)
    );
    expect(stillExists).toBe(false);
    const effective = stillExists ? selected : "alle";
    expect(effective).toBe("alle");
  });

  it("8. sichtbare Summen reagieren auf den Clientfilter", () => {
    const filtered = filterBilling({ sessions });
    const byClientFiltered = filtered.filter(
      (s) => s.anfrage_id === "anfrage-x"
    );
    const therapistRows = aggregateByTherapist(byClientFiltered);
    const total = therapistRows.reduce((sum, r) => sum + r.umsatz, 0);
    expect(total).toBe(220); // s1 (100) + s3 (120)
    expect(therapistRows.length).toBe(2);
  });

  it("9. Coach-Quartalsrechnung bleibt vom Clientfilter unbeeinflusst", () => {
    const filtered = filterBilling({ sessions, therapistFilter: "coach-anna" });
    // Offizielle Rechnung nutzt filteredBillingSessions (Zeitraum+Coach),
    // NICHT filteredBillingSessionsByClient.
    const invoiceSessions = filtered;
    const byClientFiltered = filtered.filter(
      (s) => s.anfrage_id === "anfrage-x"
    );

    const invoiceTotal = invoiceSessions.reduce(
      (sum, s) => sum + Number(s.price || 0),
      0
    );
    const clientFilteredTotal = byClientFiltered.reduce(
      (sum, s) => sum + Number(s.price || 0),
      0
    );

    expect(invoiceTotal).toBe(250); // s1 + s2 — unverändert durch Clientfilter
    expect(clientFilteredTotal).toBe(100); // nur s1 — wäre falsch für offizielle Rechnung
  });

  it("10. Filterung erfolgt ausschließlich über anfrage_id, nicht über Namen", () => {
    const filtered = filterBilling({ sessions });
    const byName = filtered.filter(
      (s) =>
        `${s.anfragen.vorname} ${s.anfragen.nachname}` === "Klientin X"
    );
    const byId = filtered.filter((s) => s.anfrage_id === "anfrage-x");
    expect(byId.length).toBe(byName.length);
    byId.forEach((s) => expect(s.anfrage_id).toBe("anfrage-x"));
  });
});
