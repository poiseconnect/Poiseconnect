# Poise Connect – P0-Datenschutzprobleme: Analyse und Remediation-Plan

**Stand:** 27. Oktober 2026
**Modus:** Read-only-Analyse und neue Dokumentation. Keine Code- oder Bestandsdokumentänderung, keine Migration, kein Produktivzugriff, kein Versand und kein Deployment.
**Zweck:** Technische Entscheidungsvorlage zur Freigabe einer späteren Implementierung. Keine rechtliche Bewertung oder Produktivfreigabe.

## 1. Ergebnis, Umfang und Beweismaß

Diese Analyse baut auf [privacy-audit-closeout.md](./privacy-audit-closeout.md) auf und startet keinen allgemeinen Audit neu. Geprüft wurden die dort genannten Consent-, Staff-, Handover-, Messaging- und Löschpfade, die vorhandenen SQL-Migrationen, relevante Dashboard-/Rechnungs-/Recovery-Routen, die Architektur-, Sicherheits- und CTO-Workflow-Dokumente sowie die generierten API-, Datenbank-, Kalender-, E-Mail- und Statusübersichten.

Es wurden ausschließlich Quellcode, Migrationen und Dokumentation im Repository gelesen. Es wurden weder Produktionsdaten noch Logs, Supabase-Projekte, Providerkonten, Rollen, Deployments, Google-Kalender oder Vercel-Umgebungsvariablen abgefragt. SQL wurde nicht ausgeführt. Es wurden keine bestehenden Dateien verändert. Die Arbeitskopie enthält Änderungen anderer Arbeiten; diese wurden nicht angerührt.

Evidenzkennzeichnung:

- **Nachgewiesen:** direkt in lokalem Anwendungscode bzw. einer vorhandenen Migration enthalten; keine Aussage über den Produktivstand.
- **Plausibles Risiko:** folgt aus Code-/Datenmodellgrenzen, setzt aber einen bestimmten Laufzeit- oder Produktionszustand voraus.
- **Nicht verifiziert:** benötigt produktive Schema-, Rollen-, Provider-, Realtime-, Retention- oder Vertragsnachweise.
- **Rechtlich/organisatorisch offen:** muss vor Implementierung von Verantwortlichen bzw. Datenschutzberatung entschieden werden.

### Kurzurteil

1. **P0-1 – Widerruf:** Die ausdrückliche Einwilligung wird versioniert und als Tokenhash mit Erteilungs- und Widerrufszeit gespeichert. Der Widerruf wirkt jedoch nur in Routen, die den aktiven Consent tatsächlich prüfen. Mehrere Staff-Lesewege, Matchingzustand und Handover prüfen ihn nicht. Ein Widerruf löscht derzeit keine bereits gespeicherten Angaben.
2. **P0-2 – Coach-Wechsel:** Die App-APIs beschränken Nachrichtenversand überwiegend auf aktuell zugewiesene aktive Coaches. Die SQL-SELECT-Policies für Conversations und Messages prüfen dagegen nur, ob der authentifizierte aktive Coach der Conversation zugeordnet ist. Sie prüfen weder den aktuellen Anfrage-Owner noch den offenen Conversation-Status. Ein aktiver ehemaliger Coach kann deshalb über direkte authentifizierte Tabellenabfragen weiterhin historische Nachrichten seiner eigenen Conversation lesen. Schreiben über den direkten Tabellenzugriff ist laut Migration nicht freigegeben; der API-Versand prüft zusätzlich die aktuelle Anfragezuordnung.
3. **P0-3 – Löschung:** `delete-forever` löscht nur die `anfragen`-Zeile. Nachgewiesene `ON DELETE RESTRICT`-Beziehungen zu Messaging und Re-Engagement können diese Löschung blockieren. Weitere FK-Regeln fehlen für mehrere Basistabellen in den lokalen Migrationen; die produktive FK-Landschaft ist unbekannt. Recovery-Queue-Datensätze ohne FK und externe Provider-/Kalenderkopien werden von der Route nicht bereinigt.

**Empfohlene Reihenfolge:** sofortige Zugriffsbegrenzung (P0-1 und P0-2), danach nur nach Freigabe des Aufbewahrungs- und Legal-Hold-Modells die transaktionale Löscharchitektur (P0-3). Keine der Empfehlungen darf bestehende Termine, `sessions` als Abrechnungsquelle, Rechnungen, POISE-Verfügbarkeitsblöcke oder bereits erteilte Einwilligungsnachweise unbeabsichtigt zerstören.

## 2. P0-1 – Gesundheitsdaten nach Widerruf

### 2.1 Nachgewiesener Daten- und Consent-Pfad

**Datenfelder:** [healthDataConsent.js](../app/lib/healthDataConsent.js) definiert als sensible Felder `themen`, `anliegen`, `leidensdruck`, `verlauf`, `diagnose`, `ziel`, `check_suizid` und `terminwunsch_text`. Sie werden in der produktiven Anfrage-Tabelle `anfragen` gespeichert; eine getrennte Gesundheitstabelle ist im geprüften Schema nicht nachgewiesen.

**Erteilung, Zuordnung und Widerruf:**

- `POST /api/intake-consent` in [intake-consent/route.js](../app/api/intake-consent/route.js) erteilt ein zufälliges Token. Bei bereits bestehender Anfrage verlangt die Route Anfrage-ID plus `booking_token`.
- Die Migration [20261017000000_anfrage_health_data_consent.sql](../supabase/migrations/20261017000000_anfrage_health_data_consent.sql) erzeugt `anfrage_health_data_consents` mit `request_id`, `token_hash`, `text_version`, `granted_at` und nullable `revoked_at`. Der Hash wird nicht als Klartexttoken gespeichert.
- `request_id` besitzt in dieser Migration **keinen Fremdschlüssel** zu `anfragen`. Damit ist eine verwaiste Zuordnung bei Anfrage-Löschung technisch möglich.
- [healthDataConsent.js](../app/lib/healthDataConsent.js) prüft in `findActiveHealthDataConsent` den Hash, `revoked_at IS NULL`, die aktuell unterstützte Consent-Version und optional die Anfragezuordnung. `attachHealthDataConsent` verknüpft einen zunächst ungebundenen Nachweis nach dem Anlegen der Anfrage.
- Widerruf setzt in `intake-consent/route.js` `revoked_at`; die bestehende Anfrage und ihre Gesundheitsfelder bleiben bestehen. Die Migration/Routen enthalten keine allgemeine Bereinigung dieser Felder.
- Consentprüfung und spätere Anfrageänderung sind mehrere Datenbankaufrufe und keine gemeinsame Transaktion. Ein Widerruf zwischen Prüfung und Schreiben wäre daher ein **plausibles TOCTOU-Risiko**. Ein Produktionsvorkommen ist nicht nachgewiesen.

**Öffentlicher Klientenzugriff:**

- [public-request/route.js](../app/api/public-request/route.js), `GET`, verlangt Anfrage-ID und `booking_token`.
- Ohne gültigen Header `x-health-data-consent` werden nur die Basisfelder zurückgegeben; mit aktiver, zur Anfrage passender Einwilligung kommen die sensiblen Felder hinzu.
- Nach Widerruf liefert die aktive-Consent-Suche keinen Treffer. Die Route begrenzt dann die Antwort auf Basisfelder. Das ist für zukünftige Antworten nachgewiesen.
- Ob ein bereits geöffnetes Browserfenster bereits geladene Werte aus React-Zustand, Browser-Speicher oder Screenshots löscht, ist nicht nachgewiesen. Clientseitige Caches und bereits erfolgte Offenlegungen lassen sich durch ein serverseitiges Widerrufsflag nicht rückwirkend zurückrufen.

**Staff-Zugriffe und Verarbeitung:**

- [dashboard/requests/route.js](../app/api/dashboard/requests/route.js), `GET`, nutzt `supabaseAdmin()` und lädt sensible Anfragefelder. Für Coaches filtert die Route `assigned_therapist_id`; für Admins wird keine Anfragezuordnung eingeschränkt. Ein Health-Consent-Check fehlt.
- [team-requests/route.js](../app/api/team-requests/route.js), `POST`, lädt sensible Felder für die aktuelle Coach-ID **und zusätzlich** Datensätze, deren `wunschtherapeut` der E-Mail des Coaches entspricht. Dieser zweite Weg kann auch eine nicht der Coach-ID zugewiesene Anfrage offenlegen. Ein Consent-Check fehlt.
- [admin/form-drafts/route.js](../app/api/admin/form-drafts/route.js), `GET`, liefert sensible Felder aus Drafts an aktive Admins. Ein Consent-Check fehlt.
- [coach-handover/route.js](../app/api/coach-handover/route.js), `POST`, lädt sensible Felder für Admin bzw. aktuell zugewiesenen Coach ohne Consent-Prüfung. Bei vorhandenen Sessions wird eine neue Anfrage angelegt und kopiert unter anderem Anliegen, Ziel, Leidensdruck, Verlauf und Diagnose. Die Kopie erhält in diesem Pfad keinen neuen Consent-Beleg. Bei fehlender Sessionhistorie werden Anfragezuordnung und Status zurückgesetzt; die Gesundheitsfelder bleiben in der bisherigen Anfrage.
- Das clientseitige Matching in [page-client.jsx](../app/page-client.jsx) berechnet `_score` aus den Themen sowie `leidensdruck` und `diagnose` über [qualificationBonus.js](../app/lib/qualificationBonus.js). Die Berechnung läuft im geladenen Browserzustand; ein erneuter Consent-Check nach Widerruf ist nicht nachgewiesen. Daten können dort bis zum Zurücksetzen/Neuladen sichtbar oder im Speicher vorhanden bleiben.
- [form-submit/route.js](../app/api/form-submit/route.js) verlangt vor dem finalen Schreiben einen aktiven, passenden Consent und speichert Gesundheitsfelder. Die Bestätigungsmails an Klient:in und Coach enthalten im geprüften Body keine Anliegen-/Diagnosefelder. Gesundheitsdaten können jedoch später freiwillig in Nachrichten eingegeben werden.
- Messaging speichert Betreff, Klartext und HTML im `request_messages`-Datensatz. [inbound.js](../app/lib/messaging/inbound.js) persistiert empfangene E-Mail-Inhalte und leitet sie an den Coach weiter; [outbound.js](../app/lib/messaging/outbound.js) speichert Coach-Nachrichten vor dem Versand über Resend. Nachrichtentexte können Gesundheitsdaten enthalten. Es gibt keinen Consent-Statuscheck in diesen Messaging-Pfaden. Bereits versandte E-Mails und Providerkopien können nach einem Widerruf nicht technisch zurückgerufen werden.
- Die Rechnungs-/Sitzungsoberflächen ([invoices/load/route.js](../app/api/invoices/load/route.js), [admin/sessions/route.js](../app/api/admin/sessions/route.js)) behandeln Anfrage- und Abrechnungsdaten. In den geprüften Pfaden werden keine oben genannten Freitext-Gesundheitsfelder in Rechnungsdatensätze kopiert; die produktiven Rechnungsfelder und sevDesk-Inhalte sind nicht verifiziert.
- Ein zentraler Exportpfad, der Gesundheitsfelder aus `anfragen` exportiert, wurde im untersuchten Repository nicht nachgewiesen. Das ist kein Beleg, dass keine externen/manuellen Exporte existieren.

