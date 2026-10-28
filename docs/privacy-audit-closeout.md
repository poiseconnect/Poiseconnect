# Poise Connect – Datenschutz-Audit-Abschluss und Vorbereitung der Datenschutzerklärung

**Stand:** 27. Oktober 2026
**Modus:** Read-only-Analyse; dieses Dokument ist keine rechtliche Freigabe und keine veröffentlichungsfertige Datenschutzerklärung.

## 1. Ergebnis und Beweismaß

Der Audit baut auf der vorherigen technischen Bestandsaufnahme und der im Chat bereitgestellten ursprünglichen Datenschutzerklärung (313 Zeilen) auf. Der Quellcode, die vorhandenen Projektunterlagen und die SQL-Migrationen wurden lokal eingesehen. Es wurden keine produktiven Daten, Logs, Providerkonten, Datenbanken oder Deployment-Einstellungen abgerufen. Es wurden keine Migrationen ausgeführt und keine bestehenden Dateien oder Funktionen verändert.

Die vorhandene Arbeitskopie enthält bereits Änderungen anderer Arbeiten. Diese wurden nicht bearbeitet. Dieses Dokument ist die einzige neu erstellte Datei.

Jede Aussage ist einer dieser Evidenzklassen zuzuordnen:

1. **Im Code nachgewiesen:** Verhalten oder Datenfelder sind in einer Repository-Datei implementiert. Das beweist nicht, dass die betreffende Konfiguration produktiv aktiv ist.
2. **In Konfiguration/Dokumentation nachgewiesen:** Aussage steht in Projektunterlagen oder einer lokalen Konfiguration; ein produktiver Zustand ist damit nicht bewiesen.
3. **Historisch erwähnt:** Aussage steht in der übermittelten alten Datenschutzerklärung oder in älterer Projektdokumentation; aktuelle Verwendung ist offen.
4. **Technisch nicht verifizierbar:** Erfordert Produktivzugriff, Plugin-/Kontoprüfung, Providervertrag, Deployment-/RLS-Nachweis oder andere externe Belege.
5. **Rechtlich/organisatorisch zu klären:** Benötigt eine verantwortliche Person bzw. Datenschutzberatung.

**Gesamturteil:** Die technische Grundlage ist besser abgegrenzt, aber nicht vollständig produktiv verifiziert. Eine konsolidierte Veröffentlichungsversion kann erst nach Abschluss der als kritisch markierten Nachweise freigegeben werden.

## 2. Priorisierte Befunde

| Priorität | Befund | Evidenz / Folge |
|---|---|---|
| **Kritisch** | Öffentlich abrufbare API-Antworten enthalten Matching-Scores. | `GET /api/public-availability` gibt `matching_scores` aus; `GET /api/public-matching-profiles` gibt sie ebenfalls aus. Zusätzlich liefert der Public-Team-Mapper `topicRelevance` als numerische Werte aus, obwohl die Architektur die Score-Zahlen als intern beschreibt. Das widerspricht dem vorgesehenen Public-Team-Vertrag. Siehe [public-availability/route.js](../app/api/public-availability/route.js), [public-matching-profiles/route.js](../app/api/public-matching-profiles/route.js), [public-team-members/route.js](../app/api/public-team-members/route.js), [publicCoachDirectory.js](../app/lib/publicCoachDirectory.js), [architecture.md](./architecture.md). |
| **Kritisch** | Ein Widerruf des Health-Data-Consents verhindert nicht alle internen Lese- und Kopierpfade. | Intake-Write und öffentlicher sensibler Abruf prüfen den aktiven Consent. Dashboard-, Admin-Draft-, Team-Request- und Handover-Pfade laden sensible Felder ohne Consent-Statusprüfung. Der Handover kann sensible Felder in eine neue Anfrage kopieren. Das ist zunächst ein technischer Befund; die zulässige Weiterverarbeitung nach Widerruf ist rechtlich zu entscheiden. |
| **Kritisch** | `delete-forever` kann wegen referenzierter Daten scheitern und löscht nicht alle zugehörigen Datensätze. | Messaging- und Re-Engagement-Fremdschlüssel verwenden `ON DELETE RESTRICT`; Health-Consent-Records haben keinen Foreign Key zu `anfragen`. Das Löschen von `anfragen` kann deshalb blockiert werden oder verwaiste Consent-Belege hinterlassen. Siehe [requests/delete-forever/route.js](../app/api/requests/delete-forever/route.js) und die Migrationen [20260901000000_request_messaging_foundation.sql](../supabase/migrations/20260901000000_request_messaging_foundation.sql), [20261005000000_admin_reengagement_log.sql](../supabase/migrations/20261005000000_admin_reengagement_log.sql), [20261017000000_anfrage_health_data_consent.sql](../supabase/migrations/20261017000000_anfrage_health_data_consent.sql). |
| **Hoch** | Frühere Coaches können laut Messaging-RLS weiterhin geschlossene Conversation-/Message-Datensätze lesen. | Die SELECT-Policies prüfen aktive Coach-Identität und `therapist_id` der Conversation, aber nicht, ob die Anfrage aktuell diesem Coach zugeordnet ist oder die Conversation noch offen ist. API-Routen haben zusätzliche Zuordnungsprüfungen, direkte authentifizierte Supabase-SELECTs werden durch die Policy aber nicht auf den aktuellen Assignment-Stand begrenzt. Siehe [20260901000000_request_messaging_foundation.sql](../supabase/migrations/20260901000000_request_messaging_foundation.sql). |
| **Hoch** | Google Fonts lädt direkt vom Google-Host; YouTube-iFrames werden bei Anzeige des Coach-Video-Modals geladen. | Im App-Code ist weder ein Consent-Gate noch ein lokales Hosting der Font-Dateien nachgewiesen. YouTube wird mit `www.youtube.com/embed/...` eingebettet, nicht erst nach einem nachgewiesenen Consent-Dialog. Siehe [globals.css](../app/globals.css), [CoachVideoModal.jsx](../app/components/CoachVideoModal.jsx). |
| **Hoch** | Google-Kalenderereignisse enthalten mehr Klient:innenidentifikatoren als für die Terminverwaltung erforderlich sein dürften. | Geprüfte Event-Payloads können Namen, Anfrage-ID, E-Mail und Telefonnummer in Titel/Beschreibung enthalten; der Terminzeitraum ist ebenfalls enthalten. Gesundheitsangaben werden dort nicht explizit übertragen. Siehe [booking/book/route.js](../app/api/booking/book/route.js), [add-session/route.js](../app/api/add-session/route.js), [add-sessions-batch/route.js](../app/api/add-sessions-batch/route.js), [confirm-proposal/route.js](../app/api/confirm-proposal/route.js). |
| **Hoch** | `/api/reminders/send` erzwingt die Cron-Authentifizierung nur, wenn `CRON_SECRET` gesetzt ist. | Bei fehlender Variable wird die Auth-Prüfung übersprungen. `vercel.json` listet den täglichen Cron, beweist aber weder die gesetzte Variable noch die aktive Produktivkonfiguration. Siehe [reminders/send/route.js](../app/api/reminders/send/route.js), [vercel.json](../vercel.json). |
| **Mittel** | `team-requests` erlaubt Coaches zusätzlich zu ID-Zuweisungen Abruf per E-Mail-Wunschzuordnung. | Aktive Coaches können Anfragen laden, wenn `wunschtherapeut` ihrer Team-E-Mail entspricht, auch wenn `assigned_therapist_id` nicht auf sie zeigt. Diese Anfragen enthalten sensible Intake-Felder. Ob das ein beabsichtigter historischer Zugriff ist, ist organisatorisch zu bestätigen. Siehe [team-requests/route.js](../app/api/team-requests/route.js). |
| **Mittel** | Statische Teamdaten werden von einer Client-Komponente importiert. | `page-client.jsx` importiert `teamData`; das Datenmodul enthält Coach-Kontakt- und interne Profil-/Rankingfelder. Ob Tree-Shaking diese Felder aus dem tatsächlich ausgelieferten Build entfernt, wurde nicht anhand eines Build-Artefakts verifiziert. Veröffentlichung des Client-Bundles prüfen. Siehe [page-client.jsx](../app/page-client.jsx), [teamData.js](../app/lib/teamData.js). |
| **Mittel** | Dokumentation und Code stimmen in Messaging teilweise nicht überein. | Ältere Abschnitte beschreiben Messaging und eingehende E-Mails als Zukunftskonzept; die geprüfte Implementierung und Migrationen enthalten Conversations, Nachrichten, Resend-Inbound-Webhook und RLS. Siehe [AI_CONTEXT.md](../AI_CONTEXT.md), [architecture.md](./architecture.md), [messaging/inbound.js](../app/lib/messaging/inbound.js), [webhooks/resend/route.js](../app/api/webhooks/resend/route.js). |

## 3. A – Gesundheitsdaten und Widerruf

### 3.1 Consent-Implementierung

