# Datenbanksicherheit – Rollen, GRANTs, RLS und Funktionsrechte

> Manuell gepflegte Architekturreferenz (kein Generator-Artefakt).
> Rekonstruiert aus allen SQL-Migrationen; Verbindlichkeitskategorien
> (REPO / PROD / UNVERIFIZIERT) wie in
> [database-schema.md](./database-schema.md) definiert.
> Objekte mit Quelle `20261022…` existieren nur im uncommitteten
> Arbeitsbaum (laufende sevDesk-Arbeiten), nicht im Release-Commit und
> nicht produktiv.
> Stand: 2026-10-31.

## Rollenmodell

- `anon`, `authenticated`: Browserrollen über Supabase-API-Keys.
- `service_role`: ausschließlich serverseitig (API-Routen mit
  Service-Role-Client). Besitzt in Supabase BYPASSRLS; die Migrationen
  verlassen sich bewusst **nicht** darauf und legen explizite Grants und
  `service_role`-Policies an.
- `postgres`: Owner-Rolle; effektive Owner/Memberships produktiv
  UNVERIFIZIERT (Teil des Preflights).
- **Supabase-Falle (PROD-bestätigt):** Default-Privileges im Schema
  `public` vergeben EXECUTE auf neue Funktionen an `anon` und
  `authenticated`. `revoke … from public` genügt nicht; jede neue Funktion
  braucht ausdrücklich
  `revoke execute … from public, anon, authenticated` (Beleg:
  `20261007000000_reengagement_function_execute_lockdown.sql`).

## RLS- und Grant-Matrix (Soll-Zustand nach allen Migrationen)

RLS ist auf allen migrationsdefinierten Tabellen aktiviert. „—“ = keine
Policy/kein Grant für Browserrollen (Zugriff nur über Server-APIs).

| Tabelle | Browserrollen (anon/authenticated) | service_role | Policies |
|---|---|---|---|
| `request_conversations` | vor P0: SELECT-Grant + Policy „coaches read own request conversations“ (PROD aktiv); nach P0: SELECT-Grant + Policy über `privacy_coach_can_read(id)` | implizit (BYPASSRLS; Grants aus Basisbestand UNVERIFIZIERT) | s. unten |
| `request_messages` | wie oben, Policy auf `privacy_coach_can_read(conversation_id)` | wie oben | s. unten |
| `request_message_events` | — (P0 wiederholt den Revoke) | wie oben | keine |
| `anfragen_reengagement_log` | — | SELECT/INSERT/UPDATE-Grant + `…_service_role_all`-Policy; kein DELETE | FOR ALL to service_role |
| `coach_quarter_releases` | — | GRANT ALL | keine explizite Policy (RLS an; service_role via BYPASSRLS) |
| `coach_invoice_sevdesk_claims` | — | nur SELECT-Grant; INSERT nur innerhalb des SECURITY-DEFINER-Triggers `guard_coach_invoice_link` | keine |
| `client_link_recovery`, `…_limits`, `…_queue` | — | SELECT/INSERT/UPDATE/DELETE + Sequence-Grant; je eine FOR-ALL-Policy | FOR ALL to service_role |
| `anfrage_health_data_consents` | — | SELECT/INSERT/UPDATE + FOR-ALL-Policy; kein DELETE | FOR ALL to service_role |
| `coach_invoice_admin_decisions` | — (auch service_role nur SELECT) | nur SELECT; INSERT nur innerhalb SECURITY-DEFINER-RPC `reserve_coach_invoice_creation(5)` | SELECT to service_role |
| `request_care_assignments`, `request_care_transfers`, `request_health_authorizations`, `request_care_operations` (P0) | — | GRANT ALL | keine (RLS an) |

### Basistabellen (`anfragen`, `sessions`, `invoices`, `blocked_slots`, `appointment_proposals`, `team_members`, …)

- Produktiver Ist-Zustand: RLS aktiv und Objektpräsenz bestätigt; die
  konkreten Policies/Grants der Basistabellen sind UNVERIFIZIERT – mit
  einer Ausnahme:
