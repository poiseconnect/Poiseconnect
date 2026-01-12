
/*
  FIXED VERSION
  - Rechnungsdaten-Block korrekt in <details> gekapselt
  - Alle <div> sauber geschlossen
  - Standardmäßig geschlossen (kein 'open' Attribut)
*/

{/* ================= RECHNUNGSDATEN (Therapeut:in) ================= */}
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

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <div>
        <label>Rechnungssteller / Name</label>
        <input
          value={invoiceSettings.company_name || ""}
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
        <label>Logo URL (optional)</label>
        <input
          value={invoiceSettings.logo_url || ""}
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
          value={invoiceSettings.address || ""}
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
          value={invoiceSettings.iban || ""}
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
        <label>BIC (optional)</label>
        <input
          value={invoiceSettings.bic || ""}
          onChange={(e) =>
            setInvoiceSettings({
              ...invoiceSettings,
              bic: e.target.value,
            })
          }
          style={{ width: "100%" }}
        />
      </div>

      <div>
        <label>Standard-Land</label>
        <select
          value={invoiceSettings.default_vat_country || "AT"}
          onChange={(e) =>
            setInvoiceSettings({
              ...invoiceSettings,
              default_vat_country: e.target.value,
            })
          }
          style={{ width: "100%" }}
        >
          <option value="AT">Österreich</option>
          <option value="DE">Deutschland</option>
        </select>
      </div>

      <div>
        <label>Standard USt %</label>
        <input
          type="number"
          value={invoiceSettings.default_vat_rate ?? 0}
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

    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
      <button
        onClick={async () => {
          const res = await fetch("/api/invoice-settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_email: user.email,
              settings: invoiceSettings,
            }),
          });

          if (!res.ok) {
            alert("Fehler beim Speichern der Rechnungsdaten");
            return;
          }
          alert("Rechnungsdaten gespeichert");
        }}
      >
        💾 Rechnungsdaten speichern
      </button>
    </div>
  </div>
</details>
