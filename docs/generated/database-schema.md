# Datenbankschema – rekonstruierter Soll-Zustand

> Manuell gepflegte Architekturreferenz (kein Generator-Artefakt).
> Rekonstruiert aus allen SQL-Migrationen in `supabase/migrations/` in
> chronologischer und tatsächlicher Abhängigkeitsreihenfolge.
> Stand der Rekonstruktion: 2026-10-31 (Release-Commit
> `df009ed0b6d4d95dd5cf34b16fe26a09c6c9d638`).
> Pflegeregel: Bei jeder neuen Migration oder Schemaentscheidung dieses
> Dokument sowie `database-security.md` und `database-dependencies.md`
> aktualisieren.

Ergänzende Referenzen:

- Zugriffs- und Rechtemodell: [database-security.md](./database-security.md)
- Trigger, RPCs, Objekt- und API-Abhängigkeiten:
  [database-dependencies.md](./database-dependencies.md)
- Tabellennutzung pro Datei: [database-usage.md](./database-usage.md)

## Verbindlichkeitskategorien

Jede Aussage in den drei Datenbankreferenzen gehört zu genau einer Kategorie:

1. **Im Repository definiert (REPO):** Durch Migrationen belegter
   Soll-Zustand. Quelle ist immer eine konkrete Migrationsdatei.
2. **Produktiv bestätigt (PROD):** Durch vorliegende Supabase-Prüfungen
   belegter Ist-Zustand:
   - `20261028020000_sessions_insert_lockdown.sql` wurde am 28.10.2026
     manuell produktiv angewendet und anschließend erfolgreich geprüft
     (sieben Berechtigungsprüfungen bestanden).
   - Die EXECUTE-Korrektur aus
     `20261007000000_reengagement_function_execute_lockdown.sql` wurde laut
     Migrationskommentar bereits manuell produktiv ausgeführt und lesend
     verifiziert.
   - Der Betreiber hat bestätigt: alle Basistabellen existieren, RLS ist
     aktiv, die beiden alten Messaging-Policies sind vorhanden,
     `auth.uid()` und `gen_random_uuid()` existieren. Die acht P0-Spalten
     und die vier Care-Tabellen fehlen produktiv erwartungsgemäß.
3. **Produktiv nicht verifiziert (UNVERIFIZIERT):** Exakte DDL-Semantik der
   Basistabellen (Spaltentypen, Defaults, Constraints, Indizes, fremde
   Trigger/Policies/Views, effektive Rechte). Objektpräsenz ist bestätigt,
   Definitionen sind es nicht. Einzige freigegebene lesende Vorprüfung:
   `scripts/privacy-p0-schema-preflight.sql` (nur Kataloge, keine
   Anwendungsdaten).

Als produktiv vorhanden gelten nur die unter PROD genannten Prüfungen und
die vom Betreiber bestätigte Objektpräsenz. Die P0-Migrationen
`20261028000000_privacy_phase1_access.sql` und
`20261028010000_privacy_delete_request.sql` sind **nicht** produktiv
angewendet; `20261022000000_coach_invoice_admin_release.sql` liegt nur
uncommitted im Arbeitsbaum. Der GitHub-Stand ist nie automatisch der
Produktionsstand.

## Migrationschronologie

