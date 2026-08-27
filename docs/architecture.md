# Systemarchitektur

## Produktiver Datenfluss

Browser
→ Next.js Frontend
→ Next.js API Route
→ Supabase, Google Calendar oder Resend
→ Antwort an den Browser

## Next.js

Next.js enthält:

- öffentliche Formulare,
- Coach-Dashboard,
- Admin-Dashboard,
- API-Routen,
- Mailhandler,
- Terminlogik,
- Abrechnungsfunktionen.

## Supabase

Supabase enthält unter anderem:

- Anfragen,
- Sitzungen,
- Booking-Einstellungen,
- blockierte Zeiträume,
- Rollen,
- Teammitglieder.

## Google Calendar

Google Calendar enthält:

- längere Blöcke mit dem Titel `POISE VERFÜGBAR`,
- separate Erstgesprächstermine,
- separate Folgesitzungen.

## Resend

Resend versendet unter anderem:

- Anfragebestätigungen,
- Terminvorschläge,
- finale Terminbestätigungen,
- Coach-Benachrichtigungen.

## Klaviyo

Klaviyo wird für Newsletter, Impulsserien und Segmentierung verwendet.

## sevDesk

sevDesk wird für Rechnungs- und Abrechnungsprozesse angebunden.

## Kritische technische Regeln

- `POISE VERFÜGBAR` niemals in einen Kliententermin umwandeln.
- Einen gebuchten Termin als eigenes Google Event anlegen.
- Jeden belegten Zeitraum in `blocked_slots` speichern.
- Jede abrechenbare Sitzung in `sessions` speichern.
- Zeitwerte in UTC speichern.
- Zeitwerte für Nutzerinnen und Nutzer in `Europe/Vienna` anzeigen.
- Produktive Zugangsdaten niemals im Repository speichern.

## Aktueller Systemzuschnitt

Die öffentliche Website und die Poise-Connect-App sind getrennte Systeme.

```text
mypoise.de
	WordPress auf Raidboxes mit Elementor
	bestehende Team- und Coach-Detailseiten
	zukünftig: [poise_team] WordPress-Plugin
			 │ serverseitiger wp_remote_get
			 ▼
app.mypoise.de/api/public-team-members
			 │
			 ▼
Poise Connect: Next.js, Supabase, Google Calendar, Resend, Klaviyo, sevDesk
```

WordPress bleibt führend für öffentliche Seiten, Detailseiten, SEO und
Darstellung. Poise Connect ist führend für App-Workflows und liefert der
Website ausschließlich den explizit freigegebenen Public-Datenvertrag. Es gibt
keine produktive Next.js-Teamseite unter `app.mypoise.de/team`.

### WordPress-Integration (geplant, nicht Bestandteil dieses Repositories)

Das spätere WordPress-Plugin `poise-team` soll einen `[poise_team]`-Shortcode
bereitstellen. Elementor bindet ihn über ein Shortcode-Widget ein. Das Plugin
holt Daten serverseitig von `https://app.mypoise.de/api/public-team-members`.
Dadurch ist kein Browser-CORS erforderlich und es sollen keine CORS-Header
allein für WordPress ergänzt werden.

V1-Plugin-Verhalten:

- WordPress-Transient mit ungefähr zehn Minuten TTL und Last-known-good-Fallback
- Themen: OR innerhalb der Gruppe
- Ausbildungen: OR innerhalb der Gruppe
- Themen und Ausbildungen: AND zwischen Gruppen
- vorhandene WordPress-Detailseiten werden über Post Meta `poise_coach_id` auf
	die API-Coach-ID abgebildet; URLs werden nicht in Poise Connect dupliziert
- WordPress implementiert sein eigenes Video-Modal mit derselben `video`-URL

## Team- und Profilarchitektur

### Drei Datenebenen

`teamData` in `app/lib/teamData.js` ist ein statischer Fallback- und
Matchingbestand. Es enthält insbesondere Coach-ID, Bild, allgemeines
Vorstellungsvideo, statische Profilgrunddaten, `qualificationLevel`,
Fallback-Themenscores und Legacy-/Formulardaten.

Supabase ist führend für laufende Dashboard- und Betriebsdaten in
`team_members` und `therapist_booking_settings`. Dashboard-Änderungen erzeugen
keinen Git-Commit. Sie werden dynamisch gelesen und dürfen nicht durch die
Annahme ersetzt werden, `teamData` sei alleinige Source of Truth.

Das Anfrageformular kombiniert drei Verträge:

```text
teamData
	+ /api/form-team-members       (dynamische Profil-Overrides)
	+ /api/public-availability    (Intake, Matching-Scores, Booking-Status)
```

`/api/form-team-members` ersetzt nur vorhandene dynamische Werte über
`mergeFormTeamMembers`. Es liefert Name, Profilrolle, Kurzprofil, Keywords,
Profil-Calendar-Mode, Preise, Paarcoaching und Proposal-Zeitgrenzen. Statische
Matchingfelder wie `qualificationLevel` und Fallback-Scores bleiben erhalten.

`/api/public-team-members` ist bewusst kein Formularvertrag. Er ist die
whitelisted Website-Bridge für WordPress.

### Source-of-Truth-Matrix

