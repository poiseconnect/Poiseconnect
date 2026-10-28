# Poise Connect – Architekturentscheidung für den sicheren Coach-Wechsel

**Stand:** Lokale Architekturprüfung des begonnenen Phase-1-Arbeitsstands
**Status:** Architekturstand dokumentiert; lokale Implementierung inzwischen freigegeben (Abschnitt 16), keine Produktionsfreigabe.
**Arbeitszweig:** `fix/privacy-p0-phase1`

## 1. Auftrag, Evidenz und Ergebnis

Der aktuelle Auftrag ersetzt widersprüchliche frühere Handover-Vorgaben: Der bisherige Coach verliert beim wirksamen Wechsel den gesamten Zugriff auf Gesundheitsdaten, laufende Klientenakte und Nachrichten dieses Falls. Ausschließlich erforderliche Daten seiner eigenen historischen Abrechnung bleiben getrennt zugänglich. Historische Sessions und Rechnungen sind kein pauschaler Wechselblocker.

Grundlage sind [AI_CONTEXT.md](../AI_CONTEXT.md), [architecture.md](./architecture.md), [security.md](./security.md), [cto-workflow.md](./agent/cto-workflow.md), [system-audit.md](./agent/system-audit.md), [privacy-audit-closeout.md](./privacy-audit-closeout.md) und [privacy-p0-remediation-plan.md](./privacy-p0-remediation-plan.md). Die Analyse vertieft ausschließlich das Handover-Modell und die hierfür relevanten P0-1-/P0-2-Zugriffspfade. P0-3 bleibt außerhalb dieser Umsetzung.

**Ergebnis:** Ein Coach-Wechsel mit historischen Sessions und Rechnungen ist technisch konzipierbar, ohne diese Datensätze zu kopieren, neu zuzuordnen oder zu verändern. Das bestehende Datenmodell liefert die Kernbeziehungen, reicht aber für nachweisbare Betreuungsperioden, empfängerbezogene Consent-Freigaben und konkurrierende Vorgänge allein nicht aus. Empfohlen wird **eine stabile Anfrage mit getrennten Betreuungsperioden, Consent-Freigaben und schmalen historischen Abrechnungszugriffen**.

Dies ist eine entworfene Architektur, keine bereits implementierte oder durch PostgreSQL nachgewiesene Garantie.

### Evidenzklassen

- **N – Nachgewiesen:** Verhalten im aktuell gelesenen lokalen Code oder SQL-Entwurf. Keine Behauptung über produktive Aktivierung.
- **R – Plausibles Risiko:** Folgerung aus vorhandenen Abläufen, insbesondere bei konkurrierenden Operationen oder gemischter Sessionhistorie.
- **U – Nicht verifiziert:** Produktivschema, RLS/Grants, Realtime-Publications, angewandte Migrationen, externe Providerdaten, Backups oder historische Datensatzqualität.
- **E – Entscheidung erforderlich:** Empfohlene technische/fachliche Ausgestaltung oder noch nicht bestätigte rechtliche Grundlage.

Es wurden keine Produktivsysteme, Klientendaten oder Providerkonten abgefragt. Keine Code- oder SQL-Datei wurde für diesen Auftrag geändert. Ausschließlich dieses neue Dokument wurde erstellt.

**Erhaltungskontrolle:** Der SHA-256-Wert des vorhandenen getrackten Binärdiffs sowie die Einzelprüfsummen des ungetrackten SQL-Entwurfs und des neuen Intake-Helpers stimmen mit dem Arbeitsbeginn überein. Alle relativen Dateilinks dieser Vorlage wurden lokal auf Existenz geprüft; die Prüfung auf Whitespacefehler blieb ohne Befund. Diese Dokumentkontrollen ersetzen keine Laufzeit-/Berechtigungstests.

## 2. Tatsächlicher Arbeitsstand und bestätigte Ursachen

### 2.1 Unvollständige Phase-1-Zwischenfassung

Der Git-Status bestätigt den Branch `fix/privacy-p0-phase1`, die begonnenen Datenschutzänderungen sowie parallel vorhandene Änderungen am Coach-Rechnungsworkflow. Nichts davon wurde zurückgesetzt oder überschrieben.

| Oberfläche | Tatsächlicher Stand und Konsequenz | Evidenz |
|---|---|---|
| Staff-Gesundheitsdaten | Neue Helper `readRequestHealth` / `mergeRequestHealth` werden bereits von Dashboard-, Team- und Draft-Routen verwendet. Sie sind von noch nicht angewandten RPCs abhängig. | **N:** [intakeAccess.js](../app/lib/intakeAccess.js), [dashboard/requests/route.js](../app/api/dashboard/requests/route.js), [team-requests/route.js](../app/api/team-requests/route.js), [admin/form-drafts/route.js](../app/api/admin/form-drafts/route.js). |
| Public-/Intake-/Consent | Öffentlicher sensibler Read, Consent-Erteilung/-Widerruf und finales Intake-Save verwenden teilweise bereits neue RPCs. Der Draft-Save ist noch nicht auf dieselbe atomare Save-Operation umgestellt. | **N:** [public-request/route.js](../app/api/public-request/route.js), [intake-consent/route.js](../app/api/intake-consent/route.js), [form-submit/route.js](../app/api/form-submit/route.js), [create-request-draft/route.js](../app/api/create-request-draft/route.js). Keine einheitliche fertige Schutzkette. |
| Handover im Anwendungscode | Die bestehende Route lädt Gesundheitsfelder. Mit Sessionhistorie kopiert sie diese in eine neue Anfrage; die alte Anfrage behält den bisherigen Coach. Ohne Sessions wird die bestehende Zuordnung entfernt. Conversation-Schließung und Anfrageänderung erfolgen getrennt. | **N:** `POST` in [coach-handover/route.js](../app/api/coach-handover/route.js). Dieser Altpfad widerspricht dem neuen Zielmodell. |
| Handover im SQL-Entwurf | `privacy_handover_request` enthält `SESSION_HANDOVER_REQUIRES_REVIEW` für jeden Fall mit Sessions, keinen echten A→B-Wechsel und setzt `bevorzugte_zeit = null`. | **N:** [20261028000000_privacy_phase1_access.sql](../supabase/migrations/20261028000000_privacy_phase1_access.sql). Diese vorläufige Sperre ist **keine akzeptierte Ziellösung**. Der Entwurf bleibt in diesem Auftrag unverändert. |
| Empfängerwechsel-Sperre | `privacy_assignment_guard` setzt beim Entfernen/Wechseln eines alten Coaches ein dauerhaftes `privacy_health_transfer_blocked`; `privacy_save_intake` verweigert danach weitere Saves. Eine kontrollierte Freigabe für eine neue gültige Einwilligung ist nicht vollständig modelliert. | **N:** gleicher SQL-Entwurf. Ein boolesches Sperrflag allein reicht für Wiederfreigabe und A→B→A nicht. |
| Messaging-Gate | `getMessagingAccess` existiert im neuen Helper, ist aber noch nicht in den bestehenden Messaging-Routen und Versand-/Inbound-Libraries verdrahtet. | **N:** [intakeAccess.js](../app/lib/intakeAccess.js), [messages/conversations/route.js](../app/api/messages/conversations/route.js), [outbound.js](../app/lib/messaging/outbound.js), [inbound.js](../app/lib/messaging/inbound.js). |
| Messaging-RLS | Ursprüngliche Policies prüfen Conversation-Owner und aktive Coachidentität, nicht aktuelle Anfragezuordnung oder offenen Status. Der neue Entwurf verschärft sie, ist aber nicht angewandt oder integrationstestvalidiert. | **N/U:** Policies `"coaches read own request conversations"` und `"coaches read own request messages"` in [20260901000000_request_messaging_foundation.sql](../supabase/migrations/20260901000000_request_messaging_foundation.sql); neue Policies im Phase-1-Entwurf. |

Die Zwischenfassung darf **weder allein noch mit ungeprüft angewandtem SQL-Entwurf ausgerollt werden**. Ohne RPC-Migration würden bereits umgestellte Routen fehlschlagen. Neue Funktionen allein sichern nicht die noch unveränderten Service-Role-Pfade ab.

### 2.2 Bestehendes Datenmodell

