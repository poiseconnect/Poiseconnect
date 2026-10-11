# Einzelrechnungen in sevDesk read-only pruefen

Das lokale Skript `scripts/sevdesk-invoice-readonly.mjs` prueft ausschliesslich
die IDs `135675889` und `135833778` im Konto des vorhandenen autorisierten
Tokens. Es benutzt dieselbe Basis-URL und Authorization-Konvention wie die
bestehende Integration. Keine App-API, SQL-RPC oder Schreibroute wird aufgerufen.

## Ausfuehrung

Node.js 22 und ein bereits autorisierter sevDesk-API-Token sind erforderlich.
Keine neuen Zugriffsrechte vergeben. Ist `SEVDESK_API_TOKEN` bereits sicher in
der eigenen Shell konfiguriert:

```bash
node scripts/sevdesk-invoice-readonly.mjs
```

Alternativ in der eigenen Bash-Shell ohne Schluessel in der History oder Datei:

```bash
(
  read -r -s -p "Vorhandener sevDesk-Token: " SEVDESK_API_TOKEN
  printf '\n'
  export SEVDESK_API_TOKEN
  node scripts/sevdesk-invoice-readonly.mjs
)
```

Nicht in ein aufgezeichnetes Terminal eingeben; kein `set -x`, keine
Screenshots und keinen Token in Chat, Kommandozeile oder Dateien speichern.
Die Subshell beendet ihre lokale Konfiguration danach. Produktions-
Environment-Variablen werden nicht geaendert. Das Skript speichert keine Antwort.

## Ausgabe und Grenzen

- GET auf `Tools/bookkeepingSystemVersion`, `Invoice/{id}` und paginierte
  `Invoice/{id}/getPositions` (1000 Positionen/Seite, maximal 100 Seiten).
- Keine Redirects, automatische Wiederholungen oder Schreibmethoden.
- HTTP 404 wird als nicht gefunden im autorisierten Konto gemeldet.
  400/401/409/500, Netzwerkfehler oder unlesbare Antworten bedeuten dagegen
  nicht verifizierbar, nicht "Rechnung fehlt".
- Status 100: Entwurf; 200: offen/ausgestellt; 750: teilbezahlt; 1000: bezahlt.
  50 und unbekannte Werte erfordern manuelle Pruefung.
- `sendDate` ist ein sevDesk-Versandmarker, kein Beweis fuer Mailzustellung.
  Ohne Marker kann auch manueller Versand nicht ausgeschlossen werden.
- Kontaktdaten werden nicht ausgegeben oder gesondert geladen. Die stabile
  gehashte Kontaktreferenz erlaubt Vergleich der beiden Rechnungen und ist
  pseudonymisiert, nicht garantiert irreversibel anonym.
- Steuerregel-ID, erlaubter Legacy-Steuertyp und Positionssteuersaetze werden
  ausgegeben. Das veraltete Headerfeld `taxRate` wird nicht zur Bewertung
  verwendet. Keine rechtliche Vermutung aus 0 % oder einem Poise-Bundle-Key;
  im Konto die ausdruecklich freigegebene Steuerkonfiguration vergleichen.
- Rechnungsdatum wird explizit in Europe/Vienna formatiert. Eine vorhandene
  Entwurfsnummer ist nicht die endgueltige Rechnungsnummer.
- Keine Freitexte, Anschriften, Namen, E-Mails, Positionstexte, Bodies oder
  Provider-Fehlermeldungen. Rechnungsnummer und Datum sind nur fuer die interne
  Pruefung bestimmt; nicht unnoetig weitergeben.
- Exit-Code 1 bedeutet fehlender Zugang oder eine nicht vollstaendige Pruefung.
  Auch Exit-Code 0 ist keine Freigabe zur Migration oder Rechnungserstellung.

## Mehrere Poise-Zeilen mit derselben sevDesk-ID