### 2.2 Aktuelle Zugriffsmatrix

„Vor Widerruf“ und „nach Widerruf“ beschreiben das gegenwärtige Repository-Verhalten. „Gesundheitsdaten“ meint die oben aufgeführten Intake-Felder; „Basisdaten“ umfasst insbesondere Kontakt-, Termin-, Zuweisungs- und Statusdaten. Rechtszulässigkeit wird hier nicht beurteilt.

| Rolle / Kanal | Vor Widerruf – technischer Zugriff | Nach Widerruf – gegenwärtiger technischer Zugriff | Evidenz / Einschränkung |
|---|---|---|---|
| Klient:in mit `booking_token` über `GET /api/public-request` | Basis- und Gesundheitsfelder nur mit aktivem passenden Consent-Token | Antwort nur mit Basisfeldern; Gesundheitsfelder werden nicht ausgegeben | Im Code nachgewiesen. Bereits im Browser geladene Daten bleiben hiervon unberührt. |
| Aktuell zugewiesener Coach – Dashboard | Anfrage einschließlich Gesundheitsfeldern | Weiterhin Gesundheitsfelder | `dashboard/requests` prüft Zuordnung, nicht Consent. |
| Coach über E-Mail-Wunschzuordnung | Anfrage einschließlich Gesundheitsfeldern, wenn `wunschtherapeut` seiner E-Mail entspricht | Weiterhin möglich, auch ohne aktuelle ID-Zuordnung | `team-requests`-Fallback; Geschäftsabsicht/produktive Nutzung offen. |
| Admin – Dashboard / Drafts / Handover | Breiter Zugriff auf sensible Anfragefelder | Weiterhin möglich | Admin-Routen nutzen privilegierte Serverzugriffe; kein Consent-Gate nach Widerruf. |
| Ehemaliger Coach – Dashboard | Bei aktueller Zuweisung wie aktueller Coach | Dashboardfilter verliert die Anfrage nach Neuzuweisung; E-Mail-Fallback kann weiter greifen | Route-spezifisch; keine historische Assignment-Tabelle im geprüften Datenmodell nachgewiesen. |
| Ehemaliger Coach – Conversation/Message-Tabellen direkt | Eigene Conversation-/Message-Zeilen, wenn aktives Coachkonto | Weiterhin lesbar, auch nach Conversation-Schließung und Anfrage-Neuzuweisung | RLS prüft eigene `therapist_id`, aktive Coachidentität, aber nicht aktuelle Anfragezuordnung oder Status. Nachrichten können Gesundheitsdaten enthalten. |
| Ehemaliger Coach – Nachrichten schreiben | Nur über API, sofern Conversation offen, Alias gültig und Anfrage noch ihm zugeordnet | API verweigert bei Zuweisungsabweichung; direkte Tabellenmutation ist laut Migration nicht gewährt | [outbound.js](../app/lib/messaging/outbound.js) prüft Zuweisung; RLS-Migration gibt `authenticated` nur SELECT. |
| Coach-Handover / Matching | Handover kopiert vorhandene Gesundheitsfelder; Matching nutzt Themen/Leidensdruck/Diagnose im Client | Die Handover-Route kopiert weiterhin; bereits im Browser befindliche Matchingdaten können weiterverarbeitet werden | Keine Consent-Prüfung im Handover; bestehende Frontendberechnung. Zielverarbeitung nach Widerruf rechtlich festzulegen. |
| Messaging- und E-Mail-Kanäle | Nachrichteninhalt kann gespeichert und über Resend weitergeleitet werden | Bestehende Inhalte und Providerkopien bleiben; keine automatische Sperre oder Löschung | Nachrichten sind nicht an Consent gekoppelt; E-Mail nicht rückrufbar. |
| Rechnung / Sitzung / Admin-Export | Personenbezogene Geschäfts- und Abrechnungsdaten | Basis-/Abrechnungsdaten können weiter nötig sein; Gesundheitsfreitext im Rechnungsinhalt nicht nachgewiesen | Aufbewahrung und konkrete Rechnungsfelder rechtlich/organisatorisch zu bestätigen. |
| Support-/Systemrollen, Realtime und manuelle Exporte | Nicht vollständig aus lokaler Codebasis bestimmbar | Nicht vollständig aus lokaler Codebasis bestimmbar | Produktionsrollen, Realtime-Publication, Supportzugriffe und manuelle Exporte nicht verifiziert. |

### 2.3 Zielmodell und Entscheidung zu Widerruf

**Technische Grundregel:** Ein Widerruf beendet die weitere Verarbeitung, die ausschließlich auf dieser Einwilligung beruht, sobald der Widerruf wirksam gespeichert ist. Er ist nicht automatisch ein Löschbefehl und hebt keine andere tatsächlich anwendbare Rechtsgrundlage auf. Welche Felder aus welchem Zweck nach Widerruf weiter benötigt/verarbeitet werden dürfen, muss vor Implementierung rechtlich und organisatorisch festgelegt werden.

Empfohlen wird ein **fail-closed Zugriffstor**:

1. Zentrale, serverseitig wiederverwendbare Autorisierungsfunktion für sensible Felder; keine einzelne Route darf die Consent-Prüfung selbst auslassen. Der Zugriff muss zugleich Nutzerrolle, aktive Anfragezuordnung, Feldumfang und aktuellen Consent-/Freigabestatus prüfen.
2. Service-Role-Routen dürfen nicht als Consent- oder RLS-Ersatz behandelt werden. Jede Admin-, Coach-, Draft-, Matching-, Handover- und Nachrichtenroute benötigt eine explizite Zweck-/Berechtigungsprüfung vor Datenabruf und vor jeder Kopie/Weitergabe.
3. Standard nach Widerruf: sensible Intake-Felder nicht mehr laden, zurückgeben, matchen, weiterkopieren oder in neue Nachrichten-/E-Mail-Prozesse übernehmen. Bereits versandte E-Mails und rechtmäßig aufbewahrte Nachweise sind getrennte Kategorien.
4. Falls eine Verarbeitung nach Widerruf auf einer anderen Rechtsgrundlage zulässig und erforderlich ist, wird sie erst nach dokumentierter juristischer Entscheidung für einen konkret definierten Zweck, Felder, Empfänger und Zeitraum freigegeben. Keine pauschale „Admin darf immer“-Ausnahme.
5. Consent-Beleg als Nachweis getrennt von der Nutzberechtigung behandeln. Widerruf muss den Authentifizierungswert unwirksam machen; Nachweisinhalt und -aufbewahrung sind minimal und nach rechtlich genehmigter Frist zu gestalten. Derzeit bleibt `token_hash` im widerrufenen Datensatz erhalten.
6. Im Frontend sensible Form-/Matchingzustände bei Widerruf und Sitzungswechsel leeren; keine sensible Browserpersistenz. Serverantworten nach Widerruf dürfen keine sensiblen Felder mehr enthalten.
7. Ein Consent-Check plus sensible Lese-/Schreiboperation sollte atomar oder gegen konkurrierenden Widerruf geschützt werden (z. B. transaktionale RPC mit Anfrage-Lock und Statusprüfung). Der Nachweis eines aktiven Consents vor separatem Update reicht gegen TOCTOU nicht.

**Zwei technische Optionen:**

| Option | Nutzen | Nachteil / Risiko |
|---|---|---|
| A. Gemeinsamer serverseitiger Zugriffsgate plus vollständige Route-Abdeckung | Kleinste erste Änderung; vorhandene `anfragen`-Struktur und Prozesse bleiben zunächst erhalten | Muss wirklich jede Service-Role-Route und jeden Kopier-/Exportpfad erfassen; Fehler bei später neu hinzugefügten Pfaden bleiben möglich. |
| B. Gesundheitsfelder in eine separate Tabelle verschieben und Zugriff über enge RPCs/Views kapseln | Stärkere Datenisolation, geringere Gefahr versehentlicher Basis-SELECTs; bessere Feld- und Rollensteuerung | Große Datenmigration/Backfill, Query-/Dashboard-/Matching-/Handover-Änderungen; Risiko für bestehende Anfragen und Matching; kein sofortiger Schutz bereits exportierter E-Mails. |

**Empfehlung:** Option A als eng begrenzte erste Sperre nach rechtlicher Entscheidung über Admin- und Ausnahmezugriff; parallel die getrennte Gesundheitstabelle als Architekturverbesserung prüfen. Kein Backfill, keine Datenbereinigung und kein Consent-Nachweis für Bestandsdaten ohne explizite Freigabe. Alte/fehlende Consent-Belege sind nicht als erteilt zu interpretieren.