| Objekt | Vorhandene Bedeutung | Grenze / Konsequenz |
|---|---|---|
| `anfragen.assigned_therapist_id` | Aktuelle Betreuungszuordnung; viele APIs autorisieren darüber. | Als aktuelle Projektion weiterverwenden; nicht zusätzlich eine zweite unabhängig beschreibbare aktuelle Ownerquelle schaffen. |
| `anfragen`-Gesundheitsfelder | Gemeinsame Intake-Daten des Falls, zentral in `HEALTH_DATA_FIELDS` aufgeführt. | Nicht durch Kopieren einer Anfrage übergeben. Erhalt bedeutet nicht Freigabe an den neuen Coach. |
| `sessions.anfrage_id`, `sessions.therapist_id` | Fallbezug und ausführender Coach; `sessions` ist führende Abrechnungsquelle. | Historische Session bleibt bei A, neue Session bei B. Vergangenes Datum allein beweist weder Durchführung noch Abrechnungsfähigkeit. Legacy: einzelne APIs akzeptieren auch `team_members.user_id` als Coachbezug. |
| `invoices.anfrage_id`, `invoices.therapist_id` | Klientenrechnungsbezug und Rechnungsowner. | Rechnung bleibt beim bisherigen Owner. Aktuelle Anfragezuordnung ist kein Recht auf dessen Rechnung. |
| `coach_invoices`, Quartalsfreigaben, sevDesk-Bezüge | Separater Poise→Coach-Abrechnungsworkflow auf Basis historischer Sessions und Quell-Snapshots. | Coachwechsel darf keine Neuberechnung, Betrags-/Status-/ID-Änderung oder externe Synchronisation auslösen. |
| `request_conversations` | Fall, Coach, Status, Alias und Widerrufszeit; maximal eine offene Conversation pro Anfrage laut Migration. | Neue Betreuung benötigt neue Conversation; geschlossene Conversation ist Speicherhistorie, keine Leseberechtigung. |
| `request_messages` | Inhalte und technische Zustellmetadaten, an Conversation/Fall gebunden. | Inhalt nicht verschieben, kopieren, löschen oder als historisches Abrechnungsdatum freigeben. |
| `request_message_events` | Provider-Eventledger, ohne Request-/Message-FK in der Ausgangsmigration. | Kein Coach- oder allgemeines Admin-Inhaltsrecht; keine Bodies in neue Auditdaten kopieren. |
| `anfrage_health_data_consents` | Hash, Version, Erteilungs-/Widerrufszeit, Anfrage-ID; im Ursprungsmodell kein FK und keine dokumentierte Empfängerfreigabe. | Anfragebezug plus aktive Version allein beweist nicht Reichweite für B. Entwurf ergänzt `coach_id` und `superseded_at`, löst aber Freigabeumfang nicht abschließend. |
| `blocked_slots`, `appointment_proposals`, `bevorzugte_zeit`, Event-IDs | Belegung, Vorschläge und Terminreferenzen, teilweise redundant/legacy. | Nicht als Abrechnung nutzen; Coachwechsel darf diese nicht stillschweigend zurücksetzen. Produktive Constraints sind nicht vollständig aus lokalen Migrationen rekonstruierbar. |

Belege: [AI_CONTEXT.md](../AI_CONTEXT.md), [healthDataConsent.js](../app/lib/healthDataConsent.js), [invoices/save/route.js](../app/api/invoices/save/route.js), [coachInvoice.js](../app/api/invoices/_lib/coachInvoice.js), Messaging-/Consent-Migrationen oben.

### 2.3 Enge Kopplungen, die vor Implementierung aufzulösen sind

1. **Rechnungs-Laderoute:** [invoices/load/route.js](../app/api/invoices/load/route.js), `GET`, bindet die Anfrage an den aktuellen Coach, lädt danach aber alle Sessions der Anfrage und die zuletzt aktualisierte Rechnung ohne Coachfilter. Bei A→B könnte B somit A-Sessions/Rechnung erhalten; A verliert zugleich den Anfrage-basierten Einstieg in seine Rechnung. **N: Filterstruktur; R: Offenlegung im gemischten Fall.** Zwingend: explizite historische Rechnungs-/Sessionressourcen mit Ownerfilter, keine Lockerung der Anfrageberechtigung.
2. **Historische Sessionansicht:** [therapist/billing-sessions/route.js](../app/api/therapist/billing-sessions/route.js) filtert nach eigenem Session-Coach, joint aber live Vor-/Nachname, aktuellen Anfragestatus und Steuerflag. **N.** Minimaler Billing-DTO darf keine laufenden Fallstatus-/Coachdetails liefern; Notwendigkeit der Identitätsfelder ist ausdrücklich festzulegen.
3. **Historischer Schreibzugriff:** [delete-session/route.js](../app/api/delete-session/route.js) autorisiert Löschung anhand `sessions.therapist_id` bzw. Legacy-User-ID, nicht anhand aktueller Betreuung. [invoices/save/route.js](../app/api/invoices/save/route.js) erlaubt Bearbeitung bestehender eigener Rechnungen nach Rechnungsowner. **N.** Historisches Leserecht darf nicht unbeabsichtigt Schreib-, Lösch- oder Neuzuordnungsrecht bedeuten. Änderungen an abgeschlossenen Abrechnungsdaten brauchen einen eigenen Korrekturprozess.
4. **Privilegierter Rechnungsversand:** [invoices/send/route.js](../app/api/invoices/send/route.js) lädt nach Rechnungsownerprüfung die komplette Anfrage mit `select("*")`. **N.** Obwohl der PDF-Aufbau gespeicherte Rechnungsfelder nutzt, ist der Health-Read hierfür nicht erforderlich und muss durch minimale Datenzugriffe ersetzt werden. Außerdem explizite Rollen-Allowlist vorsehen.
5. **Neue Sessions:** [add-session/route.js](../app/api/add-session/route.js) und [add-sessions-batch/route.js](../app/api/add-sessions-batch/route.js) prüfen aktuelle Anfragezuordnung, führen DB-/Kalenderschritte aber danach separat aus. **N/R.** Eine vorherige Prüfung allein verhindert keinen Wechsel zwischen Autorisierung und Seiteneffekt.
6. **Termine:** [client/appointment/route.js](../app/api/client/appointment/route.js) sucht zukünftige `blocked_slots` nur für den aktuell zugewiesenen Coach. Nach blindem A→B würde ein A-Termin möglicherweise aus der Klientenansicht verschwinden, ohne abgesagt zu sein. [confirm-proposal/route.js](../app/api/confirm-proposal/route.js) kann über einen alten Vorschlag die Zuordnung wieder auf dessen Coach setzen und führt Kalenderaktionen vor dem abschließenden Anfrageupdate aus. **N/R.** Alte Links brauchen Perioden-/Versionsprüfung **vor** externen Aufrufen.
7. **Abrechnungs-Snapshots:** `coach_quarter_snapshot` liest `a.invoice_with_vat` und `a.beschaeftigungsgrad` live über die historisch verknüpfte Anfrage. Trigger entwerten Freigaben bzw. schützen Rechnungsreservierungen bei Änderungen dieser Felder. **N:** [20261009000000_coach_quarter_release.sql](../supabase/migrations/20261009000000_coach_quarter_release.sql), [20261011000000_coach_invoice_creation_guards.sql](../supabase/migrations/20261011000000_coach_invoice_creation_guards.sql); lokale Erweiterung [20261022000000_coach_invoice_admin_release.sql](../supabase/migrations/20261022000000_coach_invoice_admin_release.sql). Nur Assignmentwechsel ohne Änderung dieser Quellfelder soll keine Neuberechnung auslösen. Billing-Snapshot-Umbau ist ein eigener, mit dem fremden Entwicklungsstrang abzustimmender Auftrag.
8. **Webhook-Retries:** `retryFailedMessage` in [inbound.js](../app/lib/messaging/inbound.js) prüft beim Retry einer fehlgeschlagenen Coachantwort nur Anfrage/Empfänger, nicht erneut aktuelle Zuordnung, Consent und Conversation-Status. `handleDuplicateEvent` lädt vorher Inhalte. **N.** Auch Retry-/Duplikatpfade müssen vor Inhaltsabruf und Versand dieselbe Autorisierung erhalten.

## 3. Verbindliches Zielmodell und Alternativen

### 3.1 Nicht erneut zur Disposition stehende Geschäftsregeln

- A verliert mit dem wirksamen Wechsel laufende Fall-/Health-/Message-Rechte; A erhält keine neuen Betreuungs-Schreibrechte.
- B erhält aktuelle Betreuung, jedoch sensible Daten und Kommunikation nur bei dokumentierter ausreichender aktiver Einwilligung für diesen Zweck und Empfänger.
- Kein automatisches Health-Copy, kein automatisches Wiederöffnen oder Freigeben alter Messages.
- Gesundheitsdaten, Nachrichten, historische Sessions, Rechnungen, sevDesk-IDs/-Status und Termine bleiben unverändert gespeichert, soweit nicht ein späterer separater Auftrag eine konkrete Änderung freigibt.
- `wunschtherapeut` bleibt Wunsch-/Historieninformation, nie ein Berechtigungsnachweis.
- Einwilligungswiderruf sperrt consentabhängige Verarbeitung für alle Rollen, nicht automatisch Speicherung oder rechtmäßig erforderliche Abrechnung. Keine erfundene Ersatzrechtsgrundlage.
- Historische Sessions sind kein dauerhafter 409-Grund; konkrete zukünftige Termine oder unklare laufende Provideraktionen können einen begründeten Konflikt darstellen.

### 3.2 Technische Alternativen

| Option | Vorteil | Risiko / Aufwand | Bewertung |
|---|---|---|---|
| A. Bestehende Anfrage behalten, nur Owner-ID und Routenfilter ändern | Kleine erste Änderung, keine Fallkopie | Kein zuverlässiger Nachweis von Betreuungsperioden, Freigabeumfang oder A→B→A; viele verstreute Race-Prüfungen | Als alleinige Lösung unzureichend. |
| B. Neue Anfrage je Coach und sensible Felder kopieren | Historische Anfrage bleibt unverändert | Duplikation von Gesundheitsdaten, Consent-Drift, Legacy-Links, doppelte Fälle; ehemaliger Coach behält alte Akte; zusätzliche Termin-/Rechnungskopplung | Verworfen für dieses Ziel. |
| C. Stabile Anfrage plus explizite Betreuungsperioden und Consent-Freigaben; Billing-DTOs über bestehende Session-/Invoiceowner | Keine Health-/Session-/Rechnungskopie; eindeutiger Entzug, A→B→A beherrschbar; historische Abrechnung getrennt | Additive Strukturen und abgestimmter API-/RLS-/UI-Umbau erforderlich | **Empfohlen: geringstes Gesamtrisiko bei vollständiger Umsetzung.** |
| D. Vollständiges neues Klienten-/Fall-/Gesundheitsdatenmodell samt Migration aller Altbezüge | Langfristig starke Trennung | Größte Datenmigration, riskanter Umbau von Booking und Abrechnung | Optionaler späterer Strang, keine Phase-1-Voraussetzung. |