| Feld oder Konzept | Fachliche Bedeutung | Führende Quelle und Speicherort | Wichtige Consumer | Öffentlich |
| --- | --- | --- | --- | --- |
| `active` | Teammitglied ist im System aktiv | `team_members.active` | Availability, Admin-Weiterleitung, Public Directory | Nein |
| `available_for_intake` | Nimmt neue Klient:innen an | `team_members.available_for_intake` | Availability, Admin-Weiterleitung, Public Directory | Nur als serverseitiger Filter |
| Systemrolle `role` | Autorisierung, z. B. `admin` oder `therapist` | `team_members.role` | Dashboard- und Admin-APIs | Nein |
| Profilrolle | Öffentliche berufliche Beschreibung | `team_members.profile_role`, Fallback `teamData.role` | Formular, Public Directory | Ja, als `role` |
| `qualificationLevel` | internes Qualification-Rankingsignal | `teamData.qualificationLevel` | aktiver Formular-Matcher | Nein |
| Matching-Scores | dynamische Coach-Themeneignung | `team_members.matching_scores`, Fallback `teamData.scores` | Formularmatching, Public-Topic-Ableitung | Nur abgeleitete Topic-Keys |
| Coach-Bild | öffentliches Profilbild | `teamData.image` | Formular, Public Directory | Ja |
| Coach-Video | allgemeines Vorstellungsvideo | `teamData.video` | Formular, Public Directory, spätere WordPress-Karte | Ja |
| Kurzprofil | öffentliche Kurzbeschreibung | `team_members.profile_short`, Fallback `teamData.short` | Formular, Public Directory | Ja |
| Calendar Mode | Prozessart `proposal`, `booking` oder `ics` | `team_members.profile_calendar_mode`, Fallback `teamData.calendar_mode` | Formular | Nein |
| `booking_enabled` | Booking ist für einen Coach aktiviert | `therapist_booking_settings.booking_enabled` | Availability, Slot-APIs | Nein |
| Proposal-Zeitgrenzen | grober UX-Hinweis für Proposal-Termine | `team_members.proposal_earliest_time` / `proposal_latest_time` | Formular | Nein |
| Strukturierte Zeitpräferenz | frühe grobe Präferenz der Klient:in | `anfragen.structured_time_preference` | Resume, Coach-Auswahl, Proposal-Hinweis | Nein |
| Standard-/ermäßigter Preis | Preisangabe im Formular | `team_members.profile_preis_std` / `profile_preis_ermaessigt`, Fallback `teamData` | Formular | Nein |
| Paarcoaching, Preis, Dauer | Paarcoaching-Angebot | `team_members.paarcoaching`, `paarcoaching_preis`, `paarcoaching_dauer_min` | Formular | Nein |
| `selected_calendar_id` | technischer Google-Kalender | `therapist_booking_settings.selected_calendar_id` | Booking, Proposal, Sessions | Nein |

## Public- und Private-API-Grenze

### `/api/public-team-members`

Diese unauthentifizierte Route ist der einzige vorgesehene Website-Vertrag. Sie
fragt `team_members` serverseitig mit `active = true` und
`available_for_intake = true` ab und wendet zusätzlich die defensive
Testprofil-Erkennung aus `publicCoachDirectory` an.

Der Response ist explizit auf folgende Felder begrenzt:

```text
id, name, role, educationCategories, short, image, video, topics,
topicRelevance, requestUrl
```

`requestUrl` ist eine absolute URL zu `https://app.mypoise.de/` mit der
bestehenden `therapist`-Query-Vorauswahl. Nicht ausgegeben werden
`qualificationLevel`, numerische Scores, `matching_scores`, E-Mail, ICS,
Calendar Mode, Booking-/Proposal-Daten, Preise, Sessions, Rechnungen oder
interne Statusdaten.

`topicRelevance` ist eine reduzierte öffentliche Ableitung der positiven
Themenwerte. Sie verwendet ausschließlich gültige Keys aus
`app/lib/matchingTopics.js`, bevorzugt `team_members.matching_scores` und fällt
auf `teamData.scores` zurück. Das Feld dient ausschließlich dem sanften
öffentlichen Themenranking; es enthält keine Qualification-, Diagnose-,
Leidensdruck- oder Gesamtscores und wird nicht als Qualitätsrangliste
dargestellt.

### Formularverträge

`/api/form-team-members` ist ein schlanker, formularspezifischer
Profil-Override-Vertrag. Er darf nicht als WordPress- oder allgemeiner
Public-Directory-Vertrag wiederverwendet werden.

`/api/public-availability` wird vom unauthentifizierten Anfrageformular für
`active`, `available_for_intake`, `matching_scores` und `booking_enabled`
verwendet. Sein breiterer Response ist historischer Formularbedarf und nicht
für WordPress bestimmt.

## Themen- und Matchingarchitektur

`app/lib/matchingTopics.js` ist die zentrale Definition der fachlichen
Themenkeys, Labels und Beschreibungen. Anfrageformular und Public Directory
verwenden dieselbe Liste. Es darf keine zweite Website-Themenliste entstehen.

Positive Matching-Scores bedeuten Themenpassung. Für das Public Directory wird
ein Coach einem Topic zugeordnet, wenn der wirksame Score größer als null ist;
die Zahl selbst bleibt privat.

### Aktiver Formularmatcher

Der produktiv aktive Matcher liegt in `app/page-client.jsx` im `matchedTeam`
`useMemo`:

1. summiert Scores für ausgewählte Themen,
2. fügt einen rollenbasierten Themenbonus hinzu,
3. berechnet einen dynamisch gewichteten Qualification-Bonus,
4. filtert bei ausgewählten Themen strikt auf `_themeScore > 0`,
5. sortiert nach dem finalen Score.

Themenpassung ist damit Eligibility-Gate. Qualification kann einen Coach ohne
positives Themenmatch nicht sichtbar machen.