| Migration | Inhalt (Kurzform) | Status |
|---|---|---|
| `20260901000000_request_messaging_foundation.sql` | Messaging-Tabellen, 2 Coach-Read-Policies, 2 Conversation-RPCs | produktiv vorhanden (Betreiber: Tabellen + beide Policies) |
| `20260910000000_draft_recovery_foundation.sql` | 6 Draft-Recovery-Spalten auf `anfragen` | REPO; produktiv nicht einzeln verifiziert |
| `20260927000000_coach_invoice_lifecycle.sql` | UID-/Steuerfelder, UID-Invalidation-Trigger | REPO; produktiv nicht einzeln verifiziert |
| `20261005000000_admin_reengagement_log.sql` | `anfragen_reengagement_log`, Reservierungs-RPC | REPO; produktiv nicht einzeln verifiziert |
| `20261007000000_reengagement_function_execute_lockdown.sql` | EXECUTE-Entzug für Browserrollen | PROD (manuell angewendet, lesend verifiziert) |
| `20261008000000_sevdesk_coach_invoice_send_state.sql` | sevDesk-Send-State auf `coach_invoices` | REPO; produktiv nicht einzeln verifiziert |
| `20261009000000_coach_quarter_release.sql` | `coach_quarter_releases`, Snapshot-/Release-RPCs, Invalidation-Trigger | REPO; produktiv nicht einzeln verifiziert |
| `20261011000000_coach_invoice_creation_guards.sql` | Advisory-Locks, Billing-Write-Guards, Unique-Index | REPO; produktiv nicht einzeln verifiziert |
| `20261012000000_coach_invoice_link_guards.sql` | sevDesk-Link-Claims und Link-Guard-Trigger | REPO; produktiv nicht einzeln verifiziert |
| `20261016000000_client_link_recovery.sql` | Recovery-Tabellen und Queue-RPCs | REPO; produktiv nicht einzeln verifiziert |
| `20261017000000_anfrage_health_data_consent.sql` | Consent-Tabelle | produktiv vorhanden (Betreiber-bestätigt) |
| `20261022000000_coach_invoice_admin_release.sql` | Source-Snapshot-Bindung, Admin-Decisions, 5-Param-Reservierung | **nur Arbeitsbaum (uncommitted, laufende sevDesk-Arbeiten); NICHT in `df009ed`, NICHT produktiv** |
| `20261028000000_privacy_phase1_access.sql` | P0-Zugriffsmodell (8 Spalten, 4 Care-Tabellen, Browserrechte-Entzug, `privacy_*`) | **NICHT produktiv angewendet** |
| `20261028010000_privacy_delete_request.sql` | Endlöschpfad `privacy_delete_request` | **NICHT angewendet, separat zu bewerten** |
| `20261028020000_sessions_insert_lockdown.sql` | Sessions-INSERT-Sperre für Browserrollen | PROD (28.10.2026, verifiziert) |

Hinweis zur Reihenfolge: `20261028020000` wurde produktiv **vor**
`20261028000000` angewendet. Die Supabase-Migrationshistorie muss beim
späteren P0-Rollout manuell abgeglichen werden; kein blindes
`supabase db push` (siehe `docs/privacy-p0-phase1-rollout.md`).

## Basisschema (nicht im Repository migriert) – UNVERIFIZIERT

Die folgenden Tabellen existieren produktiv, werden aber von keiner
Repository-Migration angelegt. Ihre vollständige DDL ist nicht verifiziert.
Spaltenlisten sind aus Code-Nutzung, `AI_CONTEXT.md` und den Annahmen der
Migrationen rekonstruiert (Migrationen, die auf diese Spalten zugreifen,
setzen sie voraus). Das Testfixture
`tests/postgres/privacy-p0-fixture.sql` ist ein synthetisches Modell dieser
Annahmen, **kein** Produktionsexport.

### `anfragen`

Führende Tabelle für Klientenanfragen, Matching und Status.

- `id uuid` (PK, von Migrationen geprüft), `status text`,
  `match_state text`, `assigned_therapist_id uuid`,
  `wunschtherapeut`, `admin_therapeuten`, `bevorzugte_zeit`,
  `booking_token uuid`, `email`, `vorname`, `nachname`, `telefon`,
  `strasse_hausnr`, `plz_ort`, `geburtsdatum`, `beschaeftigungsgrad`,
  `coaching_typ`, `structured_time_preference`, `invoice_with_vat`,
  `meeting_link_override`
- Gesundheitsfelder (nur über P0-Payload-Whitelist zugreifbar nach Rollout):
  `themen`, `anliegen`, `leidensdruck`, `verlauf`, `diagnose`, `ziel`,
  `check_suizid`, `terminwunsch_text`
- Migrationszusätze (REPO):
  - `20260910…`: `draft_recovery_consent boolean not null default false`,
    `draft_recovery_consent_at timestamptz`,
    `draft_recovery_consent_version text`,
    `draft_last_activity_at timestamptz`, `draft_current_step integer`,
    `draft_reminder_sent_at timestamptz`
  - `20261005…`: `reengagement_last_sent_at timestamptz`
  - `20261028000000…` (nicht produktiv): `care_version bigint not null
    default 0`, `care_episode_id uuid`,
    `admin_coach_selection_version bigint`,
    `meeting_link_care_version bigint not null default 0`

