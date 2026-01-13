// DashboardFull.jsx
// FINAL BUILD-OK VERSION
// - Rechnungsdaten <details> korrekt verschachtelt
// - invoiceLoading definiert
// - kein JSX-Leak, build-sicher (Next 14)
// - nichts entfernt

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { teamData } from "../lib/teamData";

import jsPDF from "jspdf";
import "jspdf-autotable";

/* ================= STATUS ================= */

function normalizeStatus(raw) {
  if (!raw) return "offen";
  const s = String(raw).toLowerCase().trim();

  if (["offen", "neu", ""].includes(s)) return "offen";
  if (["termin_neu", "new_appointment"].includes(s)) return "termin_neu";
  if (
    [
      "termin_bestaetigt",
      "termin bestätigt",
      "confirmed",
      "appointment_confirmed",
      "bestaetigt",
    ].includes(s)
  )
    return "termin_bestaetigt";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["kein_match", "no_match"].includes(s)) return "kein_match";
  if (["beendet", "finished"].includes(s)) return "beendet";
  if (["papierkorb"].includes(s)) return "papierkorb";

  return "offen";
}

const STATUS_LABEL = {
  offen: "Neu",
  termin_neu: "Neuer Termin",
  termin_bestaetigt: "Termin bestätigt",
  active: "Begleitung aktiv",
  kein_match: "Kein Match",
  beendet: "Beendet",
  papierkorb: "Papierkorb",
};

/* ================= MODAL ================= */

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          maxWidth: 720,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ================= DASHBOARD ================= */

export default function DashboardFull() {
  const [user, setUser] = useState(null);

  /* ---------- ABRECHNUNG: STATE ---------- */
  const [invoiceSettings, setInvoiceSettings] = useState({
    company_name: "",
    address: "",
    iban: "",
    bic: "",
    logo_url: "",
    default_vat_country: "AT",
    default_vat_rate: 0,
  });
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [filter, setFilter] = useState("unbearbeitet");

  /* ---------- USER ---------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  if (!user) return <div>Bitte einloggen…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      <button onClick={() => setFilter("abrechnung")}>💶 Abrechnung</button>

      {filter === "abrechnung" && (
        <section style={{ marginTop: 20 }}>
          <h2>Abrechnung</h2>

          {/* ===== RECHNUNGSDATEN ===== */}
          <details
            style={{
              marginTop: 10,
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              background: "#fafafa",
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              🧾 Rechnungsdaten (ausklappen)
            </summary>

            <div style={{ marginTop: 12 }}>
              {invoiceLoading && <div>Lade Rechnungsdaten…</div>}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <label>Name / Firma</label>
                  <input
                    value={invoiceSettings.company_name}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        company_name: e.target.value,
                      })
                    }
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label>Logo URL</label>
                  <input
                    value={invoiceSettings.logo_url}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        logo_url: e.target.value,
                      })
                    }
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Adresse</label>
                  <textarea
                    value={invoiceSettings.address}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        address: e.target.value,
                      })
                    }
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label>IBAN</label>
                  <input
                    value={invoiceSettings.iban}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        iban: e.target.value,
                      })
                    }
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label>USt %</label>
                  <input
                    type="number"
                    value={invoiceSettings.default_vat_rate}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        default_vat_rate: Number(e.target.value),
                      })
                    }
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12, textAlign: "right" }}>
                <button
                  onClick={async () => {
                    await fetch("/api/invoice-settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        user_email: user.email,
                        settings: invoiceSettings,
                      }),
                    });
                    alert("Gespeichert");
                  }}
                >
                  💾 Speichern
                </button>
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