`app/lib/qualificationBonus.js` ist die zentrale reine Helper-Implementierung
für Qualification-Bonus, Themenprüfung und Finalscore. Das ältere
`app/lib/matchTeamMembers.js` ist ein Legacy-Text-/Keyword-Helper und nicht der
aktive Anfrageformularpfad. Es nutzt zumindest dieselbe Richtung des
Qualification-Bonus, bleibt aber ein Risiko für zukünftige Drift.

### Qualification Phase 1

`qualificationLevel` ist ein internes Ranking-Signal mit folgender Richtung:

| Level | Basisbonus |
| --- | --- |
| 1 | 2.0 |
| 2 | 1.5 |
| 3 | 1.0 |
| 4 | 0.5 |
| 5 | 0.0 |

### Qualification Phase 2

Der Basisbonus wird mit `getQualificationWeight` gewichtet:

| Leidensdruck | Gewicht |
| --- | --- |
| niedrig | 0.5 |
| mittel oder unbekannt | 1.0 |
| hoch | 1.5 |
| sehr hoch | 2.0 |

`diagnose = ja` addiert `0.5`; `nein`, fehlende oder unbekannte Werte addieren
null. Der maximale Qualification-Bonus ist daher `2.0 × 2.5 = 5.0`. Diese
Gewichtung verändert nur das Ranking innerhalb geeigneter Coaches, nie das
Themen-Gate.

## Future Architecture – Coach Knowledge Base

### Status und Zielbild

Die Coach Knowledge Base, Arbeitstitel „Vorstellungsgespräch 2.0“, ist ein
Produkt- und Architekturkonzept für eine spätere Ausbaustufe. Sie ist noch
nicht implementiert und verändert die aktuelle Matching-Architektur nicht.

Poise soll Coaches langfristig zusätzlich zu Themen-Scores,
`qualificationLevel`, Leidensdruck, Diagnose und Verfügbarkeit über ausdrücklich
bestätigte qualitative Informationen kennen: Arbeitsweise und Haltung je
Themenfeld, Methoden und Übungen, typische Anliegen und besondere Passung
sowie Grenzen und Kriterien für Weitervermittlung. Die fachliche Einheit soll
Coach x Themenfeld sein; der allgemeine Coach-Kurztext (`short`) bleibt davon
getrennt.

### Erhebung und Freigabe

Bevorzugt wird ein strukturiertes Coach-Interview mit Einwilligung zur Audio-
oder Videoaufzeichnung. Der geplante Ablauf ist:

```text
Interview oder kurze Sprachnachricht
	-> Transkript
	-> KI strukturiert die Aussagen
	-> Coach prüft und korrigiert
	-> Coach gibt die Inhalte ausdrücklich frei
	-> freigegebene strukturierte Knowledge Base
```

Spätere Aktualisierung, Korrektur und Rücknahme müssen möglich sein. Audio,
Video und Transkript sind Rohmaterial und werden nicht ungefiltert für Website
oder Matching verwendet. Eine KI-Zusammenfassung ist erst nach Prüfung und
Freigabe fachlich nutzbar.

### Öffentliche und interne Ebene

Die Wissensbasis muss zwei klar getrennte Ebenen unterstützen:

- **Öffentlich:** `public_topic_description` kann bei einem ausgewählten
	Themenfilter auf der Website erscheinen.
- **Intern:** Arbeitsweise, Methoden, Übungen, bevorzugte Fälle, Grenzen und
	Weitervermittlungskriterien können später für interne qualitative
	Matching-Unterstützung genutzt werden, ohne öffentlich angezeigt zu werden.

Perspektivischer Website-Fallback:

```text
kein Themenfilter
	-> allgemeiner short-Text

Themenfilter ausgewählt und public_topic_description vorhanden
	-> themenspezifische Beschreibung

Themenfilter ausgewählt, aber keine public_topic_description vorhanden
	-> Fallback auf allgemeinen short-Text
```

Die bestehende Public-API-Whitelist bleibt verbindlich. Interne
Matching-Informationen, Rohmaterial, Scores und Freigabemetadaten dürfen nicht
versehentlich in den Website-Vertrag gelangen.

### Spätere Nutzung im Matching

Das bestehende deterministische Matching bleibt der fachliche Rahmen. Die
heutigen Signale werden weder ersetzt noch durch eine KI-Entscheidung
überschrieben:

```text
freies Klientenanliegen
	-> Themen und Bedürfnisse
	-> bestehendes regelbasiertes Matching
	+  freigegebene Coach Knowledge Base
	-> qualitative Zusatzpassung und differenziertere Reihenfolge
```

Denkbare spätere Formen sind strukturierte Subkriterien pro Coach/Thema,
manuell gepflegte Tags, Embeddings oder semantische Suche sowie ein
LLM-gestützter Vergleich. Keine dieser Formen ist festgelegt oder
implementiert. Die KI darf differenzieren, aber allein keine Eignung,
Kompetenz oder Weitervermittlung ableiten.

### Konzeptionelle Datenstruktur

Noch ohne Festlegung und ohne Migration ist eine eigene Coach-x-Thema-Struktur
vorzusehen, nicht nur ein einzelnes JSON-Feld:

```text
coach_topic_knowledge
	coach_id
	topic_key
	public_description
	approach
	methods
	exercises
	preferred_cases
	boundaries
	approved_at
	updated_at
```

Die konkrete Tabelle, Versionierung, Rollenfreigabe und Speicherung müssen in
einem späteren, ausdrücklich freigegebenen Architektur- und Datenschutz-Task
entschieden werden.

### KI-Guardrails und Governance

- KI darf keine Arbeitsweisen, Methoden, Kompetenzen, Passungen oder Grenzen
	eines Coaches erfinden oder stillschweigend inferieren.
- Für Website, Matching und Empfehlungen dürfen nur explizit vom Coach
	bestätigte und freigegebene Inhalte verwendet werden.