- Das Formular zeigt eine separate, nicht vorausgewählte Einwilligung, bevor sensible Themen, Anliegen, Leidensdruck, Verlauf, Diagnose, Ziel, Selbstgefährdungs-Angabe und Freitext-Zeitwünsche im Formular verwendet werden. Text und Versionskennung stehen in [healthDataConsentShared.js](../app/lib/healthDataConsentShared.js); die UI und der Client-Zustand sind in [page-client.jsx](../app/page-client.jsx).
- `POST /api/intake-consent` erzeugt einen zufälligen Token. In `anfrage_health_data_consents` werden Hash, Version, Erteilungszeitpunkt und Widerrufszeitpunkt gespeichert. Die Migration enthält keine Fremdschlüsselbeziehung von `request_id` zu `anfragen` und keine Retention-Regel: [intake-consent/route.js](../app/api/intake-consent/route.js), [20261017000000_anfrage_health_data_consent.sql](../supabase/migrations/20261017000000_anfrage_health_data_consent.sql).
- `POST /api/form-submit` und `POST /api/create-request-draft` verlangen einen aktiven Beleg. Die Draft-Route überträgt dabei nur die ausdrücklich dort konstruierten nicht-sensiblen Intakefelder, nicht die Gesundheitsfeldliste: [form-submit/route.js](../app/api/form-submit/route.js), [create-request-draft/route.js](../app/api/create-request-draft/route.js).
- `GET /api/public-request` gibt sensible Felder nur aus, wenn ein aktiver, zur Anfrage passender Consent-Token vorliegt. Ohne ihn werden Basisdaten zurückgegeben: [public-request/route.js](../app/api/public-request/route.js).
- Beim Widerruf wird `revoked_at` gesetzt und der Client leert die betreffenden sensiblen Formularfelder. Bereits gespeicherte Inhalte in `anfragen` werden nicht gelöscht oder verändert: [intake-consent/route.js](../app/api/intake-consent/route.js), [page-client.jsx](../app/page-client.jsx).
- Die Datenbankmigration zur Consent-Tabelle ist im Projekt dokumentiert als separat anzuwenden. Ihr produktiver Migrationsstand bleibt unbestätigt.

### 3.2 Was nach Widerruf technisch noch möglich ist

| Verarbeitung/Zugriff | Technischer Stand nach Widerruf | Belegte Zugriffskontrolle |
|---|---|---|
| Erneute öffentliche Übermittlung sensibler Formulardaten über `form-submit` | Ohne neuen aktiven Consent-Token abgewiesen. | Booking-Token für bestehende Anfrage plus aktiver Consent-Beleg. |
| Draft-Write | Ohne aktiven Consent-Beleg abgewiesen. | Bei bestehendem Draft zusätzlich Booking-Token und `status = draft`. |
| Sensible Felder über `public-request` lesen | Ohne aktiven, zur Anfrage gehörenden Beleg nicht im Response enthalten. | ID + Booking-Token; Consent nur für sensible Spalten. |
| Admin-Dashboard-Anfragen | Sensible Felder werden von der Dashboard-Route weiterhin ausgewählt. Keine Consent-Abfrage in dieser Route. | Aktives Teammitglied; Admin sieht alle geladenen Anfragen. |
| Admin-Draft-Ansicht | Sensible Felder werden weiterhin aus Drafts geladen. Keine Consent-Abfrage in dieser Route. | Aktiver Admin. |
| Coach-Dashboard | Sensible Felder werden bei zugewiesenen Anfragen weiterhin ausgewählt. Keine Consent-Abfrage in dieser Route. | Aktiver Coach; Zuordnung über `assigned_therapist_id`. |
| `team-requests` | Sensible Felder werden für zugewiesene Anfragen sowie Anfragen mit passendem `wunschtherapeut`-E-Mailwert geladen. Keine Consent-Abfrage. | Aktiver Coach; Zuordnungsfilter oder E-Mail-Wunschfilter. |
| `coach-handover` | Sensible Felder werden geladen; bei bestimmten Handover-Pfaden in eine neue Anfrage kopiert. Keine Consent-Abfrage und keine Consent-Verknüpfung der neuen Anfrage im geprüften Ablauf. | Aktiver Admin oder derzeit zugeordneter Coach. |
| Termin-, Sitzungs-, Rechnungs- und Statusverarbeitung | Soweit diese Pfade auf Kontakt-, Zeit-, Sitzungs- oder Abrechnungsdaten zugreifen, ist der Health-Consent nicht generell Bestandteil ihrer Autorisierung. Der Code muss je Route nach Datenfeldern und Zweck beurteilt werden. | Je nach Route Auth/Role, Zuordnung oder Booking-Token. |

Die Datenbankmigration für die Messaging-Tabellen vergibt SELECT für authentifizierte Nutzer und RLS-Policies für Coaches. Diese Policies berücksichtigen nicht die Widerrufstabelle. Zudem lassen sie aktive Coaches geschlossene, ihnen zugeordnete Conversations lesen, selbst wenn eine Anfrage später einem anderen Coach zugeordnet wurde. Das ist ein weiterer Weg, auf dem bereits gespeicherte Inhalte nach Consent-Widerruf oder Handover technisch lesbar bleiben können.

### 3.3 Rechtlich und organisatorisch zu entscheiden

- Ob und in welchem Umfang eine Verarbeitung nach Widerruf auf einer anderen Rechtsgrundlage fortgeführt werden kann, ist nicht aus Code ableitbar. Mögliche Vertrags-, vorvertragliche, Abrechnungs-, Nachweis- oder Rechtsanspruchszwecke müssen für jede Datenkategorie und Rolle konkret rechtlich bewertet werden; keine pauschale Ersatzrechtsgrundlage unterstellen.
- Zu bestimmen sind Zweckbindung, notwendige Datenfelder, Empfänger, Dauer und Zugriffsrollen nach Widerruf. Insbesondere sollte unterschieden werden zwischen fortbestehender Anfrage-/Terminorganisation, gesetzlicher Abrechnung und optionaler Matching-/Vermittlungsverarbeitung.
- Art. 22 DSGVO sowie die konkrete Reichweite der ausdrücklichen Einwilligung sind mit Datenschutzberatung zu prüfen. Das Matching bewertet Themenpassung und verwendet Leidensdruck/Diagnose als Rankinggewicht; die Klient:in wählt laut Produktablauf selbst einen Coach. Das ist eine technische Beschreibung, keine abschließende Rechtsbewertung.

### 3.4 Empfohlene technische Korrekturen (vor Umsetzung freizugeben)

1. Vollständiges Inventar aller Routen und Queries erstellen, die sensible Spalten lesen, exportieren, kopieren oder mailen; besonders `dashboard/requests`, `admin/form-drafts`, `team-requests`, `coach-handover`, Exporte und Messaging berücksichtigen.
2. Für jede Route eine fachlich bestätigte Datenzweck-/Rechtsgrundlagenentscheidung hinterlegen. Erst danach eine gemeinsame Autorisierungsregel implementieren, die nicht automatisch jede berechtigte Rechtsgrundlage mit dem Consent gleichsetzt.
3. Consent-Status in besonders geschützten Zugriffen berücksichtigen, wo dieser tatsächlich Voraussetzung ist; dokumentierte Ausnahmezugriffe zweckgebunden, minimiert und auditierbar gestalten.
4. Handover ohne stillschweigende Gesundheitsdatenkopie standardisieren: entweder nach bestätigter Rechtsgrundlage und Consent-Bezug mit neuer Coach-Zuordnung, oder nur mit nicht-sensiblen Minimaldaten. Alte Conversation-Verläufe nicht automatisch freigeben.
5. Messaging-RLS so prüfen/entwerfen, dass Lesbarkeit den aktuellen Zuweisungs- und Handoverregeln entspricht; ein aktiver Status des Coach-Kontos allein sollte keinen historischen Zugriff implizieren, sofern fachlich nicht gewollt.
6. Consent-Nachweise mit Textversion und Textarchiv nachweisbar verknüpfen; Retention, Anfragebezug, Orphan-Verhalten und Lösch-/Sperrstatus explizit festlegen.
7. Mit synthetischen Testdaten Regressionstests für Erteilung, Widerruf, neue Zustimmung, Wiederaufnahme, Handover, Admin-/Coach-Zugriff und Messaging-RLS ergänzen. Produktivtests sind hierfür nicht erforderlich.

### 3.5 Erforderliche Erklärungsaussage

Die Erklärung muss mindestens beschreiben: welche Angaben Gesundheitsdaten sein können; konkrete Zwecke; ausgewählte Empfänger/Coach-Zugriff; dass es eine eigenständige ausdrückliche Einwilligung mit protokollierter Version und Zeit gibt; den Widerrufskanal und seine Wirkung für die Zukunft; dass ein Widerruf vorhandene Daten technisch nicht automatisch löscht und welche Daten gegebenenfalls aufgrund anderer bestätigter Rechtsgrundlagen weiter gespeichert/verarbeitet werden. Letzterer Inhalt kann erst nach rechtlicher und organisatorischer Festlegung veröffentlicht werden.

## 4. B – Löschung und Aufbewahrung

### 4.1 Technisch belegte Lösch- und Retentionsverhalten