### `team_members`

- `id uuid` (PK), `user_id uuid` (auth.users-Bezug), `active boolean`,
  `role text` (Systemrolle: `admin` / `therapist`), `email`, `name`,
  `profile_name`, `sevdesk_contact_id`, `available_for_intake boolean`
- Kein Migrationszusatz; Typen von `id`, `user_id`, `active`, `role` werden
  von `20260901…` als Vorbedingung geprüft.

### `sessions`

Führende Quelle für abrechenbare Sitzungen.

- `id uuid`, `anfrage_id uuid`, `therapist_id uuid`, `date`,
  `duration_min`, `price`, `commission`, `payout`, `google_event_id`
- Historische Konvention: `therapist_id` kann `team_members.id` **oder**
  `team_members.user_id` enthalten; `coach_quarter_snapshot` und die
  Billing-Guards berücksichtigen beide. Der P0-Care-Guard verlangt bei
  INSERT mit `anfrage_id` exakt `anfragen.assigned_therapist_id`.

### `invoices` (Coach→Klient-Rechnungen)

- `id uuid`, `anfrage_id uuid`, `therapist_id uuid`, `invoice_number`,
  `invoice_date`, `service_period`, `customer_number`, `contact_person`,
  `client_name`, `client_street`, `client_city`, `client_country`,
  `client_email`, `salutation`, `intro_text`, `payment_terms`,
  `closing_text`, `vat_rate`, `total_net`, `vat_amount`, `total_gross`,
  `line_items jsonb`, `updated_at`
- Spaltenliste entspricht der Whitelist von `privacy_save_client_invoice`.

### `blocked_slots`

- `id uuid`, `anfrage_id uuid`, `therapist_id uuid`, `start_at`,
  `end_at timestamptz`, `reason`, `google_event_id`
- Nur Sperrlogik, nie Abrechnungsquelle. Überschneidungsprüfung per
  Intervalllogik (`existing_start < new_end AND existing_end > new_start`).

### `appointment_proposals`

- `id uuid`, `anfrage_id uuid`, `therapist_id uuid`, `date`, `expires_at`,
  `google_event_id`; historische Zeilen können stattdessen
  `request_id`/`proposed_at` tragen (siehe `issue_client_link_recovery`).
- Migrationszusatz `20261028000000…` (nicht produktiv):
  `care_version bigint`.

### `coach_invoices` (Poise→Coach-Rechnungen)

Basisspalten (UNVERIFIZIERT): `id uuid`, `coach_id uuid`, `billing_mode`,
`billing_year`, `billing_quarter`, `bundle_key`
(`'normal_ust' | 'reverse_charge'`), `sevdesk_invoice_id`, `updated_at`.
Vorbedingung `20260927…`: Index `coach_invoices_unique_idx` muss existieren
(historisch, nicht im Repository definiert).

Migrationszusätze (REPO):

- `20260927…`: `tax_treatment text`, `tax_reason text`; Check
  `coach_invoices_tax_treatment_check`
  (`null | 'vat' | 'reverse_charge' | 'review_required'`)
- `20261008…`: `sevdesk_send_status text`,
  `sevdesk_send_requested_by uuid`, `sevdesk_send_created_at timestamptz`,
  `sevdesk_send_accepted_at timestamptz`, `sevdesk_send_email_id text`,
  `sevdesk_send_error_code text`; partieller Index
  `coach_invoices_sevdesk_send_status_idx`
- `20261009…`: `coach_quarter_release_version integer`,
  `sevdesk_draft_invoice_number text`; Check
  `coach_invoices_sevdesk_send_status_check` **ersetzt** (aktuell gültige
  Werte: `creating`, `creation_unknown`, `created`, `sending`,
  `send_failed`, `send_unknown`, `sent`, `finalized`)
- `20261011…`: partieller Unique-Index
  `coach_invoices_quarter_bundle_unique_idx`
  `(coach_id, billing_year, billing_quarter, bundle_key)` für
  `billing_mode = 'quartal'`
- `20261012…`: `sevdesk_creation_candidate_id text`
- `20261022…`: `billing_source_snapshot jsonb`

### Weitere Basistabellen ohne Repository-Migration

- `therapist_booking_settings`: `therapist_id`, `booking_enabled`,
  `selected_calendar_id`, `time_zone`, `meeting_link`
