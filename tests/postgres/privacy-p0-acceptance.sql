-- Normative acceptance assertions. Never run on an existing database.
create function privacy_test.new_case(n bigint, draft boolean default false)
returns uuid language plpgsql as $$
declare request_id uuid := privacy_test.id(n); consent_id uuid;
begin
  insert into public.anfragen(id, assigned_therapist_id, booking_token, status,
    vorname, email, anliegen, invoice_with_vat)
  values(request_id, privacy_test.id(1), privacy_test.id(100000+n),
    case when draft then 'draft' else 'active' end,
    'Synthetic', 'client@example.invalid', 'SYNTHETIC_HEALTH_ONLY', false);
  consent_id := public.privacy_grant_intake_consent(request_id,
    privacy_test.id(100000+n)::text, repeat(md5(n::text),2));
  perform public.privacy_authorize_recipient(request_id, privacy_test.id(100000+n)::text,
    repeat(md5(n::text),2), privacy_test.id(1), 0, '2026-10-28-recipient-v1');
  return request_id;
end;
$$;
create function privacy_test.handover(n bigint, version bigint, operation bigint, target bigint)
returns jsonb language sql as $$
  select public.privacy_handover_request(privacy_test.id(n), privacy_test.id(3),
    'therapist_change', privacy_test.id(target), version, privacy_test.id(operation));
$$;
create function privacy_test.save(n bigint, draft boolean default false)
returns jsonb language sql as $$
  select public.privacy_save_intake(privacy_test.id(n), privacy_test.id(100000+n)::text,
    (select id from public.anfrage_health_data_consents
      where token_hash = repeat(md5(n::text),2)),
    jsonb_build_object('assigned_therapist_id', privacy_test.id(1),
      'vorname', 'Synthetic saved')
      || case when draft then '{}'::jsonb else '{"anliegen":"SYNTHETIC_UPDATED"}'::jsonb end,
    draft);
$$;

-- No migration backfill or billing/provider-field mutation.
select privacy_test.check_that(
  (select care_episode_id is null and care_version = 0 from public.anfragen
    where id = privacy_test.id(900)), 'legacy request has no invented episode');
select privacy_test.check_that(not exists(select 1 from public.request_health_authorizations),
  'no inferred recipient authorization');
select privacy_test.check_that(
  (select jsonb_agg(payload order by category, payload::text) from privacy_test.legacy_snapshot)
  = (select jsonb_agg(payload order by category, payload::text) from (
      select 'sessions' as category, to_jsonb(s) as payload from public.sessions s
      union all select 'invoices', to_jsonb(i) from public.invoices i
      union all select 'coach_invoices', to_jsonb(c) from public.coach_invoices c
    ) current_rows), 'migration preserves legacy finance and provider links');

-- Explicit privilege checks, including old column grants and all RPC overloads.
do $$
declare r text; t text; p record; column_name text;
begin
  perform privacy_test.check_that(
    (select not rolsuper and rolbypassrls from pg_roles where rolname='service_role'),
    'service role is not the test owner/superuser');
  foreach r in array array['anon','authenticated'] loop
    foreach t in array array['anfragen','sessions','invoices','blocked_slots','appointment_proposals',
      'request_care_assignments','request_care_transfers','request_health_authorizations',
      'request_care_operations','anfrage_health_data_consents','request_message_events'] loop
      perform privacy_test.check_that(not has_table_privilege(r, 'public.'||t,
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), r||' table grant denied: '||t);
      for column_name in select a.attname from pg_attribute a
        where a.attrelid = ('public.'||t)::regclass and a.attnum > 0 and not a.attisdropped loop
        perform privacy_test.check_that(not has_column_privilege(r, 'public.'||t, column_name,
          'SELECT,INSERT,UPDATE,REFERENCES'), r||' column grant denied: '||t||'.'||column_name);
      end loop;
    end loop;
    for p in select oid, proname from pg_proc where pronamespace='public'::regnamespace
      and proname like 'privacy_%' loop
      perform privacy_test.check_that(has_function_privilege(r, p.oid, 'EXECUTE') =
        (r = 'authenticated' and p.proname = 'privacy_coach_can_read'),
        r||' RPC execute scope: '||p.proname);
    end loop;
  end loop;
  foreach t in array array['request_conversations','request_messages','request_message_events',
    'anfrage_health_data_consents','request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations'] loop
    perform privacy_test.check_that(
      (select relrowsecurity from pg_class where oid=('public.'||t)::regclass),
      'RLS enabled: '||t);
  end loop;