## 4. Empfohlene Berechtigungsstrukturen

Die folgenden Namen sind konzeptionelle Vorschläge, keine neu erstellten SQL-Objekte.

### 4.1 Betreuungsperiode statt zweiter Klientenakte

`request_care_assignments` enthält `id`, `request_id`, `coach_id`, Beginn/Ende, Actor und begrenzten Grundcode. Pro Anfrage maximal eine offene Periode. Keine Namen, Kontakte, Gesundheitsfelder oder Nachrichtentexte in dieser Tabelle.

- `anfragen.assigned_therapist_id` bleibt die kompatible aktuelle Projektion. Offene Periode und Ownerfeld werden ausschließlich gemeinsam durch eine autorisierte DB-Operation geschrieben; Inkonsistenz führt zu Sperre, nicht zu erratener Berechtigung.
- Eine monoton steigende `care_version` am Fall sichert Compare-and-swap und verhindert veraltete Mutationen. UUID der Periode verhindert Wiederverwendung einer alten Freigabe bei A→B→A.
- Conversations werden mit genau einer Betreuungsperiode verknüpft; Coach-ID allein reicht nicht. Historische Messages bleiben an ihrer ursprünglichen Conversation.
- Ein minimaler Wechselnachweis (`request_care_transfers` oder eindeutiger Operationseintrag) enthält Idempotenzkennung, erwartete Version, alte/neue Periode, handelnde Person und UTC-Zeitpunkt. Kein Freitextgrund mit Gesundheitsangaben.
- Bestehende Zuordnungen dürfen nicht stillschweigend umgeschrieben werden. Ein später genehmigter Schema-/Altbestandsabgleich muss Inkonsistenzen, Legacy-Coach-IDs und vorhandene offene Conversations melden. Historische Perioden nicht mit erfundenen Zeitpunkten rückdatieren.

### 4.2 Historische Abrechnung ohne generelles Fallrecht

Ein eigenes allgemeines `request_access_grants`-System ist dafür **nicht erforderlich** und wäre anfänglich unnötig weitreichend:

- Historisches Session-Leserecht folgt aus nachweisbarem eigenem `sessions.therapist_id` plus zulässigem Abrechnungszweck, nicht aus aktueller Anfragezuordnung.
- Rechnungs-Leserecht folgt aus eigenem `invoices.therapist_id` bzw. `coach_invoices.coach_id`. Es autorisiert weder vollständige Anfrageabfrage noch Messages.
- Endpunkte liefern feste Ressourcen-/Feld-Allowlisten; kein `select("*")` von `anfragen` und keine allgemeine Route, die wegen einer alten Session die Klientenakte freischaltet.
- Legacy-User-ID-Zuordnungen werden nur über serverseitig bestätigte Teammitgliedbeziehung interpretiert; keine frei vom Client gewählte alternative Coach-ID.
- Neue allgemeine Support-/Admin-Ausnahme-Grants sind nicht Bestandteil dieser Phase.

### 4.3 Empfänger- und zweckbezogene Consent-Freigabe

Eine schmale `request_health_authorizations`-Struktur verknüpft Anfrage, Betreuungsperiode, Coach/Empfänger, Consent-Nachweis, freigegebenen Zweck und Scope-Version sowie Nachweis der Freigabe. Eine Coach-ID an einem Beleg allein beweist nicht, dass der Wortlaut diesen Empfänger oder Nachrichteninhalte abdeckt.

- Aktiver Consent, eindeutig passende Anfrage, dokumentierte Scope-Reichweite, aktuelle Periode und aktives Teammitglied sind kumulative Bedingungen für Coach-Health-Reads.
- Admins benötigen aktiven passenden Consent für den ausdrücklich freigegebenen Bearbeitungs-/Matchingzweck; kein implizites Recht auf Nachrichtenhistorie oder Scope-Erweiterung.
- B kann bereits zugewiesen sein, während Gesundheitszugriff `pending_consent_scope` ist. Kein künstlich erzeugter Consent, keine automatische Befüllung aus einer alten Coach-ID.
- Zulässige neue ausdrückliche Zustimmung kann eine **neue** Freigabe für B begründen. Historischer Beleg, Textversion, Widerrufsereignis und Gesundheitswerte bleiben erhalten; keine irreversible boolesche Dauersperre.
- Intake-Consent und Verarbeitung potenziell gesundheitsbezogener Nachrichten sind gesonderte Zwecke. Bis die Kommunikationsgrundlage bestätigt ist, keine automatische Aktivierung aufgrund eines Intake-Belegs.
- Bestehende Nachweise werden nicht automatisch als empfänger-/zwecksicher angereichert. Bestandsfälle ohne ausreichenden Beleg bleiben für sensible Daten gesperrt.

## 5. Berechtigungsmatrix vor und nach Wechsel

Voraussetzung für jeden Staff-Zugriff: gültige Authentifizierung, aktives erlaubtes Teamkonto und serverseitig bestätigter Zweck. „Billing-Minimum“ ist noch feldgenau freizugeben; es ist keine pauschale Aussage, dass Rechnungsdaten keinerlei sensiblen Kontext haben.

| Ressource / Handlung | Vor Wechsel: A aktuell | Nach Wechsel: A ehemalig | Nach Wechsel: B aktuell | Admin |
|---|---|---|---|---|
| Laufende Anfragebasis, aktuelle Betreuung | Nur zuständiger Fall | Kein allgemeiner Fallzugriff | Minimale erforderliche Basisdaten | Freigegebene organisatorische Aufgaben |
| Gesundheits-/Intake-Felder | Nur mit gültiger ausreichender Freigabe | **Gesperrt**, auch wenn früherer Beleg gespeichert bleibt | Nur mit gültiger ausreichender B-/Periodenfreigabe | Nur mit gültigem passenden Consent und bestätigtem Zweck; keine Widerrufsausnahme |
| Matching/Handover anhand Gesundheitsdaten | Nur bei freigegebenem Zweck | Gesperrt | Nur bei freigegebenem Zweck | Ohne entsprechenden Consent gesperrt |
| Alte Nachrichteninhalte | Nur autorisierte aktive Conversation und gesondert zulässige Kommunikation | **Gesperrt** | **Gesperrt** | Kein automatisches Inhaltsrecht |
| Neue Conversation | Aktuelle Periode und Kommunikationsfreigabe nötig | Kein Lesen/Senden; alter Alias bleibt widerrufen | Neue Conversation/ neuer Alias; ohne Kommunikationsfreigabe kein Inhalt/Versand | Nur technischer/minimaler Status, soweit freigegeben |
| Eigene erbrachte A-Sessions | Erforderliche Abrechnungsfelder | Nur Billing-Minimum, **kein Betreuungsrecht** | Kein Zugriff auf A-Sessions allein wegen neuer Betreuung | Aufgabenbezogene Abrechnung |
| Neue B-Sessions | Nicht im Namen B anlegen | Keine neue Betreuungssession verwalten | Anlegen/verwalten für eigene aktuelle Periode | Organisatorisch autorisierte Aktionen |
| Eigene A-Rechnungen | Zulässige eigene Abrechnung | Minimaler eigener Rechnungszugriff, kein Intake-/Fallzugriff | Kein automatischer Zugriff | Zulässiger Rechnungszugriff ohne Health-Beifang |
| Zukünftiger Termin bei A | Terminbezogene Rechte | Kein Recht, ihn automatisch als laufender Coach weiterzuführen | Kein automatisches Übernehmen/Ändern | Kontrollierte Konfliktlösung |
| `request_message_events`, Aliasgeheimnisse | Kein allgemeines Tabellenrecht | Kein Zugriff | Kein allgemeines Tabellenrecht | Kein automatisches Recht; technische Worker eng begrenzt |
| Fehlender/ungültiger/widerrufener Consent | Health und potenziell gesundheitsbezogene Kommunikation gesperrt | Gesperrt | Gesperrt | Ebenfalls gesperrt; Basis/Billing getrennt |

Klientenzugriff bleibt tokenbasiert und personenbezogen auf die eigene Anfrage beschränkt. Booking-Token ist kein Ersatz für Health-Consent und darf keinen Coachwechsel autorisieren. Bereits gelesene Browserdaten, E-Mailkopien oder frühere Exporte sind nicht rückrufbar; neue Abrufe/Mutationen werden gesperrt, UI-Caches verworfen.

## 6. Historische Sessions, Rechnungen und bestehende Prozesse