### 2.4 P0-1 Maßnahmen

- **P0:** Zentrale Policy für Widerruf und Health-Data-Access einschließlich expliziter Ausnahme-/Rechtsgrundlagenentscheidung festlegen.
- **P0:** Consent-Gate in `dashboard/requests`, `team-requests`, `admin/form-drafts`, `coach-handover`, alle sensiblen öffentlichen/formularbezogenen Reads/Writes und alle weiteren Such-/Kopierpfade integrieren.
- **P0:** Handover nach Widerruf so sperren, dass nicht automatisch Gesundheitsfelder in eine neue Anfrage kopiert werden. Übergabe der für Buchung/Abrechnung nötigen Basisdaten getrennt behandeln.
- **P0:** Frontendzustand und Matching bei Widerruf zurücksetzen; Matching-/Read-APIs gegen neue Verarbeitung ohne zulässige Grundlage absichern.
- **P1:** Nachrichten- und E-Mail-Verarbeitung nach Widerruf zweckbezogen regeln; sensible Inhalte in Kommunikation verhindern oder separat autorisieren, verbleibende Providerkopien erheben und Löschmöglichkeiten verifizieren.
- **P1:** Consent-Belegschema um definierte Ereignis-/Aufbewahrungstrennung ergänzen, sobald legal genehmigte Belegfelder und Fristen vorliegen.
- **P2:** Sensible Felder in separates Datenmodell migrieren, falls Risiko-/Betriebsabwägung Option B bestätigt.

## 3. P0-2 – Ehemalige Coaches, Conversations und Messaging-RLS

### 3.1 Tabellen und technische Berechtigungen

Die Ausgangsdefinition steht in [20260901000000_request_messaging_foundation.sql](../supabase/migrations/20260901000000_request_messaging_foundation.sql):

| Tabelle | Relevante Felder / Beziehungen | Direkter Zugriff nach Migration |
|---|---|---|
| `request_conversations` | `anfrage_id` → `anfragen(id) ON DELETE RESTRICT`; `therapist_id` → `team_members(id) ON DELETE RESTRICT`; `status`, `reply_alias`, `reply_token_hash`, `alias_revoked_at`, `retention_until` | RLS aktiv; `authenticated` erhält SELECT. Policy `"coaches read own request conversations"` prüft `therapist_id`, `auth.uid()`, `team_members.active = true` und `role = 'therapist'`. Kein Check auf aktuelle Anfragezuordnung oder `status = 'open'`. |
| `request_messages` | `anfrage_id` → `anfragen(id) ON DELETE RESTRICT`; zusammengesetzter FK `(conversation_id, anfrage_id)` → Conversation `(id, anfrage_id) ON DELETE RESTRICT`; Klartext/HTML, Provider- und Empfangsmetadaten, `retention_until` | RLS aktiv; `authenticated` erhält SELECT. Policy `"coaches read own request messages"` prüft Coach-Identität gegen Conversation-Owner, aber nicht aktuellen Anfrage-Owner, Conversation-Status oder Nachrichtenzustand. Kein Tabellen-INSERT/UPDATE-Grant für `authenticated` in dieser Migration. |
| `request_message_events` | Provider, Provider-Event-ID, Eventtyp, Zeit, `processing_error`; kein Anfrage- oder Nachrichten-FK in der Migration | RLS aktiv, aber keine Policy und kein `authenticated`-Grant in dieser Migration. Service-Role-Webhook kann Events schreiben/ändern. |

Die Migration legt keine `retention_until`-Purge-Routine an. Ein automatisches Ablauf-/Löschverfahren ist aus diesen Definitionen nicht belegt.

### 3.2 Antworten auf die konkreten Fragen

1. **Kann ein ehemaliger Coach nach Neuzuweisung Nachrichten lesen? – Ja, unter den nachgewiesenen Bedingungen.** Wenn der Coach weiterhin `active = true` und `role = 'therapist'` ist und seine User-ID der `therapist_id` einer alten Conversation entspricht, erfüllt er die RLS-Policy auch bei geschlossener Conversation oder neuer aktueller Anfragezuordnung. Direkte authentifizierte SELECT-Abfragen können deshalb die alten Nachrichtenzeilen weiterhin lesen. Die App-API begrenzt dagegen die Conversation-Ansicht nach aktuellem Assignment. Ob die produktive Migration angewandt ist und direkte Tabellenzugriffe aktiv sind, ist nicht verifiziert.
2. **Kann er neue Nachrichten schreiben? – Nicht über den direkten Tabellenzugriff gemäß dieser Migration; über die App-API nur bei fortbestehender Berechtigung.** Die Migration gewährt `authenticated` nur SELECT, nicht INSERT/UPDATE. `/api/messages/send` und `/api/send-personal-message` prüfen aktives Coachkonto; `sendCoachMessage` in [outbound.js](../app/lib/messaging/outbound.js) verlangt Conversation-Owner, offenen Status, nicht widerrufenen Alias und aktuelle Übereinstimmung mit `anfragen.assigned_therapist_id`. Nach Neuzuweisung sollte dieser Versand abgewiesen werden. Ein fehlgeschlagener oder nicht abgeschlossener Wechsel kann jedoch abhängig von der Reihenfolge ein offenes altes Conversation-Fenster zurücklassen; das muss atomar verhindert werden.
3. **Kann er Anhänge, Metadaten oder Ereignisse abrufen?** Die Migration definiert keine separate Attachment-Tabelle/-Spalte. `request_messages` enthält `text_body`, `html_body`, Betreff, Status, Alias und Provider-IDs; ein direkter Tabellen-SELECT kann alle gewährten Spalten abfragen, also auch HTML-Inhalt und Metadaten. Anhänge können aus dem Repository nicht als eigene gespeicherte Objekte nachgewiesen werden; Resend-Providerpayloads/-Retention sind nicht geprüft. `request_message_events` ist nach der lokalen Migration nicht direkt durch `authenticated` lesbar. Eine gesonderte Produktionsfreigabe/Rechtekonfiguration wäre nicht verifiziert.
4. **Welche Zugriffe schützt RLS?** Direkte `authenticated`-SELECTs auf `request_conversations` und `request_messages` werden durch Policies und Tabellen-Grants eingeschränkt; direkte Schreibzugriffe sind gemäß dieser Migration nicht gewährt. Für `request_message_events` gibt es keine authentifizierte Policy/Grant. Service-Role-Zugriffe umgehen RLS. Die RLS auf `anfragen` bzw. das vollständige Basisschema wurde in den vorhandenen Migrationen nicht nachgewiesen.
5. **Welche Service-Role-Routen und eigenen Prüfungen bestehen?**
   - [messages/conversations/route.js](../app/api/messages/conversations/route.js): `GET`; prüft Bearer-User, aktives Therapist-Teammitglied, aktuelles `assigned_therapist_id` und terminale Anfragezustände; lädt nur offene Conversation des aktuellen Coaches, erstellt sie bei Bedarf über RPC; listet Nachrichtentexte. Verwendet `supabaseAdmin()`.
   - [messages/send/route.js](../app/api/messages/send/route.js) und [send-personal-message/route.js](../app/api/send-personal-message/route.js): `POST`; prüfen aktives Coachkonto; `sendCoachMessage` validiert Conversation-Owner/Status/Alias und aktuelle Anfragezuordnung, bevor die Nachricht persistiert und über Resend gesendet wird. Service-Role-Client.
   - [inbound.js](../app/lib/messaging/inbound.js), aufgerufen über [webhooks/resend/route.js](../app/api/webhooks/resend/route.js): signaturgeprüfter Resend-Webhook; prüft Tokenhash des Reply-Alias, offene Conversation, nicht widerrufenen Alias, aktiven Coach und aktuelle Anfragezuordnung. Nicht zustellbare/veraltete Antworten können als `review`-Nachricht mit Body am alten Conversation-/Anfragebezug persistiert werden; sie werden nicht an den ehemaligen Coach weitergeleitet. Service-Role-Client umgeht RLS.
   - [coach-handover/route.js](../app/api/coach-handover/route.js), [forward-request/route.js](../app/api/forward-request/route.js), [admin-forward/route.js](../app/api/admin-forward/route.js): authentifizieren Admin/zugewiesenen Coach und schließen die offene Conversation vor Entfernen der Zuordnung. `reassign-request/route.js` ändert nur `wunschtherapeut`, nicht `assigned_therapist_id`; der Name der Route allein bedeutet keinen tatsächlichen Ownerwechsel.
   - [conversations.js](../app/lib/messaging/conversations.js) ruft `ensure_open_request_conversation` und `close_open_request_conversation` auf. Die SQL-Funktionen sperren `anfragen`-Zeilen; `ensure_open_request_conversation` verlangt aktuelle Zuordnung und schließt eine offene ältere Conversation, bevor eine neue angelegt wird. Sie werden ausschließlich `service_role` gewährt.
6. **Welche Berechtigungen bei einem Coach-Wechsel entziehen?** Alte aktive Assignment-Berechtigung, alle Anfrage-spezifischen Zugriffsgaben, alle weiterhin lesbaren alten Conversations und aktive Reply-Alias-Zustellung. Für API- und Realtime-Abfragen muss der Ownerwechsel sofort gelten. Eine Deaktivierung des gesamten Coachkontos ist keine angemessene Ersatzmaßnahme für Anfrage-spezifische Entziehung.
7. **Welche historischen Daten erhalten bleiben?** Keine pauschale Löschung. Conversation-/Nachrichtenhistorie kann bis zu rechtlich/fachlich freigegebenen Retentionsfristen für Nachweis, Betreuungskontinuität oder Streitfälle erhalten bleiben, aber standardmäßig für den ehemaligen und neuen Coach gesperrt sein. Ob Admins oder ein neuer Coach zweckgebundenen, begrenzten Einblick erhalten dürfen, muss separat entschieden und protokolliert werden.