| Datenkategorie / Ort | Im Code/Migration vorhandenes Verhalten | Nicht nachgewiesen / Risiko |
|---|---|---|
| `anfragen` einschließlich sensibler Angaben und Drafts | Admin-Endpunkt löscht eine Anfrage direkt. Statuswerte wie `beendet` und `papierkorb` sind Statusänderungen, keine Löschung. Drafts werden nicht durch einen allgemeinen Ablauf automatisch entfernt. | Keine allgemeine Frist oder automatische Bereinigung der Basisanfragen nachgewiesen. Der physische Löschversuch kann an Fremdschlüsseln scheitern. |
| `request_conversations` und `request_messages` | Conversation wird bei Statusende/Handover geschlossen und Alias widerrufen. Nachrichteninhalt bleibt gespeichert. Tabellen besitzen `retention_until`. | Kein Ablauf-/Purge-Prozess für `retention_until` in den geprüften Migrationen nachgewiesen. FK-Regeln können Anfrage-Löschung blockieren. |
| `request_message_events` | Provider-Event-ID, Typ, Zeit und Verarbeitungsfehler werden als Deduplizierungs-/Verarbeitungsledger gespeichert. | Keine Retention-/Purge-Regel nachgewiesen. |
| `anfrage_health_data_consents` | Hash, Textversion, grant-/revoke-Zeit; RLS und Grants nur für `service_role`. | Kein Lösch-/Aufbewahrungsmechanismus, keine FK-Kaskade zu `anfragen`, mögliche verwaiste Nachweise nach Anfrage-Löschung. |
| Draft-Erinnerung | `anfragen` erhält Consent-Status, Version, Zeitpunkt, letzte Checkpoint-Aktivität und Reminder-Zeit. Maximal eine neutrale Erinnerung ist im Helper vorgesehen. | Keine Draft-Löschfrist oder allgemeine Abbruch-Bereinigung. Produktiver Cron-/Consent-Stand ist nicht verifiziert. |
| Recovery-Link-Datensätze `client_link_recovery` | Link läuft nach 15 Minuten ab; abgelaufene Zeilen werden opportunistisch erst mehr als einen Tag nach Ablauf gelöscht. Verbrauchte/abgelaufene Einlösung wird abgewiesen. Anfrage-Löschung löscht diese Linkzeilen per FK-Cascade. | Kein regelmäßiger Scheduler für die Bereinigung; Bereinigung hängt von Funktionsaufrufen ab. |
| Recovery-Rate-Limits | Stunden-Buckets; alte Einträge werden opportunistisch nach mehr als einem Tag entfernt. | Kein eigener periodischer Purge. |
| Recovery-Queue | Nach `sent`/`no_match` werden Payload/Secretfelder geleert; die abgeschlossene Queue-Zeile wird opportunistisch nach mehr als einem Tag gelöscht. Fehler werden mit exponentiellem Backoff bis max. 1 Stunde erneut versucht. | Keine maximale Versuchszahl und keine automatische Bereinigung dauerhaft fehlschlagender `queued`-/`processing`-Datensätze. |
| `anfragen_reengagement_log` | Protokoll speichert Status, Provider-ID, Fehlercode, ausführenden Admin und Zeitpunkte. Die Migration vergibt kein DELETE-Recht; Kommentare sehen vor, dass Einträge erhalten bleiben. | Kein Zeitraum, Lösch- oder Anonymisierungsverfahren nachgewiesen; `ON DELETE RESTRICT` kann Anfrage-Löschung blockieren. |
| Klient:innenrechnungen (`invoices`) | App kann Rechnungen laden, speichern, listen und als PDF versenden. | Kein vollständiger Lösch-/Archivierungsprozess oder Frist in geprüftem Code festgestellt; gesetzliche Pflichten sind juristisch/steuerlich zu bestimmen. |
| Coach-Rechnungen und Steuerdaten | `coach_invoices`, Releases, Link-Claims und Adminentscheidungen halten Rechnungs-/Steuer-/Auditdaten. Workflow-Migrationen enthalten Sperr- und Integritätslogik. | Keine umfassende Retention-/Löschregel nachgewiesen; produktiver Migrationsstand unverifiziert. |
| Google Calendar | Event-Löschung findet in einzelnen Cancel-/Reschedule-/Proposal-Pfaden statt. | Keine vollständige systemweite Löschsynchronisierung oder Löschgarantie bei Account-/Tokenverlust nachgewiesen. Kalenderkopien und Freigaben hängen von externen Kontoeinstellungen ab. |
| Resend/Klaviyo/andere Provider | Provideraufrufe und Webhook-Verarbeitung sind im Code vorhanden. | Anbieter-Logs, Backups, Versandkopien, Unterauftragsverarbeiter, Unterdrückungslisten, Lösch-APIs und Retention nicht aus Repository belegt. |
| Vercel/Supabase-Logs und Backups | Projektunterlagen sprechen die Infrastruktur und bekannte Einschränkungen an. | Tatsächliche Log-Retention, Backup-Pläne, Regionsstand, Zugriff und Restore-Test sind nicht verifiziert. Kein Produktivnachweis. |

### 4.2 Kann `delete-forever` wegen Messaging scheitern?

**Ja, das ist im Migrationsschema technisch möglich.**

- `request_conversations.anfrage_id` referenziert `anfragen(id) ON DELETE RESTRICT`.
- `request_messages.anfrage_id` referenziert `anfragen(id) ON DELETE RESTRICT`.
- Der zusammengesetzte Foreign Key von `request_messages` zu Conversation und Anfrage verwendet ebenfalls `ON DELETE RESTRICT`.
- `anfragen_reengagement_log.anfrage_id` referenziert `anfragen(id) ON DELETE RESTRICT`.
- `delete-forever` versucht direkt, nur die Zeile in `anfragen` zu löschen. Die Route löscht vorher keine referenzierten Conversation-/Message-/Re-Engagement-Zeilen. Supabase-/Postgres-Fehler werden als `db_delete_failed` gemeldet; Erfolg kann daher ausbleiben.
- `anfrage_health_data_consents.request_id` besitzt in der geprüften Migration keinen Foreign Key. Wird eine Anfrage dennoch gelöscht, kann der Consent-Nachweis ohne Bezug zurückbleiben.
- Recovery-Link-Datensätze sind dagegen mit `ON DELETE CASCADE` verbunden. Andere Basis-Fremdschlüssel konnten aus den hinzugezogenen Add-on-Migrationen nicht vollständig beurteilt werden.

Das ist kein Beleg, dass eine konkrete produktive Löschung bereits fehlgeschlagen ist. Das Zielschema und sein Migrationsstand wurden nicht geprüft.

### 4.3 Vorschlag für ein vollständiges Löschkonzept

Vor Festlegung der Dauer muss Datenschutzverantwortliche:r/Steuerberatung je Datenart die Rechtsgrundlage, Frist bzw. objektive Löschkriterien und Sperrgründe freigeben. Die Tabelle enthält bewusst **keine erfundenen Zeiträume**.

| Datenklasse | Löschereignis / Auslöser | Technische Behandlung vorzusehen | Abhängigkeiten und zu klärende Dauer |
|---|---|---|---|
| Unvollständige Anfrage/Draft | Widerruf/Abbruch, Draft wird über einen festgelegten Zeitraum nicht fortgeführt oder betroffene Person verlangt Löschung | Draft-Status/Letzte Aktivität prüfen; nach genehmigter Frist Daten löschen oder irreversibel minimieren; Recovery- und Newsletter-Einwilligungen getrennt berücksichtigen | Frist und Zeitpunkt, ab dem Anfrage als endgültig aufgegeben gilt, organisatorisch festlegen |
| Aktive Anfrage und Gesundheitsangaben | Vermittlung abgeschlossen, Anfrage zurückgezogen, Begleitung beendet, Widerruf oder Betroffenenantrag | Sensible Felder separat erfassen; Lösch-/Sperr-/Minimierungsschritte über alle Tabellen, Backups und Provider planen; notwendige Abrechnungsdaten von Gesundheitsdaten trennen | Andere Rechtsgrundlagen, Rechtsansprüche, Gesundheitsdaten-Aufbewahrung und Widerrufsfolgen rechtlich festlegen |
| Handover-/Duplikat-Anfragen | Coachwechsel oder Neuvermittlung | Keine unkontrollierten Kopien; neue Anfrage mit Verweis auf Quelle, minimalen Feldern und klarer Consent-/Zweckzuordnung; Löschung beider Datensätze verknüpfen | Verantwortliche Rolle und Datenumfang der neuen Coach-Zuweisung bestimmen |
| Conversations, Nachrichten, Webhook-Events | Conversation-Schließung, Anfrage-Löschung, Ablauf festgelegter Support-/Anspruchszwecke | `retention_until` tatsächlich auswerten; Nachrichten, Event-Ledger, Provider-Kopien und Backups nach Regel löschen; Ausnahmezugriffe auditieren | Fristen pro Nachrichtenart und Rechtsanspruch-/Nachweiserfordernis bestimmen |
| Consent-Nachweise | Ende der zugehörigen Verarbeitung/gesetzlicher Nachweiszweck oder Wegfall des Nachweisbedarfs | Belegtext-Version archivieren; Verknüpfung zu Anfrage datensparsam halten; Nachweis geordnet löschen/anonymisieren, Orphans vermeiden | Nachweisdauer und mögliche getrennte Aufbewahrung nach Löschung der Anfrage entscheiden |
| Re-Engagement- und sonstige Audit-Protokolle | Abschluss des jeweiligen Vorgangs plus Ende des Nachweis-/Missbrauchszwecks | Festlegen, welche Auditfelder notwendig sind; Provider-ID/Actor-ID minimieren oder nach Ablauf löschen/anonymisieren; FK-Verhalten mit Antraglöschung abstimmen | Bisherige Migration sieht kein DELETE vor; organisatorische Entscheidung und Migration nötig |
| Recovery-Codes, Queue und Rate-Limits | Ablauf/Verbrauch, Erfolg, `no_match`, endgültiger Fehler oder Ende des Retry-Fensters | Abgelaufene/abgeschlossene Zeilen planmäßig purgen; Retry-Limit und terminalen Fehlerstatus festlegen; Secrets sofort nach Abschluss aus Payload entfernen; Warteschlange überwachen | Derzeit erfolgsabhängige opportunistische Bereinigung, keine maximale Retry-Zahl |
| Sitzungen, Rechnungen, Steuer- und Zahlungsdaten | Ende der Leistung, Rechnungsabschluss, Ablauf gesetzlicher Aufbewahrung bzw. Rechtsansprüche | Rechnungs- und Sitzungspersistenz von Intake-Daten trennen; Belege nach vorgeschriebener Frist sperren/löschen; abgeleitete Summen/Exports einbeziehen | Gesetzliche Aufbewahrungspflichten und genaue Fristen mit Steuerberatung bestätigen |
| Google-Calendar-Events/Videolinks | Terminabsage, Reschedule, Ende erforderlicher Organisation | Nur konkrete Kliententermine entfernen; Providerlöschung, Sperrslots und eventuelle Kopien synchronisieren; Verfügbarkeitsblöcke ausdrücklich schützen | Google-Kontofreigaben, Kalender-Backups und eventuelle Exportkopien klären |
| E-Mail-/Newsletterdaten | Abmeldung, Einwilligungswiderruf, Versand-/Supportzweck endet | Aktuelle Mailingliste und Unterdrückungs-/Sperrliste trennen; minimale Sperrinformation nur bei bestätigtem Zweck behalten; Provider und Poise-Daten synchron löschen | Double-Opt-in, Versandstatistik, Blacklist-Dauer und ActiveCampaign-Migration prüfen |
| Infrastruktur-Logs, Backups, Exporte | Ablauf der Infrastruktur-Retention bzw. erfolgreicher Löschlauf | Logging datensparsam konfigurieren; klare Rotation und Zugriffskontrolle; Backups nach festgelegtem Zyklus entfernen; Löschungen im Restore-Verfahren nachziehen | Tatsächliche Vercel-/Supabase-/Providerfristen und Restore-Prozess belegen |

