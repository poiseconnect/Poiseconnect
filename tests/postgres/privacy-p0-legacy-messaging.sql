-- Run after the real messaging/consent foundations, before the P0 candidate.
insert into public.request_conversations(id, anfrage_id, therapist_id, reply_alias, reply_token_hash)
values (privacy_test.id(904), privacy_test.id(900), privacy_test.id(1),
  'synthetic-alias@example.invalid', repeat('a',64));
insert into public.request_messages(id, conversation_id, anfrage_id, direction, sender_role,
  delivery_status, text_body, subject)
values (privacy_test.id(905), privacy_test.id(904), privacy_test.id(900),
  'inbound', 'client', 'received', 'SYNTHETIC_MESSAGE_ONLY', 'Synthetic subject');
insert into public.request_message_events(provider, provider_event_id, event_type)
values ('synthetic', 'synthetic-event', 'email.received');
insert into public.anfragen(id, status, booking_token)
values (privacy_test.id(602), 'papierkorb', privacy_test.id(100602));
insert into public.request_conversations(id, anfrage_id, therapist_id, status,
  reply_alias, reply_token_hash, closed_at, alias_revoked_at)
values (privacy_test.id(603), privacy_test.id(602), privacy_test.id(1), 'review',
  'synthetic-delete-alias@example.invalid', repeat('f',64), now(), now());
insert into public.request_messages(id, conversation_id, anfrage_id, direction, sender_role,
  delivery_status, text_body, subject)
values (privacy_test.id(604), privacy_test.id(603), privacy_test.id(602),
  'inbound', 'client', 'received', 'SYNTHETIC_DELETE_BODY', 'Synthetic delete test');
create table privacy_test.legacy_snapshot as
select 'sessions' as category, to_jsonb(s) as payload from public.sessions s
union all select 'invoices', to_jsonb(i) from public.invoices i
union all select 'coach_invoices', to_jsonb(c) from public.coach_invoices c;