**Realtime:** Im geprüften `app/`- und `supabase/`-Code wurde keine Messaging-Realtime-Subscription oder Publication-Konfiguration gefunden. Produktive Supabase-Realtime-Publications, JWT-Rollen und Channel-Berechtigungen sind daher nicht verifiziert. Falls Tabellen in einer Publication enthalten sind, muss die RLS-Neuregelung dort ausdrücklich mit synthetischen Clients getestet werden; keine pauschale Realtime-Freigabe annehmen.

### 3.3 Ziel-Berechtigungsmodell und kontrollierte Übergabe

- **Aktueller Coach:** Anfragebezogene Berechtigung nur für aktive Teammitglieder mit exakter aktueller Assignment-ID und definiertem Zweck. Nicht über E-Mail-Wunschfeld ableiten.
- **Ehemaliger Coach:** Zugriff auf Anfrage, Gesundheitsfelder und Conversation unmittelbar beim Wechsel entziehen; abgeschlossene Historie bleibt serverseitig erhalten, aber standardmäßig nicht lesbar.
- **Admin:** kein stillschweigender uneingeschränkter Nachrichteninhaltzugriff. Falls betriebliche/klinische Einsicht erforderlich ist, nur mit begründetem, zeitlich begrenztem Break-glass-/Fallzugriff, protokolliertem Zweck und kontrollierter Einsicht.
- **Neuer Coach:** neue Conversation mit neuem Alias/Token. Kein impliziter Zugriff auf die gesamte Historie. Optional freizugebende Übergabeinformationen sind ein explizites, minimiertes Paket mit rechtlicher/fachlicher Freigabe; keine automatische Kopie des alten Verlaufs.
- **Datenbank:** SELECT-Policies für Conversation und Message müssen zugleich aktive Identität, aktuelle `anfragen.assigned_therapist_id`, Conversation-Owner und für Live-Nachrichten offenen Status prüfen. Für historische/ehemalige Conversations gilt default deny. `request_message_events` bleibt ausschließlich serverseitig, sofern kein ausdrücklich begründeter Viewerprozess eingerichtet wird.
- **API und Realtime:** gleicher Autorisierungskern; Datenbank-RLS bleibt Defense-in-Depth. Privilegierte Server-Routen führen explizite AuthZ-Prüfung durch und geben nur benötigte Spalten zurück. Realtime-Policy-/Publication-Test wird Teil der Migration-Freigabe.
- **Ownerwechsel:** Anfragezeile sperren; alte Conversation schließen und Alias widerrufen, alte Grants widerrufen, Assignment-Historie protokollieren, neue Zuweisung setzen und bei Bedarf neue Conversation erzeugen. Diese Änderungen müssen in einem transaktionalen RPC bzw. einer gleichwertigen Transaktion passieren, nicht als getrennte, fehleranfällige HTTP-Schritte.

### 3.4 P0-2 Maßnahmen

- **P0:** RLS auf aktuelle Zuweisung und aktive, explizite Anfrageberechtigung begrenzen; offene Conversation als Voraussetzung für Live-Zugriff. Historische Conversation nicht allein aufgrund von `therapist_id` freigeben.
- **P0:** `team-requests`-E-Mail-Fallback für sensible Anfragefelder entweder entfernen oder durch explizite, zeitlich begrenzte Zuweisung ersetzen.
- **P0:** Alle echten Assignment-Änderungsrouten auf eine atomare Ownerwechsel-Operation umstellen. `reassign-request` als Wunschänderung separat benennen/behandeln, damit keine falsche Sicherheitsannahme entsteht.
- **P0:** Übergabe-/Handover-Regeln definieren; neuer Coach erhält keine Historie standardmäßig. Conversation- und Aliaswechsel ohne Verlust der getrennt aufzubewahrenden Historie.
- **P1:** `request_message_events`-, Provider- und Realtime-Rechte/-Retention festlegen; Produktivpublication und tatsächliche Grants vor Rollout nachweisen.
- **P1:** Historische Datenzugriffe als temporäre, begründete und auditierbare Grants implementieren, falls fachlich und rechtlich erforderlich.

## 4. P0-3 – Dauerhafte Löschung und Abhängigkeiten

### 4.1 Aktueller Löschpfad

[requests/delete-forever/route.js](../app/api/requests/delete-forever/route.js), `POST`, erfordert ein aktives Admin-Mitglied und führt dann ausschließlich `DELETE FROM anfragen WHERE id = requestId` aus. Bei Datenbankfehler wird ein Fehlerstatus zurückgegeben und nur der Fehlercode geloggt. Es gibt weder Vorabprüfung der Abhängigkeiten noch Löschstatus, Job, idempotente Kinddatenbereinigung, externe Providerbereinigung oder Legal-Hold-Entscheidung.

Die Route löscht nicht sichtbar:

- Nachrichten, Conversations, Reply-Aliasse und Nachrichtenereignisse,
- Health-Consent-Nachweise,
- Recovery-Queue-Jobs,
- Draft-/Matchingzustände außerhalb der Anfragezeile,
- Sessions, Blocked Slots oder Terminvorschläge,
- Rechnungen und Rechnungsdokumente,
- Google-Kalenderereignisse,
- bereits versandte Resend-E-Mails oder Providerlogs.

### 4.2 FK- und Abhängigkeitsübersicht aus lokalen Migrationen

Die folgende Liste ist vollständig für die in den geprüften Migrationen explizit gefundenen Beziehungen zur Anfrage bzw. zum Messaging. Sie ist **keine vollständige Datenbankinventur**: Für mehrere Basistabellen existieren im Repository keine Schemaerstellungs-/Constraintdefinitionen; Produktiv-DDL und nachträgliche Schemaänderungen wurden nicht geprüft.

| Quelle | Beziehung / Löschregel aus lokaler Migration | Konsequenz für `anfragen`-Löschung |
|---|---|---|
| `request_conversations.anfrage_id` | FK auf `anfragen(id) ON DELETE RESTRICT`; Migration `20260901000000_request_messaging_foundation.sql` | Verhindert Anfrage-Löschung, solange Conversations bestehen. |
| `request_conversations.therapist_id` | FK auf `team_members(id) ON DELETE RESTRICT` | Coaches mit Conversation können ihrerseits nicht ohne Behandlung der Conversation gelöscht werden. |
| `request_messages.anfrage_id` | Nullable FK auf `anfragen(id) ON DELETE RESTRICT` | Verhindert Anfrage-Löschung, solange Nachrichtenzeilen referenzieren. |
| `request_messages.(conversation_id, anfrage_id)` | zusammengesetzter FK zu `request_conversations(id, anfrage_id) ON DELETE RESTRICT` | Nachrichten müssen vor Conversation gelöscht/entkoppelt werden; sonst blockiert der FK die Conversation-Löschung. |
| `anfrage_health_data_consents.request_id` | `uuid`-Spalte ohne FK in `20261017000000_anfrage_health_data_consent.sql` | Anfrage kann gelöscht werden, Nachweis kann mit alter Anfrage-ID verwaisen. |
| `anfragen_reengagement_log.anfrage_id` | FK auf `anfragen(id) ON DELETE RESTRICT` in `20261005000000_admin_reengagement_log.sql`; Migration entzieht `DELETE` auf der Tabelle und gewährt `service_role` nur SELECT/INSERT/UPDATE | Anfrage-Löschung kann dauerhaft blockiert sein; die Anwendung kann den Log nicht mit dem bestehenden Grant entfernen. |
| `client_link_recovery.request_id` | FK auf `anfragen(id) ON DELETE CASCADE` in `20261016000000_client_link_recovery.sql` | Recovery-Links werden bei Request-Deletion mitgelöscht, sofern Migration produktiv angewandt ist. |
| `client_link_recovery_queue.request_id` | `text`, kein FK in derselben Migration; Queue enthält zudem E-Mail, verschlüsseltes Geheimnis und Jobstatus | Ein noch wartender/laufender Job überlebt Request-Deletion zunächst. Worker kann keinen passenden Request mehr finden, aber Queue-PII/Geheimnis bleibt bis Abschluss/Cleanup; aktive Jobs müssen gezielt storniert/geleert werden. |
| `request_message_events` | Kein Anfrage-/Message-FK in der Messaging-Migration; keine Body-Spalte | Provider-Event-ID, Eventtyp und Fehlerstatus sind ohne Requestbezug nicht gezielt löschbar/zuordenbar; Retention und mögliche Re-Identifizierbarkeit müssen festgelegt werden. |
| `sessions.anfrage_id` | Verwendung durch Booking-, Rechnungs- und Handover-Code ist nachgewiesen; FK und `ON DELETE` sind in den gefundenen lokalen Migrationen nicht definiert | Produktions-FK-Regel unbekannt. `sessions` ist laut `AI_CONTEXT.md` die führende Quelle abrechenbarer Sitzungen; nicht pauschal kaskadieren/löschen. |
| `blocked_slots.anfrage_id` | Nutzung für Buchungsblockierung nachgewiesen; FK-Regel in lokalen Migrationen nicht gefunden | Produktions-FK-Regel unbekannt. Kalendertermine und Sperren müssen getrennt behandelt werden. |
| `appointment_proposals.anfrage_id` | Nutzung in API-/Dashboard-/Reminder-Routen nachgewiesen; FK-Regel im geprüften Migrationsbestand nicht gefunden | Produktions-FK-Regel unbekannt; offene Vorschläge und Providertermine vor Löschung schließen/behandeln. |
| `invoices.anfrage_id` | Rechnungsrouten lesen/schreiben Zuordnungen; Constraintdefinition im geprüften Migrationsbestand nicht gefunden | FK und gesetzliche Aufbewahrung sind nicht verifiziert. Rechnungsdaten nicht mit Anfrage-Löschung vernichten. |
| `coach_invoices` / sevDesk | Coach-Abrechnungsdaten und externe sevDesk-Bezüge, aber kein gesicherter Anfrage-FK-Nachweis aus der untersuchten Migration | Separate Rechnungskategorie; Aufbewahrung und Empfänger-/Providerlöschung organisatorisch prüfen. |
| `anfragen` selbst | Draft, Papierkorb und aktive/finale Anfragen liegen als Statusvarianten in derselben Tabelle | Draft ist kein eigener Datensatztyp; Papierkorbstatus ist keine Löschung. |

