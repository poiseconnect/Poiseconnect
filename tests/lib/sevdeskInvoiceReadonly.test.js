import { describe, expect, it, vi } from "vitest";
import { inspectInvoices, readJson, summarizeInvoice } from "../../scripts/sevdesk-invoice-readonly.mjs";

const invoice = (id, status = "100") => ({
  id, status, contact: { id: "42", objectName: "Contact", name: "Synthetic private name" },
  invoiceDate: "11.10.2026", invoiceNumber: "RE-2026-123",
  taxRule: { id: "1" }, taxType: "default", taxText: "Private free text",
  sendDate: null, header: "Private heading",
});
const response = (data) => ({ ok: true, status: 200, json: async () => data });

describe("GET-only sevDesk inspection", () => {
  it("only calls allowlisted GET endpoints and removes private fields", async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(options.method).toBe("GET");
      expect(options.redirect).toBe("error");
      if (url.endsWith("bookkeepingSystemVersion")) return response({ objects: { version: "2.0" } });
      if (url.includes("getPositions")) return response({ objects: [{ taxRate: "20", name: "Private position" }] });
      return response({ objects: [invoice(url.split("/").at(-1))] });
    });
    const report = await inspectInvoices("synthetic-secret", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(report.rechnungen[0].positionssteuersaetze).toEqual([20]);
    expect(report.rechnungen[0].kontakt_referenz).toBe(report.rechnungen[1].kontakt_referenz);
    expect(JSON.stringify(report)).not.toMatch(/Private|Synthetic private|synthetic-secret/);
    expect(report.rechnungen[0].invoice_date_vienna).toBe("2026-10-11");
  });

  it("does not equate open/paid status with proven mail delivery", () => {
    const summary = summarizeInvoice(invoice("135675889", "200"), "135675889");
    expect(summary.ausgestellt).toBe(true);
    expect(summary.versand).toContain("nicht_belegt");
    expect(summarizeInvoice({ ...invoice("135675889"), sendDate: "2026-10-11T00:00:00Z" }, "135675889").versand)
      .toContain("keine_zustellbestaetigung");
  });

  it("distinguishes 404 from authentication failure without exposing provider bodies", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("bookkeepingSystemVersion")) return response({ objects: { version: "2.0" } });
      return { ok: false, status: url.endsWith("135675889") ? 404 : 401,
        json: async () => { throw new Error("Must not read provider error body"); } };
    });
    const report = await inspectInvoices("synthetic", fetchImpl);
    expect(report.rechnungen[0].existiert).toBe(false);
    expect(report.rechnungen[1].existiert).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("rejects a mismatched invoice and unknown status without copying free text", () => {
    expect(() => summarizeInvoice(invoice("1"), "135675889")).toThrow("invoice_response_mismatch");
    const report = summarizeInvoice({ ...invoice("135675889", "private status"), invoiceDate: "private date" }, "135675889");
    expect(report.status_code).toBe("unbekannt");
    expect(report.invoice_date_vienna).toBeNull();
  });

  it("marks incomplete position data as unresolved", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("bookkeepingSystemVersion")) return response({ objects: { version: "2.0" } });
      if (url.includes("getPositions")) return response({ objects: [{ taxRate: null }] });
      return response({ objects: [invoice(url.split("/").at(-1))] });
    });
    const report = await inspectInvoices("synthetic", fetchImpl);
    expect(report.rechnungen[0].existiert).toBe(true);
    expect(report.rechnungen[0].positionspruefung).toContain("unvollstaendig");
  });

  it("reads a second position page rather than silently truncating tax rates", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("bookkeepingSystemVersion")) return response({ objects: { version: "2.0" } });
      if (url.includes("getPositions") && url.includes("offset=0")) {
        return response({ objects: Array.from({ length: 1000 }, () => ({ taxRate: 20 })) });
      }
      if (url.includes("getPositions")) return response({ objects: [{ taxRate: 0 }] });
      return response({ objects: [invoice(url.split("/").at(-1))] });
    });
    const report = await inspectInvoices("synthetic", fetchImpl);
    expect(report.rechnungen[0].positionen).toBe(1001);
    expect(report.rechnungen[0].positionssteuersaetze).toEqual([0, 20]);
    expect(fetchImpl).toHaveBeenCalledTimes(7);
  });

  it("does not interpret an empty successful invoice response as proven nonexistence", async () => {
    const fetchImpl = vi.fn(async (url) => url.endsWith("bookkeepingSystemVersion")
      ? response({ objects: { version: "2.0" } }) : response({ objects: [] }));
    const report = await inspectInvoices("synthetic", fetchImpl);
    expect(report.rechnungen[0].existiert).toBeNull();
    expect(report.rechnungen[0].fehlercode).toBe("invoice_response_incomplete");
  });

  it("blocks arbitrary endpoints and missing tokens before fetching", async () => {
    const fetchImpl = vi.fn();
    await expect(readJson("/Invoice/Factory/saveInvoice", "synthetic", fetchImpl)).rejects.toThrow("endpoint_not_allowed");
    await expect(inspectInvoices("", fetchImpl)).rejects.toThrow("sevdesk_api_token_missing");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not retry network failures or expose exception contents", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("synthetic-secret"); });
    const report = await inspectInvoices("synthetic", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(report)).not.toContain("synthetic-secret");
    expect(report.rechnungen.every((item) => item.existiert === null)).toBe(true);
  });
});