- Rohaufnahmen und Transkripte sind von der fachlichen Source of Truth zu
	trennen.
- Aufnahmen erfolgen nur mit Einwilligung.
- Keine Klientendaten, Diagnosen oder Gesprächsnotizen in Coach-Profilen oder
	Interviewmaterialien der Knowledge Base speichern.
- Öffentliche und interne Informationen müssen technisch und organisatorisch
	getrennt bleiben.
- Freigegebene Inhalte müssen aktualisierbar und widerrufbar sein.

Dieses Konzept ist **Future Architecture / Product Concept**. Es umfasst
keine aktuelle API, keine Datenbankmigration, keine Änderung am Matching und
keine Implementierung.

## Future Architecture – Poise Messaging V1 / Request Conversations

### Status, Zweck und Umfang

Poise Messaging V1 ist eine geplante Request-basierte Kommunikationsarchitektur.
Sie ist nicht implementiert und darf bestehende Proposal-, Booking-, Kalender-,
Safety- oder Abrechnungsabläufe nicht umgehen. Sie dient nur organisatorischer
Kommunikation wie Terminfindung, Terminänderungen und kurzen Rückfragen; sie ist
kein Therapiechat, Krisenkanal, Notfallsystem oder Klientenportal.

Coach-Nachrichten werden im Dashboard verfasst, an die normale Mailbox der
Klientin oder des Klienten versendet und dort beantwortet. Klient:innen benötigen
keinen Poise-Login und keinen eigenen Chat.

```text
Coach Dashboard
	-> Poise API -> request_messages -> E-Mail-Provider -> Klient:innen-Mailbox
	<- Reply-Alias <- Inbound-Provider <- signierter Webhook <- Poise API
	<- request_messages <- Coach Dashboard
```

### Bestehender Mailstand und Provider

Resend ist heute ausschließlich für Outbound-E-Mails in Request-, Proposal-,
Booking-, Reminder- und Coach-Benachrichtigungsrouten eingesetzt. Die From-
Adresse ist überwiegend `Poise <noreply@mypoise.de>`; die bestehende persönliche
Nachrichtenroute setzt Reply-To auf die Coach-Adresse und speichert keinen
Verlauf. Es gibt aktuell keine Conversation-/Message-Tabellen, keine Inbound-
Route, keinen Receiving-Webhook und keine Header-basierte Thread-Zuordnung.

Resend bietet laut Provider-Dokumentation Inbound-Empfang für verifizierte
Domains, Receiving-Webhooks und den Abruf von Text, HTML und Headers. Ob der
bestehende Account und die Domainverwaltung dafür freigegeben sind, ist im
Repository nicht verifizierbar. Das ist eine spätere Infrastrukturentscheidung,
keine bestehende Projektfunktion.

### Request als Einheit und Conversation-Erstellung

Eine Conversation gehört zu `anfragen.id`, nicht nur zu einem Coach. Sie entsteht
erst nach einer eindeutigen und serverseitig gespeicherten Coach-Zuordnung über
`assigned_therapist_id`. Eine unverbindliche Liste in `admin_therapeuten` darf
nie eine Conversation, Kontaktfreigabe oder Reply-Adresse erzeugen.

Geeignete spätere Erzeugungspunkte sind der Abschluss eines eindeutig
zugeordneten Formular-/Draft-Flows sowie die endgültige Zuweisung bei Proposal-
Bestätigung oder Booking. Die konkrete Aktivierungsregel für Booking ist zu
entscheiden: Empfehlung ist ab bestätigter Buchung, weil dort die Zuordnung und
der organisatorische Bedarf eindeutig sind. Proposal-Messaging darf nach
eindeutiger Zuordnung ergänzend nachfassen, bestätigt Termine aber weiterhin nur
über den bestehenden Proposal-Flow.

Bei Handover oder Coach-Wechsel ist keine automatische Verlaufsfreigabe zulässig.
Zu entscheiden sind: neue Conversation, Zugriff ab Übergabe oder gezielte
Admin-Freigabe des bisherigen Verlaufs. Empfehlung: standardmäßig neue
Conversation oder Zugriff ab Übergabe, da der alte Verlauf sensible Inhalte
enthalten kann.

### Konzeptionelles Datenmodell

Noch ohne Migration sind zwei getrennte Tabellen vorzusehen:

```text
request_conversations
	id, request_id, therapist_id, client_email_snapshot
	reply_token_hash, reply_alias, status, created_at, updated_at, closed_at

request_messages
	id, conversation_id, direction, sender_type
	from_email, to_email, subject, body_text
	provider_message_id, in_reply_to, created_at, read_at, delivery_status
```

`request_id` referenziert `anfragen.id`. Der Server bestimmt Empfängeradresse,
zugehörigen Coach und Reply-Alias aus Conversation und Anfrage; der Client darf
nie eine freie `to_email` übermitteln. Für Inbound-Deduplizierung ist eine
eindeutige Provider-Message-ID erforderlich. Technische Audit-Ereignisse wie
send, failed, inbound received und closed dürfen gespeichert werden, aber nie
Nachrichtenkörper in Serverlogs.

### Reply-Alias, Domain und Threading

Jede Conversation benötigt einen nicht erratbaren Alias wie
`r-<opaque-token>@reply.mypoise.de`. Der Token muss mit einem kryptografisch
sicheren Zufallsgenerator erstellt werden, mindestens 128 Bit Entropie besitzen,
nur gehasht gespeichert werden und bei Abschluss, Handover oder Missbrauch
widerrufbar beziehungsweise rotierbar sein. Der lokale Teil darf keine
vorhersagbare Anfrage-ID enthalten.