- `therapist_google_tokens`: OAuth-Tokens pro Coach (nur serverseitig)
- `therapist_invoice_settings`: Basis `therapist_id`, `company_name`,
  `address`, `default_vat_rate`; Zusätze `20260927…`:
  `business_country_code text`, `vat_number text`,
  `uid_confirmed_at timestamptz`, `uid_confirmed_by uuid`
- `confirmed_appointments`: von `app/api/booked/route.js` genutzt

## Durch Migrationen definierte Tabellen (REPO)

### Messaging (`20260901000000_request_messaging_foundation.sql`)

**`request_conversations`**

| Spalte | Typ / Constraint |
|---|---|
| `id` | `uuid` PK, default `gen_random_uuid()` |
| `anfrage_id` | `uuid` NOT NULL, FK → `anfragen(id)` ON DELETE RESTRICT |
| `therapist_id` | `uuid` NOT NULL, FK → `team_members(id)` ON DELETE RESTRICT |
| `status` | `text` NOT NULL default `'open'`, CHECK in (`open`,`closed`,`review`) |
| `reply_alias` | `text` NOT NULL, CHECK nicht leer; Unique-Index `request_conversations_reply_alias_key` |
| `reply_token_hash` | `text` NOT NULL, CHECK `^[a-f0-9]{64}$`; Unique-Index `…_reply_token_hash_key` |
| `alias_revoked_at`, `created_at`, `closed_at`, `close_reason`, `retention_until` | Status-/Lifecycle-Felder |
| `care_episode_id` | `uuid` – erst ab P0-Zugriffsmigration |

Zusätzlich: `unique (id, anfrage_id)` (Ziel des Composite-FK aus
`request_messages`), Status-Konsistenz-CHECK (open ⇒ nicht geschlossen,
closed ⇒ `closed_at` und `alias_revoked_at` gesetzt), partieller
Unique-Index `request_conversations_one_open_per_request_key`
(`anfrage_id` where `status='open'` – genau eine offene Conversation pro
Anfrage), Indizes auf `(therapist_id, status, created_at desc)` und
`(anfrage_id, created_at desc)`.

**`request_messages`**

- `id uuid` PK; `conversation_id uuid` + `anfrage_id uuid` gemeinsam NULL
  oder gemeinsam gesetzt (`request_messages_conversation_pair_check`);
  Composite-FK `(conversation_id, anfrage_id)` →
  `request_conversations(id, anfrage_id)` ON DELETE RESTRICT;
  `anfrage_id` zusätzlich FK → `anfragen(id)` ON DELETE RESTRICT
- `direction` CHECK (`outbound`,`inbound`); `sender_role` CHECK
  (`coach`,`client`,`system`); `delivery_status` CHECK (`queued`,`sent`,
  `received`,`forwarded`,`failed`,`review`)
- `provider_message_id`, `provider_email_id` (partieller Unique-Index),
  `provider_event_id`, `client_request_id` (partieller Unique-Index je
  Conversation), `subject`, `text_body`, `html_body`, `received_to_alias`,
  `created_at`, `retention_until`

**`request_message_events`**

- `id uuid` PK; `provider`, `provider_event_id` (zusammen UNIQUE),
  `event_type`, `received_at`, `processed_at`, `processing_error`
- Webhook-Idempotenzspeicher; keine Browserrechte.

### `anfragen_reengagement_log` (`20261005…`)

- `id uuid` PK; `batch_id uuid` NOT NULL; `anfrage_id uuid` NOT NULL FK →
  `anfragen(id)` ON DELETE RESTRICT; `status` CHECK (`queued`,`sent`,
  `failed`,`unknown`) default `queued`; `provider_message_id`,
  `error_code`, `created_by uuid` NOT NULL (team_members-Konvention, keine
  auth.users-Referenz), `reserved_at`, `finished_at`
- `UNIQUE (batch_id, anfrage_id)` – Grundlage der atomaren Reservierung;
  Indizes `(anfrage_id, reserved_at desc)` und `(batch_id)`
- Kein DELETE-Grant: Protokoll bleibt erhalten.

### `coach_quarter_releases` (`20261009…`)