Im historischen Code war `sevdesk_invoice_id` im Adminformular editierbar.
`buildEditableCoachInvoicePayload` uebernimmt die eingegebene ID, andernfalls
behaelt es die bestehende ID. Beim Speichern findet kein globaler Abgleich
dieser ID statt. Der neue Unique Index sichert Coach/Jahr/Quartal/Bundle,
nicht die sevDesk-ID. Damit koennen verschiedene erlaubte lokale Zeilen
dieselbe externe ID erhalten. Das ist ein belegter moeglicher Schreibweg,
kein Nachweis der Ursache der konkreten Produktionszeilen.

Historische Importe, manuelle SQL-Verknuepfungen oder kopierte Entwuerfe sind
weitere zu pruefende Hypothesen. Beide Steuer-Bundles sind eigene Rechnungen
und duerfen nicht allein wegen desselben Coach-Quartals dieselbe externe ID
verwenden.

Die historischen manuellen Kopf-/Positions-Syncs luden die lokale sevDesk-ID und
blockieren bei gesetztem Workflowstatus. Historische Verknuepfungen mit
NULL-Status koennen diesen Schutz umgehen: der Positions-Sync ersetzt
Positionen der gemeinsamen externen Rechnung. Deshalb bis zur Klaerung
keinen Sync, keine Erstellung und keine automatische Verknuepfung ausloesen.
Der aktuelle lokale Stand legt beide Schreib-Syncs vollstaendig still.
Die ID ist read-only; Migration 20261012 friert diese Konflikte ohne
Datenbereinigung ein und sichert neue Zuordnungen mit eindeutigen Claims.

## Bereinigungsplan (keine Ausfuehrung)

1. Betroffene Rechnungen organisatorisch fuer Erstellung und Sync sperren.
   Keine neuen Statuswerte ungeprueft in die Datenbank schreiben.
2. Vorhandenen SQL-Preflight ausfuehren. Intern je externer ID lokale IDs,
   Coach-Zuordnung, Periode, Bundle, Steuerbehandlung, Version und Sync-
   Historie aufnehmen; im weitergegebenen Bericht nur aggregierte Befunde.
3. Mit dieser GET-Pruefung Existenz, Kontakt, Zustand und Steuerwerte lesen.
   Ein autorisierter Admin vergleicht im Konto privat Leistungszeitraum,
   Positionen, Betraege und die freigegebene Steuerregel.
4. Nur bei eindeutigem Beleg eine kanonische lokale Verknuepfung bestimmen.
   Ist eine sevDesk-Rechnung aus mehreren Poise-Bundles zusammengesetzt oder
   bleibt die Zuordnung unklar: keine beliebige lokale Zeile auswaehlen.
   Fachliche/accounting-seitige Entscheidung dokumentieren.
5. Nach ausdruecklicher separater Freigabe Wiederherstellung und Auditnachweis
   vorbereiten; falsche Verknuepfungen gezielt versioniert korrigieren.
   Das normale Formular und die Datenbank-Schreibguards erlauben keine
   Korrektur oder Leerung einer bestehenden ID. Die bekannte Quarantaene
   kann nur mit einem separat freigegebenen, gezielten Wartungsplan aufgehoben
   werden. Keine automatisch erstellten Ersatzrechnungen.
6. Ausgestellte/versendete Rechnungen niemals durch Sync korrigieren; etwaige
   fachliche Korrektur/Storno erfolgt ausschliesslich nach menschlicher
   Abrechnungsentscheidung. Entwurfsveraenderungen ebenfalls nur freigegeben.
7. Nach Bereinigung Duplikatpruefung wiederholen. Die lokal implementierte
   globale Verknuepfungspruefung und Unique-Claims sichern neue Zuordnungen;
   ein spaeterer Unique Index auf historische externe IDs darf erst nach
   gesonderter Bestandspruefung und Freigabe beschlossen werden.
   Fuer unterschiedliche Bundles jeweils eindeutige eigene Verknuepfung pruefen.
   Die Schreib-Syncs bleiben dauerhaft stillgelegt; keine Wiederaktivierung
   als Teil einer historischen Bereinigung.

Quelle der API-Feldsemantik: [sevDesk OpenAPI](https://api.sevdesk.de/openapi.yaml).
Die lokale Pruefung ersetzt keinen Produktionsdaten- oder Layoutnachweis.