1. **Gleiche Anfrage-ID behalten.** Keine Session-FKs, Rechnungs-FKs oder sevDesk-Bezüge umhängen.
2. **Session-Owner unverändert.** Historische Durchführung/Abrechnungsfähigkeit nicht aus `date < now()` allein ableiten. Unklarer Status wird als konkreter Prüfpunkt gemeldet, nicht automatisch „absolviert“ gesetzt.
3. **Rechnungsgesteuerter Einstieg:** Historische Rechnung per Invoice-ID und verifiziertem Owner laden. Neue Rechnungsentwürfe pro Coach enthalten nur dessen zulässige Sessionzeilen. Nicht die „neueste Rechnung einer Anfrage“ für den neuen Coach verwenden.
4. **Nur lesende historische Rechte als Ausgangspunkt.** Keine Session-Löschung oder Änderung vorhandener Rechnung aufgrund historischen Leserechts. Etwa notwendige spätere Abrechnung eigener bereits erbrachter, noch nicht fakturierter Sessions sowie rechtmäßige Rechnungskorrekturen sind gesondert freizugeben.
5. **Billing-Minimum als Vorschlag:** eigene Session-ID, Datum, Dauer, Preis und erforderliche Abrechnungs-/Steuerinformationen; eigene Rechnungsnummer, Betrag, Status und vorhandenes eigenes Dokument. Name/Anschrift nur bei nachgewiesener Rechnungsnotwendigkeit. Kein aktueller Fallstatus, neuer Coach, Freitextanliegen, Diagnose, Reply-Alias oder Zugriffstoken.
6. **Keine Spiegelkopie der gesamten Anfrage.** Gespeicherte Rechnungsidentität kann aus vorhandener eigener Rechnung kommen. Ob für noch unberechnete Altsessions ein minimierter historischer Rechnungsdaten-Snapshot erforderlich ist, ist gesondert zu entscheiden; nicht automatisch aus aktueller Adresse eine historische Identität erfinden.
7. **Poise→Coach-Abrechnung:** vorhandene Quell-Snapshots, Quartalsfreigaben, Reservierungssperren und sevDesk-Schutzregeln erhalten. Kein Übergabe-Schritt darf Steuer-/Beschäftigungsfelder ändern. Ein reiner Assignmentwechsel soll den Quell-Snapshot nicht verändern; das ist später byte-/wertgleich zu testen.
8. **Datenklassifikation:** Auch Datum, Name und Sitzungskontext können sensible Rückschlüsse ermöglichen. „Nicht sensible Abrechnungsdaten“ bezeichnet hier das freizugebende Minimum ohne Intake-/Nachrichteninhalt, keine eigenständige juristische Feststellung.

## 7. Termine und Kalender: konkrete Konflikte statt Session-Pauschalsperre

### 7.1 Preflight

Vor dem Wechsel alle relevanten lokalen Terminreferenzen prüfen: zukünftige/laufende `sessions`, `blocked_slots`, offene `appointment_proposals`, `bevorzugte_zeit`, Event-IDs und aktive Booking-/Proposaljobs. UTC-Vergleiche, Anzeige in `Europe/Vienna`. Ein schon begonnener, noch nicht beendeter Termin ist ebenfalls ein Konflikt.

- **Nur abgeschlossene historische Termine/Sessions:** kein Handoverblock allein wegen Historie.
- **Zukünftiger oder laufender Termin bei A:** konkreter Konflikt `FUTURE_APPOINTMENTS_REQUIRE_DECISION` mit minimalen Terminreferenzen; kein stilles Absagen, Umschreiben oder Ausblenden.
- **Unklare oder widersprüchliche Referenzen:** nachvollziehbarer Datenprüfkonflikt statt Annahme „kein Termin“. Ein früheres Datum allein beweist keinen erledigten Kalender-/Proposalvorgang.
- **Keine Kalenderabfrage/-änderung in diesem Auftrag.** Vor späterem Produktivrollout muss geklärt sein, ob lokale Referenzen den relevanten Kalenderbestand vollständig abdecken. Extern manuell angelegte Termine sind damit nicht automatisch bekannt.

### 7.2 Empfohlene sichere Erstlösung

Den wirksamen Wechsel nur für den **konkreten Termin-/In-flight-Konflikt** zurückstellen, nicht wegen historischer Sessions. Eine bewusste separate Terminentscheidung erlaubt Fortsetzung; bei erneuter Ausführung erfolgt frischer Preflight.

Mögliche fachliche Lösungen sind eine ausdrücklich veranlasste Absage oder separate Neuterminierung im dafür freigegebenen Terminworkflow. Bestehender Termin wird nicht allein durch den Handover-RPC verändert. Eine Variante „A führt den bestehenden Termin nach Verlust der Betreuung weiter durch“ würde ein neues zeitlich begrenztes Betreuungs-/Consentmodell benötigen und ist **nicht** stillschweigend freigegeben.

Für einen dringenden Zugriffsentzug darf ein zukünftiger Termin nicht zum Offenhalten sensibler Rechte zwingen: zusätzlich eine explizite organisatorische **Suspendierung der Betreuung** vorsehen, die Rechte sofort sperrt, Termine/Rechnungen unverändert lässt und eine Admin-Aufgabe erzeugt. Berechtigte Auslöser und UI-Ablauf dieser Suspendierung benötigen Freigabe. Das ist noch kein erfolgreicher A→B-Wechsel.

**Keine globale Löschung:** insbesondere `POISE VERFÜGBAR` nie verändern. Keine alten Event-IDs auf B umdeuten. Alte Proposal-/Bookinglinks anhand Betreuungsperiode/Version ablehnen, bevor Kalenderaktionen stattfinden. Terminansichten dürfen alte A-Termine nicht einfach wegen des neuen aktuellen Owners unsichtbar machen; entweder Konflikt vor Wechsel auflösen oder eine gesondert genehmigte terminbezogene Ansicht schaffen.

## 8. Atomarer Wechsel und Nebenläufigkeit

### 8.1 Autorisierte Operation

Vorgeschlagener RPC/Service `transfer_request_care` (noch nicht implementiert):

1. API prüft aktiven Staff-User; Actor-ID ausschließlich aus validiertem Token, nie ungeprüft aus dem Clientpayload.
2. Erwartete Anfrage-ID, aktuelle Periode/Version, Zielcoach und Idempotenzkennung validieren. Empfehlung: A darf Übergabe anstoßen; wirksame direkte B-Zuweisung erst durch Admin oder bestätigte Klientenwahl, nicht durch freie Coach-Selbstzuweisung.
3. Konsistente Lockreihenfolge: Anfragezeile, aktuelle Periode, betreffende Consent-/Conversation-/Operationseinträge; Mehrfalloperationen deterministisch sortieren. Beteiligte Sessions-/Booking-/Proposal-/Message-Schreiber müssen dieselbe Request-Grenze respektieren. Ein Parent-Lock allein stoppt keine beliebigen Child-Inserts.
4. Unter Lock Actor/Zielcoach, aktuellen Owner/Version, offenen Transfer und aktiven Status neu prüfen. Historische Sessions/Rechnungsbeziehungen lesen und Integrität prüfen, aber nicht ändern.
5. Konkrete Termin-/laufende Providerkonflikte prüfen. Bei Konflikt keine Teilübertragung, kein Aliaswiderruf allein und keine neue Conversation.
6. Alte Betreuungsperiode beenden; alle fallbezogenen A-Live-Rechte entziehen. Alte Conversation schließen und Alias widerrufen. Inhalte und historische Session-/Invoiceowner unverändert.
7. Neue B-Periode anlegen; aktuelle Projektion und `care_version` gemeinsam aktualisieren. Historischen Wunschwert nicht als neue Zugriffsgrundlage nutzen oder unnötig überschreiben.
8. B-Consent-Scope separat prüfen: ohne genügenden Beleg Betreuung nur mit Basisdaten, Health/Kommunikation gesperrt. Kein unbedingtes Erfolgsflag „Gesundheitsdaten freigegeben“.
9. Neue leere Conversation für B bei rechtlich zulässigem Zustand anlegen; alternativ vorerst keine aktive Conversation. Nicht eine alte B-Conversation aus einer früheren Betreuungsperiode wieder öffnen. Neuer Alias und neue Tokenreferenz, keine Weiterleitung alter Aliase.
10. Minimalen Wechselnachweis und idempotentes Ergebnis atomar speichern. Rückgabe enthält Periode/Version und konkrete Freigabestatus, keine Nachrichten-/Gesundheitsinhalte.
11. Commit ist die Wirksamkeitsgrenze. Fehler davor rollen alle Wechselmutationen zurück; gleiche Idempotenzkennung liefert verifizierbar dasselbe Ergebnis. Alte erwartete Version mit neuer Operation führt zu Konflikt, nicht erneutem Transfer.

Direkte Umgehungsschreiber müssen durch minimale Grants, schmale RPCs und konsistenzprüfende Trigger begrenzt werden. Legacy-`service_role` kann RLS umgehen: deshalb nicht nur Policies ändern, sondern jede Service-Route und jeden Worker in die Operation-/Versionsprüfungen einbinden.

### 8.2 Widerruf, Reads und Versand

