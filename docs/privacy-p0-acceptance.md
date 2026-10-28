# P0: Technische Abnahme und Produktivsetzungs-Checkliste

Stand: 28. Oktober 2026. **Die P0-Kandidatenmigrationen einschliesslich des
neuen Loeschpfads bestanden die isolierte synthetische PostgreSQL-Abnahme.
Keine vollstaendige Produktivabnahme erfolgt.**
Keine neue Architekturentscheidung. Grundlage ist die lokal akzeptierte
[Implementierung, Abschnitt 16](privacy-handover-architecture-decision.md#16-lokaler-umsetzungsstand-nach-implementierungsfreigabe).

Seit der frueheren Abnahme wurde der Endloeschpfad lokal auf einen
admin-gebundenen transaktionalen RPC umgestellt und die neue Migration nach
separater Nutzerfreigabe in einem frischen, netzwerkisolierten PostgreSQL-15-
Wegwerfcontainer ausgefuehrt. SQL-Assertions, Migration-Rollback und alle
19 Lock-Barrierefaelle bestanden; der Container wurde entfernt. Diese
synthetische Abnahme ist keine Produktivschema- oder Rolloutfreigabe.
Keine externe Datenbankverbindung, kein Nachrichten-/Kalender-/sevDesk-Aufruf
und kein Deployment.

**Nachtrag Session-INSERT-Lockdown:** Die neu hinzugefuegte separate
[Migration](../supabase/migrations/20261028020000_sessions_insert_lockdown.sql)
und die erweiterte Fixture-/SQL-Suite sind durch den oben beschriebenen
frueheren Lauf nicht abgenommen, bestanden aber inzwischen den separat
freigegebenen einmaligen Folgelauf (Abschnitt 7). Der Runner enthaelt zusaetzlich
[Standalone-Sessiontests](../tests/postgres/privacy-p0-session-inserts.sql),
die vor dem breiteren P0-Zugriffsentwurf laufen. Jede weitere
Datenbankausfuehrung benoetigt eine gesonderte Freigabe. Verbindlich
kein Produktivzugriff, auch nicht fuer den vorbereiteten Schema-Preflight.

**Produktivstatus laut Nutzer, 28.10.2026:** Ausschliesslich
`20261028020000_sessions_insert_lockdown.sql` wurde manuell im Supabase
SQL Editor angewendet. Alle sieben Metadatenkontrollen waren `true`;
der Session-Hotfix ist produktiv auf Berechtigungsebene verifiziert.
Kein produktiver End-to-End-Funktionstest, kein Deployment, keine weitere
P0-Migration angewendet. Kein Produktivzugriff durch den Agenten.
Die manuelle Anwendung muss spaeter kontrolliert mit der Supabase-
Migrationshistorie abgestimmt werden; keine automatische Wiederholung
oder blinde Markierung. Das Hotfix-Runbook bleibt historisch erhalten.
Fuer die noch gesperrte Zugriffsmigration gilt die neue
[Vorbereitungsanleitung](privacy-p0-phase1-rollout.md).

## 1. Vorbereitete echte Datenbanktests

Der [Runner](../scripts/privacy-p0-acceptance.py) verwendet ausschliesslich
einen selbst neu erzeugten PostgreSQL-15-Container mit:

- `--network=none`, keinen Hostports, keinen Bind-Mounts oder persistenten
  Daten-Volumes; Daten ausschliesslich in `tmpfs`;
- unveraenderbarem Container-ID-/Ownership-Check und anschliessender Entfernung
  genau dieses Containers, auch bei Testfehlern;
- festem lokalen Docker-Socket, bereinigter Prozessumgebung und explizitem
  lokalen PostgreSQL-Socket im Container; kein DSN-/Hostparameter, kein
  `.env`-Laden und keine Uebernahme von `PG*`, Supabase- oder Provider-Secrets;
- nur einem bereits lokal vorhandenen `postgres:15-alpine`-Image
  (`--pull=never`); Image-ID und SQL-Dateihashes im Laufprotokoll;
- echten Rollen `anon`, `authenticated`, `service_role`, einem synthetischen
  `auth.uid()` und ausschliesslich kuenstlichen Daten. Service-RPCs laufen
  als Nicht-Superuser mit `BYPASSRLS`, nicht als Datenbankowner.

Das [synthetische Basisschema](../tests/postgres/privacy-p0-fixture.sql)
modelliert die im Repository nicht vollstaendig migrierte Grundstruktur.
Messaging-, Consent-, Re-Engagement- und Recovery-Tabellen werden dagegen
aus ihren echten Repository-Migrationen erzeugt. Der Runner wendet danach
den P0-Zugriffsentwurf und den neuen Loeschentwurf **nur in diesem
Wegwerfcontainer** an. Zuvor
injiziert er dort einmal absichtlich einen Fehler vor `COMMIT`, um DDL- und
Grants-Rollback zu testen. Das ist keine Anwendung in einer vorhandenen DB.

**Wichtige Grenze:** Ein Erfolg beweist die Kandidatenlogik auf diesem
synthetischen Grundschema. Er ersetzt weder den Abgleich realer Datentypen,
bestehender Trigger/Policies/Views/Rollenmitgliedschaften und Default-Grants
noch Supabase/PostgREST/Realtime- oder Browser-End-to-End-Tests. Die pauschale
Messaging-Pause erlaubt aktuell keinen positiven Test eines freigegebenen
Nachrichtenlesers; sie wird fuer Tests nicht umgangen.

### Abnahmematrix

| Bereich | Vorbereiteter Nachweis | Bestanden erst nach |
|---|---|---|
| Schema/Transaktion | Echte Kandidatenmigration; absichtlich fehlgeschlagene Migration hinterlaesst weder neue Objekte noch entzogene Altgrants; kein Consent-/Empfaengerbackfill | Ausfuehrung im freigegebenen isolierten Container |
| Rollen/Grants | Tabellen- **und** Spaltengrants entzogen, RPC-EXECUTE je Overload geprueft, kein Actor-Spoofing durch Browser-RPCs, RLS aktiviert, tatsaechliche Berechtigungsfehler | Isoliertem Lauf plus spaeterem Rollen-/View-/Realtime-Abgleich |
| Gesundheitsdaten | Admin und aktueller Coach mit gueltiger Freigabe; fremder/inaktiver Coach; falsche Booking-/Consentnachweise; Widerruf, keine Admin-Ausnahme, gespeicherte Werte bleiben erhalten | Isoliertem Lauf |
| Intake/Draft | Erster Save verknuepft Anfrage, Beleg und Episode atomar; fehlende Empfaengerfreigabe hinterlaesst keine Anfrage; widerrufener Draft und finalisierter Draft abgewiesen | Isoliertem Lauf |
| Handover | A verliert laufende Akte; B braucht eigene Freigabe; A -> B -> A belebt alte Freigabe nicht wieder; eine offene Periode; direkte Owner-/Versionsupdates verboten | Isoliertem Lauf |
| Historie | Bereits vorhandene Sessions verhindern Wechsel nicht; Sessions, Rechnungen, sevDesk-/Event-IDs unveraendert; eigener aktueller Invoice-Teilupdate erhaelt ausgelassene Felder; historische A-Schreib-/Loeschversuche und B-Zugriff auf A-Session abgewiesen | Isoliertem Lauf plus UI/API-Abnahme |
| Messaging | Alte Conversation/Alias geschlossen; A/B/Admin-Browser sehen keine Bodies; Events ohne Browserrechte; Message-Write- und Conversation-Trigger verweigern neue Inhalte auch mit synthetischer Messaging-Freigabe | Isoliertem Lauf; **keine Aktivierungsfreigabe** |
| Termine | Konkrete Zukunftssession, Slot, Proposal und bevorzugte Zeit blockieren Wechsel ohne Teilmutation; persistenter Claim blockiert Transfer; alter Owner kann nach Wechsel keine Session einfuegen | Isoliertem Lauf |
| Loeschung | Transaktionaler RPC, bekannte Retentionsblocker, Recovery-Challenge-Cleanup, Rollback unbekannter FK-Abhaengigkeiten und Queue-Lockrennen | Aktuellem isolierten synthetischen Lauf bestanden; Produktivschema bleibt ungeprueft |

Die Assertions stehen in
[privacy-p0-acceptance.sql](../tests/postgres/privacy-p0-acceptance.sql);
historische Nachrichten werden ausschliesslich vor dem Kandidaten aus
[synthetischen Legacydaten](../tests/postgres/privacy-p0-legacy-messaging.sql)
angelegt, nicht durch Abschalten neuer Schutztrigger.

### 19 isoliert bestandene Parallelfaelle

Zwei echte PostgreSQL-Verbindungen halten bzw. erwarten Zeilenlocks. Eine
dritte Verbindung beobachtet `pg_stat_activity.wait_event_type = 'Lock'`;
erst danach wird die erste Transaktion committet oder zurueckgerollt.
Kein nur zeitgesteuertes `sleep` entscheidet ueber das Testergebnis.
Statement-/Locktimeouts verhindern endloses Haengen.

1. Widerruf zuerst -> wartender Healthread ohne Gesundheitsfelder.
2. Healthread zuerst -> Widerruf wartet; jeder danach gestartete Read gesperrt.
3. Widerruf zuerst -> Intake-Save abgewiesen.
4. Save zuerst -> Widerruf wartet; gespeicherte Angaben danach nicht lesbar.
5. Transfer zuerst -> alter Coach erhaelt keine laufende Akte.
6. Read zuerst -> Transfer wartet, wird danach einmal abgeschlossen.
7. Terminclaim zuerst -> Transfer wegen offener Operation abgewiesen.
8. Transfer zuerst -> alter Terminclaim wegen veralteter Version abgewiesen.
9. Gleiche Transfer-Operation parallel -> ein Ergebnis, genau ein Protokolleintrag.
10. Verschiedene Transfer-Operationen mit gleicher Version -> ein Versionskonflikt.
11. Transfer-Rollback -> wartender alter Coach bleibt berechtigt.
12. Widerrufs-Rollback -> bestehender gueltiger Healthread bleibt moeglich.
13. Claim-Rollback -> kein Phantomclaim, Transfer moeglich.
14. Zukunftssession-Insert zuerst -> Transfer erkennt den committeten Termin.
15. Transfer zuerst -> alter Rechnungs-Save abgewiesen.
16. Rechnungs-Save zuerst -> Transfer erhaelt dessen historischen Rechnungsowner.
17. Transfer zuerst -> alter Coach kann seine historische Session nicht loeschen.
18. Erlaubte Session-Loeschung zuerst -> Transfer wartet, beendet danach Betreuung.
19. Anfrage-Loeschung zuerst -> Recovery-Queue-Insert wartet und wird nach
    erfolgreich geloeschter Anfrage abgewiesen.

Bereits autorisierte, vor Widerruf/Wechsel abgeschlossene Reads koennen nicht
rueckwirkend zurueckgerufen werden. Der Paralleltest verlangt deshalb
serialisierte Verarbeitung, nicht die unmoegliche Ruecknahme ausgelieferter Daten.
Die Faelle 1-18 bestanden bereits im frueheren Lauf; alle 19 einschliesslich
des neuen Loesch-/Queue-Rennens bestanden erneut mit dem aktuellen Kandidaten.

### Befehle und Ausfuehrungsfreigabe

Ohne Datenbank-/Dockerzugriff pruefbar:

```sh
PYTHONDONTWRITEBYTECODE=1 python scripts/privacy-p0-acceptance.py
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests/postgres -p 'test_privacy_p0_runner.py' -v
node scripts/privacy-p0-messaging-contract.mjs
```

Der letzte Befehl ist eine gezielte Abnahmepruefung des unveraenderten SQL-
Denial-Vertrags mit synthetischen RPC-Antworten. Er verwendet keine Verbindung.

**Nur in der freigegebenen Wegwerf-Testdatenbank:**

```sh
PYTHONDONTWRITEBYTECODE=1 python scripts/privacy-p0-acceptance.py --run-isolated
```

Keine Connection-URL uebergeben und kein Produktionsschema/Backup importieren.
Ist Docker oder das genehmigte lokale Image nicht verfuegbar, bricht der
Runner ab, statt eine andere Datenbank oder ein Image aus dem Netz zu verwenden.
Der Schalter ist eine bewusste Ausfuehrungsgrenze. Ein fehlgeschlagener Test
ist ein Abnahmefehler; er darf nicht durch Lockerung von Policies oder
Umgehen der Pause repariert werden.

## 2. Konkrete Abhaengigkeiten des Loeschpfades

[delete-forever](../app/api/requests/delete-forever/route.js) authentifiziert
ein aktives Admin-Teammitglied und ruft mit dessen serverseitig ermittelter
Mitglieds-ID `privacy_delete_request` auf. Die Funktion ist in der noch nicht
angewendeten
[Migration](../supabase/migrations/20261028010000_privacy_delete_request.sql)
als `SECURITY INVOKER` angelegt und nur fuer `service_role` freigegeben.
Sie sperrt die Anfragezeile, klassifiziert bekannte Aufbewahrungsblocker und
loescht nur nach erfolgreicher Pruefung Anfrage plus requestgebundene
Kurzzeit-Challenges in derselben Transaktion. Bekannte Blocker kommen als
HTTP 409 mit nicht-personenbezogenen Codes zurueck; unerwartete FK-Fehler
rollen die RPC-Transaktion zurueck und werden ebenfalls als Blockade
behandelt. Fehlendes RPC, fehlende Berechtigung oder ungueltiges Resultat
schlagen fail-closed als 503 fehl.

| Bezug | Im Repository nachgewiesen | Auswirkung auf die aktuelle Route |
|---|---|---|
| `request_care_assignments.request_id` | Neuer FK `ON DELETE RESTRICT`; eine aktuelle Episode entsteht bereits beim Insert mit Coach | Auch normale neue Anfragen werden direkt loeschblockiert |
| `request_care_transfers.request_id` | Neuer `RESTRICT`-FK | Transferhistorie blockiert dauerhaft; keine automatische Frist |
| `request_health_authorizations.request_id`, `.consent_id`, `.care_episode_id` | Neue `RESTRICT`-FKs | Anfrage-, Beleg- und Periodenbereinigung voneinander abhaengig |
| `request_care_operations.request_id` | Neuer `RESTRICT`-FK, auch nach `completed_at` | Abschliessen einer Operation hebt ihre Loeschblockade nicht auf |
| `request_conversations.anfrage_id` | Bestehender `RESTRICT`-FK aus Messaging-Foundation | Auch geschlossene Conversations blockieren |
| `request_messages.anfrage_id`, `(conversation_id, anfrage_id)` | Bestehende `RESTRICT`-FKs | Anfrage und Conversation koennen nicht einfach geloescht werden |
| `request_message_events` | Keine Anfrage-/Conversation-FK; providerbezogene Event-ID | Nicht automatisch bereinigt; keine pauschale sichere Zuordnung allein ueber Anfrage-ID |
| `anfragen_reengagement_log.anfrage_id` | Bestehender `RESTRICT`-FK | Auch erledigte Versandversuche koennen blockieren |
| `anfrage_health_data_consents.request_id` | Im Consent-Foundation-SQL absichtlich ohne FK | Kein automatisches Cascade; Belege koennen nach Elternloeschung zurueckbleiben |
| `client_link_recovery.request_id` | `ON DELETE CASCADE` | Die RPC loescht gebundene Kurzzeit-Challenges explizit vor dem Parent; unbekannte FK-Fehler rollen beides zurueck |
| `client_link_recovery_queue.request_id` | Nullable-Textfeld ohne FK; zusaetzlich Empfaenger/verschluesselter Payload | Jede passend gebundene Queuezeile blockiert; Inserts/Updates auf eine Anfrage sperren die Elternzeile. Nicht-UUID-Werte werden abgewiesen. Vorhandene nicht-leere ungueltige IDs blockieren konservativ alle Endloeschungen, bis sie organisatorisch geklaert sind. |
| Sessions, Rechnungen, Slots, Proposals und weitere Altobjekte | Vollstaendiges produktives Grundschema nicht im Repository | Reale FKs/Trigger nicht nachgewiesen. `RESTRICT` im Testmodell ist eine explizite Annahme, keine Produktionsfeststellung |

Die RPC loescht **keine** Consentbelege, Care-/Transfer-/Operationshistorie,
Nachrichten/Conversations, Re-Engagement-Protokolle, Recovery-Queue-Eintraege,
Sessions, Rechnungen, sevDesk-Referenzen, Kalender-Slots oder Proposals.
Unklassifizierte FK-Abhaengigkeiten fuehren zu einem Rollback statt zu einer
Teilbereinigung. `request_message_events` hat in der bekannten Foundation
keinen Anfrage-FK und wird weder geloescht noch als Anfrage-Abhaengigkeit
klassifiziert.

Vor Produktivsetzung bleiben Retentionsentscheidungen fuer die genannten
Datentypen sowie der Umgang mit Backups und nicht zuordenbaren Queue-Daten
erforderlich. Die lokale Kandidatenlogik ist keine rechtliche Feststellung,
dass eine Blockade fuer alle Faelle erforderlich oder dauerhaft zulaessig ist.
Es werden **keine Fristen oder sofortigen Loeschpflichten erfunden** und keine
Bereinigungsanweisungen fuer vorhandene Daten erzeugt.

## 3. Produktivschema-Abgleich: vorbereitet, nicht ausgefuehrt

Die neue
[read-only Preflight-Abfrage](../scripts/privacy-p0-schema-preflight.sql)
liest ausschliesslich PostgreSQL-Kataloge und `information_schema`. Sie
berichtet Tabellen/Spalten, Fremdschluessel, RLS/Policies, Rollen/
Mitgliedschaften, Tabellen- und Spaltengrants, Trigger, Realtime-
Publikationen, View-Abhaengigkeiten, RPC-Rechte und Default-ACLs. Sie fragt
keine Anwendungsdaten, Secrets oder personenbezogenen Werte ab.

Der Vergleich ist derzeit nur ein Repository-/Testmodell-Abgleich:

- Die Foundation-Migrationen definieren Messaging
  (`20260901000000_request_messaging_foundation.sql`), Re-Engagement
  (`20261005000000_admin_reengagement_log.sql`), Recovery
  (`20261016000000_client_link_recovery.sql`) und Consent
  (`20261017000000_anfrage_health_data_consent.sql`).
- Im Repository sind Messaging-Conversations und -Messages sowie
  Re-Engagement-Logs mit `ON DELETE RESTRICT` an Anfragen gebunden.
  `client_link_recovery.request_id` ist ein UUID-FK mit `ON DELETE CASCADE`;
  die Recovery-Queue nutzt dagegen ein nullable Textfeld ohne FK.
  Consent-Nachweise haben in der Foundation keinen Anfrage-FK.
  Care-Assignments, Transfers, Health-Authorizations und Care-Operations
  verwenden die neuen `RESTRICT`-FKs aus dem P0-Zugriffsentwurf.
  `request_message_events` hat in der Messaging-Foundation keinen Anfrage-
  oder Conversation-FK.
- Die Foundation-Migrationen schalten RLS ein und entziehen Browserrollen
  Zugriff auf Consent-, Recovery-, Re-Engagement- und Messagingtabellen;
  Messaging-Policies gewaehren authentifizierten Coaches selektives Lesen.
  Der P0-Entwurf ersetzt diese durch aktuelle Betreuungs-/Consentpruefungen,
  sperrt Browserzugriffe auf sensible Basistabellen und fuehrt weitere
  Trigger/RPC-Grenzen ein. Das Testfixture erzeugt Rollen `anon`,
  `authenticated` und `service_role` selbst; dessen `service_role` hat
  `BYPASSRLS`. Es belegt keine produktiven Rollenattribute,
  Mitgliedschaften oder Default-Grants.
- Die gelesenen Foundation-/P0-Migrationen definieren keine Views und
  konfigurieren keine Realtime-Publikation. Das Fixture bildet deshalb
  keinen vollstaendigen Bestand bestehender Views oder Publications ab.
  Trigger/Policies aus den eingeschlossenen Migrationen werden im Runner
  erzeugt; sonstige produktive Trigger und Policies sind nicht verifiziert.
- Der P0-Entwurf `20261028000000_privacy_phase1_access.sql` und der neue
  Loeschentwurf setzen bereits vorhandene Basistabellen und Rollen voraus.
  Das synthetische Fixture modelliert diese nur fuer Tests; es ist kein
  vollstaendiger Create-/Schema-Export der produktiven Supabase-DB.
- Deshalb sind konkrete Unterschiede zur produktiven Struktur, einschliesslich
  realer FKs, weiterer Trigger, Policies, Rollenmitgliedschaften, Grants,
  Views und Realtime-Konfiguration, **nicht verifiziert**.
- Das Preflight-SQL ist vorbereitet, aber gegen keine Datenbank ausgefuehrt.
  Auch ein produktiver read-only Aufruf benoetigt eine gesonderte Freigabe.

## 4. Inhalts-Messaging: Pause und echter Vertragsblocker

### Bewusst nicht aktiviert

- SQL: [privacy_messaging_context](../supabase/migrations/20261028000000_privacy_phase1_access.sql)
  und `privacy_coach_can_read` enthalten eine explizite unerfuellbare
  Messaging-Bedingung (`and false`). Intake-Consent reicht nicht aus.
- JavaScript: [getMessagingDispatchAvailability](../app/lib/messaging/access.js)
  verweigert Inhaltsversand unabhaengig von einer positiven synthetischen
  Access-Antwort. Kein konfigurierbarer Aktivierungsschalter.
- API-, Outbound-, Inbound- und Retrypfade brechen vor Bodyabruf/-versand ab;
  SQL-Trigger blockieren neue Inhalte und aktive Conversations.
  Es wird keine neue Kommunikationsfreigabe aus alten Intake-Belegen erzeugt.

### Nachgewiesener SQL-/JavaScript-Vertragsfehler

Der [offline Vertragsprobe](../scripts/privacy-p0-messaging-contract.mjs)
uebergibt der echten
[authorizeMessagingContext](../app/lib/messaging/access.js)
die unveraenderten Denial-JSONs aus dem SQL-Entwurf:

| Tatsachliches SQL-JSON | Erwarteter und jetzt tatsaechlicher JS-Status |
|---|---|
| `{"allowed":false}` | `MESSAGING_ACCESS_DENIED` |
| `{"allowed":false,"reason":"MESSAGING_CONTENT_PAUSED"}` | `MESSAGING_CONTENT_PAUSED` |

Grund: Der Adapter verlangt `requestId`, `conversationId` und `careVersion`
Die urspruengliche Implementierung verlangte `requestId`, `conversationId`
und `careVersion` bereits vor der Behandlung von `allowed:false`. SQL liefert
diese bei Ablehnung bewusst nicht. Die bisherigen
[Adaptertests](../tests/lib/messagingAccess.test.js) reichern Denials mit
einem vollstaendigen erlaubten Kontext an und erkennen den Fehler deshalb nicht.

**Kein nachgewiesener Bodyzugriff:** Der Fehler bleibt fail-closed. Er
vermischt jedoch Berechtigungsablehnung, Betriebs-Pause und echten
Infrastrukturfehler; API-/Webhook-Status und Behandlung sind so nicht korrekt
abnehmbar. Der Adapter behandelt jetzt `allowed:false` zuerst und ordnet die
minimalen SQL-Denials korrekt zu, ohne IDs nachzuladen. Regressionstests
verwenden exakt die SQL-Payloads. Die Dispatchfunktion bleibt separat und
unveraendert deaktiviert.

### Technische Bedingungen vor einer spaeteren Messaging-Aktivierung

Dies ist eine Abnahmegrenze, keine neue Architekturvorlage:

- Freigegebener eigener Kommunikationszweck/Notice und aktuelle
  Coach-/Periodenbindung; Intake-Nachweis nicht umdeuten.
- Konsistenter Denial-Vertrag, aktive/neue Conversation ohne Altverlauf,
  nicht wiederbelebbarer alter Reply-Alias und eigener administrativer
  Inhaltszugriff nur nach ausdruecklicher Zweckfreigabe.
- Datenbankseitig abgesicherte Dispatch-/Queue-Grenze fuer Widerruf,
  Coach-Wechsel, Inbound-Weiterleitung und Retries. Ein separates
  `authorize -> read/send` ist kein atomarer Nachweis.
- Provider-Idempotenz und kontrollierter Umgang mit bereits angenommenem
  oder unbekanntem Versand; kein blinder Retry, kein bloesser Claim-Timeout.
  Bereits ausgelieferte E-Mails sind nicht rueckholbar.
- Erst danach positive und negative echte DB-/API-Tests, einschliesslich
  Widerruf/Wechsel waehrend eines Dispatchs. Aktuelle Terminclaims ersetzen
  diesen Nachweis nicht.

Eine Produktivsetzung **mit unveraendert pausiertem Inhalts-Messaging**
benoetigt eine ausdrueckliche Betriebsfreigabe fuer diese Funktionseinschraenkung.
Eine Aktivierungsfreigabe ist davon getrennt und derzeit technisch nicht reif.

## 5. Kurze Checkliste fuer die spaetere Produktivsetzung

- [x] Isolierten synthetischen PostgreSQL-Testlauf ausfuehren: Image-ID,
  SQL-Hashes, Ergebnisse und erfolgreiche Containerentfernung sind im
  Runnerprotokoll nachgewiesen; alle SQL-/RLS-/Trigger-/19 Paralleltests
  bestanden.
- [x] Den Messaging-Denial-Vertragsfehler korrigieren und testen;
  Inhalts-Messaging bleibt dabei pausiert.
- [ ] Umgang mit Loeschblockaden freigeben und testen. Keine pauschale
  Cascade-/Aufbewahrungsentscheidung im Migrationsrollout verstecken.
- [ ] Katalog-Preflight nach gesonderter Freigabe read-only gegen das
  freigegebene Ziel ausfuehren; Ergebnisse ohne Anwendungsdaten vergleichen
  und reale Schemaabweichungen vor Rollout behandeln.
- [ ] Verantwortlichen, zeitlich begrenzten Ablauf fuer unklare/offene
  Providerclaims und historische Rechnungskorrekturen festlegen und abnehmen;
  keine automatische Claimfreigabe oder Aenderung historischer Werte.
- [ ] Empfaenger-Notice, erneute Freigabe von Altfaellen, Widerrufsablauf
  sowie den Betrieb mit pausiertem Messaging organisatorisch bestaetigen.
- [ ] Gesonderten Schema-/Rollen-/Grants-/Views-/Realtime-Abgleich genehmigen;
  reale Typen/Alttrigger mit dem Testmodell vergleichen. Browser-/API-Smoke-
  und Provider-Doubles gegen das freigegebene isolierte Schema abnehmen.
- [ ] Backup-/Restore-Nachweis, abgestimmtes Wartungsfenster,
  Worker-/Traffic-Pause und koordinierte Schema-/Code-/Recovery-Reihenfolge
  sowie einen Rollback ohne Wiedereroeffnung alter Datenrechte freigeben.
  Erst dann getrennte Freigabe fuer produktive Migration und Deployment.

## 6. Tatsaechliche Ergebnisse

- **Isolierte PostgreSQL-Abnahme bestanden:** echte Migrationen und SQL-
  Assertions liefen in PostgreSQL 15, Image-ID
  `sha256:f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81`.
  Container war `network=none`, ohne Hostports/Bindmounts und mit ausschliesslich
  `tmpfs`-Daten; anschliessend entfernt und Containerliste auf Reste geprueft.
- **Migration-Rollback bestanden:** kuenstlich injizierter Fehler vor Commit
  hinterliess weder DDL noch Grant-Aenderungen.
- **18 echte Lock-Barrierefaelle bestanden**, darunter Widerruf/Read/Save,
  Wechsel/Read/Claim, gleichzeitige/idempotente Transfers, Sessioninsert,
  Invoice-save und Session-delete Rennen.
- RLS, Alt-/Spaltengrants, Rollenidentitaet, RPC-EXECUTE, Trigger, neue
  Empfaengerfreigabe, Widerruf, A->B->A, Zukunftskonflikte, alte Nachrichten,
  unveraenderte Sessions/Rechnungen/sevDesk- und Event-IDs sowie erwartete
  Loeschblockaden bestanden auf dem synthetischen Modellschema.
- Frueherer Stand: **828 Tests in 64 Vitest-Dateien bestanden** sowie 18
  Parallelfaelle; diese Ergebnisse sind vor dem neuen Loeschmigrationskandidaten.
- Aktuelle isolierte PostgreSQL-Abnahme: **19 Lock-Barrierefaelle und alle
  SQL/RLS/Trigger-Assertions bestanden**, einschliesslich Transaktionsrollback,
  Blockerkategorien, erfolgreichem Challenge-Cleanup, unbekannter FK-
  Abhaengigkeit und unveraenderter Rechnungs-/sevDesk-/Kalenderreferenzen.
  PostgreSQL 15 Image-ID:
  `sha256:f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81`.
  Containernetzwerk `none`, Daten nur in `tmpfs`; Container danach entfernt.
- Aktueller Loeschpfad-Stand: **23 gezielte Vitest-Tests bestanden** in
  `deleteForever.test.js`, `privacyDeleteMigrationContract.test.js` und dem
  angepassten `staffOwnershipRoutes.test.js`; ausserdem **10 Offline-Runner-
  Sicherheitstests bestanden**, Python-Syntaxpruefungen und die pausierte
  Messaging-Vertragsprobe bestanden.
- Nach den Dokumentations- und Vertragskorrekturen bestand die vollstaendige
  lokale Vitest-Suite: **839 Tests in 66 Dateien**.
- SQL-Assertions, 19. Parallelfall und Migration-Rollback wurden im aktuellen
  isolierten Lauf ausgefuehrt und bestanden.
- `privacy-p0-schema-preflight.sql` wurde vorbereitet und **gegen keine DB**
  ausgefuehrt. Daher besteht kein produktiver Schemaabgleich.
- Kein echter Provider, keine produktive DB, kein Produktionsdatensatz und
  kein Deployment.
- **Fehlgeschlagene Versuche waehrend der Iteration:** Der erste Lauf mit der
  neuen Loeschsuite traf eine doppelt belegte synthetische Fixture-ID; diese
  wurde korrigiert und der vollstaendige Lauf anschliessend bestanden. Der
  fruehere Initial-Save-Assertion-Fehler und Messaging-Denial-Mismatches sind
  ebenfalls behoben. Im abschliessenden Lauf blieb kein fehlgeschlagener Test.
- **Verbleibende Blocker:** Das Test-Fixture ist ein kuenstliches Grundschema, kein
  Abbild der tatsaechlichen Supabase-Installation. Reale Typen, FKs, Trigger,
  Rollenmitgliedschaften, Default-Grants, Policies/Views und Realtime bleiben
  unvalidiert. Fuer den produktiven Abgleich braucht es eine gesonderte
  Freigabe fuer den read-only Katalog-Preflight.

## 7. Nachtrag: gezielter Session-INSERT-Lockdown

Der Nutzer hat die offene produktive Policy und INSERT-Grants gemeldet;
es fand kein Produktivzugriff zur Verifikation statt.
Die damals neu vorbereitete
[Lockdown-Migration](../supabase/migrations/20261028020000_sessions_insert_lockdown.sql)
wurde inzwischen laut Nutzer am 28.10.2026 produktiv angewendet und mit
sieben positiven Metadatenpruefungen auf Berechtigungsebene verifiziert
(kein produktiver End-to-End-Test). Sie entfernt die benannte
offene Policy und widerruft nur Session-INSERT-Tabellen-/Spaltenrechte fuer
`PUBLIC`, `anon`, `authenticated`; keine Datenmutation, keine neue RPC und
kein Entzug legitimer Backendrechte.

Aktuell ausgefuehrt, ausschliesslich lokal:

- **847 Vitest-Tests in 67 Dateien bestanden**, darunter 136 gezielte Tests
  fuer Session-Lockdown-Vertrag, Termin-/Sessionrouten, historische Abrechnung
  und sevDesk-Route.
- Fuenf neue synthetische Erfolgsfaelle in
  [appointmentCareProtections.test.js](../tests/api/appointmentCareProtections.test.js)
  erreichen den Session-INSERT ueber die echten Routen fuer Einzel-/Batch-
  Erfassung als Coach/Admin sowie tokenbasierte Folgebuchung. Datenbank,
  Kalender und Mailanbieter sind dabei gemockt; kein Provideraufruf.
- **10 Offline-Runner-Sicherheitstests bestanden**, Messaging-Vertragsprobe
  bestaetigt weiter pausierten Inhaltsversand; `git diff --check` bestanden.
- Ein erster Vitest-Versuch traf eine unvollstaendige simulierte
  Mailbestaetigung im neuen Buchungs-Erfolgsfall. Der Mock wurde korrigiert,
  gezielter und vollstaendiger Wiederholungslauf bestanden.

Im anschliessend separat freigegebenen einmaligen PostgreSQL-15-Lauf
**ausgefuehrt und bestanden**:

- Standalone-PostgreSQL-Test mit der konkret gemeldeten offenen RLS-Policy,
  Tabellen- und INSERT-Spaltengrants als Ausgangszustand; anschliessend
  echte `42501`-Denials fuer `anon`/`authenticated` bei passend zugeordnetem
  Coach und bei `DEFAULT VALUES`, unveraenderte andere Rechte und erlaubter
  `service_role`-INSERT.
- Kombinierte P0-SQL-Suite mit zusaetzlichen Session-INSERT-Denials und
  erlaubtem Backend-INSERT trotz neuer Care-Trigger.
- Historische Finanz-/Providerreferenzen werden gegen den synthetischen
  Snapshot geprueft. Der Runner testet den Standalone-Lockdown absichtlich
  vor dem breiteren P0-Grantentzug; das ist eine Testreihenfolge, keine
  automatische produktive Migrationsanwendung.

Alle bisherigen SQL-/RLS-/Trigger-Assertions, Migration-Rollback sowie
**19 Lock-Barrierefaelle** bestanden erneut. Image-ID:
`sha256:f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81`.
Neuer Container mit `network=none`, ohne Hostports/Bindmounts und Daten nur
in `tmpfs`; nach dem erfolgreichen Lauf entfernt und Entfernung geprueft.
Keine Regression im ausgefuehrten Umfang; kein Produktionskompatibilitaetsbeweis.

Vor Produktivsetzung: Offline-Abgleich verfuegbarer Schema-/Berechtigungs-
unterlagen und menschlich freigegebener Rollout erforderlich. Die
[manuelle Anleitung](privacy-p0-manual-rollout.md) enthaelt exaktes Hotfix-SQL,
Metadaten-Vor-/Nachpruefung, Sicherung und Fail-closed-Wiederherstellung.
Produktivzugriff durch den Agenten bleibt ausdruecklich untersagt, auch
read-only und auch fuer den vorhandenen Katalog-Preflight. Die Anleitung
selbst erteilt keine Freigabe zur manuellen SQL-Ausfuehrung. Dieser Absatz
beschreibt die Vorbereitung vor der inzwischen vom Nutzer bestaetigten
Hotfix-Anwendung; aktueller Produktivstatus siehe Dokumentanfang.
