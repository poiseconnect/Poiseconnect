export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();

    const { anfrageId, client, vorname } = body || {};

    if (!anfrageId || !client) {
      return json({ error: "missing_fields" }, 400);
    }

    const { error } = await supabase
      .from("anfragen")
      .update({
        status: "papierkorb",
        bevorzugte_zeit: null,
      })
      .eq("id", anfrageId);

    if (error) {
      console.error("NO-MATCH ERROR:", error);
      return json({ error: "update_failed" }, 500);
    }

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Zu deiner Anfrage bei Poise",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>
            vielen Dank für deine Anfrage und dein Vertrauen.
            Es freut uns sehr, dass du dir vorstellen kannst, mit uns zu arbeiten 🤍
          </p>

          <p>
            Nach sorgfältiger Prüfung müssen wir dir leider mitteilen,
            dass wir dein Anliegen aktuell <strong>nicht im reinen Online-Setting begleiten können</strong>.
          </p>

          <p>
            Uns ist wichtig, dass unsere Psycholog:innen und Therapeut:innen nah genug dran sind,
            um dich bestmöglich unterstützen zu können.
            Bei manchen Themen ist eine Begleitung vor Ort sinnvoller,
            damit nachhaltige Veränderung und echte Entlastung möglich werden.
          </p>

          <p>
            Deshalb haben wir uns bewusst dafür entschieden,
            nur bestimmte Themen im Online-Setting anzubieten.
          </p>

          <br/>

          <p><strong>Was du jetzt tun kannst:</strong></p>

          <p>
            Damit du schnell passende Unterstützung findest, haben wir dir hier einige Möglichkeiten zusammengestellt:
          </p>

          <p><strong>🇩🇪 Deutschland</strong></p>
          <ul>
            <li>
              <strong>116117 (Kassenärztliche Vereinigung)</strong><br/>
              Über die 116117 erhältst du Hilfe bei der Suche nach Therapieplätzen.<br/>
              Mit einem Dringlichkeitscode vom Hausarzt solltest du innerhalb von ca. 4 Wochen ein Erstgespräch bekommen.<br/>
              👉 <a href="https://www.116117.de">www.116117.de</a>
            </li>
            <li>
              <strong>Ausbildungsinstitute für Psychotherapie</strong><br/>
              Oft kürzere Wartezeiten bei gleichzeitig sehr guter Begleitung.
            </li>
            <li>
              <strong>Tageskliniken</strong><br/>
              Eine gute Option, wenn du intensivere Unterstützung brauchst.
            </li>
          </ul>

          <p><strong>🇦🇹 Österreich</strong></p>
          <ul>
            <li>
              👉 <a href="https://www.psychotherapie.at/">www.psychotherapie.at</a><br/>
              Offizielle Plattform zur Suche nach Psychotherapeut:innen in deiner Nähe.
            </li>
            <li>
              <strong>Klinisch-psychologische Behandlung</strong>
            </li>
            <li>
              <strong>Tageskliniken</strong> als intensivere Alternative
            </li>
          </ul>

          <p><strong>🇨🇭 Schweiz</strong></p>
          <ul>
            <li>
              👉 <a href="https://www.therapievermittlung.ch/">www.therapievermittlung.ch</a><br/>
              Suche nach passenden Therapeut:innen nach Fachrichtung und Region
            </li>
            <li>
              <strong>Tageskliniken</strong> ebenfalls eine gute Option
            </li>
          </ul>

          <br/>

          <p>
            <strong>Wichtig:</strong><br/>
            Falls du dich aktuell in einer akuten Krise befindest,
            zögere bitte nicht, sofort Hilfe in Anspruch zu nehmen:
          </p>

          <ul>
            <li>🇩🇪 Deutschland: 0800 111 0 111</li>
            <li>🇦🇹 Österreich: 142 (TelefonSeelsorge)</li>
            <li>🇨🇭 Schweiz: 143 (Die Dargebotene Hand)</li>
          </ul>

          <br/>

          <p>
            Auch wenn wir dich aktuell nicht begleiten können,
            wünschen wir dir von Herzen, dass du die Unterstützung findest,
            die wirklich gut zu dir passt.
          </p>

          <p>
            Du bist diesen wichtigen Schritt bereits gegangen –
            bleib unbedingt dran 🤍
          </p>

          <br/>

          <p>
            Alles Liebe<br />
            dein Poise-Team
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      const text = await mailRes.text();
      console.warn("NO-MATCH MAIL FAILED – DB UPDATE OK:", text);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("NO-MATCH SERVER ERROR:", e);
    return json({ error: "server_error" }, 500);
  }
}
