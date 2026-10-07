// Reine, testbare Bausteine für die Admin-Aktion "Erneut Kontakt aufnehmen"
// im Tab "Wartet auf Klient:in" (anfragen.status = "admin_vorschlaege_gesendet").
// Diese Datei enthält bewusst keinen Netzwerk- oder Supabase-Zugriff, damit
// sie ohne Mocking getestet werden kann.

export const REENGAGEMENT_SUBJECT = "Möchtest du noch einen passenden Coach finden?";

// Begrenzung einer einzelnen Anfrage, damit "Alle auswählen" nicht versehentlich
// zu einem unkontrolliert großen Versand werden kann. Für die aktuelle Tab-Größe
// (einstellige/niedrige zweistellige Anzahl) bewusst konservativ gewählt.
export const MAX_BATCH_SIZE = 50;

export function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

// Baut den personalisierten Mailtext. Fehlt der Vorname, wird eine neutrale
// Anrede verwendet statt eine leere oder falsche Anrede zu erzeugen.
export function buildReengagementEmail({ vorname } = {}) {
  const trimmedName = typeof vorname === "string" ? vorname.trim() : "";
  const greetingName = trimmedName ? escapeHtml(trimmedName) : "liebe:r Interessent:in";
  const greetingNameText = trimmedName || "liebe:r Interessent:in";

  const html = `
    <p>Hallo ${greetingName},</p>

    <p>
      wir hatten dir vor einiger Zeit alternative Coaches vorgeschlagen.
      Deshalb möchten wir noch einmal nachfragen: Wünschst du dir weiterhin
      Unterstützung bei der Suche nach einem passenden Coach?
    </p>

    <p>
      Wenn du noch Interesse hast oder bei der Auswahl unsicher bist,
      antworte einfach auf diese Mail. Wir helfen dir gerne weiter.
    </p>

    <p>
      Falls du inzwischen keine Begleitung mehr suchst, ist das natürlich
      auch in Ordnung.
    </p>

    <p>
      Liebe Grüße<br />
      Linda und Sebastian<br />
      Poise
    </p>
  `;

  const text = [
    `Hallo ${greetingNameText},`,
    "",
    "wir hatten dir vor einiger Zeit alternative Coaches vorgeschlagen.",
    "Deshalb möchten wir noch einmal nachfragen: Wünschst du dir weiterhin",
    "Unterstützung bei der Suche nach einem passenden Coach?",
    "",
    "Wenn du noch Interesse hast oder bei der Auswahl unsicher bist,",
    "antworte einfach auf diese Mail. Wir helfen dir gerne weiter.",
    "",
    "Falls du inzwischen keine Begleitung mehr suchst, ist das natürlich",
    "auch in Ordnung.",
    "",
    "Liebe Grüße",
    "Linda und Sebastian",
    "Poise",
  ].join("\n");

  return { subject: REENGAGEMENT_SUBJECT, html, text };
}

// Ordnet eine Provider-Antwort einem von drei Ergebnissen zu. 2xx gilt als
// "vom Provider angenommen" (nicht als bestätigte Zustellung). 400/401/403/404/422
// gelten als eindeutig fehlgeschlagen. Alles andere (u. a. 429/5xx, Timeouts,
// Verbindungsabbrüche) gilt als unbekannt und darf nicht automatisch wiederholt
// werden.
export function classifySendOutcome({ ok, status, threwException } = {}) {
  if (threwException) {
    return "unknown";
  }
  if (ok && typeof status === "number" && status >= 200 && status < 300) {
    return "sent";
  }
  if ([400, 401, 403, 404, 422].includes(status)) {
    return "failed";
  }
  return "unknown";
}

export function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