end;
$$;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', privacy_test.id(1001)::text, true);
select privacy_test.check_that((select count(*)=0 from public.request_messages),
  'current legacy A cannot read paused message bodies');
select privacy_test.check_that((select count(*)=0 from public.request_conversations),
  'legacy conversation ID alone grants no read');
select privacy_test.rejects('select anliegen from public.anfragen', '42501', null);
select privacy_test.rejects('select * from public.sessions', '42501', null);
select privacy_test.rejects(
  'insert into public.sessions(anfrage_id,therapist_id,date,price)
   values(privacy_test.id(900),privacy_test.id(1),''2000-01-02T10:00:00Z'',80)',
  '42501', null);
select privacy_test.rejects('update public.anfragen set anliegen=''synthetic''', '42501', null);
select privacy_test.rejects('select * from public.request_message_events', '42501', null);
select privacy_test.rejects(
  'select public.privacy_read_request_health(array[privacy_test.id(900)],privacy_test.id(3))',
  '42501', null);
select privacy_test.rejects(
  'insert into public.request_messages(direction,sender_role,delivery_status)
   values(''outbound'',''coach'',''queued'')', '42501', null);
rollback;
begin;
set local role anon;
select privacy_test.rejects(
  'insert into public.sessions(anfrage_id,therapist_id,date,price)
   values(privacy_test.id(900),privacy_test.id(1),''2000-01-02T10:00:00Z'',80)',
  '42501', null);
select privacy_test.rejects('select * from public.request_messages', '42501', null);
select privacy_test.rejects(
  'select public.privacy_messaging_context(p_request_id=>privacy_test.id(900))', '42501', null);
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', privacy_test.id(1004)::text,true);
select privacy_test.check_that(not public.privacy_coach_can_read(privacy_test.id(904)),
  'inactive actor has no conversation scope');
select set_config('request.jwt.claim.sub','',true);
select privacy_test.check_that(not public.privacy_coach_can_read(privacy_test.id(904)),
  'missing JWT has no conversation scope');
rollback;

-- Execute real server RPCs as non-superuser service_role, with explicit actor IDs.
select privacy_test.new_case(10);
begin;
set local role service_role;
insert into public.sessions(id,anfrage_id,therapist_id,date,price)
values(privacy_test.id(951),privacy_test.id(10),privacy_test.id(1),'2000-01-02T10:00:00Z',80);
select privacy_test.check_that(exists(
  select 1 from public.sessions where id = privacy_test.id(951) and price = 80),
  'authorized backend session INSERT survives combined P0 migrations');
select privacy_test.check_that(
  public.privacy_read_request_health(array[privacy_test.id(10)],privacy_test.id(1))
    ->0->>'anliegen' = 'SYNTHETIC_HEALTH_ONLY', 'current authorized coach health');
select privacy_test.check_that(
  public.privacy_read_request_health(array[privacy_test.id(10)],privacy_test.id(2))='[]'::jsonb,
  'unassigned coach receives no case');
select privacy_test.check_that(
  public.privacy_read_request_health(array[privacy_test.id(10)],privacy_test.id(3))
    ->0->>'anliegen'='SYNTHETIC_HEALTH_ONLY', 'admin active consent');
select privacy_test.rejects(
  'select public.privacy_read_request_health(array[privacy_test.id(10)],privacy_test.id(4))',
  'P0001','NO_ACCESS');
select privacy_test.check_that(public.privacy_read_public_health(privacy_test.id(10),
  privacy_test.id(100010)::text, repeat('f',64)) is null, 'wrong proof cannot read');
select privacy_test.check_that(public.privacy_read_public_health(privacy_test.id(10),
  privacy_test.id(100011)::text, repeat(md5('10'),2)) is null, 'wrong booking credential');
select privacy_test.check_that(public.privacy_revoke_intake_consent(privacy_test.id(10),
  privacy_test.id(100010)::text, repeat(md5('10'),2)), 'withdraw succeeds');
select privacy_test.check_that(
  public.privacy_read_request_health(array[privacy_test.id(10)],privacy_test.id(1))
    ->0->>'__healthAllowed'='false', 'coach health denied after withdrawal');
select privacy_test.check_that(not (
  public.privacy_read_request_health(array[privacy_test.id(10)],privacy_test.id(3))->0 ? 'anliegen'),
  'no admin withdrawal exception');
select privacy_test.check_that(public.privacy_read_public_health(privacy_test.id(10),
  privacy_test.id(100010)::text, repeat(md5('10'),2)) is null, 'public withdrawal');
select privacy_test.rejects('select privacy_test.save(10)', 'P0001','HEALTH_DATA_CONSENT_REQUIRED');
select privacy_test.check_that((select anliegen='SYNTHETIC_HEALTH_ONLY'
  from public.anfragen where id=privacy_test.id(10)), 'withdrawal is not deletion');
commit;

-- Renewal and A -> B -> A never revive old episode consent.
select privacy_test.new_case(11);
select privacy_test.handover(11,0,200011,2);
select privacy_test.check_that(
  public.privacy_read_request_health(array[privacy_test.id(11)],privacy_test.id(1))='[]'::jsonb,
  'former A loses live case');
select privacy_test.check_that(
  public.privacy_read_request_health(array[privacy_test.id(11)],privacy_test.id(2))
    ->0->>'__healthAllowed'='false', 'new B has no inferred health consent');
select public.privacy_authorize_recipient(privacy_test.id(11),privacy_test.id(100011)::text,
  repeat(md5('11'),2),privacy_test.id(2),1,'2026-10-28-recipient-v1');
select privacy_test.check_that(
  public.privacy_read_request_health(array[privacy_test.id(11)],privacy_test.id(2))
    ->0->>'__healthAllowed'='true', 'B explicitly authorized');
select privacy_test.handover(11,1,200012,1);
select privacy_test.check_that(
  public.privacy_read_request_health(array[privacy_test.id(11)],privacy_test.id(1))
    ->0->>'__healthAllowed'='false', 'returning A needs new episode consent');
select privacy_test.check_that(
  (select count(*)=1 from public.request_care_assignments
    where request_id=privacy_test.id(11) and ended_at is null), 'exactly one current period');
select privacy_test.rejects('select privacy_test.handover(11,0,200013,2)',
  'P0001','CARE_VERSION_CONFLICT');
select privacy_test.rejects('update public.anfragen set assigned_therapist_id=privacy_test.id(2)
  where id=privacy_test.id(11)', 'P0001','ATOMIC_CARE_TRANSFER_REQUIRED');
select privacy_test.rejects('update public.anfragen set care_version=99
  where id=privacy_test.id(11)', 'P0001','ATOMIC_CARE_TRANSFER_REQUIRED');
select privacy_test.rejects('insert into public.request_care_assignments(request_id,coach_id)
  values(privacy_test.id(11),privacy_test.id(2))', '23505', null);

-- Historical sessions are allowed; finance remains byte-for-byte unchanged.
select privacy_test.handover(900,0,200900,2);
select privacy_test.check_that(
  (select status='closed' and alias_revoked_at is not null and closed_at is not null
    from public.request_conversations where id=privacy_test.id(904)), 'old conversation/alias closed');
select privacy_test.check_that(
  (select jsonb_agg(payload order by category, payload::text) from privacy_test.legacy_snapshot)
  = (select jsonb_agg(payload order by category, payload::text) from (
    select 'sessions' as category, to_jsonb(s) as payload from public.sessions s where id=privacy_test.id(901)
    union all select 'invoices', to_jsonb(i) from public.invoices i where id=privacy_test.id(902)
    union all select 'coach_invoices', to_jsonb(c) from public.coach_invoices c
  ) after_transfer), 'handover leaves old billing/sevDesk/calendar IDs unchanged');
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', privacy_test.id(1001)::text,true);
select privacy_test.check_that((select count(*)=0 from public.request_messages), 'former A RLS');
select set_config('request.jwt.claim.sub', privacy_test.id(1002)::text,true);
select privacy_test.check_that((select count(*)=0 from public.request_messages), 'new B no history');
select set_config('request.jwt.claim.sub', privacy_test.id(1003)::text,true);
select privacy_test.check_that((select count(*)=0 from public.request_messages), 'no browser admin body bypass');
rollback;

-- Content remains paused even with a synthetically inserted messaging authorization.
select privacy_test.new_case(12);
insert into public.request_health_authorizations
  (consent_id,request_id,care_episode_id,coach_id,purpose,notice_version)
select c.id,a.id,a.care_episode_id,a.assigned_therapist_id,'messaging','synthetic-not-approval'
from public.anfragen a join public.anfrage_health_data_consents c on c.request_id=a.id
where a.id=privacy_test.id(12);
select privacy_test.check_that(
  public.privacy_messaging_context(p_request_id=>privacy_test.id(12),p_coach_id=>privacy_test.id(1))
    ->>'reason'='MESSAGING_CONTENT_PAUSED', 'intake/messaging row cannot activate dispatch');
select privacy_test.check_that(public.privacy_read_messages(privacy_test.id(904),privacy_test.id(1))
  is null, 'old message RPC cannot bypass pause');
select privacy_test.rejects('update public.request_messages set text_body=''SYNTHETIC_CHANGED''
  where id=privacy_test.id(905)', 'P0001','MESSAGE_PROCESSING_NOT_AUTHORIZED');
select privacy_test.rejects(
  'select public.ensure_open_request_conversation(privacy_test.id(12),privacy_test.id(1),
    ''new-synthetic@example.invalid'',repeat(''b'',64))',
  'P0001','MESSAGE_PROCESSING_NOT_AUTHORIZED');

-- Claim fences, future conflict kinds, stale owner child inserts and rollback.
select privacy_test.new_case(13);
select public.privacy_begin_appointment_operation(privacy_test.id(13),privacy_test.id(1),0,privacy_test.id(300013));
select privacy_test.rejects('select privacy_test.handover(13,0,200013,2)',
  'P0001','CARE_OPERATION_IN_PROGRESS');
select public.privacy_end_appointment_operation(privacy_test.id(300013));
select privacy_test.handover(13,0,200013,2);
select privacy_test.rejects(
  'select public.privacy_begin_appointment_operation(privacy_test.id(13),privacy_test.id(1),0,privacy_test.id(300014))',
  'P0001','CARE_VERSION_CONFLICT');
select privacy_test.rejects(
  'insert into public.sessions(anfrage_id,therapist_id,date)
    values(privacy_test.id(13),privacy_test.id(1),now())', 'P0001','CARE_VERSION_CONFLICT');
do $$
declare n bigint; before_row jsonb;
begin
  for n in 14..17 loop
    perform privacy_test.new_case(n);
    if n=14 then
      insert into public.sessions(anfrage_id,therapist_id,date,duration_min)
        values(privacy_test.id(n),privacy_test.id(1),now()+interval '1 day',50.5);
    elsif n=15 then
      insert into public.blocked_slots(anfrage_id,therapist_id,start_at,end_at)
        values(privacy_test.id(n),privacy_test.id(1),now(),now()+interval '1 hour');
    elsif n=16 then
      insert into public.appointment_proposals(anfrage_id,therapist_id,date,expires_at)
        values(privacy_test.id(n),privacy_test.id(1),now()+interval '1 day',now()+interval '1 hour');
    else
      update public.anfragen set bevorzugte_zeit=now()+interval '1 day' where id=privacy_test.id(n);
    end if;
    select to_jsonb(a) into before_row from public.anfragen a where id=privacy_test.id(n);
    perform privacy_test.rejects(format('select privacy_test.handover(%s,0,%s,2)',n,200000+n),
      'P0001','FUTURE_APPOINTMENTS_REQUIRE_DECISION');
    perform privacy_test.check_that(before_row =
      (select to_jsonb(a) from public.anfragen a where id=privacy_test.id(n)),
      'conflict rolls back all assignment/status/version changes');
  end loop;
end;
$$;

-- Atomic intake update, revoked draft, forged recipient and finalization guard.
select privacy_test.new_case(18,true);
select privacy_test.save(18,true);
select privacy_test.check_that((select vorname='Synthetic saved' from public.anfragen
  where id=privacy_test.id(18)), 'draft atomic update');
select public.privacy_revoke_intake_consent(privacy_test.id(18),privacy_test.id(100018)::text,repeat(md5('18'),2));
select privacy_test.rejects('select privacy_test.save(18,true)','P0001','HEALTH_DATA_CONSENT_REQUIRED');
select privacy_test.new_case(19);
select privacy_test.rejects('select privacy_test.save(19,true)','P0001','REQUEST_ALREADY_FINALIZED');
select privacy_test.rejects(
  'select public.privacy_authorize_recipient(privacy_test.id(19),privacy_test.id(100019)::text,
    repeat(md5(''19''),2),privacy_test.id(2),0,''2026-10-28-recipient-v1'')',
  'P0001','INTAKE_RECIPIENT_CHANGE_REQUIRES_APPROVAL');
select privacy_test.rejects(
  'select public.privacy_authorize_recipient(privacy_test.id(19),privacy_test.id(100019)::text,
    repeat(md5(''19''),2),privacy_test.id(1),0,''unknown'')',
  'P0001','INVALID_RECIPIENT_NOTICE');

-- Initial save links proof + authorization + newly initialized episode atomically.
do $$
<<initial_save>>
declare proof uuid; saved jsonb; request_id uuid; before_requests bigint;
begin
  proof := public.privacy_grant_intake_consent(null,null,repeat('c',64));
  select count(*) into before_requests from public.anfragen;
  perform privacy_test.rejects(format(
    'select public.privacy_save_intake(null,null,%L,
      jsonb_build_object(''assigned_therapist_id'',privacy_test.id(1),''status'',''draft''),true)',proof),
    'P0001','RECIPIENT_CONSENT_REQUIRED');
  perform privacy_test.check_that((select count(*)=before_requests from public.anfragen),
    'failed initial save leaves no request');
  perform public.privacy_authorize_recipient(null,null,repeat('c',64),privacy_test.id(1),
    null,'2026-10-28-recipient-v1');
  saved := public.privacy_save_intake(null,null,proof,
    jsonb_build_object('assigned_therapist_id',privacy_test.id(1),'status','draft'),true);
  request_id := (saved->>'id')::uuid;
  perform privacy_test.check_that(exists(select 1 from public.request_health_authorizations h
    join public.anfragen a on a.id=h.request_id and a.care_episode_id=h.care_episode_id
    join public.anfrage_health_data_consents c on c.id=h.consent_id and c.request_id=a.id
    where a.id=initial_save.request_id and c.id=proof),
    'initial save attaches all three identities');
end;
$$;

-- Historical billing write protections run as real RPCs, not an in-memory model.
begin;
set local role service_role;
select privacy_test.rejects(
  'select public.privacy_save_client_invoice(privacy_test.id(1001),privacy_test.id(902),
    privacy_test.id(900),1,jsonb_build_object(''anfrage_id'',privacy_test.id(900),
      ''therapist_id'',privacy_test.id(1),''total_gross'',1))', 'P0001','NO_ACCESS');
select privacy_test.rejects(
  'select public.privacy_delete_care_session(privacy_test.id(1001),privacy_test.id(901))',
  'P0001','NO_ACCESS');
select privacy_test.rejects(
  'select public.privacy_delete_care_session(privacy_test.id(1002),privacy_test.id(901))',
  'P0001','NO_ACCESS');
rollback;

-- Own current invoice partial updates preserve omitted values and session ownership.
select privacy_test.new_case(20);
insert into public.sessions(id,anfrage_id,therapist_id,date,price)
  values(privacy_test.id(920),privacy_test.id(20),privacy_test.id(1),'2000-01-01',80);
do $$
declare saved jsonb; patched jsonb;
begin
  saved := public.privacy_save_client_invoice(privacy_test.id(1001),null,privacy_test.id(20),0,
    jsonb_build_object('anfrage_id',privacy_test.id(20),'therapist_id',privacy_test.id(1),
      'client_email','synthetic@example.invalid','total_gross',80,
      'line_items',jsonb_build_array(jsonb_build_object('session_id',privacy_test.id(920),'total',80))));
  patched := public.privacy_save_client_invoice(privacy_test.id(1001),(saved->>'id')::uuid,
    privacy_test.id(20),0,jsonb_build_object('anfrage_id',privacy_test.id(20),
      'therapist_id',privacy_test.id(1),'invoice_number','SYNTHETIC-PATCH'));
  perform privacy_test.check_that(patched->>'client_email'=saved->>'client_email'
    and patched->'line_items'=saved->'line_items' and patched->'total_gross'=saved->'total_gross',
    'partial save preserves omitted billing data');
end;
$$;
begin;
set local role service_role;
select public.privacy_delete_care_session(privacy_test.id(1001),privacy_test.id(920));
select privacy_test.check_that(not exists(select 1 from public.sessions where id=privacy_test.id(920)),
  'current own session deletion succeeds in rollback-only test');
rollback;

-- Delete path: rejection is expected, and all dependent data must remain.
do $$
declare t text; constraint_row record; n bigint := 400; before_count bigint;
begin
  for constraint_row in
    select conrelid::regclass as child, conname, confdeltype from pg_constraint
    where contype='f' and confrelid='public.anfragen'::regclass
  loop
    raise notice 'DELETE_DEPENDENCY: % / % / delete=%',
      constraint_row.child,constraint_row.conname,constraint_row.confdeltype;
  end loop;
  foreach t in array array['request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations'] loop
    perform privacy_test.check_that(exists(select 1 from pg_constraint
      where conrelid=('public.'||t)::regclass and confrelid='public.anfragen'::regclass
        and contype='f' and confdeltype='r'), 'restrict FK: '||t);
  end loop;
  select count(*) into before_count from public.request_messages;
  perform privacy_test.rejects('delete from public.anfragen where id=privacy_test.id(900)','23503',null);
  perform privacy_test.check_that((select count(*)=before_count from public.request_messages),
    'failed delete does not erase message content');
  -- Each new dependency is tested alone; never delete existing application data.
  foreach t in array array['request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations','request_conversations',
    'anfragen_reengagement_log'] loop
    n := n+1;
    insert into public.anfragen(id,status) values(privacy_test.id(n),'papierkorb');
    if t='request_care_assignments' then
      insert into public.request_care_assignments(request_id,coach_id)
        values(privacy_test.id(n),privacy_test.id(1));
    elsif t='request_care_transfers' then
      insert into public.request_care_transfers(operation_id,request_id,actor_id,reason_code,expected_version,result)
        values(gen_random_uuid(),privacy_test.id(n),privacy_test.id(3),'therapist_change',0,'{}');
    elsif t='request_health_authorizations' then
      insert into public.request_health_authorizations(consent_id,request_id,coach_id,purpose,notice_version)
        select id,privacy_test.id(n),privacy_test.id(1),'intake','synthetic'
        from public.anfrage_health_data_consents where request_id=privacy_test.id(12) limit 1;
    elsif t='request_care_operations' then
      insert into public.request_care_operations(id,request_id,care_version,completed_at)
        values(gen_random_uuid(),privacy_test.id(n),0,now());
    elsif t='request_conversations' then
      insert into public.request_conversations(anfrage_id,therapist_id,status,reply_alias,reply_token_hash)
        values(privacy_test.id(n),privacy_test.id(1),'review',
          'synthetic-'||n||'@example.invalid',repeat(md5(n::text),2));
    else
      insert into public.anfragen_reengagement_log(batch_id,anfrage_id,created_by)
        values(gen_random_uuid(),privacy_test.id(n),privacy_test.id(3));
    end if;
    perform privacy_test.rejects(format('delete from public.anfragen where id=privacy_test.id(%s)',n),
      '23503',null);
    perform privacy_test.check_that(exists(select 1 from public.anfragen where id=privacy_test.id(n)),
      'failed delete preserves request: '||t);
  end loop;
end;
$$;
select privacy_test.rejects('delete from public.request_conversations where id=privacy_test.id(904)',
  '23503',null);

-- Structural deletion evidence: no business retention rule is inferred here.
-- This transaction deliberately has no care-assignment FK, and is rolled back.
begin;
insert into public.anfragen(id,status) values(privacy_test.id(490),'papierkorb');
insert into public.anfrage_health_data_consents(request_id,token_hash,text_version)
  values(privacy_test.id(490),repeat('d',64),'2026-10-16-v1');
insert into public.client_link_recovery(secret_hash,request_id,recipient,token_fingerprint,purpose)
  values(repeat('e',64),privacy_test.id(490),'synthetic@example.invalid','synthetic','draft');
insert into public.client_link_recovery_queue(email,request_id)
  values('synthetic@example.invalid',privacy_test.id(490)::text);
delete from public.anfragen where id=privacy_test.id(490);
select privacy_test.check_that(exists(select 1 from public.anfrage_health_data_consents
  where request_id=privacy_test.id(490)), 'consent proof has no request FK: can survive deletion');
select privacy_test.check_that(not exists(select 1 from public.client_link_recovery
  where request_id=privacy_test.id(490)), 'recovery challenge cascades when parent deletion is allowed');
select privacy_test.check_that(exists(select 1 from public.client_link_recovery_queue
  where request_id=privacy_test.id(490)::text), 'recovery queue text reference does not cascade');
rollback;
select 'P0 SQL/RLS/trigger assertions completed' as result;
