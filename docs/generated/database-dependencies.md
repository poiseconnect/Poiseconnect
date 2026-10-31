# Datenbankabhängigkeiten – Trigger, RPCs, Objekt- und API-Bezüge

> Manuell gepflegte Architekturreferenz (kein Generator-Artefakt).
> Verbindlichkeitskategorien (REPO / PROD / UNVERIFIZIERT) wie in
> [database-schema.md](./database-schema.md). Stand: 2026-10-31.
> Objekte mit Quelle `20261022…` existieren nur im uncommitteten
> Arbeitsbaum (laufende sevDesk-Arbeiten), nicht im Release-Commit und
> nicht produktiv.
> Tabellennutzung pro Datei: [database-usage.md](./database-usage.md);
> Routenübersicht: [api-map.md](./api-map.md).

## Triggerinventar (Soll-Zustand nach allen Migrationen)

Trigger gleicher Phase feuern alphabetisch nach Triggernamen. „(P0)“ =
erst nach Anwendung von `20261028000000_privacy_phase1_access.sql`,
produktiv noch nicht vorhanden. Nicht aufgeführte, produktiv eventuell
vorhandene Fremdtrigger sind UNVERIFIZIERT (Preflight-Gegenstand).

### `anfragen`

| Trigger | Phase/Ereignis | Funktion | Quelle |
|---|---|---|---|
| `privacy_assignment_guard` (P0) | BEFORE UPDATE OF `assigned_therapist_id`, `care_version`, `care_episode_id` | `privacy_assignment_guard()` – blockiert Coachwechsel außerhalb atomarer Transfers (`privacy.transfer_request`-GUC), schließt offene Conversations | `20261028000000…` |
| `anfragen_coach_billing_creation_guard` | BEFORE UPDATE OF `invoice_with_vat`, `beschaeftigungsgrad` | `guard_coach_billing_source_change()` – Fehler bei laufender sevDesk-Erstellung | `20261011…` |
| `privacy_initialize_care` (P0) | AFTER INSERT | `privacy_initialize_care()` – legt erste Betreuungsperiode an, setzt `care_episode_id` | `20261028000000…` |
| `anfragen_coach_quarter_release_invalidation` | AFTER UPDATE OF `invoice_with_vat`, `beschaeftigungsgrad` (WHEN distinct) | `invalidate_coach_quarter_on_anfrage_change()` → `mark_coach_quarter_stale` je Session | `20261009…` |

### `sessions`

| Trigger | Phase/Ereignis | Funktion | Quelle |
|---|---|---|---|
| `privacy_session_care_guard` (P0) | BEFORE INSERT | `privacy_care_child_guard()` – verlangt `therapist_id` = `anfragen.assigned_therapist_id` (bei gesetzter `anfrage_id`) | `20261028000000…` |
| `sessions_coach_billing_creation_guard` | BEFORE INSERT/DELETE/UPDATE OF `date`,`price`,`therapist_id`,`anfrage_id` | `guard_coach_billing_source_change()` | `20261011…` |
| `sessions_coach_quarter_release_invalidation` | AFTER INSERT/DELETE/UPDATE OF dto. | `invalidate_coach_quarter_on_session_change()` | `20261009…` |

BEFORE-INSERT-Reihenfolge: `privacy_session_care_guard` →
`sessions_coach_billing_creation_guard` (alphabetisch); beide validieren
nur bzw. werfen Fehler, verändern NEW nicht → reihenfolgeneutral.

### `blocked_slots` / `appointment_proposals`

- `privacy_slot_care_guard` (P0), `privacy_proposal_care_guard` (P0):
  BEFORE INSERT, `privacy_care_child_guard()`; bei Proposals wird
  zusätzlich `care_version` aus der Anfrage gestempelt.

### `request_conversations` / `request_messages`

- `privacy_conversation_guard` (P0): BEFORE INSERT OR UPDATE – neue/offene
  Conversations nur bei erlaubtem `privacy_messaging_context`; stempelt
  `care_episode_id`; geschlossene Conversations nie wieder öffnen.
  **Da der Messaging-Scope hart pausiert ist, schlägt nach P0 jedes
  Anlegen einer offenen Conversation fehl (beabsichtigt), auch über
  `ensure_open_request_conversation`.**
