"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function safeDateString(v) {
  if (!v) return "";

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("de-AT", {
    timeZone: "Europe/Vienna",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConfirmProposalPage() {
  const searchParams = useSearchParams();

  // Neuer Link
  const tokenFromUrl = searchParams.get("token");

  // Alter Link
  const legacyRequestId = searchParams.get("request");

  const [token, setToken] = useState(tokenFromUrl || null);
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [requestingNew, setRequestingNew] =
  useState(false);

const [newRequested, setNewRequested] =
  useState(false);

  // ------------------------------------------------
  // ALTEN ?request=... LINK AUFLÖSEN
  // ------------------------------------------------
  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      return;
    }

    if (!legacyRequestId) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          "/api/proposals/resolve-legacy-link",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requestId: legacyRequestId,
            }),
          }
        );

        const data = await res.json();

        if (!res.ok || !data?.token) {
          setInvalid(true);
          setLoading(false);
          return;
        }

        setToken(data.token);
      } catch (e) {
        console.error(
          "LEGACY LINK RESOLVE FAILED:",
          e
        );

        setInvalid(true);
        setLoading(false);
      }
    })();
  }, [tokenFromUrl, legacyRequestId]);

  // ------------------------------------------------
  // VORSCHLÄGE LADEN
  // ------------------------------------------------
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(
          "/api/proposals/list",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          console.error(
            "PROPOSALS LOAD FAILED:",
            data
          );

          setInvalid(true);
          setLoading(false);
          return;
        }

        setProposals(data || []);
        setLoading(false);
      } catch (e) {
        console.error(
          "PROPOSALS LOAD ERROR:",
          e
        );

        setInvalid(true);
        setLoading(false);
      }
    })();
  }, [token]);

  // ------------------------------------------------
  // TERMIN BESTÄTIGEN
  // ------------------------------------------------
  async function confirm(proposalId) {
    if (!token) return;

    const res = await fetch(
      "/api/confirm-proposal",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          proposalId,
        }),
      }
    );

    const data = await res.json();

    if (res.ok) {
      setDone(true);
      return;
    }

    if (res.status === 410) {
      alert(
        data?.message ||
          "Diese Terminvorschläge sind leider abgelaufen."
      );
      return;
    }

    if (res.status === 409) {
      alert(
        data?.message ||
          "Dieser Termin ist inzwischen nicht mehr verfügbar."
      );
      return;
    }

    console.error(
      "CONFIRM PROPOSAL FAILED:",
      data
    );

    alert("Fehler beim Bestätigen");
  }

  // ------------------------------------------------
// NEUE TERMINE ANFORDERN
// ------------------------------------------------

async function requestNewProposals() {
  if (
    !token ||
    requestingNew
  ) {
    return;
  }

  setRequestingNew(true);

  try {
    const res = await fetch(
      "/api/proposals/request-new",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          token,
        }),
      }
    );

    const data =
      await res.json();

    if (!res.ok) {
      console.error(
        "REQUEST NEW PROPOSALS FAILED:",
        data
      );

      alert(
        "Die Anfrage konnte leider nicht übermittelt werden."
      );

      return;
    }

    setNewRequested(true);
  } catch (e) {
    console.error(
      "REQUEST NEW PROPOSALS ERROR:",
      e
    );

    alert(
      "Die Anfrage konnte leider nicht übermittelt werden."
    );
  } finally {
    setRequestingNew(false);
  }
}
  // ------------------------------------------------
  // ANZEIGE
  // ------------------------------------------------

  if (invalid) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Dieser Link ist leider nicht gültig.</h2>

        <p style={{ marginTop: 12 }}>
          Bitte melde dich unter{" "}
          <a href="mailto:hallo@mypoise.de">
            hallo@mypoise.de
          </a>.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        Lade Termine...
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ padding: 40 }}>
        <h2>✅ Danke für deine Terminauswahl!</h2>

        <p style={{ marginTop: 12 }}>
          Dein Terminwunsch wurde erfolgreich übermittelt.
        </p>

        <p style={{ marginTop: 8 }}>
          Dein:e Therapeut:in sendet dir den persönlichen
          Link für den Videocall rechtzeitig per E-Mail zu.
        </p>

        <p style={{ marginTop: 8 }}>
          Sollte der Termin inzwischen nicht mehr verfügbar
          sein, bekommst du automatisch neue
          Terminvorschläge.
        </p>

        <p
          style={{
            marginTop: 18,
            fontWeight: 500,
          }}
        >
          Wir freuen uns auf dich 🤍
        </p>
      </div>
    );
  }
return (
  <div style={{ padding: 40 }}>
    {proposals.length > 0 && (
      <h2>Bitte wähle einen Termin</h2>
    )}

    {proposals.length === 0 &&
      !newRequested && (
        <div>
          <h2>
            Deine Terminvorschläge sind abgelaufen
          </h2>

          <p style={{ marginTop: 12 }}>
            Die bisherigen Termine sind leider
            nicht mehr verfügbar.
          </p>

          <p style={{ marginTop: 8 }}>
            Wenn du weiterhin ein Erstgespräch
            möchtest, kannst du hier ganz einfach
            neue Terminvorschläge anfordern.
          </p>

          <button
            onClick={requestNewProposals}
            disabled={requestingNew}
            style={{
              marginTop: 18,
              padding: "12px 18px",
              borderRadius: 999,
              border: "none",
              background: "#111",
              color: "#fff",
              cursor: requestingNew
                ? "default"
                : "pointer",
              fontWeight: 600,
            }}
          >
            {requestingNew
              ? "Wird gesendet..."
              : "Neue Terminvorschläge anfordern"}
          </button>
        </div>
      )}

    {newRequested && (
      <div>
        <h2>Danke 🤍</h2>

        <p style={{ marginTop: 12 }}>
          Deine Anfrage wurde erfolgreich
          übermittelt.
        </p>

        <p style={{ marginTop: 8 }}>
          Dein:e Therapeut:in kann dir nun
          neue Terminvorschläge senden.
        </p>

        <p
          style={{
            marginTop: 18,
            fontWeight: 500,
          }}
        >
          Wir melden uns bei dir.
        </p>
      </div>
    )}

{proposals.length > 0 &&
  proposals.map((p) => (
      <div
        key={p.id}
        style={{ marginBottom: 12 }}
      >
        <button
          onClick={() => confirm(p.id)}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          {safeDateString(p.date)}
        </button>
      </div>
    ))}
  </div>
);
}