**Implementierungsreihenfolge nach fachlicher Freigabe:** Dateninventar und Fristen genehmigen → Fremdschlüssel-/Löschgraph erstellen → kontrollierten Löschservice mit Audit-Resultaten umsetzen → Queue-/Providerlöschung integrieren → tägliche/periodische Job-Überwachung einrichten → Tests mit synthetischen Daten → dokumentierte Backup-/Restore- und Löschprobe. Keine Migration oder Codeänderung wurde hier vorgenommen.

## 5. C – Google Fonts und YouTube

### Google Fonts

- [globals.css](../app/globals.css) importiert Montserrat von `https://fonts.googleapis.com/...`.
- Der Browser kann dadurch beim Abruf des globalen Stylesheets eine Verbindung zu Google herstellen und Font-Ressourcen von Google anfordern. Die Anfrage kann jedenfalls technische Verbindungsdaten wie IP-Adresse und Browser-/Anfragemetadaten an den Anbieter übermitteln. Welche Requests beim konkreten Besuch tatsächlich erfolgen und welcher Speicher-/Verarbeitungsort verwendet wird, wurde nicht mit einem Browser-Netzwerkmitschnitt oder Providerzugriff geprüft.
- Ein Consent-Gate für diese Ressource ist in den geprüften App-Dateien nicht ersichtlich.

**Empfehlung:** Font-Dateien rechtmäßig lizenzieren und lokal ausliefern; CSS-Import durch lokale `@font-face`-Definitionen ersetzen; nur benötigte Schnitte/Zeichensätze einbinden; Network-Regressionstest und CSP-/Buildprüfung ergänzen. Falls externe Bereitstellung bewusst beibehalten wird, vor dem Laden eine belastbare Rechts-/Consent-Entscheidung treffen und die Drittanbieteranfrage dokumentieren.

### YouTube

- [CoachVideoModal.jsx](../app/components/CoachVideoModal.jsx) erzeugt eine `youtube.com/embed/`-URL und rendert ein iframe. Das Modal wird durch eine Nutzeraktion angezeigt; ab dann entsteht der externe Inhaltseinbettungsaufruf. Der iframe erlaubt unter anderem Autoplay-Fähigkeiten, startet aber im geprüften Code nicht automatisch mit `autoplay`.
- Eine vorgeschaltete Einwilligungsprüfung oder ein Klick-zu-Laden-Platzhalter ist nicht nachgewiesen. Die Coachvideo-URLs sind in [teamData.js](../app/lib/teamData.js) hinterlegt.
- Der externe Videoanbieter kann beim Laden des iframes Verbindungsdaten erhalten; ein eingeloggter YouTube-/Google-Account kann die Zuordnung beeinflussen. Die genaue Speicherung, Cookies und Weitergabe hängen vom Anbieter und Browserzustand ab und wurden nicht produktiv gemessen.

**Empfehlung:** Bis zur Freigabe nur ein lokales Vorschaubild/Platzhalter anzeigen und das iframe erst nach dokumentierter Zustimmung bzw. expliziter Aktivierung laden. Alternative: vorhandenes `youtube-nocookie.com`-Embed als zusätzliche Datenminimierung prüfen, aber nicht als „keine Datenübermittlung“ bezeichnen. Beim Schließen iframe aus dem DOM entfernen; `referrerPolicy="strict-origin-when-cross-origin"` oder strengere passende Policy festlegen; Consent-Zustand widerrufbar halten; Datenschutztext und Consent-Logik konsistent testen. Noch keine Umsetzung.

## 6. D – Google Calendar

### Daten, Auslöser und Empfänger

Im geprüften Buchungs- und Sitzungs-Code werden für konkrete Kalendertermine je nach Pfad übertragen:

- Terminzeit, Endzeit und Zeitzone,
- Titel/Summary wie „Poise Erstgespräch“ bzw. „Poise Sitzung“ mit Klient:innenname,
- Beschreibung mit Anfrage-ID, teils Sitzungs-ID, Klient:innenname, E-Mail-Adresse und Telefonnummer,
- bei Proposal-Pfaden ebenso Klient:innenname, E-Mail und Telefonnummer,
- Kalenderkennung und Provider-Event-ID als technische Steuerungsdaten.

Die Übertragung wird beim Buchen, Bestätigen eines Vorschlags bzw. Anlegen einer Sitzung ausgelöst. Verfügbarkeitsabfragen lesen Kalenderereignisse; OAuth-Flows fordern Calendar-Zugriff an und speichern Access-/Refresh-Tokens serverseitig in `therapist_google_tokens`. Nachweis: [booking/book/route.js](../app/api/booking/book/route.js), [add-session/route.js](../app/api/add-session/route.js), [add-sessions-batch/route.js](../app/api/add-sessions-batch/route.js), [confirm-proposal/route.js](../app/api/confirm-proposal/route.js), [google/start/route.js](../app/api/google/start/route.js), [google/callback/route.js](../app/api/google/callback/route.js).

**Gesundheitsdaten:** In den konkret geprüften Google-Event-Payloads werden keine Anliegen, Diagnose, Leidensdruck oder Gesprächsnotizen gesetzt. Titel, Coachbezug und „Erstgespräch“/„Sitzung“ können dennoch Rückschlüsse auf eine Coaching-/Gesundheitsdienstleistung zulassen. Das ist ein mögliches sensibles Kontextsignal, aber kein ausdrücklicher Gesundheitsfreitext im Event.

### Sichtbarkeit

- OAuth-Zugriff wird im Code aktiven Coach-Konten vorbehalten. Die Anwendung lädt die Kalenderliste des verbundenen Coaches und verwendet eine gespeicherte Kalenderkennung.
- Buchungs- und Admin-/Coach-Routen können je nach Flow Calendar-API-Aktionen auslösen. Einige Pfade verwenden globale Google-Umgebungszugänge, andere OAuth-Tokens. Die vollständige Zuordnung der produktiven Credentials und Kalender ist nicht verifizierbar.
- Wer konkrete Ereignisse in Google Calendar sehen kann, hängt zusätzlich von Google-Kontofreigaben, Organisationsrichtlinien, delegierten Rechten und Providerkonfigurationen ab; diese Daten wurden nicht abgerufen.

### Datenminimierungsvorschlag

1. Titel generisch halten, z. B. „Poise – Termin“ ohne Klient:innenname oder Hinweis auf eine bestimmte Leistung.
2. Beschreibung auf Terminorganisation beschränken: keine E-Mail, Telefonnummer, Gesundheitsangaben und möglichst keine Anfrage-ID. Falls Korrelation erforderlich ist, eine nicht sprechende interne Referenz erwägen und Zugriffs-/Löschkonzept festlegen.
3. Event-Zeit und nötige technische Event-ID beibehalten; andere Kontaktinformationen in der geschützten App statt im Kalender vorhalten.
4. Nur den tatsächlich benötigten Kalenderumfang autorisieren. Aktuell fordert der OAuth-Start den Calendar-Scope an; prüfen, ob der Provider einen engeren Scope ermöglicht.
5. Kalenderfreigaben, Rollen, Tokenzugriff, Kalender-Region/Vertragslage, Event-Löschung und Backups organisatorisch nachweisen.
6. Die Poise-Regel zum unveränderten `POISE VERFÜGBAR`-Block bleibt unberührt: Datenminimierung darf die bestehenden Buchungs-/Reschedule-Schutzregeln nicht beschädigen.