- `privacy_message_write_guard` (P0): BEFORE INSERT OR UPDATE OF
  `text_body`,`html_body`,`subject` – blockiert Inhalts-Schreibpfade
  (`MESSAGE_PROCESSING_NOT_AUTHORIZED`).

### `coach_invoices`

| Trigger (Feuerreihenfolge) | Ereignis | Funktion |
|---|---|---|
| `coach_invoice_00_link_write_guard` | BEFORE INSERT/UPDATE/DELETE | `guard_coach_invoice_link()` – sevDesk-Link nur im Übergang `creating→created`, Claim-Insert, Quarantäne-IDs, Advisory-Lock je externer ID |
| `coach_invoice_creation_write_guard` | BEFORE UPDATE/DELETE | `guard_coach_invoice_creation_update()` – Zustandsmaschine `creating`/`creation_unknown`, Löschschutz |
| `coach_invoice_source_snapshot_guard` | BEFORE INSERT/UPDATE | `guard_coach_invoice_source_snapshot()` – Quartalsdrafts nur mit aktuellem `billing_source_snapshot` |

Das `00`-Präfix erzwingt, dass der Link-Guard vor den übrigen Guards läuft.

### Weitere Tabellen

- `coach_quarter_releases`: `coach_quarter_releases_billing_creation_guard`
  (BEFORE I/U/D → `guard_coach_billing_source_change()`).
- `therapist_invoice_settings`:
  `therapist_invoice_settings_uid_confirmation_guard` (BEFORE UPDATE OF
  `vat_number`,`business_country_code` → nullt UID-Bestätigung),
  `therapist_settings_coach_billing_creation_guard` (BEFORE I/U/D),
  `therapist_settings_coach_quarter_release_invalidation` (AFTER …).
- `team_members`: `team_members_coach_billing_creation_guard` (BEFORE
  UPDATE-of-Spalten OR DELETE),
  `team_members_coach_quarter_release_invalidation` (AFTER UPDATE WHEN
  distinct).
- `client_link_recovery_queue`: `privacy_lock_recovery_queue_request`
  (BEFORE INSERT/UPDATE OF `request_id`) – **nur Löschmigration
  `20261028010000…`**, nicht produktiv.

## Funktionsabhängigkeiten (Aufrufgraph)

- `release_coach_quarter` → `guard_coach_billing_write` →
  `lock_coach_billing`; → `coach_quarter_snapshot`
- `reserve_coach_invoice_creation(5)` → `lock_coach_billing`,
  `check_coach_invoice_link`, `coach_quarter_snapshot`; schreibt
  `coach_invoice_admin_decisions`; 4-Param-Wrapper → 5-Param-Version
- `mark_coach_quarter_stale` → `lock_coach_billing`; aufgerufen von
  `invalidate_coach_quarter_on_session_change` und
  `invalidate_coach_quarter_on_anfrage_change`
- `guard_coach_billing_source_change` → `guard_coach_billing_write`
- `guard_coach_invoice_link` → `check_coach_invoice_link`; INSERT in
  `coach_invoice_sevdesk_claims`
- `guard_coach_invoice_source_snapshot` → `guard_coach_billing_write`,
  `coach_quarter_snapshot`
- `process_client_link_recovery_queue` → `issue_client_link_recovery`
- P0: `privacy_read_request_health` / `privacy_messaging_context` /
  `privacy_coach_can_read` → `privacy_consent_allows` (→
  `request_health_authorizations`, `request_care_assignments`);
  `privacy_read_request_health` → `privacy_health_payload`;
  `privacy_authorize_recipient` / `privacy_handover_request` →
  `privacy_check_transfer_conflicts`; `privacy_message_write_guard` /
  `privacy_conversation_guard` → `privacy_messaging_context`;
  `privacy_read_messages` → `privacy_messaging_context`
- Advisory-Lock-Schlüssel: `lock_coach_billing` =
  `hashtextextended(coach_id, 752941)`; Link-Guard =
  `hashtextextended('sevdesk-invoice:'||id, 752942)`; Quarter-Release
  (alt, `20261009…`) = `hashtext(coach_id), year*10+quarter`.
- GUC-Kopplung (P0): `privacy.transfer_request` verbindet
  `privacy_initialize_care` / `privacy_authorize_recipient` /
  `privacy_handover_request` mit dem `privacy_assignment_guard`.