- Health-Read/Write sowie Widerruf teilen die Anfrage-/Consent-Lockkonvention; nach abgeschlossenem Widerruf darf ein neu gestarteter Zugriff keine Healthdaten erhalten. Eine zuvor autorisierte, bereits laufende Antwort lässt sich nicht rückwirkend zurückrufen; kein stärkeres Versprechen aus einem Mocktest ableiten.
- RLS und API prüfen aktive Periode, aktuelle Zuordnung, passenden Zweck/Consent und aktive Rolle; bei fehlendem Schema/Prüffehler expliziter Fehler bzw. sensible Felder gesperrt. Kein success-shaped Fallback.
- Request-/Care-Version auch bei Sessioninsert, Booking, Proposalbestätigung und Statusänderung revalidieren. Alte A- oder Proposalrequests dürfen A nicht nach einem abgeschlossenen Wechsel wieder zuweisen.
- Bei Nachrichten: vor Inhaltsabruf, Speichern, Queueclaim, Retry und Provideraufruf autorisieren. Nachricht gehört unveränderlich zur ursprünglichen Periode/Conversation. Keine automatische Retargetierung einer alten Nachricht an B.
- **Externe HTTP-Aufrufe sind nicht DB-atomar.** Ein Gate vor einem späteren Resend-Aufruf oder Google-Aufruf allein schließt die Race-Lücke nicht. Keine DB-Transaktion über einen Provideraufruf offen halten.
- Empfohlene Weiterentwicklung: kurze, in der DB reservierte Operation mit Periode/Consentversion, Idempotenz und Zuständen `reserved`, `dispatching`, `accepted`, `failed`, `unknown`. Wechsel/Widerruf verhindern neue Dispatchreservierungen. Wirksamer Transfer darf nicht als abgeschlossen gemeldet werden, während eine alte unklare Inhaltsweitergabe noch automatisch fortgesetzt werden kann.
- Wenn strikte Grenze „kein Versand aus A-Betreuung nach wirksamem Wechsel“ verlangt ist, muss der Transfer bis zur Auflösung bereits laufender/unklarer Dispatches ausstehen. Ein bloßes Lease-Timeout beweist nicht, dass Resend nichts angenommen hat. Bei Widerruf wird der Consent sofort gesperrt; bereits in-flight angenommene externe Sendungen sind nicht zurückholbar und müssen als Grenzfall transparent bleiben.
- Bis diese Zustände und die Kommunikationsgrundlage freigegeben sind, potenziell gesundheitsbezogene Freitextweiterleitung pausieren. Neutraler Billing-/Terminversand ist ein separater enger Prozess, keine Freitextausnahme.
- Inbound: zuerst signaturgeprüfte Eventmetadaten/Alias und minimale Kontextberechtigung prüfen. Bei alter/unklarer Zuordnung oder fehlendem Consent keine Bodies bei Resend nachladen oder in `review` persistieren. Wenn der signierte Metadatenvertrag keine sichere Vorabzuordnung ermöglicht, fail closed und keinen Bodyabruf als Ersatz verwenden. Providerseitige E-Mailannahme bleibt davon getrennt.
- Realtime: produktive Publication/Grants unbekannt; RLS plus Neuanmeldung/Subscriptionverhalten testen. Realtime ist nicht erforderlich, um den Wechsel umzusetzen, und wird nicht vorsorglich aktiviert.

## 9. Später erforderliche Codeänderungen

| Bereich / Dateien | Erforderliche Anpassung; keine Umsetzung in diesem Auftrag |
|---|---|
| [intakeAccess.js](../app/lib/intakeAccess.js), [healthDataConsent.js](../app/lib/healthDataConsent.js) | Einheitliche Perioden-/Zweck-/Consentprüfung; explizite Rückgabestatus statt Gleichsetzung von Adminrolle und Recht; Hash-/Versionsnachweis vom Freigabescope trennen. |
| [intake-consent/route.js](../app/api/intake-consent/route.js), [form-submit/route.js](../app/api/form-submit/route.js), [create-request-draft/route.js](../app/api/create-request-draft/route.js), [public-request/route.js](../app/api/public-request/route.js) | Unvollständige RPC-Umstellung fertigstellen; Widerruf und Verarbeitung atomar ordnen; keine unautorisierte Assignmentänderung durch Formular-/Draftsave; neue Zustimmung darf keinen alten Scope erweitern. |
| [dashboard/requests/route.js](../app/api/dashboard/requests/route.js), [team-requests/route.js](../app/api/team-requests/route.js), [admin/form-drafts/route.js](../app/api/admin/form-drafts/route.js) | Fortführung der neuen Field-Allowlists; alte A-Fälle nicht aus Rechnungsrechten laden; Basisansicht von Health-Freigabe unterscheiden. E-Mail-Fallback bleibt entfernt. |
| [page-client.jsx](../app/page-client.jsx), [DashboardFull.jsx](../app/dashboard/DashboardFull.jsx) | Pending-Consent/Termin-/Transferkonflikte anzeigen; alte Detail-/Matchingzustände bei Widerruf/Wechsel löschen; erneute Serverautorisierung vor Verwendung. UI-Gate ersetzt keinen Serverschutz. |
| [coach-handover/route.js](../app/api/coach-handover/route.js), [forward-request/route.js](../app/api/forward-request/route.js), [admin-forward/route.js](../app/api/admin-forward/route.js), [reassign-request/route.js](../app/api/reassign-request/route.js) | Copy-Pfad und getrennte Close/Update-Schritte ersetzen; Session-Pauschalsperre nicht übernehmen. Wunschänderung von wirklichem Wechsel trennen; historische Angaben nicht unnötig überschreiben. |
| [messages/conversations/route.js](../app/api/messages/conversations/route.js), [messages/send/route.js](../app/api/messages/send/route.js), [send-personal-message/route.js](../app/api/send-personal-message/route.js), [proposals/message/route.js](../app/api/proposals/message/route.js) | Aktuelle Periode und Kommunikationsscope vor Body-/Aliaszugriff und Conversation-Erstellung prüfen. Keine alte Historie oder geschlossene Conversation reaktivieren. |
| [conversations.js](../app/lib/messaging/conversations.js), [outbound.js](../app/lib/messaging/outbound.js), [inbound.js](../app/lib/messaging/inbound.js), [webhooks/resend/route.js](../app/api/webhooks/resend/route.js) | Neues Periodenmodell, Retry-/Duplikatgates, Metadaten-vor-Body, sichere Dispatchzustände und fail-closed Fehler; bestehende Inhalte nicht löschen oder umschreiben. |
| [invoices/load/route.js](../app/api/invoices/load/route.js), [invoices/list/route.js](../app/api/invoices/list/route.js), [invoices/save/route.js](../app/api/invoices/save/route.js), [invoices/send/route.js](../app/api/invoices/send/route.js) | Historische Rechnungsrechte resource-/ownerbezogen; eigenes Billing-Minimum statt vollständiger Anfrage. Alte Rechnung nicht automatisch B zuordnen oder als aktuelle Fallrechnung laden. Historischer Versand/Korrektur nur nach Freigabe. |
| [therapist/billing-sessions/route.js](../app/api/therapist/billing-sessions/route.js), [admin/billing-sessions/route.js](../app/api/admin/billing-sessions/route.js), [admin/sessions/route.js](../app/api/admin/sessions/route.js), [delete-session/route.js](../app/api/delete-session/route.js) | Eigene historische Billingressource und Read-/Write-Rechte trennen; kein Live-Fallstatus für A. Aktueller B-Zugriff gibt keinen Zugriff auf A-Sessiondetails. |
| [add-session/route.js](../app/api/add-session/route.js), [add-sessions-batch/route.js](../app/api/add-sessions-batch/route.js), [booking/book/route.js](../app/api/booking/book/route.js), [confirm-proposal/route.js](../app/api/confirm-proposal/route.js), [new-appointment/route.js](../app/api/new-appointment/route.js) | Versions-/Periodenprüfung und gemeinsame konkurrierende Operationen vor DB-/Kalenderseiteneffekten; kein stale Ownerreset. |
| [client/appointment/route.js](../app/api/client/appointment/route.js), [reminder/route.js](../app/api/reminder/route.js), [reminders/send/route.js](../app/api/reminders/send/route.js), Proposal-/Bestätigungsflows | Konkrete Terminowner und Konflikte beachten; keine unsichtbaren A-Termine, keine falschen Reminder oder automatischen Conversationöffnungen ohne Kommunikationsgrundlage. |
| [coachInvoice.js](../app/api/invoices/_lib/coachInvoice.js), [coachInvoiceSevdesk.js](../app/lib/coachInvoiceSevdesk.js), bestehender fremder Rechnungsstrang | Erhalt der Session-/Quellsnapshotberechnung durch Regressionstests nachweisen; kein Umbau oder Überschreiben des fremden Arbeitsstands als Nebenwirkung. |

Diese Liste bezeichnet die konkreten Integrationsflächen des entworfenen Modells. Die vollständige Basistabellen-RLS-/Grants-Konfiguration und weitere produktive Integrationen bleiben U und müssen vor späterem Rollout autorisiert verifiziert werden.

## 10. Konzeptionell erforderliche Migrationen

**Keine SQL-Datei wurde in diesem Auftrag geändert oder erstellt; keine Migration ausgeführt.**

1. **M1 – Betreuungsperioden und Wechselnachweis (zwingend):** additive Periodenstruktur, eine offene Periode je Fall, Versions-/Idempotenzregeln, konsistente aktuelle Ownerprojektion, minimale Auditdaten. Vorbereitende reine Schema-/Inkonsistenzprüfung, keine automatische Altzuordnungsänderung.
2. **M2 – Empfänger-/Zweckscope (zwingend):** Nachweisverknüpfung zur Periode; aktiver Consent und passend bestätigter Scope als Voraussetzungen. Bestehende Consentbelege und Healthwerte nicht überschreiben. Keine automatische Anreicherung historischer Freigaben.
3. **M3 – Conversationperiode, RPC und RLS (zwingend):** atomare Transferoperation ohne Session-Pauschalsperre; neue Conversation mit neuem Alias; restriktive SELECT-Policies für aktive Periode, Owner und gültigen Kommunikationsscope. Historische Conversation/Messageinhalte für beide Coaches gesperrt. Events bleiben serverseitig; sensible Aliasgeheimnisse nicht breit an Browserrollen gewähren.
4. **M4 – Konkurrenz-/Dispatchschutz (zwingend, falls Freitext-/Kalenderdispatch parallel weiterläuft):** konsistente Request-Locks, Versionsprüfung und ggf. minimaler In-flight-Operationsbestand ohne Bodykopie. Unklare Providerergebnisse explizit sperren.
5. **M5 – Schmale historische Billingzugriffe (zwingend):** sichere Views/RPCs oder Routen-Allowlists; Datenbank-Grants/RLS gegen direkte Health-/Fremdrechnungsabfragen absichern. Snapshotneugestaltung nur bei gesonderter Entscheidung; keine Finanzdatenmigration unter diesem Handover-Label.