- `id uuid` PK; `coach_id uuid` NOT NULL FK → `team_members(id)`
  ON DELETE CASCADE; `billing_year integer` NOT NULL;
  `billing_quarter integer` NOT NULL CHECK 1–4;
  `release_version integer` NOT NULL default 0;
  `release_status` CHECK (`released`,`stale`) default `stale`;
  `snapshot jsonb` NOT NULL; `released_at`; `released_by uuid` FK →
  `team_members(id)`; `updated_at` NOT NULL default now()
- `UNIQUE (coach_id, billing_year, billing_quarter)`; Index
  `(release_status, billing_year, billing_quarter)`

### `coach_invoice_sevdesk_claims` (`20261012…`)

- `sevdesk_invoice_id text` PK, CHECK `^[1-9][0-9]*$`;
  `coach_invoice_id uuid` NOT NULL UNIQUE FK → `coach_invoices(id)`;
  `created_at`
- Erzwingt Eindeutigkeit **neuer** sevDesk-Verknüpfungen auch bei
  REPEATABLE READ; bekannte historische Konflikte (IDs `135675889`,
  `135833778`) bleiben unverändert und sind dauerhaft quarantäniert.

### Client-Link-Recovery (`20261016…`)

- **`client_link_recovery_limits`**: `bucket timestamptz` + `key text`
  (Composite-PK), `attempts integer` – stündliche Rate-Limits
  (Quelle max. 10, E-Mail max. 3 Versuche/Stunde).
- **`client_link_recovery_queue`**: `id bigint identity` PK, `email`,
  `request_id text` (bewusst Text, UUID-Validierung erst im P0-Löschpfad-
  Trigger), `legacy_proposal`, `purpose`, `secret_hash`,
  `encrypted_secret`, `email_key`, `source_key`, `status` CHECK
  (`queued`,`processing`,`sent`,`no_match`), `attempts`, `available_at`,
  `locked_until`, `claim_token uuid`, `created_at`, `finished_at`;
  partieller Index auf `(available_at, created_at)` für offene Jobs.
  PII-Felder werden bei Abschluss genullt.
- **`client_link_recovery`**: `secret_hash text` PK;
  `request_id uuid` NOT NULL FK → `anfragen(id)` ON DELETE CASCADE
  (einzige CASCADE-Referenz auf `anfragen`); `recipient`,
  `token_fingerprint` (md5 des booking_token), `purpose` CHECK (`draft`,
  `coach-selection`,`appointment`,`proposal`), `created_at`,
  `expires_at` default now()+15min, `consumed_at`. Kurzlebige Challenges,
  Aufräumen nach 1 Tag.

### `anfrage_health_data_consents` (`20261017…`)

- `id uuid` PK; `request_id uuid` (nullable – Consent kann vor der Anfrage
  existieren, **kein FK**); `token_hash text` NOT NULL UNIQUE CHECK
  `^[a-f0-9]{64}$`; `text_version text` NOT NULL CHECK nicht leer;
  `granted_at` default now(); `revoked_at`
- Zusätze `20261028000000…` (nicht produktiv): `coach_id uuid`,
  `superseded_at timestamptz`
- Index `(request_id, granted_at desc)`. Gültige Textversion im Code und in
  den P0-Funktionen: `2026-10-16-v1`.

### `coach_invoice_admin_decisions` (`20261022…` – nur Arbeitsbaum, uncommitted)

- `id uuid` PK; `coach_invoice_id uuid` NOT NULL FK → `coach_invoices(id)`;
  `admin_id uuid` NOT NULL FK → `team_members(id)`; `confirmed_at`;
  `draft_updated_at timestamptz` NOT NULL; `source_snapshot jsonb` NOT
  NULL; `coach_release_version integer`; `decision` CHECK
  (= `'without_current_coach_release'`)
- Audit-Protokoll für Admin-Erstellung ohne aktuelles Coach-Release.

### Care-Tabellen (`20261028000000…`, NICHT produktiv)

- **`request_care_assignments`**: `id uuid` PK; `request_id uuid` NOT NULL
  FK → `anfragen(id)` RESTRICT; `coach_id uuid` NOT NULL FK →
  `team_members(id)` RESTRICT; `observed_at` default now(); `ended_at`;
  `unique (id, request_id, coach_id)`; partieller Unique-Index
  `request_care_assignments_one_current` (`request_id` where
  `ended_at is null`) – genau eine aktuelle Betreuungsperiode je Anfrage.