## RPC → Aufrufer im Code

| RPC | Aufrufer |
|---|---|
| `reserve_reengagement_attempt` | `app/api/admin-reengage/route.js` |
| `ensure_open_request_conversation`, `close_open_request_conversation` | `app/lib/messaging/conversations.js` |
| `release_coach_quarter` | `app/api/therapist/quarter-release/route.js` |
| `coach_quarter_snapshot` | `app/api/invoices/recalculate-coach/route.js` |
| `coach_invoice_admin_workflow_ready` | `app/lib/coachQuarterWorkflowReadiness.js` |
| `check_coach_invoice_link` | `app/lib/coachInvoiceLink.js` |
| `enqueue_client_link_recovery` | `app/api/client-link-recovery/request/route.js` |
| `claim/process/finish/retry_client_link_recovery_queue` | `app/api/cron/client-link-recovery/route.js` |
| `consume_client_link_recovery` | `app/api/client-link-recovery/consume/route.js` |
| `privacy_grant_intake_consent`, `privacy_revoke_intake_consent`, `privacy_authorize_recipient` | `app/api/intake-consent/route.js` |
| `privacy_save_intake` | `app/api/form-submit/route.js`, `app/api/create-request-draft/route.js` |
| `privacy_read_public_health` | `app/api/public-request/route.js` |
| `privacy_read_request_health`, `privacy_messaging_context`, `privacy_handover_request` | `app/lib/intakeAccess.js` (genutzt u. a. von `app/api/coach-handover/route.js`, `app/api/dashboard/requests/route.js`, `app/api/forward-request/route.js`) |
| `privacy_appointment_context`, `privacy_begin/end_appointment_operation` | `app/lib/appointmentCare.js` |
| `privacy_save_client_invoice` | `app/api/invoices/save/route.js` |
| `privacy_delete_care_session` | `app/api/delete-session/route.js` |
| `privacy_delete_request` | `app/api/requests/delete-forever/route.js` – im Arbeitsbaum deaktiviert (`503 REQUEST_DELETE_DISABLED`), da die Löschmigration nicht angewendet ist |

`reserve_coach_invoice_creation` existiert als DB-RPC; der aktuelle
sevDesk-Erstellpfad reserviert zusätzlich über einen bedingten
Direkt-UPDATE auf `coach_invoices` – beide Wege laufen durch dieselben
Trigger-Guards. Die `privacy_*`-Aufrufer sind erst nach produktivem
P0-Rollout funktionsfähig; bis dahin führen fehlende RPCs zu einem
ausdrücklichen Fehler, nicht zum Altpfad.

## Auswirkungen auf Geschäftsprozesse

- **Buchung/Termine:** `sessions`- und `blocked_slots`-Schreibpfade laufen
  nach P0 durch Care-Guards (`assigned_therapist_id`-Bindung) und
  weiterhin durch die Billing-Guards. Terminoperationen verwenden nach P0
  persistente Reservierungen (`request_care_operations`); offene
  Operationen blockieren Handover (`FUTURE_APPOINTMENTS_REQUIRE_DECISION`
  bzw. Konfliktprüfung).
- **Messaging:** Conversation-Erzeugung nur nach serverseitiger
  Coach-Zuordnung (`ensure_open_request_conversation`); nach P0 ist
  Inhalts-Messaging vollständig pausiert, Coach-Lesezugriff läuft über
  `privacy_coach_can_read`. Handover schließt Conversations
  (`assignment_changed`) und gibt den Verlauf nicht an den neuen Coach.
- **Consent/Intake:** Formular-/Draft-Speicherung verlangt nach P0 aktiven
  Consent (`2026-10-16-v1`) plus Empfängerfreigabe
  (`2026-10-28-recipient-v1`) je Betreuungsperiode.
- **Handover:** idempotent über `operation_id`, optimistisch über
  `care_version`; A→B→A reaktiviert keine alten Freigaben (neue
  `care_episode_id`).
- **Abrechnung:** `sessions` bleibt führend. Quartalsworkflow:
  Snapshot-Release (`coach_quarter_releases`) → Draft mit
  `billing_source_snapshot` → Reservierung (`creating`) → sevDesk-Link mit
  Claim. Stale-Invalidation durch Quelländerungs-Trigger auf `sessions`,
  `anfragen`, `therapist_invoice_settings`, `team_members`;
  `creation_unknown` erfordert manuelle Reconciliation.