**Erklärung:** Google Calendar als Empfänger, Zwecke (Verfügbarkeitsprüfung, Buchung, Terminänderung und Sitzungsverwaltung), übermittelte Zeit-/Identifikationsdaten, Zugriff durch Coach und gegebenenfalls interne Admin-/Betriebsrollen, Speicherort/Region soweit belegt und Drittland-/Vertragsinformationen nach Bestätigung aufführen.

## 7. E – Rollen, Berechtigungen und RLS

| Oberfläche / Daten | Code-definierte Berechtigung | Risiko / Verifikationsstatus |
|---|---|---|
| Admin-Dashboard und Anfragen | Aktiver Staff-Login; Admin-Rolle erlaubt breite Anfrageansicht einschließlich sensibler Felder. | Zugriff wird nicht mit Health-Consent-Status abgeglichen. Effektive Produktionsrollen und Auth-Konfiguration unbekannt. |
| Coach-Dashboard | Aktiver Staff-Login; Anfragen werden typischerweise nach `assigned_therapist_id` gefiltert. | Gesundheitsfelder sind sichtbar; kein erneuter Consent-Check nach Widerruf. |
| `team-requests` | Authentifizierter aktiver Coach; Abfrage über assignment sowie zusätzlich Coach-E-Mail in `wunschtherapeut`. | Kann Zugriff über die aktuelle explizite ID-Zuordnung hinaus erlauben. Geschäftsabsicht prüfen. |
| Handover | Admin oder zuständiger Coach; lädt Gesundheitsfelder; vorhandene Sessionhistorie beeinflusst Handover-Pfad. | Sensible Felder können kopiert werden; kein Consent-Nachweis der Zielanfrage sichtbar. |
| Messaging-API | Conversation-Anlage an eindeutige serverseitige Coach-Zuordnung gebunden; Nachrichten-API prüft Coach und Anfragezuordnung. | Alte geschlossene Conversation bleibt laut RLS für den bisherigen aktiven Coach direkt lesbar; DB-Migrationsstand unbekannt. |
| RLS für Conversations/Messages | SELECT ist authentifizierten Coaches erlaubt, deren `therapist_id` ihrem aktiven Nutzer zugeordnet ist. | Policy filtert nicht auf derzeitige Anfragezuordnung oder offene Conversation; direkte Browser-Supabase-Abfragen sind deshalb weiter als die App-API begrenzt. |
| Consent-/Recovery-/Re-Engagement-/Invoice-Schutz-Tabellen | Migrationen aktivieren RLS und beschränken Grants/Policies auf `service_role` in den jeweiligen Tabellen. | Produktionsanwendung der Migrationen und Rollenrechte nicht verifiziert. |
| Basisdaten wie `anfragen`, `sessions`, `team_members` | App-API nutzt überwiegend Service-Role-Clients und eigene Routenchecks. | Die Migrationen im Repository definieren nicht die gesamte Basisschema-RLS. Service Role umgeht RLS; jede App-Route ist sicherheitsrelevant. |
| Klient:innenzugriff | Resume/Public-Request erfordert ID+Booking-Token; sensible Felder zusätzlich aktiven Consent-Token. Recovery verwendet E-Mail-Abgleich, Queue und kurzlebige Codes. | Tatsächliche Token- und Mailprovider-Konfiguration, Linktracking und Produktionsstand sind unbestätigt. |
| Öffentliche Matchingwerte | Unauthentifizierte Endpoints geben Matching-Scores aus; Public-Team-Mapper gibt numerische `topicRelevance` aus. | Verstößt gegen die dokumentierte Grenze, Scores nicht öffentlich zu liefern. |
| Öffentliche Profile | `/api/public-team-members` mappt Profildaten über `toPublicCoachMember`; intendierter Whitelist-Vertrag umfasst Profile, Topics und Medien. | Tatsächliche Response enthält zusätzlich numerische `topicRelevance`; tatsächlicher ausgelieferter Client-Bundle-Inhalt prüfen. |

**Empfehlung:** API-Verträge mit automatisierten Allowlist-Tests absichern; Scores aus Public Responses entfernen, sofern keine bewusste Freigabe erfolgt; in Client-Bundles nur öffentliche Profildaten führen; RLS gegen direkte Zugriffe und Handover testen; Zugriffe auf Gesundheitsdaten und Exporte zweckgebunden protokollieren. Das bleibt eine Empfehlung, keine hier ausgeführte Codeänderung.

## 8. F – E-Mail, Newsletter, Erinnerungen und externe Kommunikation

### Resend

- Der Code verwendet Resend für Anfragebestätigungen, Coach-Benachrichtigungen, Vorschläge, Terminbestätigungen/-änderungen, Videolinks, Erinnerungen, Klientenlinks und Rechnungs-PDF-Versand: z. B. [form-submit/route.js](../app/api/form-submit/route.js), [confirm-appointment/route.js](../app/api/confirm-appointment/route.js), [invoices/send/route.js](../app/api/invoices/send/route.js).
- Messaging-Outbound speichert Betreff und Nachrichtentext in Supabase; Inbound-Verarbeitung liest Provider-E-Mail-Inhalte und kann sie als Nachricht speichern. Webhooksignaturen werden geprüft: [messaging/outbound.js](../app/lib/messaging/outbound.js), [messaging/inbound.js](../app/lib/messaging/inbound.js), [webhooks/resend/route.js](../app/api/webhooks/resend/route.js).
- Datenkategorien hängen vom Mailtyp ab und umfassen Empfängeradresse, Vorname, Zeit-/Coachinformationen, Video-/Terminlinks, Rechnungs-PDF-Inhalte oder frei eingegebene Nachrichtentexte. Das Vorhandensein einer Providerverbindung im Code beweist nicht die produktive Provider-/Domainkonfiguration.

### Klaviyo / ActiveCampaign / MailChimp

- Klaviyo-API-Code nimmt bei Einwilligung die E-Mail-Adresse und kontrollierte Attribution-/UTM-Felder entgegen. Das Formular sendet Newsletterdaten separat nach erfolgreicher Anfrage; Social-Landingpages besitzen ebenfalls einen Newsletter-Subscribe-Flow. Nachweis: [klaviyo/subscribe/route.js](../app/api/klaviyo/subscribe/route.js), [SocialLandingPage.jsx](../app/components/SocialLandingPage.jsx), [page-client.jsx](../app/page-client.jsx).
- ActiveCampaign wird im geprüften App-Code nicht nachgewiesen. Die Aussage, dass ein Wechsel vorbereitet oder bereits erfolgt, muss die Geschäftsverantwortung bestätigen.
- MailChimp steht in der ursprünglichen Erklärung, ist aber im geprüften App-Code nicht nachgewiesen. Vor dem Streichen sind Konto, Altlisten, Sperrlisten und fortbestehende Export-/Backups organisatorisch zu prüfen.
- Double-Opt-in, Einwilligungsbeleg, Abmeldeablauf, Öffnungs-/Klicktracking, Sperrliste, Vertragsstand, Region und Löschverhalten sind nicht vollständig durch Code belegt.

### Draft-Erinnerungen

- Eine eigene optionale Zustimmung ist von Newsletter- und Health-Consent getrennt. Nur Drafts mit Zustimmung, mehr als 48 Stunden seit dem beim Draft-Save bekannten Checkpoint und bisher ohne Reminder sind vorgesehen; es wird eine neutrale Fortsetzungs-E-Mail mit Resume-Link versandt. Nachweis: [draftRecovery.js](../app/lib/draftRecovery.js), [reminders/send/route.js](../app/api/reminders/send/route.js).
- Die Aktivitätserfassung ist kein vollständiges Tastatur-/Eventtracking: `draft_last_activity_at` ist laut Architektur zunächst ein Save-Checkpoint bei der Coach-Auswahl.
- Der tägliche Vercel-Cron ist lokal konfiguriert. Ob Cron und Consent-Regeln produktiv aktiv sind, ist nicht bestätigt.

### Re-Engagement

- Aktiver Admin kann manuell eine begrenzte Gruppe von Anfragen mit passendem Status auswählen; die Route lädt frisch E-Mail, Vorname und Status und sendet über Resend. Ein separates Log speichert Anfragebezug, Provider-ID, Status, Fehlercode, ausführenden Admin und Zeitstempel: [admin-reengage/route.js](../app/api/admin-reengage/route.js), [20261005000000_admin_reengagement_log.sql](../supabase/migrations/20261005000000_admin_reengagement_log.sql).
- Die Migration vergibt kein DELETE-Recht für dieses Log. Zweck, Rechtsgrundlage, Einwilligung/Widerspruch, Nachrichtentyp und Retention müssen vor einer Erklärung organisatorisch entschieden werden.

### Cron-Authentifizierung

- `/api/cron/client-link-recovery` verlangt `CRON_SECRET` zwingend und fail-closed.
- `/api/reminders/send` führt die Secret-Prüfung nur aus, wenn die Variable vorhanden ist; ohne Variable ist die Route laut Code nicht gegen fehlendes Secret geschützt.
- Andere Cron-Routen müssen jeweils separat geprüft werden; Cron-Konfiguration allein belegt keinen erfolgreichen oder autorisierten Produktionslauf. Vercel-Variablen und Supabase-Cron-/Vault-Einrichtung nicht abrufen oder verändern, sondern von zuständigen Administrator:innen bestätigen lassen.