**Weitere externe Abhängigkeiten:** Google Calendar kann Events mit Request-/Sessionbezug enthalten; die Löschroute löscht keine konkreten Events. `POISE VERFÜGBAR`-Blöcke dürfen niemals gelöscht oder verändert werden. Resend kann versandte/empfangene E-Mail-Kopien und Eventdaten halten. Providerseitige Retention, Suchbarkeit und Lösch-API sind nicht verifiziert. Anwendungslogs müssen ohne Body/PII geprüft werden; der aktuelle Delete-Handler loggt nur Fehlercode, weitere Plattformlogs sind nicht zugänglich.

### 4.3 Status- und Aufbewahrungsmodell

Vor Implementierung müssen die folgenden Zustände und Übergänge fachlich bestätigt werden:

| Begriff | Technische Bedeutung/Ziel |
|---|---|
| **Aktive Anfrage** | Operativer Datensatz, der Matching, Coachkommunikation, Termine oder Betreuung ermöglicht. Consent-/Assignment-Gates gelten pro Anfrage. |
| **Archivierte Anfrage** | Nicht mehr im aktiven Arbeitsvorrat, aber nicht gelöscht. Zugriff restriktiv; konkrete Frist und Gründe festlegen. Kein aktuelles eindeutiges Archivmodell in den geprüften Statusmaps belegt. |
| **Papierkorb** | Der Status `papierkorb` wird von Status-/No-Match-Pfaden verwendet und kann Conversations schließen. Er ist reversibler/operativer Status, kein Beleg einer Löschung und keine Retention-Freigabe. |
| **Endgültige Löschung** | Unumkehrbare Entfernung aus aktiven Systemen nach Berechtigungs-, Abhängigkeits- und Legal-Hold-Prüfung sowie abgeschlossenem externem Lösch-/Nachweisworkflow soweit technisch möglich. |
| **Gesetzlich erforderliche Aufbewahrung** | Nur konkret freigegebene Rechnungs-/Buchungs-/Consent-Nachweise bleiben erhalten; Zugriff, Zweck, Frist, Speicherort und spätere Löschung getrennt definieren. Keine Frist wird hier erfunden. |
| **Anonymisierung** | Nur wenn direkte und indirekte Identifikatoren sowie verknüpfbare IDs zuverlässig entfernt oder aggregiert wurden. Pseudonymisierte UUID, Tokenhash oder Request-Referenz ist nicht automatisch anonym. |

### 4.4 Sichere Löscharchitektur

**Eine transaktionale, mehrstufige Architektur ist erforderlich**, weil Daten über mehrere Tabellen und externe Systeme verteilt sind. Eine einzelne Parent-DELETE-Abfrage reicht nicht aus.

1. **Autorisierter Antrag:** Admin-only Endpoint mit starker Authentifizierung, CSRF-/Requestschutz gemäß vorhandenem Muster, validierter UUID, serverseitigem Auditgrund und optionaler Zwei-Personen-Freigabe für irreversiblen Schritt. Keine vom Client gelieferte Löschliste akzeptieren.
2. **Idempotente Reservierung:** Eine `request_erasure_jobs`-/Tombstone-Struktur mit eindeutiger Idempotenzkennung und Zuständen wie `requested`, `preflight`, `blocked_legal_hold`, `deleting`, `external_pending`, `completed`, `failed`. Fehler werden als Stufe plus sanitisiertem Fehlercode, nicht als SQL-Body/PII, protokolliert. Keine dauerhafte Klartext-E-Mail, Gesundheitsfelder, Token oder vollständigen Request-Payloads in Job-/Auditdaten.
3. **Sperre und Eingangsstopp:** Anfragezeile transaktional sperren; Status/Deletion-Pending setzen; weitere Formularänderung, Zuweisung, Recovery-Link-Ausgabe, Termin-/Proposal-Erstellung und Messaging-Weiterleitung blockieren. Ausstehende Recovery-Queue-Jobs mit passendem Requestbezug neutralisieren und verschlüsselte Secrets/E-Mail-/Tokenfelder löschen. Race mit Recovery-Issue/Consume und Messaging-Inbound über dieselbe Request-Lock-/Statusprüfung verhindern.
4. **Preflight:** Fremdschlüssel und Datensatzanzahl aus einer expliziten Datenbank-Abhängigkeitsliste prüfen; offene Sessions, Rechnungen, Steuer-/Abrechnungsnachweise, aktive Termine, Google-Events, laufende Nachrichten und offene Providerjobs feststellen. Bei unbekannter Tabelle, Integritätsfehler oder ungeklärtem Legal Hold fail closed. Kein automatischer Cascade auf unbekannte Daten.
5. **Legal-Hold-/Aufbewahrungstrennung:** Rechnungen, abrechnungsrelevante `sessions` und erforderliche Belege nicht löschen, wenn eine freigegebene Aufbewahrung entgegensteht. Vor Entfernung der Anfragebeziehung eine bestätigte, zugriffsbeschränkte und minimale Abrechnungs-/Nachweisstruktur vorsehen. Kein pauschales `ON DELETE CASCADE` auf Abrechnungsdaten. Rechtliche Fristen und notwendige Felder müssen zuerst feststehen.
6. **Datenbankphase in einer Transaktion:** nach erfolgreicher Freigabe erforderliche Conversation schließen, Reply-Alias/Hash invalidieren, Nachrichteninhalte und sensible Anfragefelder gemäß Retentionentscheidung entfernen; Child-Reihenfolge nach FK beachten; Consent-Nachweise nach beschlossener Evidenzstrategie verknüpfen, minimieren oder löschen; Recoverydaten und Draft-/Vorschlagsdaten bereinigen; Re-Engagement-Log kontrolliert anonymisieren/löschen oder einen genehmigten Retention-Verweis erhalten; Parent erst löschen/anonymisieren, wenn alle Constraint-/Holdprüfungen erfolgreich sind.
7. **Externe Systeme über Outbox:** notwendige Google-Eventbereinigung und Providerlösch-/Retentionanfragen nach erfolgreichem DB-Preflight als idempotente Outbox-Aufgaben ausführen. Kalenderlöschung darf nur konkrete Poise-Termine umfassen, niemals `POISE VERFÜGBAR`-Verfügbarkeitsblöcke. Externe Systeme sind nicht Teil einer DB-Transaktion; fehlgeschlagene Aufgaben bleiben sichtbar/retrybar, nicht als „gelöscht“ ausgeben.
8. **Abschluss und Nachweis:** Nach Abschluss nur minimale, rechtlich freigegebene Erasure-Metadaten beibehalten; Request-ID-/E-Mail-/Tokenzuordnung aus dem Job entfernen oder gemäß genehmigter Nachweisstrategie pseudonymisieren. Antwort unterscheidet „gelöscht“, „teilweise extern ausstehend“ und „aufbewahrt wegen dokumentiertem Grund“.
9. **Wiederholung und Fehler:** Wiederholte Anforderung gibt bestehenden Status zurück und legt keine zweite Aktion an. Jede Stufe ist transaktional/idempotent. Bei Fehler bleibt der Datensatz für Nutzerzugriffe gesperrt und die Aufgabe mit safe stage/error code nachverfolgbar; keine Erfolgsmeldung bei Teilfehler.

### 4.5 Datenkategorien, Trigger und Fristen – Fristen offen

| Kategorie | Auslöser / Zielaktion | Abhängigkeiten / Schutz | Frist |
|---|---|---|---|
| Anfrage-Basisdaten | Genehmigter endgültiger Löschantrag oder genehmigte Zweckbeendigung; entfernen oder irreversibel anonymisieren | `anfragen`, Recovery, Vorschläge, Sessions, Rechnungen, Kalender, externe Systeme | **Offen – rechtlich festzulegen** |
| Gesundheits-/Matchingfelder | Widerruf stoppt Verarbeitung, ist aber nicht automatisch Löschung; genehmigte Löschung entfernt Inhalte aus aktiver und abgeleiteter Speicherung | `anfragen`, Frontendzustand, Nachrichten, E-Mail, Handover-Kopien, Backups | **Offen – je Zweck festzulegen** |
| Consent-Nachweis | Widerruf bzw. Löschung; nur minimaler Nachweis, falls rechtlich erforderlich, sonst löschen | `anfrage_health_data_consents` hat derzeit keinen FK; Tokenhash ist nicht mehr als Berechtigungscredential nutzbar | **Offen – rechtliche Evidenzpflicht klären** |
| Messaging und Conversations | Anfrage-Löschung/Retentionsende; Inhalte entfernen, Aliase widerrufen; notwendige Historie gesperrt erhalten | Restrict-FKs zwischen Request/Conversation/Message; Resend-Kopien; Events | **Offen – je Nachrichtenart festzulegen** |
| `request_message_events` | Ablauf der Provider-/Fehlernachweispflicht; minimieren oder löschen | Kein Request-FK; nur Eventmetadaten in lokaler Migration | **Offen – organisatorisch festzulegen** |
| Drafts | Draft-Abbruch, Zweckende oder Löschantrag; Draft ist `anfragen.status = 'draft'`, also dieselbe Tabelle | Admin-Draft-Route, Recovery-Queue, Recovery-Token | **Offen – rechtlich festzulegen** |
| Coach-Zuordnungen / Handover | Wechsel bzw. Löschung; alte Rechte sofort entziehen, historische Zuordnung minimal nachweisen | `assigned_therapist_id`, Conversation `therapist_id`, fehlende dedizierte Assignment-Historie | Zugriffsentzug sofort; Retention **offen** |
| Termine / `blocked_slots` / Sessions | Absage oder Löschprozess; konkrete Termine und Sperren prüfen, Session nur nach Abrechnungs-/Aufbewahrungsfreigabe entfernen | Calendar-Event-ID, `blocked_slots`, `sessions`; `sessions` Abrechnungsquelle | **Offen – Buchung und Abrechnung getrennt** |
| Rechnungen / sevDesk | Ablauf gesetzlicher Aufbewahrung bzw. genehmigte Anonymisierung | `invoices`, `coach_invoices`, externe sevDesk-Objekte; FK/Produktivstatus unbekannt | **Offen – keine Fristen angenommen** |
| Re-Engagement-Protokolle | Fristende; minimale Auditdaten behalten oder anonymisieren | Restrict-FK und fehlendes DELETE-Recht in `anfragen_reengagement_log` | **Offen – Recht und notwendiger Nachweis** |
| Recovery-Daten | Bei Abschluss, Verfall, Löschantrag oder Deletion-Pending; Challenge/Queue-PII/Geheimnis beseitigen | `client_link_recovery` Cascade; Queue ohne FK; Retryworker | Laufzeit/Frist **offen**, aber Löschung bei Auftrag sofort anstoßen |
| E-Mail-/Provider-Ereignisse | Anfrage-Löschung bzw. Retentionsende; Provider-Löschbarkeit/-Retention abfragen | `request_messages`, Resend-E-Mailkopien und Providerlogs | **Offen – Anbieterbedingungen prüfen** |
| Logs / Backups / Recovery | Genehmigte Datenkategorie-Frist; aus Live-DB, Logs, Backups und Restore-Systemen planen | Produktivprotokolle/Backup-/Restorekonfiguration nicht zugänglich | **Offen – kein Nachweis im Repository** |