Der vorhandene [Phase-1-SQL-Entwurf](../supabase/migrations/20261028000000_privacy_phase1_access.sql) muss nach erneuter Freigabe überarbeitet werden: pauschalen Sessionblock ersetzen; kein Terminreset im Wechsel; boolesche Dauersperre durch entscheidbaren Perioden-/Scopezustand ersetzen; tatsächlichen Zielcoach/Version/Idempotenz integrieren; alte direkten Schreibwege abfangen. `privacy_read_messages` und `getMessagingAccess` allein sichern keine noch unverdrahteten Libraries.

M1/M2/M3 müssen als abgestimmtes Schema-/Codepaket entworfen werden. M4 muss vor garantierter Nebenläufigkeit/erneutem Inhaltsversand verfügbar sein. Keine Betriebsfreigabe allein wegen vorhandener Migrationsdateien. Echte RLS-/Rollback-/Concurrencytests benötigen gesonderte Genehmigung.

## 11. Synthetischer Test- und Abnahmeplan

Nur künstliche Fall-/Coach-IDs, erfundene Texte und `example.invalid`-Adressen; HTTP-/Providerclients blockieren oder stubben. Für Tests bestehender Finanzdaten neutrale synthetische Dokumente verwenden. Keine lokalen oder produktiven Migrationen ohne gesonderte Freigabe.

| Test | Eingabe / Szenario | Erwartung / messbare Invariante |
|---|---|---|
| T01 | A→B ohne Sessions | Eine neue aktive Periode; A-Ownerrecht entzogen; alte Conversation geschlossen, Alias widerrufen; keine zweite Anfrage. |
| T02 | A→B mit historischen Sessions | Wechsel möglich; alle ursprünglichen Session-IDs, Owners, Daten und Beträge unverändert. |
| T03 | Vorhandene Klientenrechnungen | Invoice-ID, Owner, Requestbezug, Nummer, Beträge, Status und Dokument unverändert; B erhält keine A-Rechnung aus `load`. |
| T04 | Bereits erstellte/versendete sevDesk-Rechnungen | Externe IDs, Status, gespeicherte Quellen/Verknüpfungen bleiben identisch; kein Provideraufruf oder automatisches Recalculate. |
| T05 | Zukünftige/laufende A-Termine oder offene Proposals | Konkreter Konflikt vor jeder Mutation; Zeiten, Slot-/Sessionowner und Event-IDs identisch; 0 Kalenderaufrufe; nach separater Lösung frischer Preflight. |
| T06 | A greift direkt nach wirksamem Commit über jede Live-API zu | Kein Basisakten-, Health-, Nachrichten- oder neues Betreuungsrecht; nur eigene separat freigegebene Billingressource. |
| T07 | B mit ausreichendem aktiven Consent für B/Periode | Nur erlaubte Intakefelder; keine alte Messagehistorie; neue Conversation nur mit Kommunikationsgrundlage. |
| T08 | B mit fehlendem, falschem Empfänger-, falschem Zweck- oder altem Periodenbeleg | Health und Kommunikation gesperrt; minimale Basis-/Termin-/Billingfunktionen getrennt. |
| T09 | Widerruf; Admin, A, B und öffentliche Tokenroute | Keine neuen sensiblen Reads/Writes/Matching-/Handoververarbeitung; Daten und Nachweise bleiben gespeichert. |
| T10 | Direkte RLS-Abfragen durch A/B/anon/inaktiven Coach/Admin | Historische Messages/Conversations gesperrt, Eventtabellen ohne allgemeines Recht; echte Aussagen erst im später genehmigten DB-Test. |
| T11 | Service-Role-Routen mit falschem Owner oder Prüffehler | Eigene API-AuthZ verhindert Offenlegung trotz RLS-Bypass; kein Body-/Alias-/Kontaktpayload im Fehlerlog. |
| T12 | A→B→A | Rückkehr von A aktiviert weder alte Conversation noch alte Empfängerfreigabe; neue Periode/Conversation/Scope erforderlich. |
| T13 | Wechsel parallel zu API-Versand, Inboundretry oder Provider-`unknown` | Keine Retargetierung zu B; nach final wirksamem Wechsel keine neue A-Dispatchreservierung; In-flight-Grenzfall explizit statt falscher Erfolgsgarantie. |
| T14 | Widerruf parallel zu Read/Save/Draft/Queueclaim | Gemeinsame definierte Serialisierung; nach Widerruf gestartete Verarbeitung gesperrt; vorherige Antwort/Providerannahme nicht als rückrufbar behaupten. |
| T15 | Vergleich vor/nach Wechsel | Session-, Invoice-, sevDesk-/Quartals-Snapshots wertgleich; keine Änderung von Steuerflags, Preis, Terminzeit oder `POISE VERFÜGBAR`. |
| T16 | Fehler nach jeder Transferstufe | Vollständiger DB-Rollback ohne halbgeschlossene Rechte oder doppelte aktive Periode; API-Ergebnis kein Erfolg. |
| T17 | Gleiche Idempotenzkennung / stale Version / zwei Zielcoaches | Ein gültiges Ergebnis; gleiche Operation reproduzierbar, konkurrierende andere Operation erhält Konflikt. |
| T18 | Alter Proposal-/Booking-/Draftlink nach Wechsel | Vor Provideraktion abweisen; kann A nicht wieder zum aktuellen Coach machen. |
| T19 | Rechnungs-Read/Save/Delete als ehemaliger Coach | Nur freigegebene eigene historische Felder; kein vollständiger Request, keine Fremdsession, kein Sessiondelete allein aus historischem Leserecht. |
| T20 | Alias-/Eventmetadaten unklar, Consent fehlt, doppelte Inboundevents | Kein Provider-Bodyabruf, keine neue Bodypersistenz/Weiterleitung; minimale sichere Ereignisbehandlung. |
| T21 | UI geöffnet, danach Wechsel/Widerruf | Alte Detail-/Matchingcaches verwerfen; nächste Aktion reautorisiert; bereits zuvor gesehene Inhalte nicht als technisch rückrufbar darstellen. |
| T22 | Mehrdeutige Legacy-ID / fehlender Schema-/Ownerabgleich | Kein erratenes Rechnungs- oder Betreuungsrecht; konkreter Prüfkonflikt, keine automatische Migration. |

**Prüfebenen:** Unit-/API-/Contracttests prüfen Entscheidungslogik, Feldlisten und stubbasiertes Fehlerverhalten. Sie beweisen keine DB-Isolation, RLS-Ausführung oder Triggerreihenfolge. Später separat genehmigte isolierte PostgreSQL-Tests müssen Migrationsfähigkeit, Grants, JWT-RLS, echte parallele Transaktionen, Rollback, A→B→A und die Wechsel-/Widerrufsraces nachweisen. Providerannahme-/Timeoutverhalten bleibt eine weitere Integrationsabnahme.

**In diesem Auftrag ausgeführt:** nur lokale Quellen-/Git-/Dokumentprüfungen. Keine Anwendungstests, Builds, Migrationen oder Provideraktionen; es wurden ausschließlich Architektur und Testplan erstellt.

## 12. Risiken, Rückfall und Rolloutschutz

- **Unvollständige Privilegiengrenze:** Ein historischer Rechnungslink oder Service-Role-Join kann Healthdaten mitladen. Gegenmaßnahme: Ressourcentrennung, feste Projektionen, Route-/RLS-Negativtests; nicht nur Dashboardfilter ändern.
- **Zwei Ownerquellen:** Periode und Anfrage-ID könnten driften. Gegenmaßnahme: eine transaktionale Schreiboperation und Datenbankinvarianten; kein unkontrolliertes Dual-write.
- **Versehentliche Wiederfreigabe:** erneute Zustimmung oder A→B→A kann alten Verlauf öffnen. Gegenmaßnahme: periodengebundener Scope, keine Wiederöffnung geschlossener Conversations.
- **Billing-Seiteneffekte:** neue Queryfilter können historische Rechnungserstellung verhindern oder fremde Snapshotarbeiten beschädigen. Gegenmaßnahme: Feld-/Workflowfreigabe und Regressionstests zusammen mit bestehendem Rechnungsstrang; keine automatischen Datenkorrekturen.
- **Terminkonflikte:** lokale Referenzen können unvollständig sein. Gegenmaßnahme: bestätigte Datenqualität und expliziter Konfliktworkflow; keine Kalenderlöschung als Handover-Nebenwirkung.
- **In-flight-Provideraktionen:** kein naives Versprechen einer verteilten Transaktion. Unklare Zustände sperren, nicht nach Timeout neu an B senden.
- **Legacy-Daten:** fehlende Consent-/Periodenbelege verursachen berechtigte Sperren. Kein Backfill erfundener Einwilligungen oder vergangener Zuordnungszeitpunkte; datensparsamer manueller Prüfprozess.
- **Bereits offengelegte Inhalte:** Browser, alte E-Mails und externe Exporte sind nicht rückrufbar. Künftige Zugriffe sperren; organisatorische Grenzen transparent halten.