- **Löschung:** Endlöschung ausschließlich über `privacy_delete_request`
  mit klassifizierten Retention-Blockern; bis zur separaten Freigabe der
  Löschmigration ist der gesamte Pfad deaktiviert.

## P0-Kompatibilitätsanalyse (lokal)

Geprüft gegen alle Repository-Migrationen; Ergebnis: **kein belegter
lokaler Konflikt** der Zugriffsmigration `20261028000000…`.

1. **Vorbedingungen erfüllt:** Die ohne `if exists` gedroppten
   Messaging-Policies stammen aus `20260901…`;
   `anfrage_health_data_consents` (aus `20261017…`) besitzt die neuen
   Spalten `coach_id`/`superseded_at` noch nicht. Die Migration ist
   dadurch bewusst **einmalig** ausführbar (nicht idempotent).
2. **Sessions-Lockdown:** `20261028020000…` (produktiv seit 28.10.2026)
   ist eine Teilmenge der P0-Revokes; keine Richtungs- oder
   Policy-Kollision. Zeitstempel-Anomalie (020000 produktiv vor 000000)
   erfordert manuellen Historienabgleich, kein `db push`.
3. **Triggerinteraktion:** Keine Namenskollisionen; die neuen
   P0-BEFORE-Trigger validieren nur und kollidieren nicht mit den
   Billing-Guards (siehe `sessions`-Reihenfolge oben). Die beabsichtigte
   Härtung: Sessions-INSERTs mit `therapist_id ≠ assigned_therapist_id`
   werden nach P0 abgelehnt – durch die bestandenen Akzeptanztests
   (`tests/postgres/privacy-p0-acceptance.sql`,
   `…-session-inserts.sql`, `…-legacy-messaging.sql`) lokal abgedeckt.
4. **Messaging-Pause:** `ensure_open_request_conversation` schlägt nach
   P0 beim Anlegen offener Conversations fehl – beabsichtigter
   Sperrzustand, kein Konflikt.
5. **Löschmigration `20261028010000…`:** hängt von den Care-Tabellen der
   Zugriffsmigration sowie `anfragen_reengagement_log` und den
   Recovery-Tabellen ab; darf nie vor der Zugriffsmigration laufen und
   bleibt eigenständig zu bewerten.
6. **Verbleibendes Risiko ist kein lokaler Konflikt:** Der
   Kompaktpreflight vom 31.10.2026 hat produktiv bestätigt: keine
   unerwarteten Fremdtrigger, keine `privacy_*`-Funktionen, P0-Namen
   (Trigger/Policies/Care-Relationen) frei, kritische Spaltentypen wie
   erwartet, Sessions-Lockdown hält. Offen bleiben nur Befunde, die der
   Betreiber gegen die volle Preflight abgleicht (Views, eingehende FKs,
   nicht validierte Constraints, Policy-Definitionen), gemäß
   `docs/privacy-p0-phase1-rollout.md`.
7. **Billing-Trigger produktiv unvollständig:** Die Trigger aus
   `20261009…`/`20261011…` fehlen produktiv mindestens teilweise. Für die
   P0-Zugriffsmigration bedeutungslos (keine Abhängigkeit; die P0-Trigger
   auf `anfragen` reagieren auf `assigned_therapist_id`/`care_*`, die
   Billing-Guards auf `invoice_with_vat`/`beschaeftigungsgrad`). Vor
   Aktivierung des sevDesk-Quartalsworkflows müssen diese Migrationen
   gesondert produktiv angewendet werden.
8. **Eingehender FK `accounting_settings_therapist_id_fkey` →
   `team_members` (Preflight-Zeile 20, 31.10.2026): unkritisch.** Die
   Zugriffsmigration führt auf `team_members` weder DDL noch Revokes noch
   DELETEs aus (nur `select … for share`-Reads und neue ausgehende FKs
   der Care-Tabellen); auch die separate Löschmigration löscht keine
   `team_members`-Zeilen. `accounting_settings` ist eine nur produktiv
   vorhandene, im Code nicht referenzierte Tabelle (siehe
   [database-schema.md](./database-schema.md)); der FK bewirkt allein,
   dass referenzierte Teammitglieder nicht gelöscht werden können.