### 4.6 P0-3 Maßnahmen

- **P0:** Vollständige FK-/Tabellen-/Provider-Inventur anhand des autorisierten Produktivschemas und freigegebener Stagingkopie; bis dahin kein Hard-Delete-Rollout.
- **P0:** Rechtliche Retentionsmatrix und Legal-Hold-Entscheidungen für Sessions, Rechnungen, Consent-Nachweise, Nachrichten und Logs beschließen.
- **P0:** `delete-forever` zunächst in einen sicheren Preflight-/Jobstatus umwandeln; Fehler/Abhängigkeiten explizit ausweisen; Parent nicht löschen, wenn unbekannte Referenzen oder Holds bestehen.
- **P0:** Ein transaktionales Erasure-RPC/Servicekonzept und Mehrstufen-Outbox spezifizieren; keine unkontrollierten Kaskaden.
- **P1:** Constraint-Strategie nach Genehmigung festlegen: harte Restrict-Gates für aufzubewahrende Nachweise, kaskadierende Löschung nur für eindeutig kurzlebige technische Tokens, Set-Null/Anonymisierung für zu erhaltende Minimalprotokolle. Jede Regel mit Reversal-/Restoreplan.
- **P1:** Recovery-Queue, E-Mailprovider und Calendar-Cleanup integrieren; externe Teilergebnisse sichtbar machen.
- **P2:** Backup-, Log- und Restore-Erasure-Nachweise sowie periodische Retentionjobs auditierbar automatisieren.

## 5. Betroffene Oberflächen und Prozessauswirkungen

| Bereich | Erwartete Auswirkung einer Umsetzung | Schutzmaßnahme |
|---|---|---|
| Bestehende Anfragen | Nach Widerruf werden sensible Felder verborgen/gesperrt; Datenzeile und Status bleiben zunächst bestehen. Fehlender Consent darf nicht rückwirkend als Zustimmung gelten. | Vor Rollout Bestandszustände ohne Produktivdaten in einer genehmigten Inventur quantifizieren; API-Antworten testen. |
| Admin-/Coach-Dashboards | Gesundheitsdetails erscheinen nur mit aktueller Berechtigung; Coach-E-Mail-Fallback verschwindet oder wird explizit berechtigt. | Nicht sensible Status-/Kontaktfunktionen separat erhalten; Admin-Ausnahmen protokollieren. |
| Matching | Widerruf beendet weitere Nutzung von Leidensdruck/Diagnose und leert UI-Zustand; Themen-/Buchungsweiterverarbeitung abhängig von rechtlicher Feldklassifikation. | Keine automatische Neuberechnung, Löschung oder Coach-Abwahl ohne Produktentscheidung. |
| Handover | Neue Zuweisung wird atomar; kein automatischer Kopiervorgang sensibler Intake-Daten oder Historie. | Klinisch notwendiges Minimum separat genehmigen; bestehende Sessionhistorie bleibt intakt. |
| Termine / Google Calendar | Consent-/Coachänderung löscht nicht automatisch gebuchte Termine. Endgültige Löschung kann konkrete Events erfordern. | Separate Stornoentscheidung und Event-ID verwenden; `POISE VERFÜGBAR` unverändert lassen. |
| Messaging / Resend | Alte Coachrechte werden sofort entzogen; neue Conversation/Reply-Alias; alte Inhalte bleiben ggf. gesperrt erhalten. E-Mailproviderkopien sind nicht automatisch rückrufbar. | Versand/Inbound auf aktuelle Zuweisung prüfen; Providerretention und Löschmöglichkeiten verifizieren. |
| Rechnungen / sevDesk | Abrechnungsrelevante `sessions`/Rechnungen werden nicht pauschal gelöscht. Anfragebezug kann für Bedienung/Reporting erforderlich sein. | Rechtliche Aufbewahrung, Rechnungsinhalt und Entkopplung vom Request vor Datenlöschung entscheiden; kein stilles Überschreiben. |
| Datenbankeinträge | Neue Constraints/Statusfelder/RPCs können Migrationen erfordern; vorhandene Zuordnungen und verwaiste Daten können Migration blockieren. | Schema-Preflight, Duplikat-/Orphan-Prüfung in freigegebener Testumgebung; erst nach expliziter Freigabe produktive Anwendung. |
| Bereits erteilte Einwilligungen | Vorhandene gültige Nachweise bleiben nachvollziehbar; Widerruf entwertet Zugriffstoken sofort. | Keine automatische Backfill-Einwilligung; Version, Erteilungs-/Widerrufszeit und spätere Aufbewahrung gesondert halten. |

## 6. Implementierungsvorschlag in sicherer Reihenfolge

Alle Schritte sind **Vorschläge**, keine Freigabe. P0-Schritte benötigen vor Umsetzung die unten aufgeführten Entscheidungen.

1. **P0 – Rechtliche Zweck-/Berechtigungsmatrix beschließen.** Für jede sensible Feldgruppe, Rolle und Weitergabe festlegen, ob nach Widerruf eine andere Basis gilt, wer Zugriff erhält und welche Aufbewahrung erforderlich ist.
2. **P0 – Synthetische Regressionstests zuerst ergänzen.** Bestehende Tests unter `tests/api/intakeConsentRoute.test.js`, `tests/api/healthDataConsentMigration.test.js`, `tests/lib/messagingConversationsRoute.test.js` und `tests/lib/messagingOutbound.test.js` decken Teilverhalten ab; Tests für Staff-Zugriffe nach Widerruf, direkte RLS-Policies, Handover ohne Consent, finale Löschung und FK-Fehler sind nicht als vollständiger Satz nachgewiesen. Kein Test mit echten Datensätzen.
3. **P0 – Access-Gate und API-Verträge implementieren.** Zuerst zentrale Autorisierung und sichere Feld-Allowlist, danach Admin-, Coach-, Client-, Draft-, Matching-, Messaging- und Handover-Route darauf umstellen. UI-Memory leeren. Jede privilegierte Route bekommt explizite Tests.
4. **P0 – Conversation-/Assignment-Wechsel konsolidieren.** Gemeinsame atomare Operation für Close/alias revoke, Assignment-Entzug, Audit-Historie und neue Conversation. Alle Assignmentschreiber darauf umstellen; `reassign-request` fachlich als Wunschänderung kennzeichnen.
5. **P0 – Datenbankmigration für RLS und Assignment-Integrität vorbereiten.** Neue Policies mit aktueller Zuweisung, aktiver Identität und Status; Rechte auf schmale Spalten-/Views/RPCs reduzieren; Realtime-Publication/Rechte prüfen. `SECURITY DEFINER`-Funktionen nur mit festem `search_path`, minimalen Grants und Review verwenden.
6. **P0 – Löschinventur und rechtliche Retentionsentscheidung abschließen.** Kein endgültiger Delete, bevor alle Constraints, Tabellen, externen Kopien und erforderlichen Aufbewahrungen geklärt sind.
7. **P0 – Lösch-Preflight und idempotente Jobarchitektur in Testumgebung aufbauen.** FKs/Legal Holds erkennen; Jobfehler und Wiederholung; Elternzeile erst im genehmigten finalen Schritt entfernen/anonymisieren.
8. **P1 – Kinddaten-/Providerbereinigung implementieren.** Pro Datenkategorie festgelegte Reihenfolge, Outbox und Retry; kein generisches Cascade.
9. **P1 – Retention/Backup/Log-Wartung automatisieren.** Nur mit bestätigten Fristen, Restoretests und Löschbelegen.
10. **P2 – Optionale Trennung sensibler Gesundheitsfelder** aus `anfragen` evaluieren, Migration zunächst nur in synthetischer/staging Umgebung testen.

## 7. Erforderliche Migrationen – konzeptionell, nicht ausgeführt

### Migration A – Berechtigungsmodell für Anfrage- und Messagingzugriff (P0)

