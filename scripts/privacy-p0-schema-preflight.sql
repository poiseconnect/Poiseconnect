-- Read-only catalog report; no application rows or secrets are queried.
-- Do not run against production without separate approval.
begin transaction read only;

select current_database() as database_name,
  current_user as executed_as,
  current_setting('server_version') as postgres_version;

with expected(name) as (
  values
    ('anfragen'), ('team_members'), ('sessions'), ('invoices'),
    ('blocked_slots'), ('appointment_proposals'),
    ('anfrage_health_data_consents'), ('request_conversations'),
    ('request_messages'), ('request_message_events'),
    ('request_care_assignments'), ('request_care_transfers'),
    ('request_health_authorizations'), ('request_care_operations'),
    ('anfragen_reengagement_log'), ('client_link_recovery'),
    ('client_link_recovery_queue')
)
select e.name as expected_table,
  c.oid::regclass::text as actual_relation,
  c.relkind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  c.relowner::regrole::text as owner
from expected e
left join pg_class c on c.relnamespace = 'public'::regnamespace and c.relname = e.name
order by e.name;

select table_name, ordinal_position, column_name, data_type, udt_name,
  is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'anfragen','team_members','sessions','invoices','blocked_slots',
    'appointment_proposals','anfrage_health_data_consents',
    'request_conversations','request_messages','request_message_events',
    'request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations',
    'anfragen_reengagement_log','client_link_recovery',
    'client_link_recovery_queue'
  )
order by table_name, ordinal_position;

select conrelid::regclass::text as child_relation,
  conname as constraint_name,
  confrelid::regclass::text as parent_relation,
  pg_get_constraintdef(oid, true) as definition,
  case confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT'
    else confdeltype::text end as on_delete
from pg_constraint
where contype = 'f'
  and (
    conrelid in (select c.oid from pg_class c
      where c.relnamespace='public'::regnamespace and c.relname in (
        'anfragen','sessions','invoices','blocked_slots','appointment_proposals',
        'request_conversations','request_messages','request_message_events',
        'request_care_assignments','request_care_transfers',
        'request_health_authorizations','request_care_operations',
        'anfragen_reengagement_log','client_link_recovery','client_link_recovery_queue'
      ))
    or confrelid in (select c.oid from pg_class c
      where c.relnamespace='public'::regnamespace and c.relname in (
        'anfragen','team_members','sessions','invoices','blocked_slots',
        'appointment_proposals','request_conversations','request_messages',
        'request_care_assignments','request_health_authorizations'
      ))
  )
order by parent_relation, child_relation, constraint_name;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'anfragen','team_members','sessions','invoices','blocked_slots',
    'appointment_proposals','anfrage_health_data_consents',
    'request_conversations','request_messages','request_message_events',
    'request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations',
    'anfragen_reengagement_log','client_link_recovery',
    'client_link_recovery_queue'
  )
order by tablename, policyname;

select r.rolname, r.rolsuper, r.rolbypassrls, r.rolcanlogin, r.rolinherit,
  parent.rolname as member_of_role, m.admin_option
from pg_roles r
left join pg_auth_members m on m.member = r.oid
left join pg_roles parent on parent.oid = m.roleid
where r.rolname in ('anon','authenticated','service_role','authenticator','postgres')
   or parent.rolname in ('anon','authenticated','service_role','authenticator')
order by r.rolname, member_of_role;

select c.oid::regclass::text as relation,
  grantor.rolname as grantor,
  case when x.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
  x.privilege_type,
  x.is_grantable
from pg_class c
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
left join pg_roles grantor on grantor.oid = x.grantor
left join pg_roles grantee on grantee.oid = x.grantee
where c.relnamespace = 'public'::regnamespace
  and c.relname in (
    'anfragen','team_members','sessions','invoices','blocked_slots',
    'appointment_proposals','anfrage_health_data_consents',
    'request_conversations','request_messages','request_message_events',
    'request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations',
    'anfragen_reengagement_log','client_link_recovery',
    'client_link_recovery_queue'
  )
order by relation, grantee, privilege_type;

select a.attrelid::regclass::text as relation, a.attname as column_name,
  case when x.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
  x.privilege_type, x.is_grantable
from pg_attribute a
cross join lateral aclexplode(a.attacl) x
left join pg_roles grantee on grantee.oid = x.grantee
where a.attnum > 0 and not a.attisdropped and a.attacl is not null
  and a.attrelid in (select c.oid from pg_class c
    where c.relnamespace='public'::regnamespace and c.relname in (
      'anfragen','team_members','sessions','invoices','blocked_slots',
      'appointment_proposals','anfrage_health_data_consents',
      'request_conversations','request_messages','request_message_events',
      'request_care_assignments','request_care_transfers',
      'request_health_authorizations','request_care_operations',
      'anfragen_reengagement_log','client_link_recovery',
      'client_link_recovery_queue'
    ))
order by relation, column_name, grantee, privilege_type;

select n.nspname as schema_name, c.relname as table_name,
  t.tgname as trigger_name, pg_get_triggerdef(t.oid, true) as definition,
  p.proname as function_name, p.prosecdef as security_definer
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and n.nspname='public'
  and c.relname in (
    'anfragen','sessions','invoices','blocked_slots','appointment_proposals',
    'request_conversations','request_messages','request_message_events',
    'request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations',
    'anfragen_reengagement_log','client_link_recovery_queue'
  )
order by table_name, trigger_name;

select p.pubname, p.puballtables, p.pubinsert, p.pubupdate, p.pubdelete, p.pubtruncate,
  pt.schemaname, pt.tablename
from pg_publication p
left join pg_publication_tables pt on pt.pubname = p.pubname
  and pt.schemaname = 'public'
  and pt.tablename in (
    'anfragen','sessions','invoices','blocked_slots','appointment_proposals',
    'request_conversations','request_messages','request_message_events',
    'request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations',
    'anfragen_reengagement_log','client_link_recovery_queue'
  )
order by p.pubname, pt.tablename;

select n.nspname as schema_name, c.relname as view_name, c.relkind,
  dep.refobjid::regclass::text as referenced_relation
from pg_depend dep
join pg_rewrite rw on rw.oid = dep.objid
join pg_class c on c.oid = rw.ev_class
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('v','m')
  and n.nspname='public'
  and dep.refobjid in (select r.oid from pg_class r
    where r.relnamespace='public'::regnamespace and r.relname in (
      'anfragen','sessions','invoices','blocked_slots','appointment_proposals',
      'request_conversations','request_messages','request_message_events',
      'request_care_assignments','request_care_transfers',
      'request_health_authorizations','request_care_operations',
      'anfragen_reengagement_log','client_link_recovery_queue'
    ))
order by view_name, referenced_relation;

select p.oid::regprocedure::text as function_signature,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  case when x.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
  x.privilege_type, x.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
left join pg_roles grantee on grantee.oid = x.grantee
where n.nspname='public'
  and (p.proname like 'privacy_%'
    or p.proname in ('ensure_open_request_conversation',
      'close_open_request_conversation','enqueue_client_link_recovery'))
order by function_signature, grantee, privilege_type;

select defaclrole::regrole::text as default_acl_owner,
  defaclnamespace::regnamespace::text as schema_name,
  defaclobjtype,
  case when x.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
  x.privilege_type,
  x.is_grantable
from pg_default_acl d
cross join lateral aclexplode(d.defaclacl) x
left join pg_roles grantee on grantee.oid=x.grantee
where d.defaclnamespace in (0, 'public'::regnamespace)
order by default_acl_owner, schema_name, defaclobjtype, grantee;

rollback;