Rollout erst nach separater Implementierungsfreigabe, abgeschlossenen Tests, Schema-/Grants-Prüfung und eigener Migrations-/Deploymentfreigabe. Additive Migrationen und readinessgeprüfte APIs koordinieren. Keine neue RPC aufrufen, bevor deren geprüftes Schema vorhanden ist; andererseits keine unsicheren Legacy-Schreibpfade parallel weiterlaufen lassen.

Rückfall bei Fehler: sensible Zugriffspfade und Transfers kontrolliert pausieren, Daten erhalten, neutrale Billing-/Terminpfade nach geprüftem Muster verfügbar halten. Nicht auf frühere zu breite RLS zurückschalten oder Coach-ID blind auf A zurücksetzen. Ein Rückwechsel ist eine neue autorisierte Periode, keine Wiederbelebung alter Rechte. Vor irreversiblen Datenmigrationen separat genehmigte Backup-/Restoreprüfung; dieser Entwurf erfordert keine Health-/Nachrichtenlöschung.

## 13. Offene Freigabeentscheidungen und Reihenfolge

Die zentralen Geschäftsregeln sind verbindlich; offen ist deren konkrete technische/organisatorische Ausgestaltung:

| Entscheidung | Sichere Empfehlung | Auswirkung bis zur Freigabe |
|---|---|---|
| Architektur C und additive Perioden-/Scopeobjekte | Stabile Anfrage, keine Healthkopie; aktuelle Projektion atomar zur Periode | Keine Fortsetzung des alten Copy-Handoverpfads. |
| Wer darf wirksam A→B zuweisen? | A kann anstoßen; aktiver Admin oder nachgewiesene Klientenwahl bestätigt B | Keine freie Zielcoachzuweisung aus beliebigem Clientpayload. |
| Empfänger-/Zwecknachweis | Rechtlich bestätigter Consentumfang oder neue ausdrückliche Zustimmung für B; Nachrichten separat | B erhält bis dahin nur minimale Basisrechte, keine Health-/Messageinhalte. |
| Historisches Billing-Minimum | Ownerbezogene lesende Ressource; Name/Adresse nur bei Rechnungsnotwendigkeit | Keine allgemeine alte Akte; Feldliste und notwendige Rechtsgrundlage noch bestätigen. |
| Noch nicht fakturierte eigene Altsessions und Rechnungskorrektur/-versand | Eigener enger Billingworkflow statt neues Betreuungsrecht | Keine unbeabsichtigte Änderung vorhandener Rechnungen; erlaubte Aktionen explizit entscheiden. |
| Zukünftige Termine | Nur konkrete Konflikte blockieren, separate Terminentscheidung | Historische Sessions blockieren nicht; keine automatischen Kalenderaktionen. |
| Dringender Zugriffsentzug bei Terminkonflikt | Explizite Suspendierung ohne Termin-/Finanzänderung | Erfordert berechtigte Rolle, Meldung und kontrollierten Wiedereinstieg. |
| Kommunikationsgrundlage und Dispatchgrenze | Keine automatische Inhaltsweitergabe bis rechtlich/fachlich bestätigt; später serialisierte Dispatchreservierung | Keine pauschale Freigabe aus Intake-Consent. In-flight-Annahme nicht als rückrufbar darstellen. |
| Altbestand / echte DB-Tests | Genehmigter Schema-/Rechteabgleich und danach isolierte synthetische PostgreSQL-Abnahme | Keine Produktiv-/lokalen Migrationen und kein stiller Backfill in diesem Auftrag. |

**Zwingend:** Consent-/Scope-Gates für alle Rollen, Entzug aktueller A-Rechte, getrennte historische Billing-Reads, keine Session-/Invoicekopien, neue periodengebundene Conversation, atomarer Wechsel, konkrete Terminprüfung, Service-Role- und RLS-Absicherung samt Retry-/Legacy-Pfaden und synthetischer Testabnahme.

**Optional/später:** vollständige Trennung von Gesundheitstabelle/Fallmodell, generisches Ausnahme-Grantsystem, Übergabezusammenfassungen, historische Messageeinsicht, Rechnungs-Snapshotneudesign und Realtime-Ausbau. Diese sind keine stillen Berechtigungen.

**Betroffene Prozesse:** Dashboardfallliste und alte Detailansichten, Matching/Consentwiederaufnahme, Handover und Adminvorschläge, neue/historische Sessionverwaltung, Klientenrechnungsansichten und Quartalsabrechnungsquellen, Booking/Proposal/Reminder sowie Resend-Inbound/-Retry. Bestehende Daten müssen dabei erhalten bleiben.

**Empfohlene nächste Reihenfolge nach Freigabe:** Entscheidungen oben festhalten → synthetische Vertrags-/Negativtests → Perioden-/Scope-/Billingmodell fertig spezifizieren → SQL-Entwurf und APIs gemeinsam überarbeiten → isolierte DB-Tests gesondert genehmigen → erst danach eigene Rolloutentscheidung. Eine neue SQL-Datei oder Änderung des vorhandenen Entwurfs bedarf ausdrücklich der nächsten Freigabe.

## 14. Neues Systemwissen

- Handover mit Sessions kopiert aktuell eine Anfrage, statt den bisherigen Gesundheitsdatenzugriff sicher zu entziehen; unveränderte historische Abrechnung verlangt gerade **keine** neue Gesundheitsakte.
- Historische Sessionowner und Rechnungsowner sind bereits getrennt vom aktuellen Anfrageowner gespeichert. Sie bilden den Ausgangspunkt minimaler Billingrechte, aber nicht automatisch ausreichende APIs.
- Die aktuelle `invoices/load`-Query ist für gemischte Coachhistorie nicht ownergetrennt; allein das Verbergen von Gesundheitsfeldern löst diese Fehlkopplung nicht.
- Historische Session-/Invoiceberechtigung beinhaltet derzeit teilweise auch Schreibrechte; Read- und Korrekturberechtigung müssen ausdrücklich unterschieden werden.
- Anfrage-Steuer-/Beschäftigungsfelder fließen live in Quartals-Snapshots ein. Ihr Umbau wäre abrechnungsrelevant; bloßer Betreuungswechsel soll sie unangetastet lassen.
- Ein aktueller Coachfilter in Terminansichten kann einen noch existierenden alten Coachtermin ausblenden. Sicherer Wechsel braucht deshalb ein konkretes Terminmodell, keine bloße Ownerupdate-Abfrage.
- A→B→A und Retry-/Duplikatereignisse erfordern Periodenbindung und erneute Autorisierung; Coach-ID und Conversation-Status allein sind nicht genug.
- Ein geprüfter SQL-Read und ein späterer HTTP-Versand sind keine gemeinsame Transaktion. Sofortiger Rechteentzug und externe Zustellung brauchen ausdrücklich definierte Wirksamkeitsgrenzen.
- Die vorhandene Phase-1-Zwischenfassung ist weiterhin unvollständig, nicht ausgeführt und nicht sicherheitsvalidiert. Insbesondere die Session-Pauschalsperre ist überholt.

Diese Erkenntnisse werden ausschließlich in dieser Entscheidungsvorlage dokumentiert, nicht ungefragt in bestehende Systemdokumente übernommen.

## 15. Abschluss und Freigabe

**Kann der Coach-Wechsel mit vorhandenen Sessions sicher umgesetzt werden?** Ja, als oben entworfene stabile Fall-/Periodenarchitektur mit separaten historischen Abrechnungsrechten. Historie allein ist kein Blocker. Die sichere Implementierung und tatsächliche DB-Garantie stehen noch aus; konkrete zukünftige Termine/unklare Provideroperationen bleiben explizite Konflikte.

**Welche Änderungen sind zwingend bzw. optional und welche Fragen bleiben?** Abschnitte 9–13 enthalten Integrationsflächen, konzeptionelle Migrationen, Reihenfolge und Freigaben. Die bisherigen Geschäftsentscheidungen werden nicht erneut relativiert; zusätzliche Rechte und rechtliche Grundlagen werden nicht angenommen.

**ENTSCHEIDUNG ERFORDERLICH**

**Handover-Architektur analysiert: JA**

**Berechtigungsmodell definiert: JA**

**Implementierung freigegeben: NEIN**

**Migrationen ausgeführt: NEIN**

**Deployment durchgeführt: NEIN**

**Weitere Freigabe erforderlich: JA**

## 16. Lokaler Umsetzungsstand nach Implementierungsfreigabe

Der nachfolgende Implementierungsauftrag hat die Pause aus Abschnitt 15
aufgehoben. Die vorherigen Abschnitte dokumentieren den damaligen
Analyse-/Entscheidungsstand und sind keine Aussage ueber bereits ausgerollte
Datenbankgarantien. Es wurde keine weitere Architekturvorlage angelegt.

### Umgesetzt und als SQL-Datei vorbereitet

- Zentrale sensible Projektion fuer Dashboard, Team, Drafts und Public-Intake;
  erneute Owner-/Consentpruefung, keine E-Mail-Fallbackberechtigung.
- Atomarer Intake-/Draftsave und Widerruf; eigene versionierte, ausdrueckliche
  Empfaengerbestaetigung. Bestehende Belege werden nicht umgedeutet.