- Ergänzung eines minimalen Assignment-/Access-Auditmodells, etwa `request_assignment_events` und ggf. zeitlich begrenzter `request_access_grants`. Felder, Zweckcodes, Widerrufs-/Ablaufzeit und vergebende Person müssen vorher feststehen.
- Atomare RPC für Assignmentwechsel: Anfragezeile locken; alte Conversation schließen; Alias widerrufen; alte temporäre Grants entziehen; neue Zuweisung und neue Conversation setzen; Status-/Auditereignis atomar speichern.
- Policies auf `request_conversations` und `request_messages` so ändern, dass nur aktive, aktuell zugewiesene bzw. explizit gewährte Coachidentität Zugriff erhält. Für normale Coaches nur offene Conversation-/Live-Daten; historische Messages nicht implizit mitfreigeben.
- `request_message_events` bleibt server-only. Rechte und RLS müssen explizit geprüft werden, nicht auf implizite Supabase-Defaults vertrauen.
- Neue notwendige Indizes auf Anfrage-ID, aktuelle Zuweisung und zeitlich aktive Grants; Migration muss vorhandene Duplikate/Inkonsistenzen vor Aktivierung erkennen und bei Konflikt stoppen.
- Realtime-Publication wird nicht unbesehen aktiviert; falls vorhanden, RLS mit echten synthetischen JWT-Claims testen.

### Migration B – Consent-/Health-Access-Sicherung (P0)

- Keine bestehende Anfrage-/Consentzeile automatisch als gültig backfillen.
- Optionales, explizites Verarbeitungs-/Widerrufsereignis bzw. Zweckstatusfeld nur nach rechtlicher Entscheidung; bei Einwilligungswiderruf aktive Tokenberechtigung sofort widerrufen.
- `request_id`-FK für Consent-Tabelle nicht ohne Entscheidung zu Nachweisaufbewahrung setzen: `RESTRICT` schützt Nachweise, kann Löschung blockieren; `CASCADE` kann erforderliche Nachweise vernichten; `SET NULL` kann Nachweiszuordnung verlieren. Ein separates, minimiertes Consent-Evidence-Modell ist zu prüfen.
- Atomare RPC/Transaktionsprüfung für Consentstatus und sensible Verarbeitung, um Prüfung/Schreiben nicht zu trennen.
- Falls Gesundheitstabelle separiert wird: Additiv starten, Backfill ausschließlich in freigegebenem Wartungsfenster, Konsistenz-/Counts ohne Ausgabe von Datenwerten, dual-read/write nur zeitlich begrenzt und mit vollständigem Rückfallpfad.

### Migration C – Löschworkflow und Constraint-Schutz (P0)

- `request_erasure_jobs` bzw. äquivalente Job-/Tombstone-Tabelle mit Status, zufälliger Job-ID, idempotentem Schlüssel, Zeitstempeln und sanitisiertem Fehlercode; personenbezogene Requestdaten nicht in die Jobpayload kopieren.
- Temporäre Anfrageverknüpfung nur während Bearbeitung; finalen Tombstone-/Belegumfang rechtlich bestätigen. Eine gehashte UUID kann weiterhin personenbezogen/pseudonym sein.
- FK-/Indexinventur und Constraints für Consent, Sessions, Blocked Slots, Proposals, Invoices und Messaging zuerst in Staging verifizieren. Kein automatischer FK-Cascade auf Finanz-/Nachweisdaten.
- Ergänzung einer Lösch-Outbox für externe Vorgänge (konkrete Kalenderereignisse, Provideraufträge) mit Idempotenz, Retry-/Dead-letter-Status und PII-Minimierung.
- FK-/Löschregeln für Messages, Conversations, Recovery, Re-Engagement und `request_message_events` nach beschlossenem Aufbewahrungsmodell; keine voreilige Änderung der bestehenden `RESTRICT`-Regeln.

**Migrationsabhängigkeiten:** Migration A und Teile von B teilen Anfrage-Locks/Access-Audit und müssen gemeinsam abgestimmt werden. Migration C kann separat entwickelt werden, darf aber Consent-Evidence, Nachrichten-/Assignment-Historie und Finanzdaten nicht ohne die Entscheidungen aus A/B entkoppeln. Endgültige Parent-Löschung benötigt alle drei Modelle sowie produktive FK-Inventur. Keine Migration darf durch die Anwendung automatisch ausgeführt werden.

## 8. Synthetischer Testplan

Nur künstliche IDs, Coachidentitäten, E-Maildomains wie `example.invalid` und erfundene Nachrichteninhalte. Providerclients in Tests stubben; keine echten E-Mails, Tokens, Kalender oder Datenbanken.

| # | Fall / Testgrenze | Erwartung |
|---|---|---|
| 1 | Consent erteilen, versionierte Nachweiszeile an synthetische Anfrage binden, anschließend widerrufen | Hash statt Klartext; genaue Version/Zeiten; aktiver Token nach Widerruf nicht mehr akzeptiert; Anfrageinhalt wird nicht automatisch gelöscht. |
| 2 | Admin-Zugriff nach Widerruf über Dashboard, Draft, Handover und alle sensiblen APIs | Default deny für Gesundheitsfelder; Basisdaten bleiben nur gemäß freigegebener Rolle/Zweck verfügbar; jede genehmigte Ausnahme wird protokolliert. |
| 3 | Aktuell zugewiesener Coach nach Widerruf über Dashboard, Team-Requests, Matching, Invoice-Load und Statusroute | Kein Health-Feld aus unerwartetem Pfad; bestehende Buchungs-/Abrechnungsdaten bleiben unverändert. |
| 4 | Handover bei aktivem und widerrufenem Consent, jeweils mit/ohne Sessionhistorie | Kein Health-Copy nach Widerruf; keine unautorisierte neue Anfrage; vorhandene Session-/Invoicebezüge bleiben bestehen; erwartete Statuswerte geprüft. |
| 5 | Coach-Wechsel A→B während laufender Nachrichtenabfrage/-sendung | Atomarer Wechsel; A verliert neue/alte Datenzugriffe und Versand; B erhält nur neue Conversation; keine offene alte Conversation/Alias-Lücke. |
| 6 | Direkte RLS-SELECTs als ehemaliger, aktueller, deaktivierter Coach sowie Admin; API- und Realtime-Zugriff | Ehemaliger/deaktivierter Coach kann keine alte Conversation/Message lesen; aktueller nur autorisierte Live-Daten; Events server-only; Realtime folgt denselben Grenzen. |
| 7 | Historische Nachrichten und kontrollierte Handover-Freigabe | Verlauf bleibt gemäß Retention vorhanden, aber standardmäßig nicht für neuen Coach; explizite, zeitlich begrenzte Grantentscheidung wird protokolliert; keine pauschale Historienkopie. |
| 8 | Löschung einer Anfrage ohne Kinddatensätze | Job geht idempotent bis `completed`; keine Restdaten; Statusmeldung korrekt; wiederholter Request ändert das Ergebnis nicht. |
| 9 | Löschung mit vorhandenen Conversations, Nachrichten, Message Events und Consentnachweisen | Preflight erkennt alle Abhängigkeiten; genehmigte Reihenfolge entfernt/retentiert Daten passend; kein unkontrolliertes FK-Cascade; kein verwaister Consent-/Messagebezug ohne dokumentierte Entscheidung. |
| 10 | Löschung mit Sessions, Blocked Slots, Vorschlägen, Rechnung und Legal Hold | Antrag stoppt an ungeklärter/aktiver Aufbewahrung; Rechnung/Session bleibt; konkrete Kalenderereignisse nur nach Freigabe; `POISE VERFÜGBAR` bleibt unangetastet. |
| 11 | Löschung mit Re-Engagement-Log und in queued/processing Recovery-Jobs | Restrict-/fehlende-FK-Fälle werden erkannt; Recoveryjob wird sicher storniert und Geheimnis/PII entfernt; kein späterer Wiederherstellungsversand. |
| 12 | Wiederholte Löschanforderung, parallele Requests, Worker-Retry | Ein Job/Ergebnis aufgrund Idempotenz; keine Doppellöschung oder doppelte externe Aktion; Parallelität serialisiert am Request. |
| 13 | Fehler injiziert in jeder Löschstufe und externer Kalender-/Providerfehler | Kein Erfolgssignal bei Teilfehler; DB-Rollback, wo transaktional möglich; Job bleibt nachvollziehbar und wiederholbar; kein PII in Logs. |
| 14 | Unberechtigter Coach/Admin/Client versucht Zugriff, Wechsel, Handover oder Löschung | 401/403/404 nach Repositorykonvention; keine Datenrückgabe, kein Provideraufruf und keine Mutation. |
| 15 | TOCTOU: Consent-Widerruf konkurriert mit Formularsave, Handover, Messaging und Export | Serialisierung/atomare Prüfung verhindert neue Verarbeitung nach wirksamem Widerruf; Status ist deterministisch. |
| 16 | FK-Preflight gegen synthetisches vollständiges Schema mit Restrict/Cascade/Set-Null-Kindern | Alle Tabellen/Constraints in Abhängigkeitsplan erkannt; unbekannter FK blockiert fail-closed; Retained Legal-Data bleibt erhalten. |
| 17 | UI nach Widerruf und Browser-Rückkehr/Reload | Sensible React-Zustände werden geleert; API gibt keine sensiblen Felder zurück; keine sensible Local-/Session-Storage-Retention. |
| 18 | E-Mail-/Resend- und Providerretention | Tests belegen nur App-Verhalten/Stubs; tatsächliche Providerlöschung bleibt separater organisatorischer Abnahmebeleg. |

## 9. Risiken und Rückfallstrategie

### Hauptrisiken