## 9. G – Ursprüngliche Datenschutzerklärung: vollständige Erhaltungs- und Prüfmatrix

Die Originalfassung wurde im Chat bereitgestellt. Diese Matrix bezieht alle darin enthaltenen Sachabschnitte ein. „Streichen“ bedeutet jeweils nur: erst nach dokumentiertem Nachweis, dass die Aussage nicht mehr zutrifft und keine Altverarbeitung fortbesteht.

| Ursprünglicher Abschnitt / Inhalt | Aktueller Abgleich | Behandlung für die neue Fassung | Noch benötigter Nachweis |
|---|---|---|---|
| Datenschutz auf einen Blick: Datenarten, Erhebung, Verwendungszwecke und Rechte | Formulardaten und technische App-Verarbeitungen sind teilweise im Code sichtbar; WordPressserver-/Analyticsdaten nicht. | **Erhalten und neu formulieren**, Websites trennen; Analysebehauptung nur bei aktuellem Nachweis. | Website-/Hosting- und Analytics-Inventar. |
| Allgemeine Hinweise / vertrauliche Behandlung / Internetübertragung | Allgemeine Sicherheitsbehauptungen sind nicht ausreichend durch den Code verifiziert. | **Erhalten**, aber keine absolute Sicherheitsgarantie behaupten; TLS/Hosting kontrollieren. | TLS- und Hostingkonfiguration. |
| Verantwortliche Stelle und Kontaktangaben | Original enthält mehrere teils abweichende Bezeichnungen/Kontaktblöcke; Code bestätigt keine aktuelle rechtliche Identität. | **Erhalten, konsolidieren und vor Veröffentlichung zwingend bestätigen.** | Aktuelle Rechtsträger-, Vertretungs- und Kontaktangaben. |
| Widerruf allgemeiner Einwilligungen | Health-Consent-Widerruf technisch implementiert; Newsletter-/andere Widerrufspfade teilweise providerabhängig. | **Erhalten und pro Consent-Zweck konkretisieren.** | Verantwortlicher Prozess für sämtliche Einwilligungsarten. |
| Widerspruch nach Art. 21 und Direktwerbung | Rechtliche Standardinformation im Original; praktische Werbeprozesse umfassen Newsletter und manuelles Re-Engagement. | **Erhalten**, rechtlich aktualisieren; Werbewiderspruch über alle Systeme umsetzen. | Marketing-/Re-Engagement Rechtsgrundlage und Suppression. |
| Beschwerderecht | Allgemeine Rechteinformation, nicht codeabhängig. | **Erhalten und aktualisieren**, Aufsichtsbehörde/Verantwortlicher prüfen. | Zuständige Behörde und Kontaktprozess. |
| Datenübertragbarkeit | Allgemeine Rechteinformation, nicht codeabhängig. | **Erhalten.** | Prozess zur Datenbereitstellung. |
| SSL-/TLS-Verschlüsselung | HTTPS wird verwendet/verlinkt; konkrete produktive TLS-Einstellungen nicht geprüft. | **Erhalten nur nach Konfigurationsnachweis**, verständlich und ohne absolute Sicherheitssprache. | Produktive TLS-Einstellungen. |
| Auskunft, Löschung und Berichtigung | Anfrage-Löschung vorhanden, aber nicht vollständig und kann durch Fremdschlüssel blockiert werden. | **Erhalten**, realen Prozess und Grenzen nicht überversprechen. | Umsetzbarer Datenexport-/Löschworkflow. |
| Einschränkung der Verarbeitung | Allgemeiner Abschnitt. | **Erhalten**, organisatorische Umsetzung und Sperrmechanismus definieren. | Prozess und technische Sperre. |
| Cookies allgemein | Keine vollständige App-Cookie-/Storage-Prüfung; WordPress nicht einsehbar. | **Erhalten bis geprüft**, dann nach aktuellen Cookies und ähnlichen Technologien neu schreiben. | Browser-/Plugin-Inventar beider Websites. |
| Usercentrics Consent Manager und AVV | Historisch im Original; nicht im App-Code belegt. | **Ungeklärt; weder als aktiv behaupten noch ohne Websiteprüfung streichen.** | Plugin, Konfiguration, Consent-Log und Vertrag. |
| Kontaktformular | App verarbeitet umfangreiche Daten; sensible Einwilligung und Coachweitergabe vorhanden. | **Erhalten und konkret erweitern.** | Websitekontaktformular und Verarbeitungszuständigkeit. |
| Kontakt per E-Mail/Telefon/Fax | App-E-Mail über Resend nachgewiesen; allgemeine Postfächer, Telefonie/Fax nicht verifiziert. | **Erhalten**, tatsächliche Kanäle/Dienstleister bestätigen. | Mail-/Telefonie-/Faxprovider und Löschregeln. |
| Poise Connect Vermittlung, Datenkategorien, Art. 6/9, Coaches, Dienstleister, Aufbewahrung | Viele Datenfelder und Datenwege im Code nachgewiesen; Rollen, Rechtsgrundlagen und Aufbewahrungsfristen fehlen. | **Erhalten und vollständig neu abgrenzen**, keine pauschalen Rechtsgrundlagen übernehmen. | Rolle Coach, Rechtsgrundlagen, Empfänger, Fristen, Anbieter. |
| eRecht24 Safe Sharing | Im geprüften App-Code nicht nachgewiesen. | **Historisch erwähnen; nur nach WordPressprüfung behalten.** | WordPress-Plugin-/Netzwerkprüfung. |
| Shariff und Social Plugins (Facebook/Twitter/Instagram/Pinterest/XING/LinkedIn/Tumblr) | Im App-Code nicht nachgewiesen; WordPress nicht geprüft. | **Jeden Anbieter einzeln verifizieren**; nicht als pauschales Plugin weiterführen. | Live-Pluginliste und tatsächliche Request-Auslöser. |
| Instagram Plugin | Keine App-Pluginintegration nachgewiesen; Social-Landingpages allein belegen kein Plugin. | **Historisch/ungeklärt**, mit aktiven Pixels/Embeds/Links unterscheiden. | WordPress-/Landingpage-Konfiguration. |
| LinkedIn Plugin | Keine App-Pluginintegration nachgewiesen. | **Historisch/ungeklärt.** | LinkedIn Insight Tag, Buttons, Embeds prüfen. |
| XING Plugin | Keine App-Pluginintegration nachgewiesen; alte Nicht-Speicherungsbehauptung unbelegt. | **Historisch/ungeklärt; Nicht-Speicherung nicht wiederholen.** | Aktuelle Einbindung und Requestverhalten. |
| YouTube Plugin/Einbettung | App bettet Coach-Videos als YouTube-iframe ein, wenn das Modal angezeigt wird. | **Erhalten und aktualisieren**, App- und WordPress-Embeds beschreiben. | Consent-/No-cookie-/Trackingverhalten produktiv prüfen. |
| Zoom für Coachings, Workshops und Sessions | Keine Zoom-API im App-Code gefunden; Meetinglinks sind frei konfigurierbar. | **Historisch/ungeklärt**, Anbieter und Aufzeichnungen organisatorisch bestätigen. | Videodienst, Aufzeichnung, Metadaten, Vertrags-/Transfernachweise. |
| Google Analytics, Cookies, IP-Anonymisierung, Opt-out, AVV, 14 Monate | Im App-Code nicht nachgewiesen; WordPress nicht geprüft. Alte Privacy-Shield-Referenz nicht ungeprüft fortschreiben. | **Historisch/ungeklärt**; bei aktiver Nutzung vollständig mit aktuellem Produktstand ersetzen. | Analytics-Konto, Consent, Version, Aufbewahrung, AVV/Transfer. |
| WordPress Stats/Automattic und Quantcast-Opt-out | Im App-Code nicht nachgewiesen. | **Historisch/ungeklärt.** | WordPress Stats-/Jetpack-Plugin, Cookies und aktueller Widerspruchsweg. |
| Newsletter allgemein, Einwilligung, Abmeldung, Löschung und Sperrliste | Separate Newsletter-Checkbox und Klaviyo-API-Aufruf im App-Code; tatsächliche Opt-in-/Abmelde-/Blacklistdetails offen. | **Erhalten und aktualisieren**, tatsächlichen Anbieterprozess dokumentieren. | Double-Opt-in, Abmeldung, Tracking, Sperrliste, Löschung. |
| MailChimp, US-Transfer, Tracking, Privacy Shield, Vertrag | Historisch in der Erklärung; nicht im App-Code nachgewiesen. | **Vorläufig historisch; erst nach Bestätigung von Altdaten/Konten streichen.** Privacy-Shield-Aussage nicht wiederverwenden. | MailChimp-Konto, Listen, Backups, AVV/Transferstatus. |
| Google Maps mit Einwilligung | Im App-Code nicht nachgewiesen. | **Historisch/ungeklärt.** | WordPress-Embeds/API und Consent-Steuerung. |
| Abschluss-/Signaturblock mit weiteren Kontaktangaben | Weitere abweichende Angaben im Original; Aktualität nicht belegt. | **Erhalten bis zur Konsolidierung** und mit verantwortlicher Stelle abgleichen. | Freigegebene aktuelle Kontakt-/Funktionsangaben. |

