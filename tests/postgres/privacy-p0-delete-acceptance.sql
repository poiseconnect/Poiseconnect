-- SQL execution is approved only in the disposable, networkless test runner.
create function privacy_test.delete_request(n bigint, actor bigint default 3)
returns jsonb language sql as $$
  select public.privacy_delete_request(privacy_test.id(n),privacy_test.id(actor));
$$;

-- A request with no retained dependencies is deleted atomically with its
-- short-lived, request-bound recovery challenge.
insert into public.anfragen(id,status,booking_token)
values (privacy_test.id(700),'papierkorb',privacy_test.id(100700));
insert into public.client_link_recovery(secret_hash,request_id,recipient,token_fingerprint,purpose)
values (repeat('7',64),privacy_test.id(700),'synthetic@example.invalid','synthetic','draft');
begin;
set local role service_role;
select privacy_test.check_that(privacy_test.delete_request(700)->>'deleted'='true',
  'eligible request deletion succeeds');
select privacy_test.check_that(not exists(select 1 from public.anfragen where id=privacy_test.id(700))
  and not exists(select 1 from public.client_link_recovery where request_id=privacy_test.id(700)),
  'request and short-lived recovery challenge are removed in one transaction');
rollback;

insert into public.anfragen(id,status) values
  (privacy_test.id(701),'papierkorb'),(privacy_test.id(702),'papierkorb'),
  (privacy_test.id(703),'papierkorb'),(privacy_test.id(704),'papierkorb'),
  (privacy_test.id(705),'papierkorb'),(privacy_test.id(706),'papierkorb'),
  (privacy_test.id(707),'papierkorb'),(privacy_test.id(708),'papierkorb'),
  (privacy_test.id(709),'papierkorb'),(privacy_test.id(710),'papierkorb'),
  (privacy_test.id(712),'papierkorb'),(privacy_test.id(713),'papierkorb');

insert into public.anfrage_health_data_consents(request_id,token_hash,text_version)
values(privacy_test.id(701),repeat('1',64),'2026-10-16-v1');
insert into public.anfrage_health_data_consents(request_id,token_hash,text_version)
values(privacy_test.id(704),repeat('4',64),'2026-10-16-v1');
insert into public.request_care_assignments(request_id,coach_id)
values(privacy_test.id(702),privacy_test.id(1));
insert into public.request_care_transfers(operation_id,request_id,actor_id,reason_code,expected_version,result)
values(privacy_test.id(1703),privacy_test.id(703),privacy_test.id(3),'therapist_change',0,'{}');
insert into public.request_health_authorizations(consent_id,request_id,coach_id,purpose,notice_version)
select id,privacy_test.id(704),privacy_test.id(1),'intake','synthetic'
from public.anfrage_health_data_consents where request_id=privacy_test.id(704);
insert into public.request_care_operations(id,request_id,care_version)
values(privacy_test.id(1705),privacy_test.id(705),0);
insert into public.request_care_operations(id,request_id,care_version,completed_at)
values(privacy_test.id(1706),privacy_test.id(706),0,now());
insert into public.anfragen_reengagement_log(batch_id,anfrage_id,created_by)
values(privacy_test.id(1708),privacy_test.id(708),privacy_test.id(3));
insert into public.client_link_recovery_queue(request_id,status,email,encrypted_secret)
values(privacy_test.id(709)::text,'queued','synthetic@example.invalid','synthetic-only');
insert into public.invoices(id,anfrage_id,therapist_id,invoice_number,total_gross,sevdesk_invoice_id)
values(privacy_test.id(1710),privacy_test.id(710),privacy_test.id(1),'SYNTHETIC-KEEP',80,'synthetic-sevdesk-id');
insert into public.anfragen(id,assigned_therapist_id,status)
values(privacy_test.id(711),privacy_test.id(1),'papierkorb');
insert into public.blocked_slots(id,anfrage_id,therapist_id,start_at,end_at,google_event_id)
values(privacy_test.id(1711),privacy_test.id(711),privacy_test.id(1),
  '2020-01-01','2020-01-01 01:00Z','synthetic-calendar-event');