- **Zu breite Sperre:** Coach- oder Adminoberflächen verlieren für aktive Betreuung notwendige Daten. Gegenmaßnahme: Field-Allowlist und Ende-zu-Ende-Tests pro Rolle, nicht pauschal `anfragen` sperren.
- **Zu schmale Sperre:** Ein nicht inventarisierter Service-Role- oder Exportpfad umgeht das Gate. Gegenmaßnahme: Suche nach allen Gesundheitsfeldern und Review aller `supabaseAdmin`-Routen; CI-Allowlist-/Contract-Tests.
- **Assignment-Migration:** Vorhandene historische Zuordnungen/Conversations können inkonsistent sein; Migration darf nicht stillschweigend neu zuweisen oder löschen.
- **Hard Delete:** unbekannte Fremdschlüssel, Abrechnungsnachweise oder externe Mails können verloren gehen bzw. verbleiben. Gegenmaßnahme: fail-closed Preflight, Legal Hold und idempotente Stufen.
- **Externe Nichtatomarität:** Google/Resend können ausfallen, während DB-Schritte erfolgreich sind. Gegenmaßnahme: Outbox und expliziter Teilstatus statt Erfolgssimulation.
- **RLS-/Service-Role-Verwechslung:** RLS-Änderung wirkt nicht auf privilegierte Serverclients. Gegenmaßnahme: App-AuthZ separat testen, privilegierte Clients minimieren und jede Route explizit prüfen.

### Rückfall

- Migrationen zunächst additiv und mit neuen Policies/RPCs statt Datenlöschungen bereitstellen; Policy-Rollback bedeutet nur vorher geprüfte, eng begrenzte Version wiederherstellen, nicht offene historische Leserechte pauschal reaktivieren.
- Alte Assignment-/Consentdaten nicht überschreiben oder rückwirkend ändern; Events append-only oder revisionssicher nach genehmigtem Modell.
- Vor produktiver Migration Backup/Restore-Fähigkeit, Schema-Snapshot und Staging-Test belegen; `docs/architecture.md` weist auf notwendige Recovery-/Backupvorsorge hin. Keine Produktion ohne separat genehmigten Restoretest.
- Bei API-Regression Gesundheitsfelder lieber temporär ausblenden und Fallbearbeitung pausieren, statt Widerrufsschutz zurückzunehmen.
- Bei Löschfehler Request in `failed`/`blocked_legal_hold` belassen, Zugriffe sperren und kontrolliert wiederholen; niemals manuell die FK-Regel umgehen.
- Backfill-/Datenverschiebung: Quelle bis zur verifizierten Zielkonsistenz erhalten; kein Drop der Quelle im selben Rollout. Rückmigration darf keine seit Migration neu entstandenen sensiblen Daten versehentlich überschreiben.

## 10. Offene Entscheidungen vor Implementierung

1. Wer ist Verantwortlicher für die Datenverarbeitung, und welche organisatorischen Rollen (Coach, Admin, Support) dürfen je Zweck Daten sehen?
2. Was ist die konkrete Rechtsgrundlage je Intake-Feld und Zweck? Welche Verarbeitung darf nach Widerruf auf welcher anderen Rechtsgrundlage fortgesetzt werden?
3. Soll ein Admin nach Widerruf noch einzelne Gesundheitsfelder sehen dürfen? Wenn ja: wer genehmigt, welcher Zweck, welche Felder, Dauer, Protokoll und Benachrichtigung?
4. Welche Daten sind für Coach-Handover zwingend? Darf ein neuer Coach je nach Einwilligung eine Kurz-Zusammenfassung erhalten? Wer erstellt/freigibt diese?
5. Sollen historische Nachrichten grundsätzlich aufbewahrt, nach Frist gelöscht oder nur für genau benannte Streit-/Nachweiszwecke zugänglich bleiben? Darf ein ehemaliger Coach jemals Einsicht erhalten?
6. Welche Nachrichten-/Resend-Anteile werden gespeichert, wie lange, und welche externen Lösch-/Retentionmöglichkeiten bestehen? Wie sind Anhänge, Header und Providerlogs behandelt?
7. Welche Datenkategorien und Fristen gelten für Drafts, Anfragen, Gesundheitsfelder, Consentbelege, Nachrichten, Re-Engagement, Recovery, Sessions, Rechnungen, Logs und Backups? Jede Frist ist zu beschließen, nicht zu schätzen.
8. Welche Rechnungs-/Sessiondaten müssen bei Requestlöschung erhalten bleiben? Darf `anfrage_id` durch irreversible Kennung ersetzt werden, und welche Rechnungsfelder müssen fortbestehen?
9. Was bedeutet „endgültige Löschung“ für Google Calendar, Resend, sevDesk, Vercel/Supabase-Logs, Backups und exportierte/manuelle Dateien? Wer bestätigt die Löschung bei jedem Provider?
10. Ist für endgültige Löschung eine Zwei-Personen-Freigabe erforderlich? Welche Authentisierung, Begründung und Einspruchs-/Legal-Hold-Prozedur gilt?
11. Welche produktive Supabase-Migrationen, Rollen-/Grants, RLS-Policies, Realtime-Publications, Fremdschlüssel und Providerkonfigurationen sind tatsächlich aktiv? Wer liefert einen datensparsamen, nicht personenbezogenen Nachweis?
12. Welche bestehende Anfragezustände müssen trotz Widerruf in Matching/Terminorganisation fortbestehen, und welche Felder sind dafür wirklich erforderlich?

## 11. Freigabepunkt und technische Entscheidung

### Zwingende Maßnahmen

- Vor Implementierung verbindliche rechtliche Zweck-/Feld-/Rollen- und Aufbewahrungsentscheidung.
- P0-Zugriffsgate für sensible Felder in jeder Service-Role-Route; `team-requests`-Fallback und Handover-Copy korrigieren.
- P0-RLS-Sperre für aktuelle Coachzuordnung und atomarer Entzug bei Ownerwechsel; direkte Conversation-/Message-SELECTs müssen den aktuellen Berechtigungszustand abbilden.
- P0-Vollständige Datenbank-/Provider-Abhängigkeitsinventur plus Lösch-Preflight; `delete-forever` darf nicht mehr eine Parent-Zeile mit unbekannten Children versuchen.
- Synthetische Regressionstests für Consentwiderruf, ehemalige Coaches, Handover, FK-Blockaden, Legal Hold, Wiederholung, Fehler und unberechtigte Aktionen.

### Zuerst implementieren

1. Entscheidungen zu Consent nach Widerruf, Adminzugriff und Coachhandover.
2. Tests sowie zentrale Health-Data-Zugriffsfunktion und API-Gates.
3. Atomarer Coachwechsel + RLS-Policy-Korrektur; API- und Realtime-Validierung.
4. Schema-/Providerinventur und Retentionsmatrix.
5. Idempotenter Preflight-/Löschjob erst nach Freigabe der Aufbewahrungsregeln.

### Unabhängig umsetzbar

- Testfälle und statische API-Contract-Tests.
- Entfernung des nicht autorisierten `wunschtherapeut`-E-Mail-Fallbacks (nach Bestätigung der fachlichen Absicht).
- Health-Data-Read-Gate und UI-State-Clear können als separate Codeänderungen erfolgen, benötigen aber dieselbe rechtliche Access-Matrix.
- Messaging-RLS-Policy-Änderung kann separat vorbereitet werden, aber produktiver Rollout muss mit Ownerwechsel-RPC und Assignment-Schreibpfaden koordiniert werden.
- Lösch-Preflight-/Abhängigkeitsinventur ist unabhängig vom Hard-Delete ausführbar, darf keine Daten verändern.

### Gemeinsame Migrationen / zwingende Abhängigkeiten

- Assignment-Audit, temporäre Access-Grants, atomarer Ownerwechsel und Conversation-RLS gehören in ein abgestimmtes Migrations-/Codepaket.
- Consent-Evidence-FK/Löschverhalten und Erasure-Workflow müssen gemeinsam entschieden werden; ein separater Consent-FK kann später die Löschung blockieren oder erforderliche Nachweise vernichten.
- Hard Delete muss die gesamte FK-Landschaft einschließlich Session/Invoice/Proposal/Calendar-Abhängigkeiten berücksichtigen; aktuell ist diese Landschaft nicht vollständig aus lokalen Migrationen belegbar.
- Trennung von Gesundheitsdaten aus `anfragen` ist ein eigener, rückwärtskompatibler Datenmigrationsstrang, nicht Voraussetzung für die erste serverseitige Sperre.

## 12. Neues Systemwissen (nur dieses Dokument)

- Der Consent-Nachweis liegt in `anfrage_health_data_consents`; das Token wird als Hash gespeichert und durch `revoked_at` entwertet. `request_id` hat in der lokalen Migration keinen FK zu `anfragen`.
- `public-request` blendet sensible Felder ohne aktiven passenden Consent aus; mehrere privilegierte Staff-Routen prüfen den Consent dagegen nicht.
- Die RLS-Policies der Messaging-Migration binden Conversations/Messages an den damaligen `therapist_id`-Owner, nicht an aktuelle `anfragen.assigned_therapist_id` oder offenen Status. App-APIs prüfen teilweise zusätzlich; Service-Role umgeht RLS.
- `request_message_events` ist in der lokalen Migration RLS-aktiviert, hat aber weder eine Anfragezuordnung noch eine authentifizierte Policy/Grant.
- `anfragen_reengagement_log` referenziert Requests mit `ON DELETE RESTRICT` und hat laut lokaler Migration kein DELETE-Recht für `service_role`.
- Recovery-Tokens kaskadieren lokal bei Requestlöschung; Recovery-Queue-Jobs verwenden hingegen ein textuelles Request-ID-Feld ohne FK und halten vor Abschluss E-Mail-/Recovery-Payload.
- Die lokale Migrationenlage definiert keine vollständigen Constraints für `sessions`, `blocked_slots`, `appointment_proposals` oder `invoices`; App-Verwendung ist belegt, produktive FK-Regeln nicht.
- Lösch- und Retentionplanung muss Buchungs-/Kalenderereignisse, `sessions` als Abrechnungsquelle, Rechnungen, externe Resend-Kopien und den unveränderlichen `POISE VERFÜGBAR`-Block getrennt behandeln.

Dieses Wissen wird bewusst nicht ungefragt in bestehende Systemdokumente übernommen.

## Status

**P0-Analyse abgeschlossen: JA**

**Implementierung technisch vorbereitet: JA**

**Produktive Änderungen durchgeführt: NEIN**

**Freigabe zur Implementierung erforderlich: JA**