**Kein Abschnitt darf ohne dokumentierte Prüfung entfallen.** Das Original umfasst außerdem rechtliche Standardinformationen, deren Wortlaut vor einer Veröffentlichung juristisch aktualisiert werden sollte; die technische Nichtnutzung eines Tools hebt die Prüfung der zugehörigen Altverarbeitung nicht automatisch auf.

## 10. Gesonderte WordPress-/Marketing-Prüfliste

`mypoise.de` ist laut Projektdokumentation eine getrennte WordPress-/Elementor-Website bei Raidboxes. Sie liegt außerhalb dieses Next.js-Repositories. Die folgenden Punkte sind daher **nicht technisch bestätigt**, auch wenn sie in der alten Erklärung stehen:

| Prüfobjekt | Zu erhebende Nachweise (read-only, durch berechtigte Websiteverantwortliche) |
|---|---|
| Raidboxes | Aktiver Hostingvertrag, Rechenzentrums-/Supportregion, AVV, Subunternehmer, Backup-/Log-Retention, TLS, Zugriffsrollen, Restore-/Löschablauf. Keine Passwörter oder Datenbankdumps anfordern. |
| WordPress Core | Version/Update- und Hostingzustand, Nutzerrollen, Systemlogs, Formulare/Uploads, Datenexporte und Löschwerkzeuge; nur administrativ autorisierte Metadaten. |
| Elementor | Aktive Widgets, externe Ressourcen, Formulare, reCAPTCHA/Maps/YouTube/Fonts, Webhooks/Integrationen, gespeicherte Formulareinträge und deren Löschung. |
| Complianz | Ob installiert/aktiv, Bannerkonfiguration, Script-Blocking vor Consent, Consent-Log, Kategorien, Widerruf, externe Dienste und Speicherfristen. |
| WPForms | Aktive Formulare, Felder, Speicherung/Benachrichtigungen, Empfänger, Spam-Schutz, Uploads, Löschfristen und verbundene Marketing-/CRM-Integrationen. |
| Burst Statistics | Aktivität, Cookie-/cookieless-Modus, IP-Verarbeitung, Rollen, Aufbewahrung und Export-/Löschoptionen. |
| OMGF | Ob lokal gehostete Fonts tatsächlich verwendet werden und ob weitere externe Font-Requests verbleiben. Browser-Netzwerkprüfung durchführen. |
| Pinterest for WooCommerce | Pluginstatus, Pixel-/Conversion-Events, Datenpunkte, WooCommerce-Kundendaten, Consent-Integration, Datenempfänger und Transfermechanismus. |
| Google Analytics / Google Tag Manager | Property-/Containerinventar, Tags/Events, Consent Mode, Trigger, IP-/User-ID-/Ads-Nutzung, Aufbewahrung, AVV und Länder-/Transferbelege. |
| WooCommerce / Shop / Produktverkauf | Aktive Shop-Systeme, Bestellungen, Konten, Zahlungsanbieter, Steuer-/Rechnungsdaten, Versand-/Supportdienste, Aufbewahrung und gesetzliche Belege. |
| Newsletter / Marketing | Klaviyo- und ActiveCampaign-Konten, Migration/Parallelbetrieb, Formulare, Listen, Consent-/Double-Opt-in-Nachweise, Tracking, Abmeldung, Sperrlisten, Automationen und Webhooks. MailChimp-Altlisten/Exports auf fortbestehende Verarbeitung prüfen. |
| Landingpages / Webinare | OnePage, WebinarJam, Zoom, Ablefy, Zapier, ManyChat und weitere Tools: produktive Domains/Accounts, eingebundene Skripte, tatsächliche Events, Datenfelder, Empfänger, Vertrags-/Transfer- und Löschbelege. Der App-Code belegt diese Dienste nicht. |
| Soziale Medien / Sharing | eRecht24 Safe Sharing, Shariff, Instagram, TikTok, Pinterest, LinkedIn, XING, X/andere Buttons: Pluginstatus, Requests vor/nach Klick, Cookies/Local Storage, Auftrags-/gemeinsame Verantwortlichkeit und Drittlandbelege. |
| Google Maps / YouTube / reCAPTCHA | Seiten und konkrete Einbettungen, tatsächlicher Ladezeitpunkt, Consent-Blockierung, verwendete Domains, übermittelte Daten und Verhalten bei Ablehnung. |
| Änderungs-/Belegarchiv | Vorher-/Nachher-Screenshots ohne Personen- oder Kontodaten, datierte Pluginliste, Netzwerkrequest-Protokoll ohne sensible Inhalte, AVV-/Transferstatus und dokumentierte Entscheidung je Altabschnitt. |

Keine Kontozugangsdaten, echten Klient:inneninformationen, Formulareinträge, vollständigen Logs oder produktiven Datenbankinhalte in dieses Auditdokument übernehmen.

## 11. H – Vorbereitete Datenschutzerklärungsbausteine

Die folgenden Absätze sind **Arbeitsfassungen mit offenen Klammern**, keine Freigabe für Veröffentlichung. Sie dürfen erst nach Besetzung der Platzhalter, Prüfung der aktuellen WordPress-Konfiguration und juristischer Prüfung verwendet werden.

### Anfrage, Coaching-Vermittlung und sensible Angaben

> Wenn Sie über Poise Connect eine Anfrage stellen, verarbeiten wir die von Ihnen im Formular angegebenen Kontakt- und Stammdaten, Ihre Coaching- und Terminwünsche sowie Angaben zu Ihrem Anliegen. Dazu können Angaben zu Themen, Verlauf, Leidensdruck, Diagnose, Zielen oder einer möglichen Selbstgefährdung gehören. Solche Angaben können Gesundheitsdaten im Sinne der Datenschutz-Grundverordnung sein. Wir verwenden die Angaben zur Bearbeitung Ihrer Anfrage und – soweit rechtlich freigegeben – zur Auswahl und Organisation einer passenden Begleitung. Das Formular verlangt für potenziell gesundheitsbezogene Angaben eine gesonderte ausdrückliche Einwilligung. Rechtsgrundlage und zusätzliche Voraussetzung nach Art. 9 DSGVO: **[durch Verantwortliche/Datenschutzberatung je Zweck bestätigen]**.

### Empfänger und Coach-Zugriff

> Zugriff auf Anfragedaten erhalten die hierfür zuständigen Personen bei **[verantwortliche Stelle bestätigen]**. Ein ausgewählter bzw. zugeordneter Coach kann die für die Vermittlung und Begleitung benötigten Angaben einsehen. Die konkrete Rolle der Coaches und der Umfang der Datenweitergabe sind **[organisatorisch und rechtlich zu bestätigen]**. Für Hosting, Datenbank, E-Mail, Kalender, Newsletter und Abrechnung setzen wir – soweit im jeweiligen Prozess tatsächlich aktiv – **[bestätigte Dienste und deren Rolle eintragen]** ein.

### Widerruf

> Sie können eine erteilte Einwilligung mit Wirkung für die Zukunft widerrufen. Der Widerruf verhindert im System weitere Verarbeitungen, die einen aktiven Einwilligungsnachweis voraussetzen. Bereits gespeicherte Anfrageinhalte werden dadurch nicht automatisch gelöscht. Ob einzelne Daten aufgrund einer anderen Rechtsgrundlage weiterhin benötigt werden, etwa für **[nur nach rechtlicher Prüfung konkretisieren]**, teilen wir nach Prüfung Ihres Anliegens mit. **[Kontakt- und Widerrufsweg ergänzen.]**

### Terminorganisation

> Für Verfügbarkeitsprüfung und Terminverwaltung können erforderliche Termin- und Zuordnungsdaten an Google Calendar bzw. den jeweils verbundenen Kalender übermittelt werden. Der derzeitige Code kann darüber hinaus Namen, Anfrage-ID, E-Mail-Adresse und Telefonnummer im Kalendertermin hinterlegen. Vor Veröffentlichung wird empfohlen, die Kalenderdaten auf notwendige Angaben zu reduzieren. **[Aktuelle Konfiguration, Zugriffskreise, Region und Anbieterbedingungen bestätigen.]**

### Kommunikation und Nachrichten

> Transaktions- und Termin-E-Mails werden über **[tatsächlich aktiven Versanddienst bestätigen]** verschickt. Wenn Sie oder Ihr Coach die Nachrichtenfunktion verwenden, werden Nachrichtentext und Betreff im System gespeichert und über den E-Mail-Dienst übermittelt. Nachrichten können freiwillig sensible Angaben enthalten. **[Retention, Rollen, Providerregion, Vertrags- und Löschprozess ergänzen.]**

### Newsletter und Erinnerungen

> Wenn Sie gesondert in den Newsletter einwilligen, verwenden wir Ihre E-Mail-Adresse und **[bestätigte Attribution-/Interessenangaben]** zum Versand von Informationen. Sie können Ihre Einwilligung jederzeit über **[tatsächlich vorhandenen Abmeldeweg]** widerrufen. Eine optionale Zustimmung für eine einmalige neutrale E-Mail zur Fortsetzung eines begonnenen Anfrageentwurfs ist davon getrennt. **[Klaviyo/ActiveCampaign-Status, Tracking, Nachweis und Löschung bestätigen.]**