insert into public.appointment_proposals(id,anfrage_id,therapist_id,date,expires_at,google_event_id)
values(privacy_test.id(1712),privacy_test.id(711),privacy_test.id(1),
  '2020-01-01','2020-01-02','synthetic-proposal-event');
insert into public.synthetic_unclassified_dependents(request_id)
values(privacy_test.id(712));
insert into public.client_link_recovery(secret_hash,request_id,recipient,token_fingerprint,purpose)
values (repeat('2',64),privacy_test.id(712),'synthetic@example.invalid','synthetic','draft');

begin;
set local role service_role;
select privacy_test.check_that((privacy_test.delete_request(701)->'blockers')
  ? 'HEALTH_CONSENT_RETENTION', 'consent proof blocks request deletion');
select privacy_test.check_that((privacy_test.delete_request(702)->'blockers')
  ? 'CARE_HISTORY_RETENTION', 'care assignment blocks request deletion');
select privacy_test.check_that((privacy_test.delete_request(703)->'blockers')
  ? 'CARE_HISTORY_RETENTION', 'transfer record blocks request deletion');
select privacy_test.check_that((privacy_test.delete_request(704)->'blockers')
  ? 'CARE_HISTORY_RETENTION', 'health authorization blocks request deletion');
select privacy_test.check_that((privacy_test.delete_request(705)->'blockers')
  ? 'CARE_OPERATION_IN_PROGRESS', 'pending care operation blocks request deletion');
select privacy_test.check_that((privacy_test.delete_request(706)->'blockers')
  ? 'CARE_OPERATION_HISTORY_RETENTION', 'completed care operation is retained');
select privacy_test.check_that((privacy_test.delete_request(602)->'blockers')
  ? 'MESSAGING_RETENTION', 'conversation and message history block request deletion');
select privacy_test.check_that((privacy_test.delete_request(708)->'blockers')
  ? 'REENGAGEMENT_RETENTION', 're-engagement ledger blocks request deletion');
select privacy_test.check_that((privacy_test.delete_request(709)->'blockers')
  ? 'RECOVERY_QUEUE_REVIEW', 'recovery queue record blocks request deletion');
select privacy_test.check_that((privacy_test.delete_request(710)->'blockers')
  ? 'BILLING_RETENTION', 'invoice and sevDesk record block request deletion');
select privacy_test.check_that((privacy_test.delete_request(711)->'blockers')
  ? 'APPOINTMENT_OR_CALENDAR_REVIEW', 'calendar/proposal references block request deletion');
select privacy_test.rejects(
  'select privacy_test.delete_request(712)', '23503', null);
select privacy_test.check_that(exists(select 1 from public.anfragen where id=privacy_test.id(712))
  and exists(select 1 from public.client_link_recovery where request_id=privacy_test.id(712)),
  'unknown FK failure rolls back request and recovery-token deletion together');
select privacy_test.rejects(
  'select privacy_test.delete_request(713,1)', 'P0001', 'NO_ACCESS');
select privacy_test.check_that(exists(select 1 from public.anfragen where id=privacy_test.id(713)),
  'non-admin cannot delete request');
select privacy_test.check_that(exists(select 1 from public.invoices
  where id=privacy_test.id(1710) and invoice_number='SYNTHETIC-KEEP'
    and sevdesk_invoice_id='synthetic-sevdesk-id'), 'blocked invoice and sevDesk ID unchanged');
select privacy_test.check_that(exists(select 1 from public.blocked_slots
  where id=privacy_test.id(1711) and google_event_id='synthetic-calendar-event')
  and exists(select 1 from public.appointment_proposals
    where id=privacy_test.id(1712) and google_event_id='synthetic-proposal-event'),
  'blocked calendar and proposal event IDs unchanged');
select privacy_test.rejects(
  'insert into public.client_link_recovery_queue(request_id)
    values(privacy_test.id(799)::text)', 'P0001', 'REQUEST_NOT_FOUND');
select privacy_test.rejects(
  'insert into public.client_link_recovery_queue(request_id)
    values(''not-a-uuid'')', 'P0001', 'INVALID_REQUEST_ID');
rollback;