- Eine stabile Anfrage und neue Betreuungsperioden statt kopierter Healthdaten.
  Historische Sessions blockieren nicht pauschal; konkrete Zukunftstermine und
  offene Provideroperationen liefern einen Konflikt vor dem Wechsel.
- Entzug alter Conversation-/Aliasrechte, periodenbezogene Messaging-RLS
  sowie API-/Inbound-/Retry-Gates. Keine Historienfreigabe oder Datenloeschung.
- Ownerbezogene historische Billingansichten, atomare Invoice-Save- und
  Session-Delete-RPCs, keine Gesundheitsdaten im Rechnungsversand.
  Dashboard-Rechnungslinks binden den ausgewaehlten Rechnungscoach auch fuer
  Admins; alte Rechnungen werden nicht versehentlich als B-Rechnung geoeffnet.
  Die historische Rechnungsansicht ist schreibgeschuetzt und verwendet
  gespeicherte Positionen, Steuerwerte und Summen statt einer Neuberechnung.
  Rechnungsversand akzeptiert keine frei eingegebenen Nachrichtentexte oder
  Betreffzeilen als Umgehung der Messaging-Sperre; Providerfehler sind Fehler.
- Versionsgebundene Booking-/Proposalaktionen und persistente Providerclaims.
  Die ungesicherte Proposal-Erstellung erfordert jetzt aktive Staff-Authentifizierung.
  Historische Meeting-Overrides bleiben gespeichert, werden fuer eine andere
  Betreuungs-Version aber nicht verwendet.

Alle Datenbankobjekte liegen ausschliesslich im ueberarbeiteten, noch nicht
angewendeten Entwurf
[20261028000000_privacy_phase1_access.sql](../supabase/migrations/20261028000000_privacy_phase1_access.sql).
Er fuehrt beim Transfer keine Session-/Invoice-/sevDesk-Aenderung aus.
Bestehende parallele Rechnungsarbeiten wurden nicht zurueckgesetzt.

### Bewusste Betriebsgrenzen

Inhalts-Messaging bleibt mit explizitem Pausenstatus gesperrt, bis eine
eigenstaendige Kommunikationsgrundlage und Dispatchgrenze bestaetigt sind.
Es gibt keine versteckte Umgebungsvariable zum Umgehen dieser Sperre.
Neutrale Termin-/Rechnungsmails sind davon getrennt.
Die neue Conversation ist ohne Kommunikationsfreigabe nur `pending`, keine
aktive Weiterleitung. Alte Browser-/E-Mailkopien sind nicht rueckrufbar.

Versionen an alten Links/Proposals werden nicht erraten. Neue bewusst
gebundene B-Buchungen sind moeglich; ungebundene Altlinks werden nach einem
Wechsel abgewiesen. Ungebundene alte Reminder werden nicht als neue
B-Termine versendet. Fehlendes Schema/RPC fuehrt fail-closed zu Fehlern.

Offene Terminclaims laufen nicht automatisch ab. Nach Fehlern oder unklarem
Providerergebnis muss dessen tatsaechlicher Ausgang kontrolliert geprueft
werden; ein blindes Abschliessen oder Wiederholen ist keine sichere
Reparatur. Ein allgemeines Admin-Reconciliation-UI ist nicht Teil dieser
Korrektur. Ein separater Korrekturworkflow fuer historische Rechnungen und
noch unberechnete Altsessions bleibt ebenfalls ausserhalb dieser Phase.

Die neuen Betreuungs-/Freigabe-/Operationsreferenzen verwenden bewusst
`ON DELETE RESTRICT`. Der lokal vorbereitete Kandidat fuer
`delete-forever` ersetzt den direkten Parent-DELETE durch den RPC
`privacy_delete_request` in
[20261028010000_privacy_delete_request.sql](../supabase/migrations/20261028010000_privacy_delete_request.sql).
Er blockiert bekannte Aufbewahrungsabhaengigkeiten, loescht nur kurzlebige
requestgebundene Recovery-Challenges innerhalb derselben Transaktion und laesst
unbekannte FK-Verletzungen die gesamte Transaktion zurueckrollen.
Consent-/Care-/Transfer-/Operationshistorie, Conversations/Nachrichten,
Re-Engagement-/Recovery-Queue-Datensaetze, Sessions, Rechnungen, sevDesk-IDs
und Kalender-/Proposal-Daten werden nicht automatisch geloescht oder veraendert.
Der Kandidat und seine PostgreSQL-Tests bestanden in einem netzwerkisolierten
PostgreSQL-15-Wegwerfcontainer mit kuenstlichen Daten; der Container wurde
entfernt. Das vollstaendige produktive Basisschema ist nicht im Repository
enthalten. Die zulaessige Aufbewahrung der Blockerkategorien bleibt vor
Produktivsetzung zu entscheiden.

### Betroffene Implementierungsdateien

- Consent/Intake: [intakeAccess.js](../app/lib/intakeAccess.js),
  [healthDataConsentShared.js](../app/lib/healthDataConsentShared.js),
  [intake-consent](../app/api/intake-consent/route.js),
  [Draftsave](../app/api/create-request-draft/route.js),
  [Formularsave](../app/api/form-submit/route.js),
  [Public-Reader](../app/api/public-request/route.js),
  [Formular-UI](../app/page-client.jsx), Staff-Reader in
  [dashboard/requests](../app/api/dashboard/requests/route.js),
  [team-requests](../app/api/team-requests/route.js) und
  [admin/form-drafts](../app/api/admin/form-drafts/route.js).
- Transfer: [coach-handover](../app/api/coach-handover/route.js),
  [forward-request](../app/api/forward-request/route.js),
  [admin-forward](../app/api/admin-forward/route.js) und
  [Dashboard](../app/dashboard/DashboardFull.jsx).
- Nachrichten: [Messaging-Helper](../app/lib/messaging/),
  [Conversation-API](../app/api/messages/conversations/route.js),
  [Send-API](../app/api/messages/send/route.js),
  [persoenlicher Versand](../app/api/send-personal-message/route.js),
  [Resend-Webhook](../app/api/webhooks/resend/route.js) und Proposal-Mailpfade.
- Historische Abrechnung: [billingAccess.js](../app/api/_lib/billingAccess.js),
  [Client-Invoice-APIs](../app/api/invoices/),
  [Coach-Billing](../app/api/therapist/billing-sessions/route.js),
  [Admin-Billing](../app/api/admin/billing-sessions/route.js),
  [Session-Loeschung](../app/api/delete-session/route.js),
  [Client-Rechnungsansicht](../app/dashboard/rechnung/[id]/page.js).
  Parallele Poise-an-Coach-/sevDesk-Arbeiten sind keine P0-Aenderungen.
- Terminbindung: [appointmentCare.js](../app/lib/appointmentCare.js),
  [meetingLinkScope.js](../app/lib/meetingLinkScope.js), Sessionanlage,
  Booking-/Proposal-/Bestaetigungs-/Reminder-/Storno-/Reschedule-Routen,
  [Bestaetigungs-Handler](../app/lib/handlers/confirmAppointment.js),
  [Booking-UI](../app/booking/[token]/page.jsx) sowie Linkversand und
  [Meeting-Override](../app/api/update-meeting-link-override/route.js).
- Gemeinsame Response-Header: [server.js](../app/api/_lib/server.js).
  Direkt zugehoeriges Systemwissen steht in [AI_CONTEXT.md](../AI_CONTEXT.md),
  [architecture.md](architecture.md) und [security.md](security.md).

### Validierung und Schritte vor Produktivsetzung

Abschliessend erfolgreich:

- `npm test`: **64 Testdateien, 826 Tests**. Synthetische Daten und gemockte
  Provider; insbesondere Widerruf, Empfaengerfreigabe, Handover/Replay,
  Ownerwechsel, alte Nachrichten, historische Rechnungen, neutrale Mails
  und veraltete Terminaktionen.
- `next build --experimental-build-mode compile`: erfolgreich mit
  gesperrtem Netzwerk, ohne Prerendering oder Deployment.
- SQL-Parser: **72 SQL-Anweisungen und 20 PL/pgSQL-Funktionen** syntaktisch
  geprueft, keine Ausfuehrung und keine Datenbankverbindung.
- `git diff --check`: erfolgreich.

Nicht getestet in der damaligen Implementierungsrunde: echte
PostgreSQL-Policies/Grants/Trigger und Transaktionsrennen,
Browser-End-to-End-Flows, Produktionsschema, Altdatenmigration, echte
Provideraktionen, Backup/Restore. Die spaeter durchgefuehrte isolierte
Abnahme ist nachfolgend dokumentiert.

Die technische Abnahme ist separat in
[privacy-p0-acceptance.md](privacy-p0-acceptance.md) dokumentiert: PostgreSQL
15, Migration-Rollback, SQL/RLS/Trigger und 19 Lock-Barrierefaelle;
ausschliesslich kuenstliches Schema und Daten, Container danach entfernt.
Auch der neue transaktionale Loeschpfad bestand diesen isolierten Lauf.
Der Vertragsfehler fuer minimale Messaging-Denials wurde im JavaScript-Adapter
korrigiert und mit exakt den SQL-JSONs getestet. Inhalts-Messaging bleibt
deaktiviert. Produktiver Schema-/Altbestandsabgleich, Retention-Freigaben,
Provider-/Restoreabnahme und Rolloutfreigabe bleiben offen.