### Externe Inhalte und technische Ressourcen

> Auf einzelnen Seiten können externe Schriftarten oder Video-Inhalte eingebunden sein. Beim Laden solcher Inhalte kann Ihr Browser eine Verbindung zum jeweiligen Anbieter herstellen und technische Verbindungsdaten übermitteln. **[Nach Umsetzung des lokalen Font-Hostings und der Consent-gesteuerten Videoeinbindung aktualisieren; nicht verwendete Einbindungen nach geprüfter Entfernung streichen.]**

### Speicherdauer

> Wir speichern personenbezogene Daten nur so lange, wie dies für den jeweiligen Zweck erforderlich ist oder gesetzliche Aufbewahrungspflichten bzw. die Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen dies erfordern. Die konkreten Zeiträume bzw. Löschkriterien sind **[je Datenkategorie nach genehmigtem Löschkonzept einzutragen]**. Für technische Recovery-Codes und Warteschlangendaten gelten **[produktive Migration und Fristen bestätigen]**.

## 12. Noch benötigte Freigaben und Nachweise

### Kritisch vor Veröffentlichungsfassung

- Verantwortliche Stelle und konsistente, aktuelle Kontaktangaben für `mypoise.de` und `app.mypoise.de`.
- Schriftliche rechtliche Entscheidung über Art.-6-Grundlagen und Art.-9-Ausnahme je Zweck, Art.-22-Einschätzung und Rolle jedes Coaches.
- Bestätigung der tatsächlich aktiven Anbieter, Regionen, Unterauftragsverarbeiter, AVV, Angemessenheitsmechanismen/SCC und konkreten Drittlandübermittlungen.
- WordPress-/Raidboxes-Plugin- und Browser-Netzwerk-Inventar einschließlich Consent-Gating und tatsächlicher Cookies/Skripte.
- Beschluss und Nachweis eines einheitlichen Lösch-/Aufbewahrungskonzepts inklusive Rechnungsdaten, Consent-Nachweisen, Nachrichten, Re-Engagement, Backups und Logs.
- Produktive Migrations-/RLS-/Cron-/Providerkonfiguration durch zuständige Administrator:innen anhand datensparsamer Nachweise bestätigen; keine Produktionsdatensätze oder Secrets übermitteln.
- Health-Data-Widerrufsprozess für interne Zugriffe, Handover, Messaging und gegebenenfalls andere Rechtsgrundlagen verbindlich festlegen.

### Technische Maßnahmen vor oder parallel zur Veröffentlichung

- Öffentliche Score-Ausgaben und `topicRelevance` gegen den dokumentierten Public-Vertrag prüfen und fachlich freigeben bzw. entfernen.
- `delete-forever` und referenzierte Daten als durchgängigen, idempotenten Löschworkflow konzipieren; Restrict-Fremdschlüssel, Consent-Orphans und Providerlöschung berücksichtigen.
- Messaging-RLS auf Handover und aktuelle Zuweisung ausrichten; direkte Browser-SELECTs testen.
- Kalender-Payload minimieren, Zugriffsrechte prüfen und Löschsynchronisierung definieren.
- Google Fonts lokal ausliefern; YouTube-Embeds nach einer genehmigten Consent-/Click-to-load-Strategie nachladen.
- Cron-Authentifizierung fail-closed gestalten; tatsächlich gesetzte Secrets nur durch zuständige Personen bestätigen lassen.
- Client-Bundle auf Coach-Kontakt- und interne Rankingfelder prüfen.
- Dokumentation mit implementierter Messaging-Funktion und tatsächlich ausgelieferten Public-API-Feldern in Einklang bringen.

## 13. Neues Systemwissen

- **Was wurde gelernt?** Der aktuelle App-Code enthält mehr laufende Datenschutzfunktionen als Teile der älteren Architekturbeschreibung ausdrücken: persistente Conversations/Messages, Resend-Inbound-Verarbeitung, getrennten Health-Consent, Dashboardzugriffe auf sensible Felder, mehrere öffentliche Matchingdaten-Endpunkte und konkrete Personendaten in Kalenderereignissen.
- **Allgemeine Relevanz:** Ja. Die Befunde beeinflussen den Public-Datenvertrag, Einwilligungs-/Widerrufsverhalten, Handover, RLS, Löschbarkeit und die Datenschutzerklärung.
- **Bereits dokumentiert?** Teilweise. Consent und Teile des Recovery-Verhaltens stehen in Architektur-/Sicherheitsdokumenten. Der RLS-Handover-Befund, numerische Public-Scores, die `delete-forever`-Fremdschlüsselabhängigkeit und die Kalender-Minimierung waren nicht als abgeschlossene Maßnahmen dokumentiert.
- **Welche Dokumentation ist betroffen?** [AI_CONTEXT.md](../AI_CONTEXT.md), [architecture.md](./architecture.md), [security.md](./security.md), [generated API map](./generated/api-map.md), [generated database usage](./generated/database-usage.md), [generated calendar map](./generated/calendar-map.md), [generated email map](./generated/email-map.md).
- **Wurde sie aktualisiert?** Nein. Auftragsgemäß wurde ausschließlich dieses neue Audit-Abschlussdokument erstellt. Änderungen an bestehenden Regeln, Code oder Migrationen wurden nicht vorgenommen.
- **ENTSCHEIDUNG ERFORDERLICH:** Welche dokumentierten Public-Verträge, Coachzugriffe nach Handover und Aufbewahrungsregeln verbindlich gelten sollen, muss durch die verantwortliche Person freigegeben werden.

## 14. Abschluss

1. **Personenbezogene Daten:** Kontakt-/Stammdaten, Adresse, Geburtsdatum, Beschäftigungsgrad, Anliegen und Präferenzen, sensible Gesundheitsangaben, Termine, Coach-Zuordnungen, Nachrichten, Rechnungs-/Steuerangaben, Provider-/Event-IDs und Recovery-/Einwilligungsnachweise.
2. **Besondere Kategorien:** Gesundheitsbezogene Angaben einschließlich Diagnose, Leidensdruck, Verlauf, Anliegen, Selbstgefährdungsangaben und potenziell gesundheitsbezogener Freitexte.
3. **Zugriffe:** Aktive Admins auf breite Anfrage-/Draftdaten; Coaches auf zugewiesene Daten sowie in einem gesonderten Endpunkt auf bestimmte E-Mail-Wunschzuordnungen; Klient:innen über tokenbasierte Endpunkte; frühere Coaches können laut bestehender Messaging-RLS geschlossene Verläufe weiterhin lesen. Produktive RLS bleibt ungeprüft.
4. **Externe Anbieter im Code/Dokumentationsbestand:** Supabase, Vercel-Konfiguration, Google Calendar/OAuth, Resend, Klaviyo und sevDesk; zusätzlich Google Fonts, YouTube und ein Microsoft-Forms-Link. WordPress/Raidboxes/Elementor sind dokumentiert, aber nicht in diesem App-Repository enthalten. Produktivstatus jeweils bestätigen.
5. **Drittlandübermittlungen:** Aus dem Repository nicht verifizierbar. Google Fonts, YouTube und Anbieter-/Hostingkonten erfordern konkrete Anbieter- und Regionennachweise; keine Übermittlung oder Rechtsgrundlage wird hier behauptet.
6. **Technische Einwilligungen:** Health-Data-Consent mit Tokenhash, Textversion, Erteilungs- und Widerrufszeitpunkt; optionaler Draft-Reminder-Consent; Newsletter-Checkbox und separates Klaviyo-Subscribe. Der allgemeine Datenschutz-Checkboxwert speichert im geprüften Code keine Version oder Zeit.
7. **Löschfristen:** Keine vollständige Frist für Anfragen, Gesundheitsdaten, Nachrichten, Rechnungen, Logs oder Backups nachgewiesen. Recovery-Funktionen besitzen kurze Ablauf-/opportunistische Purge-Regeln, aber keinen vollständigen Scheduler und keine begrenzte Retryzahl für Fehlerjobs.
8. **Fehlende Informationen:** Produktive WordPress-/Plugin-/Consent-/Analytics-Konfiguration, tatsächliche Anbieter-/Kontonutzung, AVV/Transferbelege, Rollen der Coaches, Rechtsgrundlagen, Aufbewahrungsfristen, produktive RLS-/Migrationstände und Verantwortlichenangaben.
9. **Ursprüngliche Erklärung:** Alle darin enthaltenen Sachabschnitte sind in Abschnitt 9 einzeln abgebildet. Kein Anbieter-/Rechte-/Kontaktabschnitt soll ohne dokumentierte Prüfung entfallen.
10. **Noch erforderlich:** Die Freigaben und Nachweise aus Abschnitt 12, insbesondere Websiteprüfung, Verantwortlichen-/Rechtsgrundlagenentscheidung, Anbieter- und Transferinventar, Löschkonzept sowie Entscheidung zu Widerruf und Coachzugriff.

**Technische Grundlage für Datenschutzerklärung vollständig geprüft: NEIN.** Die Code- und Dokumentationsanalyse ist abgeschlossen, aber produktive WordPress-/App-Konfiguration, Providerkonten/-verträge, produktive Datenbank-/RLS-/Cron-Stände, Löschfristen und rechtlich-organisatorische Festlegungen sind offen. Eine Veröffentlichung darf nicht als technisch oder rechtlich freigegeben dargestellt werden.