`reply.mypoise.de` kann als getrennte Subdomain betrieben werden. Dafür sind
Provider-spezifische Receiving-/MX-DNS-Einträge, Domainverifikation und ein
signierter Receiving-Webhook erforderlich. SPF, DKIM und DMARC für den
Outbound-Absender müssen getrennt geprüft werden; Auswirkungen auf bestehende
Domainverwaltung, Checkdomain oder mailbox.org sind nicht aus dem Repository
ableitbar und vor Umsetzung zu klären.

Outbound-Nachrichten sollen Provider-Message-ID, `In-Reply-To`, `References` und
einen stabilen Subject-Stamm verwenden, soweit Resend dies unterstützt. Das
verbessert E-Mail-Threading, ersetzt aber nicht die Alias-/Token-Zuordnung.

### Inbound, Datenschutz und Berechtigungen

Der Webhook akzeptiert nur gültig signierte Provider-Events, prüft Replay-Schutz,
dedupliziert per Event- und Provider-Message-ID, begrenzt Requests und verarbeitet
idempotent. Der Alias ist nur ein Routinghinweis: Der erwartete Absender wird mit
dem gespeicherten Client-E-Mail-Snapshot verglichen. Abweichende From-Adressen,
Weiterleitungen oder Aliasse müssen in einen sicheren Prüfstatus fallen und
dürfen nicht automatisch als Klientennachricht veröffentlicht werden.

V1 speichert als Source den Plaintext-Body und rendert kein rohes HTML. Der
vollständige Plaintext ist zunächst robuster als fehleranfälliges Entfernen
zitierter Antworten; eine spätere Quoted-Reply-Heuristik darf nur eine Anzeige-
Optimierung sein, nie Datenverlust verursachen. Anhänge werden in V1 weder
gespeichert noch zugänglich gemacht; sie werden verworfen und gegebenenfalls als
technischer Hinweis behandelt.

RLS muss Coach-Zugriff auf Conversations und Messages strikt auf den aktuell
berechtigten `therapist_id` begrenzen. Klient:innen erhalten keinen Datenbank-
oder API-Zugriff. Inbound-Verarbeitung erfolgt serverseitig privilegiert,
authentifiziert aber niemals über einen Client-Request. Admin-Sichtbarkeit ist
offen: volle Einsicht, Metadaten mit Support-Eskalation oder kein Standardzugriff
sind getrennt gegen Datenschutz und Supportbedarf zu entscheiden.

Nachrichten können Gesundheitsdaten enthalten. Vor Umsetzung sind Zugriff,
RLS, Backups, Retention, Export, Löschung und Support-Zugriff datenschutzrechtlich
zu entscheiden. Mögliche Retention-Strategien sind Löschen, Anonymisieren oder
befristete Aufbewahrung nach Abschluss; keine Frist wird hier festgelegt.

### Dashboard, Zustellung und Umsetzung

Der spätere Coach-Bereich gehört an eine berechtigte Anfrage in
`DashboardFull.jsx`: chronologischer ruhiger Verlauf, Absender, Zeit, gelesen/
ungelesen und Composer. Bei Inbound erhält der Coach eine bestehende
E-Mail-Benachrichtigung mit minimalem sicherem Preview und Dashboard-Link.
Unreads benötigen `read_at` und einen Count; mindestens Provider-Ablehnung oder
Sendefehler muss sichtbar sein. Automatische Follow-ups und editierbare Templates
sind spätere Komfortfunktionen, keine V1-Pflicht.

Empfohlene Umsetzungsphasen nach Freigabe:

1. Datenschutz-, Retention-, Handover- und Admin-Sichtbarkeitsentscheidung.
2. Schema, RLS, serverseitige Conversation-Erstellung und Outbound mit
	 Reply-Alias sowie Sendefehlerstatus.
3. Receiving-Domain, DNS, signierter Inbound-Webhook und Idempotenz.
4. Dashboard-Verlauf, Composer, Unread und Coach-Benachrichtigung.
5. Delivery-Events, Support-Audit und optionale Follow-up-/Template-Funktionen.

Dieses Konzept umfasst keine aktuelle Migration, API-Route, Resend-Konfiguration,
DNS-Änderung, Webhook, UI oder Deployment. **ENTSCHEIDUNG ERFORDERLICH:**
Handover-Sichtbarkeit, Admin-Einsicht, Retention, zulässige Aktivierungszeitpunkte
und Infrastruktur-/Domainverantwortung.

### Beschlossene V1-Leitplanken

- **Admin-Zugriff:** Autorisierte Poise-Admins haben technisch vollständige
	Inhaltseinsicht für Support, Qualitätssicherung, Vermittlungsabwicklung und
	Problemklärung. Die normale Admin-UI zeigt zunächst Metadaten wie Coach,
	Klient:in, Anzahl Nachrichten, letzte Aktivität und Ungelesenstatus; Inhalte
	öffnen sich erst durch eine bewusste Aktion. Admin-Inhaltszugriffe sollen
	später auditierbar werden.
- **Proposal:** Messaging wird verfügbar, sobald `anfragen.assigned_therapist_id`
	eindeutig und serverseitig gesetzt ist. In `/api/form-submit` wird dies beim
	finalisierten Request gesetzt; bei `/api/confirm-proposal` wird es spätestens
	zusammen mit `status = termin_bestaetigt` aus `appointment_proposals.therapist_id`
	gesetzt. `admin_therapeuten` ist unverbindlich und niemals ein Trigger.
- **Booking:** Messaging startet erst, wenn `/api/booking/book` die Anfrage mit
	`assigned_therapist_id` auf `status = termin_bestaetigt` aktualisiert hat.