- **`request_care_transfers`**: `operation_id uuid` PK (Idempotenzschlüssel);
  `request_id`, `actor_id` (FK RESTRICT), `from_coach_id`, `to_coach_id`,
  `reason_code` CHECK (`not_match`,`therapist_change`),
  `expected_version bigint` NOT NULL, `result jsonb` NOT NULL,
  `created_at`.
- **`request_health_authorizations`**: `id uuid` PK; `consent_id` NOT NULL
  FK → `anfrage_health_data_consents(id)` RESTRICT; `request_id` FK →
  `anfragen(id)` RESTRICT (nullable); `care_episode_id` FK →
  `request_care_assignments(id)` RESTRICT; `coach_id` NOT NULL FK →
  `team_members(id)` RESTRICT; `purpose` CHECK (`intake`,`messaging`);
  `notice_version text` NOT NULL (gültig: `2026-10-28-recipient-v1`);
  `granted_at`.
- **`request_care_operations`**: `id uuid` PK (Operation-ID); `request_id`
  FK RESTRICT; `care_version bigint` NOT NULL; `created_at`;
  `completed_at` – persistente Terminoperations-Reservierung; offene
  Operationen blockieren Transfers.

Kein historischer Episode- oder Empfänger-Scope wird rückwirkend abgeleitet
oder backfilled.

## Ersetzte / historische Definitionen (nicht mit Soll-Zustand verwechseln)

Hinweis: Alle Objekte aus `20261022000000_coach_invoice_admin_release.sql`
(inkl. der 5-Parameter-`reserve_coach_invoice_creation`) existieren nur im
uncommitteten Arbeitsbaum; committeter Stand in `df009ed` ist die
4-Parameter-Version aus `20261012…`.

| Objekt | Historisch | Aktuell gültig |
|---|---|---|
| `reserve_coach_invoice_creation` | `20261009…` (4 Param), ersetzt `20261011…`, ersetzt `20261012…` | `20261022…`: 5-Param-Version (`p_confirm_without_release`) + 4-Param-SQL-Wrapper |
| `release_coach_quarter` | `20261009…` (roher Advisory-Lock) | `20261011…` (über `guard_coach_billing_write`) |
| `mark_coach_quarter_stale` | `20261009…` | `20261011…` (mit Creation-Guard) |
| `guard_coach_invoice_creation_update` | `20261011…` | `20261012…` (zusätzlich `creation_unknown`-Freeze und Candidate-ID) |
| `coach_invoices_sevdesk_send_status_check` | `20261008…` (7 Werte) | `20261009…` (8 Werte inkl. `finalized`) |
| Policies „coaches read own request conversations/messages“ | `20260901…` – **produktiv noch aktiv** | nach P0-Rollout ersetzt durch `privacy_coach_can_read`-Policies (`20261028000000…`) |

## P0-Status und lokale Kompatibilität

- Die Zugriffsmigration `20261028000000…` ist **nicht idempotent**
  (`add column` ohne `if not exists`, `drop policy` ohne `if exists`) und
  muss exakt einmal als eine Transaktion laufen.
- Lokale Abhängigkeiten sind im Repository vollständig erfüllt:
  `20260901…` liefert die beiden gedroppten Policies, `20261017…` die
  Consent-Tabelle ohne die neuen Spalten. Es besteht **kein belegter
  lokaler Konflikt** zwischen der Zugriffsmigration und den übrigen
  Repository-Migrationen (Details:
  [database-dependencies.md](./database-dependencies.md), Abschnitt
  „P0-Kompatibilitätsanalyse“).
- Die bereits produktive Sessions-INSERT-Sperre (`20261028020000…`) ist
  eine Teilmenge der P0-Revokes; erneutes Anwenden der Revokes ist
  wirkungsneutral.
- Die Löschmigration `20261028010000…` setzt die Zugriffsmigration sowie
  `anfragen_reengagement_log` und die Recovery-Tabellen voraus und bleibt
  eigenständig zu bewerten; der zugehörige API-Pfad ist im Arbeitsbaum
  deaktiviert (`503 REQUEST_DELETE_DISABLED`).
- Rollout-Reihenfolge, Preflight und NO-GO-Kriterien:
  `docs/privacy-p0-phase1-rollout.md`.