- **`sessions` (PROD, 28.10.2026):** Policy „allow inserts from api“
  entfernt; INSERT-Tabellen- und Spaltenrechte für `public`, `anon`,
  `authenticated` entzogen; sieben Berechtigungsprüfungen bestanden
  (`20261028020000_sessions_insert_lockdown.sql`).
- **Nach P0-Zugriffsmigration (REPO, nicht produktiv):** vollständiger
  Entzug aller Tabellen- **und** Spaltenrechte (SELECT/INSERT/UPDATE/
  REFERENCES je Spalte) auf `anfragen`, `sessions`, `invoices`,
  `blocked_slots`, `appointment_proposals` für `public`, `anon`,
  `authenticated`. Browser nutzt danach ausschließlich zweckgebundene
  Server-APIs. Öffentliche Views auf diese Tabellen würden brechen –
  produktiv UNVERIFIZIERT, Teil des Preflights.

### Messaging-Policies im Detail

Vor P0 (PROD aktiv, `20260901…`):

- „coaches read own request conversations“: SELECT für `authenticated`,
  wenn `team_members`-Zeile mit `user_id = auth.uid()`, `active`,
  `role='therapist'` und `id = therapist_id` existiert.
- „coaches read own request messages“: analog über Join auf die
  Conversation.

Nach P0 (REPO): beide Policies werden gedroppt und ersetzt durch
`privacy_coach_can_read(uuid)` (SECURITY DEFINER, EXECUTE für
`authenticated` – die **einzige** browserseitig aufrufbare neue Funktion).
Sie verlangt zusätzlich: offene, nicht revozierte Conversation; Coach ist
aktueller `assigned_therapist_id`; `care_episode_id` stimmt mit der
Anfrage überein; aktiver Consent (`privacy_consent_allows`); und eine
Messaging-Autorisierung, die durch hartes `and false` derzeit nie erfüllt
ist → **Inhalts-Messaging ist nach P0 vollständig pausiert**
(`MESSAGING_CONTENT_PAUSED`), bis eine separate Kommunikationsfreigabe
beschlossen und die Bedingung entfernt wird.

## Funktionsrechte

Alle Funktionen setzen `set search_path = public, pg_temp`. EXECUTE wird
jeweils für `public, anon, authenticated` entzogen und nur gezielt
vergeben. Trigger-Funktionen benötigen kein EXECUTE für Aufrufer.

### SECURITY DEFINER (laufen mit Owner-Rechten – besonders review-pflichtig)

| Funktion | Quelle | EXECUTE |
|---|---|---|
| `coach_quarter_snapshot(uuid,int,int)` | `20261009…` | service_role |
| `release_coach_quarter(uuid,int,int,uuid)` | `20261009…`/`20261011…` | service_role |
| `reserve_coach_invoice_creation(…,boolean)` + 4-Param-Wrapper | `20261022…` | service_role |
| `mark_coach_quarter_stale(uuid,timestamptz)` | `20261009…`/`20261011…` | keiner (nur Triggerkontext) |
| `lock_coach_billing(uuid)`, `guard_coach_billing_write(uuid)` | `20261011…` | service_role |
| `invalidate_coach_quarter_on_*` (4 Triggerfunktionen) | `20261009…` | keiner |
| `guard_coach_billing_source_change()`, `guard_coach_invoice_creation_update()` | `20261011…`/`20261012…` | keiner |
| `check_coach_invoice_link(uuid)` | `20261012…` | service_role |
| `guard_coach_invoice_link()` | `20261012…` | keiner |
| `guard_coach_invoice_source_snapshot()` | `20261022…` | keiner |
| `coach_invoice_admin_workflow_ready()` | `20261022…` | service_role |
| `privacy_coach_can_read(uuid)` (P0) | `20261028000000…` | **authenticated** (RLS-Helper) |

### SECURITY INVOKER (Service-Role-Kontext erforderlich)