- **Handover:** Der neue Coach erhält eine neue Conversation und niemals
	automatisch den bisherigen Verlauf. Die alte Conversation wird geschlossen;
	ihr Reply-Alias wird widerrufen. Antworten an einen widerrufenen Alias werden
	nicht an den neuen Coach weitergereicht, sondern als geschlossener/reviewbarer
	Inbound-Vorgang für berechtigte Admins behandelt.
- **Anhänge:** V1 speichert, verarbeitet und zeigt keine Anhänge.
- **Abweichende Absender:** Weicht der Inbound-From vom gespeicherten
	Client-E-Mail-Snapshot ab, entsteht keine normale Coach-sichtbare Nachricht,
	sondern ein Review-Status.
- **Empfänger:** Client-Aufrufe übermitteln nur Conversation-/Request-Referenz
	und Nachrichtentext. Client-E-Mail, Coach, Berechtigung und Reply-Alias werden
	ausschließlich serverseitig geladen.

Eine spätere technische Kennzeichnung `possible_external_contact` darf als
Review-Signal für bewusst ausgetauschte externe Kontaktdaten erwogen werden. V1
blockiert oder überwacht E-Mail-Adressen, Telefonnummern und URLs nicht
automatisch, kennzeichnet Messaging aber transparent als Poise-Kommunikationskanal.

### Receiving, DNS und Tokenmodell

Resend dokumentiert als Receiving-Webhook-Event `email.received`. Der Webhook
liefert Metadaten einschließlich `email_id` und `message_id`, jedoch weder Body,
Headers noch Anhänge. Die serverseitige Verarbeitung lädt diese anschließend über
die Receiving-API. Webhook-Signaturen müssen nach der aktuellen
Provider-Spezifikation validiert werden; Event-ID und Provider-Message-ID dienen
der idempotenten Verarbeitung.

Resend Receiving benötigt eine verifizierte Domain und einen providerseitig
vorgegebenen MX-Record. Bei bestehenden MX-Records empfiehlt Resend eine eigene
Subdomain, weil konkurrierende MX-Prioritäten Empfang verhindern oder die
bestehende Mailzustellung stören können. `reply.mypoise.de` ist daher die
bevorzugte isolierte Receiving-Subdomain; die konkrete Catch-all-Unterstützung,
Account-/Tarif-Freigabe sowie alle Recordwerte müssen im Resend-Dashboard
verifiziert werden.

Späterer DNS-Plan, ohne konkrete Providerwerte vorwegzunehmen:

| Bereich | Record-Typ | Host | Zweck | Wertquelle |
| --- | --- | --- | --- | --- |
| Resend Sending | TXT/CNAME nach Provideranweisung | bestehende Sending-Domain | SPF/DKIM/Domainverifikation | Resend-Dashboard |
| Resend Receiving | MX | `reply.mypoise.de` | Inbound an Resend | Resend Receiving-Dashboard |
| Receiving-Verifikation | TXT/CNAME, falls verlangt | `reply.mypoise.de` | Domain-/MX-Verifikation | Resend-Dashboard |
| Bestehende Firmenmail | unveränderte MX/TXT/CNAME | `mypoise.de` | mailbox.org/sonstige Mailzustellung | bestehende DNS-Verwaltung |

DMARC-Policy, Return-Path und Wechselwirkungen mit bestehender mailbox.org- oder
Checkdomain-Verwaltung sind vor Umsetzung mit der zuständigen Domainverwaltung
zu prüfen. Sie sind im Repository nicht verifizierbar.

Für V1 ist die kleinste robuste Alias-Lösung: Alias vollständig und eindeutig
speichern, den zufälligen Token nur als Hash speichern und den vollständigen Alias
bei der Conversation-Erstellung einmalig für `Reply-To` erzeugen. Ein Klartext-
Token muss danach nicht rekonstruiert werden. Das vermeidet reversibel gespeicherte
Tokens und ist einfacher als eine zusätzliche Verschlüsselungs- oder HMAC-Schicht.

### Lifecycle, Retention und Transparenz

`open` bezeichnet eine aktive Conversation; `closed` beendet Outbound und
widerruft den Alias; `review` hält Senderabweichungen oder Antworten auf alte
Aliases für Admin-Prüfung zurück. Reopen ist nur über eine bewusst autorisierte
neue Conversation oder Alias-Rotation zulässig, nicht durch eine beliebige
eingehende E-Mail.

`closed_at` und `retention_until` sollten von Anfang an im konzeptionellen Modell
vorgesehen werden, obwohl die Retention-Frist erst nach Datenschutz- und
Rechtsprüfung festgelegt wird. Ein separates `conversation_access_log` für
`admin_user_id`, `conversation_id`, `accessed_at` und optionalen Grund ist für
V1 empfohlen, aber kein Blocker, sofern die administrative Einsicht ausdrücklich
eingeschränkt und der Zugriff technisch nachvollziehbar umgesetzt wird.

Vorgeschlagener, noch rechtlich zu prüfender Hinweis für Composer und Mailfooter:
„Dieser Nachrichtenweg dient organisatorischen Absprachen rund um Anfrage und
Termine. Bitte sende keine sensiblen gesundheitlichen Informationen per E-Mail.“

Vorgeschlagener Transparenzhinweis: „Nachrichten werden über Poise verarbeitet
und können von autorisierten Poise-Mitarbeitenden im Rahmen von Support,
Qualitätssicherung und Vermittlungsabwicklung eingesehen werden.“

### Vor Implementierung zu bereinigende Logs

Messaging darf nicht auf den bestehenden PII-Logging-Mustern aufbauen. Der Audit
identifizierte folgende priorisierte Beispiele:

