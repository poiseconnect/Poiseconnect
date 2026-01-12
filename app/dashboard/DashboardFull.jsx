
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function DashboardFull() {
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState("dashboard");

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    if (filter !== "abrechnung") return;

    let mounted = true;

    async function loadSettings() {
      setInvoiceLoading(true);
      try {
        const res = await fetch("/api/invoice-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_email: user.email }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json?.settings) {
          setInvoiceSettings((prev) => ({ ...prev, ...json.settings }));
        }
      } finally {
        mounted && setInvoiceLoading(false);
      }
    }

    loadSettings();
    return () => {
      mounted = false;
    };
  }, [user, filter]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>

      <button onClick={() => setFilter("abrechnung")}>Abrechnung</button>

      {filter === "abrechnung" && (
        <>
          <h2>💶 Abrechnung</h2>

          <details
            style={{
              marginTop: 10,
              border: "1px solid #eee",
              borderRadius: 10,
              background: "#FAFAFA",
              padding: 10,
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              🧾 Rechnungsdaten (deine Angaben)
            </summary>

            <div style={{ marginTop: 10 }}>
              {invoiceLoading && (
                <div style={{ color: "#777" }}>Lade Rechnungsdaten…</div>
              )}

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
                    value={invoiceSettings.company_name || ""}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        company_name: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label>Logo URL</label>
                  <input
                    value={invoiceSettings.logo_url || ""}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        logo_url: e.target.value,
                      })
                    }
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Adresse</label>
                  <textarea
                    value={invoiceSettings.address || ""}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        address: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label>IBAN</label>
                  <input
                    value={invoiceSettings.iban || ""}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        iban: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label>BIC</label>
                  <input
                    value={invoiceSettings.bic || ""}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        bic: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label>USt-Land</label>
                  <select
                    value={invoiceSettings.default_vat_country}
                    onChange={(e) =>
                      setInvoiceSettings({
                        ...invoiceSettings,
                        default_vat_country: e.target.value,
                      })
                    }
                  >
                    <option value="AT">AT</option>
                    <option value="DE">DE</option>
                  </select>
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
                  />
                </div>
              </div>

              <button
                style={{ marginTop: 12 }}
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
          </details>
        </>
      )}
    </div>
  );
}