| Funktionsgruppe | Quelle | EXECUTE |
|---|---|---|
| `ensure_open_request_conversation`, `close_open_request_conversation` | `20260901…` | service_role |
| `reserve_reengagement_attempt(uuid,uuid,uuid)` | `20261005…` + Lockdown `20261007…` (PROD) | service_role |
| `enqueue/issue/claim/process/finish/retry_client_link_recovery*`, `consume_client_link_recovery` | `20261016…` | service_role |
| `invalidate_coach_uid_confirmation()` (Trigger) | `20260927…` | Default (Trigger; kein expliziter Entzug – Aufruf außerhalb des Triggers wirkungslos) |
| Alle `privacy_*`-RPCs und -Triggerfunktionen außer `privacy_coach_can_read` (P0) | `20261028000000…` | service_role |
| `privacy_delete_request(uuid,uuid)`, `privacy_lock_recovery_queue_request()` (Löschmigration) | `20261028010000…` | service_role |

### Effektive Zugriffslogik der zentralen P0-Funktionen (REPO)

- `privacy_health_payload(anfragen)`: extrahiert ausschließlich die acht
  Gesundheitsfelder als JSONB-Whitelist.
- `privacy_consent_allows(anfragen, coach_id)`: aktiver, nicht
  revozierter/supersedeter Consent der Textversion `2026-10-16-v1`; für
  Coaches zusätzlich Empfängerfreigabe (`purpose='intake'`,
  `notice_version='2026-10-28-recipient-v1'`) in der **aktuellen**
  Betreuungsperiode (`care_episode_id`-Gleichheit, `ended_at is null`).
  Admin-Lesezugriff (`coach_id = null`) hängt nur am aktiven Consent –
  keine Widerrufsausnahme.
- `privacy_read_request_health(uuid[], actor)`: Staff-Lesepfad; Admin sieht
  alle, Coach nur zugewiesene Anfragen; Gesundheitsdaten nur bei
  `privacy_consent_allows`.
- `privacy_read_public_health(request, booking_token, consent_hash)`:
  Klientenpfad; verlangt Booking-Token **und** Consent-Token-Hash.
- `privacy_save_intake(…)`: strikte Spalten-Whitelist (Draft vs. final),
  Consent- und Empfängerfreigabe-Pflicht; Empfängerwechsel ohne Freigabe →
  `INTAKE_RECIPIENT_CHANGE_REQUIRES_APPROVAL`.
- `privacy_handover_request(…)`: idempotent über `operation_id`;
  optimistisch über `care_version`; Coach darf nur eigene Anfragen ohne
  Zielcoach abgeben, nur Admin wählt Zielcoach; schließt offene
  Conversations über den Assignment-Guard.
- `privacy_delete_request(…)` (separate Migration): nur aktiver Admin;
  klassifizierte Retention-Blocker (`HEALTH_CONSENT_RETENTION`,
  `CARE_*`, `MESSAGING_RETENTION`, `REENGAGEMENT_RETENTION`,
  `RECOVERY_QUEUE_REVIEW`, `BILLING_RETENTION`,
  `APPOINTMENT_OR_CALENDAR_REVIEW`); löscht sonst atomar Anfrage plus
  kurzlebige Recovery-Challenges; unklassifizierte FK-Abhängigkeiten
  führen zum Rollback.

## Sicherheitsinvarianten für zukünftige Änderungen

1. Neue Tabellen: RLS aktivieren, `revoke all … from public, anon,
   authenticated`, explizite `service_role`-Grants und -Policy; niemals
   auf BYPASSRLS allein verlassen.
2. Neue Funktionen: immer `set search_path = public, pg_temp`; EXECUTE
   explizit von `public, anon, authenticated` entziehen (Default-
   Privileges-Falle); SECURITY DEFINER nur mit Begründung.
3. Browserrollen erhalten keine neuen Rechte auf `anfragen`, `sessions`,
   `invoices`, `blocked_slots`, `appointment_proposals`,
   `request_message_events` oder Gesundheits-/Consent-/Care-Tabellen.
4. Gesundheitsfelder nur über die `privacy_*`-Whitelists; keine neuen
   Pfade an `privacy_consent_allows` vorbei.
5. Message-Bodies niemals loggen; Inhalts-Messaging bleibt bis zur
   gesonderten Freigabe pausiert.
6. Die produktive Sessions-INSERT-Sperre darf durch keine Migration oder
   Policy wieder aufgeweicht werden (auch nicht durch Restores).