- **P0:** vollständige Request-Bodies in `/api/booking/book`,
	`/api/proposals/create`, `/api/new-appointment`, `/api/add-session`,
	`/api/add-sessions-batch`, `/api/confirm-appointment`, `/api/match-client` und
	`/api/reject-appointment`; diese können Anliegen, Diagnose, Kontaktdaten oder
	Termin-/Tokeninformationen enthalten.
- **P1:** geladene Request-/Client-Objekte und Mailziele in `/api/booking/book`,
	E-Mail-/Videolink-Werte in `/api/confirm-proposal` sowie E-Mail-Antworttexte in
	`/api/admin-forward`.
- **P2:** technische IDs, Status und Fehlercodes sind zulässig, sofern keine
	personenbeziehbaren Zusatzwerte mitgeloggt werden.

Die P0-/P1-Logs sind ein Sicherheitsblocker für die Messaging-Implementierung und
müssen als separater Security-Task vor der Speicherung oder Verarbeitung von
Nachrichtenkörpern bereinigt werden.

## Collaboration Architecture – Poise Partner / Poise Netzwerk

### Status und Modelle

Poise Partner und Poise Netzwerk sind ein **Product / Collaboration
Architecture**-Konzept. Es ist noch nicht implementiert und hängt davon ab, ob
Coaches künftig tatsächlich zwischen beiden Modellen wählen. Es verändert weder
das aktuelle Matching noch die öffentliche Website oder Datenstruktur.

- **Poise Partner:** enge, kontinuierliche persönliche und fachliche
	Zusammenarbeit mit Poise. Orientierung sind etwa ein gemeinsames Austausch-
	oder Supervisionsformat pro Quartal, ein Teamtreffen mindestens alle zwei
	Jahre, Fortbildungen, Impulse und gemeinsame Qualitätssicherung.
- **Poise Netzwerk:** flexiblere Zusammenarbeit. Netzwerk-Coaches sind von
	Poise ausgewählt, fachlich passend, sichtbar und vermittelbar, arbeiten aber
	eigenständiger und ohne verpflichtende regelmäßige Supervision oder
	Teamtreffen.

Die Orientierungswerte für Partner:innen sind bewusst weich. Partnerstatus ist
gelebte Zusammenarbeit und keine Checklisten-Zertifizierung; bei nachlassendem
Kontakt soll die Verbindung angesprochen und gemeinsam überprüft werden.

### Vermittlungsprinzip

Partnerstatus ist kein fachlicher Matchingbonus und kein Ersatz für
Themenpassung, `qualificationLevel`, diagnostische Eignung, fachliche Kompetenz
oder die Coach Knowledge Base. Netzwerkstatus ist keine Qualitätsminderung und
darf nie als zweite Kategorie, geringere Verifikation oder geringere
Vertrauenswürdigkeit kommuniziert oder interpretiert werden.

Die fachliche Passung und Eignung für das konkrete Anliegen bleiben primär. Bei
vergleichbarer fachlicher Passung kann eine engere und aktuellere Kenntnis der
Arbeitsweise eines Coaches als nachrangiges Kriterium berücksichtigt werden.
Damit wird nicht der Status „Partner“ bevorzugt, sondern die belegbare Kenntnis
über Arbeitsweise und Zusammenarbeit als Vermittlungssicherheit genutzt.

Langfristig kann diese Kenntnis mit der Coach Knowledge Base zusammenwachsen:
Entscheidend soll nicht nur sein, dass ein Coach Partner ist, sondern wie gut
Poise die freigegebene Arbeitsweise, Haltung, Methoden, Passung und Grenzen
kennt. Ein möglicher späterer Wert „Knowledge Confidence“ ist nur eine
konzeptionelle Idee und darf weder jetzt als Score noch als Ranking implementiert
werden.

### Mögliche öffentliche Darstellung

Eine spätere Website-Kennzeichnung ist optional: Nur Poise Partner:innen könnten
ein kleines positives Kennzeichen wie „Poise Partner“ erhalten. Netzwerk-Coaches
erhalten kein gegenteiliges Badge. Eine mögliche Erklärung ist, dass Poise
Partner:innen durch regelmäßigen persönlichen und fachlichen Austausch,
Supervision, Fortbildungen und Qualitätssicherung besonders gut bekannt sind.

Es darf nicht kommuniziert werden, dass Partner pauschal bevorzugt oder
Netzwerk-Coaches nachrangig vermittelt werden. Bestehende WordPress-
Detailseiten, Public-API und Karten werden dafür jetzt nicht geändert.

### Spätere technische Entscheidung

Falls beide Modelle nach den Coach-Rückmeldungen tatsächlich genutzt werden,
könnte ein projekttypisches Feld wie `collaboration_model` mit den Werten
`partner` und `network` sinnvoll sein. Es gibt hierfür keine festgelegte
Datenstruktur, Migration, API, UI oder Matchinglogik.

Falls alle Coaches Poise Partner wählen, kann eine technische Abbildung des
Netzwerkstatus, ein Badge auf jeder Karte und zusätzliche Matching- oder
UI-Logik entfallen. Implementierung erst nach den Rückmeldungen entscheiden.

## Verfügbarkeit, Admin und Termine

Folgende Konzepte sind strikt getrennt:

1. `available_for_intake`: Nimmt ein Coach neue Klient:innen an?
2. Calendar Mode: Welcher Prozess (`proposal`, `booking`, `ics`) wird genutzt?
3. Konkrete Kalenderverfügbarkeit: Welche Termine sind tatsächlich frei?

Calendar Mode und freie Slots dürfen nicht als Intake-Verfügbarkeit
interpretiert werden.

