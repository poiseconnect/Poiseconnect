export function createProposalMail({ to, replyAlias, clientName, coachName, link }) {
  return {
    from: "Poise <hallo@mypoise.de>",
    to,
    reply_to: replyAlias,
    subject: "Deine Terminvorschläge 🤍",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2 style="margin-bottom: 16px;">Deine Terminvorschläge 🤍</h2>

        <p>Hallo ${clientName || "du"},</p>

        <p>
          ich habe dir passende Terminvorschläge für unser Erstgespräch vorbereitet.
        </p>

        <p>
          Such dir gerne den Termin aus, der für dich am besten passt.
        </p>

        <p>Die Terminvorschläge sind für die nächsten 4 Tage gültig.</p>

        <p style="margin: 24px 0;">
          <a href="${link}" style="background:#111;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;display:inline-block;font-weight:600;">
            Terminvorschläge ansehen
          </a>
        </p>

        <p>
          Sobald du einen Termin ausgewählt hast, erhältst du anschließend noch eine separate Bestätigungsmail mit dem Link zum Erstgespräch.
        </p>

        <p>
          <strong>Keiner der Termine passt?</strong><br />
          Antworte einfach auf diese E-Mail und schreib deinem Coach, wann es bei dir besser passen würde.
        </p>

        <p>Du kannst deinem Coach auch direkt auf der Seite mit den Terminvorschlägen schreiben.</p>

        <p style="margin-top: 24px;">
          Alles Liebe<br />
          ${coachName || "dein Coach"} 🤍
        </p>
      </div>
    `,
  };
}