`app/lib/intakeAvailability.js` zentralisiert die Regel für neue
Vermittlungen. `/api/admin-forward` prüft beim POST erneut
`active === true && available_for_intake === true` und lehnt ungültige Coaches
ab. Das schützt gegen eine Statusänderung zwischen Dialogöffnung und Absenden.
Historisch ausgewählte `admin_therapeuten` bleiben im Admin-Kontext sichtbar;
Handover ist nicht automatisch eine Neuvermittlung.

### Proposal, Booking und Resume

- `proposal`: Coach erstellt `appointment_proposals`; Proposal-Zeitgrenzen und
	`structured_time_preference` sind nur UX-Hinweise, keine harte
	serverseitige Zeitvalidierung.
- `booking`: `/api/booking/free-slots` leitet buchbare Teilslots aus
	`POISE VERFÜGBAR`-Blöcken, Booking-Einstellungen und `blocked_slots` ab.
	`/api/booking/book` erstellt einen separaten Kliententermin und sperrt ihn;
	der Availability-Block wird nicht umgewandelt oder gelöscht.
- `resume`: `proposalTimePreference` entscheidet für Coach-Auswahl-Resumes
	(`admin`, `5`, `8`), ob zuerst die strukturierte Zeitpräferenz erfragt wird.
- Reschedule: `/api/new-appointment` löscht nur den konkreten Kliententermin
	und den zugehörigen `blocked_slots`-Eintrag; `POISE VERFÜGBAR` bleibt
	unverändert.

## Sessions und Billing

`sessions` ist die führende Quelle für abrechenbare Sitzungen. `blocked_slots`
ist ausschließlich Kollisions- und Belegungsdatenbestand. Session- und
Invoice-Routen arbeiten auf `sessions`, `anfragen`, `invoices`,
`therapist_invoice_settings` und `team_members`; Google-Event-IDs sind
technische Referenzen, keine Abrechnungsquelle.

## Wichtige API-Gruppen

| Gruppe | Beispiele | Zweck und Source of Truth |
| --- | --- | --- |
| Website Public | `/api/public-team-members` | Whitelisted Website-Daten aus `team_members` und `teamData` |
| Formular | `/api/form-team-members`, `/api/form-submit` | Profil-Overrides und Persistenz nach `anfragen` |
| Matching/Availability | `/api/public-availability`, `/api/team-members/matching-scores` | Intake-, Booking- und Score-Daten aus `team_members` und Booking Settings |
| Coach | `/api/team-members/profile`, `/api/therapist/*` | Authentifiziertes Coach-Profil, Sessions und Billing |
| Admin | `/api/admin-forward`, `/api/dashboard/*`, `/api/requests/*` | Authentifizierte Admin- und Dashboard-Workflows |
| Proposal | `/api/proposals/*`, `/api/confirm-proposal` | Vorschläge, Reservierungen und Bestätigung |
| Booking | `/api/booking/*`, `/api/confirm-appointment`, `/api/new-appointment` | Slots, Buchung, Bestätigung und Reschedule |
| Sessions/Billing | `/api/add-session`, `/api/delete-session`, `/api/invoices/*` | Sitzungen, Rechnungen und Payout-Grundlagen |
| Cron | `/api/cron/*`, `/api/reminders/send` | Erinnerungen und Ablaufprozesse |

## Verifizierte Risiken und Tech Debt

### P0 – Schutz personenbezogener Daten in Logs

Mehrere terminbezogene Routen protokollieren vollständige Request-Bodies oder
geladene Anfrageobjekte, unter anderem `/api/booking/book`,
`/api/proposals/create`, `/api/new-appointment` und `/api/add-session`.
Diese Flüsse verarbeiten sensible Klient:innen- und Termindaten. Das verstößt
gegen die Logging-Regel aus `docs/security.md` und muss vor einer breiteren
Produktionsexposition als separater Security-Task bereinigt werden.

### P1 – Breiter historischer Availability-Vertrag

`/api/public-availability` ist ohne Authentifizierung erreichbar und gibt
`matching_scores` sowie `booking_enabled` zurück, weil das Anfrageformular sie
heute verwendet. Er ist nicht der WordPress-Public-Vertrag. Eine spätere
Härtung sollte den tatsächlichen Browserbedarf minimieren und das Themenmatching
serverseitig bewerten, ohne den aktuellen Formularflow ungetestet zu brechen.

### P1 – Statische und dynamische Teamdaten

`teamData` bleibt für Bild, Video, Qualification und Fallback-Matching nötig;
Supabase überschreibt laufende Profil- und Betriebsdaten. Jede neue Teamfunktion
muss diese Kombination bewusst wählen. Ein vollständiger Ersatz ohne
Migrations- und Regressionplan wäre riskant.

### P2 – Legacy-Matchinghelper

`matchTeamMembers.js` ist nicht der aktive Anfrageformularpfad. Seine
Text-/Keyword-Logik und der aktive strukturierte Matcher können langfristig
driften. Vor Änderungen muss entschieden werden, ob er migriert oder explizit
stillgelegt wird.

### P2 – Generierte Karten aktualisieren

Dateien unter `docs/generated/` sind automatisch erzeugt. Ihre Header weisen
auf `scripts/generate-project-map.mjs` hin. Nach größeren API-Strukturänderungen
soll der Generator bewusst ausgeführt und sein Ergebnis geprüft werden; diese
Dateien dürfen nicht manuell geändert werden.

### P3 – Alte Resume- und Routenvielfalt

Mehrere Resume-Modi und historische API-Pfade sind produktiv relevant. Sie
sollten nicht ohne Workflow-Tests vereinfacht oder entfernt werden.