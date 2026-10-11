/*
 * One SELECT statement. No application functions, explicit/advisory locks,
 * DDL or writes. Normal SELECT access-share locks still apply.
 * query_to_xml executes only the fixed aggregate SELECTs below, and only
 * after table existence, column existence, SELECT privileges and RLS checks.
 * Missing objects introduced by migrations 08/09/11/12 are FEHLT, not BLOCKER.
 * This is a preflight, not proof of function-body or application compatibility.
 */
WITH
table_spec(name, origin) AS (
  VALUES
    ('coach_invoices', 'VORAUSSETZUNG'),
    ('sessions', 'VORAUSSETZUNG'),
    ('anfragen', 'VORAUSSETZUNG'),
    ('team_members', 'VORAUSSETZUNG'),
    ('therapist_invoice_settings', 'VORAUSSETZUNG'),
    ('coach_quarter_releases', 'NEU: 20261009'),
    ('coach_invoice_sevdesk_claims', 'NEU: 20261012')
),
tables AS (
  SELECT s.*, c.oid, c.relkind, c.relowner,
         c.relrowsecurity, c.relforcerowsecurity
  FROM table_spec s
  LEFT JOIN pg_catalog.pg_namespace ns ON ns.nspname = 'public'
  LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = ns.oid AND c.relname = s.name
),
column_spec(tbl, col, accepted, origin) AS (
  VALUES
    ('coach_invoices','id',ARRAY['uuid'],'VORAUSSETZUNG'),
    ('coach_invoices','coach_id',ARRAY['uuid'],'VORAUSSETZUNG'),
    ('coach_invoices','billing_mode',ARRAY['text','varchar'],'VORAUSSETZUNG'),
    ('coach_invoices','billing_year',ARRAY['int4'],'VORAUSSETZUNG'),
    ('coach_invoices','billing_quarter',ARRAY['int4'],'VORAUSSETZUNG'),
    ('coach_invoices','billing_month',ARRAY['int4'],'VORAUSSETZUNG'),
    ('coach_invoices','bundle_key',ARRAY['text','varchar'],'VORAUSSETZUNG'),
    ('coach_invoices','updated_at',ARRAY['timestamptz'],'VORAUSSETZUNG'),
    ('coach_invoices','sevdesk_invoice_id',ARRAY['text','varchar','int4','int8','numeric'],'VORAUSSETZUNG'),
    ('coach_invoices','sevdesk_send_status',ARRAY['text'],'NEU: 20261008'),
    ('coach_invoices','sevdesk_send_requested_by',ARRAY['uuid'],'NEU: 20261008'),
    ('coach_invoices','sevdesk_send_created_at',ARRAY['timestamptz'],'NEU: 20261008'),
    ('coach_invoices','sevdesk_send_accepted_at',ARRAY['timestamptz'],'NEU: 20261008'),
    ('coach_invoices','sevdesk_send_email_id',ARRAY['text'],'NEU: 20261008'),
    ('coach_invoices','sevdesk_send_error_code',ARRAY['text'],'NEU: 20261008'),
    ('coach_invoices','coach_quarter_release_version',ARRAY['int4'],'NEU: 20261009'),
    ('coach_invoices','sevdesk_draft_invoice_number',ARRAY['text'],'NEU: 20261009'),
    ('coach_invoices','sevdesk_creation_candidate_id',ARRAY['text'],'NEU: 20261012'),
    ('coach_invoice_sevdesk_claims','sevdesk_invoice_id',ARRAY['text'],'NEU: 20261012'),
    ('coach_invoice_sevdesk_claims','coach_invoice_id',ARRAY['uuid'],'NEU: 20261012'),
    ('coach_invoice_sevdesk_claims','created_at',ARRAY['timestamptz'],'NEU: 20261012'),
    ('coach_invoices','tax_treatment',ARRAY['text'],'ALT: Lifecycle 20260927 / Anwendung'),
    ('coach_invoices','tax_reason',ARRAY['text'],'ALT: Lifecycle 20260927 / Anwendung'),
    ('sessions','id',ARRAY['uuid','int4','int8','text','varchar'],'VORAUSSETZUNG'),
    ('sessions','date',ARRAY['timestamptz'],'VORAUSSETZUNG'),
    ('sessions','price',ARRAY['numeric','float4','float8','int2','int4','int8'],'VORAUSSETZUNG'),
    ('sessions','therapist_id',ARRAY['uuid'],'VORAUSSETZUNG'),
    ('sessions','anfrage_id',ARRAY['uuid','int4','int8','text','varchar'],'VORAUSSETZUNG'),
    ('anfragen','id',ARRAY['uuid','int4','int8','text','varchar'],'VORAUSSETZUNG'),
    ('anfragen','invoice_with_vat',ARRAY['bool'],'VORAUSSETZUNG'),
    ('anfragen','beschaeftigungsgrad',ARRAY['text','varchar','numeric','int2','int4','int8','float4','float8'],'VORAUSSETZUNG'),
    ('team_members','id',ARRAY['uuid'],'VORAUSSETZUNG'),
    ('team_members','user_id',ARRAY['uuid'],'VORAUSSETZUNG'),
    ('team_members','email',ARRAY['text','varchar'],'VORAUSSETZUNG'),
    ('team_members','profile_name',ARRAY['text','varchar'],'VORAUSSETZUNG'),
    ('team_members','name',ARRAY['text','varchar'],'VORAUSSETZUNG'),
    ('team_members','sevdesk_contact_id',ARRAY['text','varchar','int4','int8','numeric'],'VORAUSSETZUNG'),
    ('team_members','active',ARRAY['bool'],'VORAUSSETZUNG'),
    ('team_members','role',ARRAY['text','varchar'],'VORAUSSETZUNG'),
    ('therapist_invoice_settings','therapist_id',ARRAY['uuid'],'VORAUSSETZUNG'),
    ('therapist_invoice_settings','company_name',ARRAY['text','varchar'],'VORAUSSETZUNG'),
    ('therapist_invoice_settings','address',ARRAY['text','varchar'],'VORAUSSETZUNG'),
    ('therapist_invoice_settings','default_vat_rate',ARRAY['numeric','float4','float8','int2','int4','int8'],'VORAUSSETZUNG'),
    ('therapist_invoice_settings','business_country_code',ARRAY['text'],'ALT: Lifecycle 20260927'),
    ('therapist_invoice_settings','vat_number',ARRAY['text','varchar'],'ALT: Lifecycle 20260927'),
    ('therapist_invoice_settings','uid_confirmed_at',ARRAY['timestamptz'],'ALT: Lifecycle 20260927'),
    ('therapist_invoice_settings','uid_confirmed_by',ARRAY['uuid'],'ALT: Lifecycle 20260927'),
    ('coach_quarter_releases','id',ARRAY['uuid'],'NEU: 20261009'),
    ('coach_quarter_releases','coach_id',ARRAY['uuid'],'NEU: 20261009'),
    ('coach_quarter_releases','billing_year',ARRAY['int4'],'NEU: 20261009'),
    ('coach_quarter_releases','billing_quarter',ARRAY['int4'],'NEU: 20261009'),
    ('coach_quarter_releases','release_version',ARRAY['int4'],'NEU: 20261009'),
    ('coach_quarter_releases','release_status',ARRAY['text'],'NEU: 20261009'),
    ('coach_quarter_releases','snapshot',ARRAY['jsonb'],'NEU: 20261009'),
    ('coach_quarter_releases','released_at',ARRAY['timestamptz'],'NEU: 20261009'),
    ('coach_quarter_releases','released_by',ARRAY['uuid'],'NEU: 20261009'),
    ('coach_quarter_releases','updated_at',ARRAY['timestamptz'],'NEU: 20261009')
),
columns AS (
  SELECT s.*, t.oid AS table_oid, a.attnum, a.atttypid,
         a.attnotnull, a.attgenerated, ty.typname,
         pg_catalog.format_type(a.atttypid, a.atttypmod) AS actual_type
  FROM column_spec s
  JOIN tables t ON t.name = s.tbl
  LEFT JOIN pg_catalog.pg_attribute a
    ON a.attrelid = t.oid AND a.attname = s.col
       AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_catalog.pg_type ty ON ty.oid = a.atttypid
),
index_spec(name, tbl, keys, predicate, is_unique, origin) AS (
  VALUES
    ('coach_invoices_unique_idx','coach_invoices',NULL::text[],NULL::text,true,'ALT: Lifecycle / Anwendung'),
    ('coach_invoices_sevdesk_send_status_idx','coach_invoices',ARRAY['sevdesk_send_status'],
      'sevdesk_send_statusisnotnull',false,'NEU: 20261008'),
    ('coach_quarter_releases_status_idx','coach_quarter_releases',
      ARRAY['release_status','billing_year','billing_quarter'],NULL,false,'NEU: 20261009'),
    ('coach_invoices_quarter_bundle_unique_idx','coach_invoices',
      ARRAY['coach_id','billing_year','billing_quarter','bundle_key'],
      'billing_mode=quartalandbilling_yearisnotnullandbilling_quarterisnotnullandbundle_keyisnotnull',
      true,'NEU: 20261011')
),
indexes AS (
  SELECT s.*, ic.oid AS object_oid, i.indrelid, t.oid AS expected_table_oid,
         i.indisunique, i.indisvalid, i.indisready, i.indexprs,
         CASE WHEN i.indexrelid IS NOT NULL
           THEN pg_catalog.pg_get_indexdef(i.indexrelid) END AS index_definition,
         pg_catalog.pg_get_expr(i.indpred,i.indrelid) AS actual_predicate,
         ARRAY(
           SELECT a.attname::text
           FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum,n)
           LEFT JOIN pg_catalog.pg_attribute a
             ON a.attrelid=i.indrelid AND a.attnum=k.attnum
           WHERE k.n <= i.indnkeyatts ORDER BY k.n
         ) AS actual_keys
  FROM index_spec s
  JOIN tables t ON t.name=s.tbl
  LEFT JOIN pg_catalog.pg_namespace ns ON ns.nspname='public'
  LEFT JOIN pg_catalog.pg_class ic ON ic.relnamespace=ns.oid AND ic.relname=s.name
  LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=ic.oid
),
function_spec(sig, result, arg_names, origin) AS (
  VALUES
    ('public.coach_quarter_snapshot(uuid,integer,integer)','jsonb',
      ARRAY['p_coach_id','p_billing_year','p_billing_quarter'],'NEU: 20261009'),
    ('public.release_coach_quarter(uuid,integer,integer,uuid)','public.coach_quarter_releases',
      ARRAY['p_coach_id','p_billing_year','p_billing_quarter','p_released_by'],'NEU: 20261009; ersetzt 20261011'),
    ('public.reserve_coach_invoice_creation(uuid,uuid,integer,timestamptz)','text',
      ARRAY['p_invoice_id','p_admin_id','p_release_version','p_expected_updated_at'],'NEU: 20261009; ersetzt 20261011/12'),
    ('public.mark_coach_quarter_stale(uuid,timestamptz)','void',
      ARRAY['p_coach_id','p_session_date'],'NEU: 20261009; ersetzt 20261011'),
    ('public.invalidate_coach_quarter_on_session_change()','trigger',NULL,'NEU: 20261009'),
    ('public.invalidate_coach_quarter_on_anfrage_change()','trigger',NULL,'NEU: 20261009'),
    ('public.invalidate_coach_quarter_on_tax_profile_change()','trigger',NULL,'NEU: 20261009'),
    ('public.invalidate_coach_quarter_on_team_member_change()','trigger',NULL,'NEU: 20261009'),
    ('public.lock_coach_billing(uuid)','uuid',ARRAY['p_coach_id'],'NEU: 20261011'),
    ('public.guard_coach_billing_write(uuid)','void',ARRAY['p_coach_id'],'NEU: 20261011'),
    ('public.guard_coach_billing_source_change()','trigger',NULL,'NEU: 20261011'),
    ('public.guard_coach_invoice_creation_update()','trigger',NULL,'NEU: 20261011'),
    ('public.invalidate_coach_uid_confirmation()','trigger',NULL,'ALT: Lifecycle 20260927'),
    ('public.check_coach_invoice_link(uuid)','text',ARRAY['p_invoice_id'],'NEU: 20261012'),
    ('public.guard_coach_invoice_link()','trigger',NULL,'NEU: 20261012')
),
functions AS (
  SELECT s.*, p.oid, p.prorettype, p.proargnames, p.prokind,
         p.prosecdef, p.proconfig, p.proacl, p.proowner, p.prosrc
  FROM function_spec s
  LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(s.sig)
),
body_spec(sig, digest) AS (
  VALUES
    ('public.coach_quarter_snapshot(uuid,integer,integer)','864171f21cb4660fba5201e4a107776c'),
    ('public.release_coach_quarter(uuid,integer,integer,uuid)','2ca430305dd18010d739ee77ec30ca25'),
    ('public.reserve_coach_invoice_creation(uuid,uuid,integer,timestamptz)','c53b16079cc9f411633158aa76c661ad'),
    ('public.mark_coach_quarter_stale(uuid,timestamptz)','f3fc26076ab8869497eadeffb522d803'),
    ('public.invalidate_coach_quarter_on_session_change()','ddf3756c84b4a969cebe0d877d836190'),
    ('public.invalidate_coach_quarter_on_anfrage_change()','5ea3ced2df544da11db9ebfaf6ea5573'),
    ('public.invalidate_coach_quarter_on_tax_profile_change()','5cd912b7514a5d50cd356c190208052a'),
    ('public.invalidate_coach_quarter_on_team_member_change()','94219ddbae52808754b538203e6b6e27'),
    ('public.lock_coach_billing(uuid)','9829e2d60d3ce14db5e89f908e844422'),
    ('public.guard_coach_billing_write(uuid)','81eba41bdd6e399563dc534f371d9255'),
    ('public.guard_coach_billing_source_change()','2d4edc538cc8656e52088bfc8341a3da'),
    ('public.guard_coach_invoice_creation_update()','251566b39dda5b4b4ef68ca3939df6a2'),
    ('public.check_coach_invoice_link(uuid)','0951a8f1ca1187df074ddabfc5bf63c4'),
    ('public.guard_coach_invoice_link()','3f66a7ab1a86e00a5e8f45eb6b89776d')
),
trigger_spec(tbl, name, sig, mask, origin) AS (
  VALUES
    ('sessions','sessions_coach_quarter_release_invalidation',
      'public.invalidate_coach_quarter_on_session_change()',29,'NEU: 20261009'),
    ('anfragen','anfragen_coach_quarter_release_invalidation',
      'public.invalidate_coach_quarter_on_anfrage_change()',17,'NEU: 20261009'),
    ('therapist_invoice_settings','therapist_settings_coach_quarter_release_invalidation',
      'public.invalidate_coach_quarter_on_tax_profile_change()',29,'NEU: 20261009'),
    ('team_members','team_members_coach_quarter_release_invalidation',
      'public.invalidate_coach_quarter_on_team_member_change()',17,'NEU: 20261009'),
    ('sessions','sessions_coach_billing_creation_guard',
      'public.guard_coach_billing_source_change()',31,'NEU: 20261011'),
    ('anfragen','anfragen_coach_billing_creation_guard',
      'public.guard_coach_billing_source_change()',19,'NEU: 20261011'),
    ('coach_quarter_releases','coach_quarter_releases_billing_creation_guard',
      'public.guard_coach_billing_source_change()',31,'NEU: 20261011'),
    ('therapist_invoice_settings','therapist_settings_coach_billing_creation_guard',
      'public.guard_coach_billing_source_change()',31,'NEU: 20261011'),
    ('team_members','team_members_coach_billing_creation_guard',
      'public.guard_coach_billing_source_change()',27,'NEU: 20261011'),
    ('coach_invoices','coach_invoice_creation_write_guard',
      'public.guard_coach_invoice_creation_update()',27,'NEU: 20261011'),
    ('therapist_invoice_settings','therapist_invoice_settings_uid_confirmation_guard',
      'public.invalidate_coach_uid_confirmation()',19,'ALT: Lifecycle 20260927'),
    ('coach_invoices','coach_invoice_00_link_write_guard',
      'public.guard_coach_invoice_link()',31,'NEU: 20261012')
),
constraint_spec(tbl, kind, keys, ref_table, ref_keys, delete_action, origin) AS (
  VALUES
    ('team_members','key',ARRAY['id'],NULL::text,NULL::text[],NULL::text,'VORAUSSETZUNG: eindeutiges FK-Ziel'),
    ('coach_invoices','p',ARRAY['id'],NULL,NULL,NULL,'ANWENDUNG: eindeutiger Draft'),
    ('coach_quarter_releases','p',ARRAY['id'],NULL,NULL,NULL,'NEU: 20261009'),
    ('coach_quarter_releases','u',ARRAY['coach_id','billing_year','billing_quarter'],NULL,NULL,NULL,'NEU: 20261009'),
    ('coach_quarter_releases','f',ARRAY['coach_id'],'team_members',ARRAY['id'],'c','NEU: 20261009'),
    ('coach_quarter_releases','f',ARRAY['released_by'],'team_members',ARRAY['id'],'a','NEU: 20261009'),
    ('coach_invoice_sevdesk_claims','p',ARRAY['sevdesk_invoice_id'],NULL,NULL,NULL,'NEU: 20261012'),
    ('coach_invoice_sevdesk_claims','u',ARRAY['coach_invoice_id'],NULL,NULL,NULL,'NEU: 20261012'),
    ('coach_invoice_sevdesk_claims','f',ARRAY['coach_invoice_id'],'coach_invoices',ARRAY['id'],'a','NEU: 20261012')
),
constraint_checks AS (
  SELECT s.*, t.oid AS table_oid,
    EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint c
      WHERE c.conrelid=t.oid AND
        (c.contype::text=s.kind OR (s.kind='key' AND c.contype IN ('p','u')))
        AND c.convalidated AND NOT c.condeferrable
        AND ARRAY(
          SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,n)
          JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
          ORDER BY k.n
        )=s.keys
        AND (s.ref_table IS NULL OR (
          c.confrelid=pg_catalog.to_regclass('public.'||s.ref_table)
          AND c.confdeltype::text=s.delete_action
          AND ARRAY(
            SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(attnum,n)
            JOIN pg_catalog.pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum
            ORDER BY k.n
          )=s.ref_keys
        ))
    ) OR (
      s.kind IN ('key','u') AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_index i
        WHERE i.indrelid=t.oid AND i.indisunique AND i.indisvalid
          AND i.indisready AND i.indimmediate
          AND i.indpred IS NULL AND i.indexprs IS NULL
          AND ARRAY(
            SELECT a.attname::text
            FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum,n)
            JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
            WHERE k.n<=i.indnkeyatts ORDER BY k.n
          )=s.keys
      )
    ) AS matches
  FROM constraint_spec s JOIN tables t ON t.name=s.tbl
),
/* Fixed aggregate SELECTs only; JSON access makes absent optional fields safe.
 * Required columns are checked separately before each query is evaluated.
 */
data_spec(name, tbls, required_columns, severity, sql_text) AS (
  VALUES
    ('Quartalsrechnungen gesamt',ARRAY['coach_invoices'],ARRAY['coach_invoices.billing_mode'],'INFO',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'billing_mode'='quartal'$q$),
    ('Quartal: fehlende Schluessel',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.billing_mode','coach_invoices.coach_id','coach_invoices.billing_year','coach_invoices.billing_quarter','coach_invoices.bundle_key'],'BLOCKER',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'billing_mode'='quartal'
       AND (to_jsonb(i)->>'coach_id' IS NULL OR to_jsonb(i)->>'billing_year' IS NULL
         OR to_jsonb(i)->>'billing_quarter' IS NULL OR nullif(btrim(to_jsonb(i)->>'bundle_key'),'') IS NULL)$q$),
    ('Quartal: ungueltiger Zeitraum/Bundle',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.billing_mode','coach_invoices.billing_year','coach_invoices.billing_quarter','coach_invoices.bundle_key'],'BLOCKER',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'billing_mode'='quartal'
       AND ((to_jsonb(i)->>'billing_quarter') NOT IN ('1','2','3','4')
         OR (to_jsonb(i)->>'billing_year') !~ '^[2-9][0-9]{3}$'
         OR (to_jsonb(i)->>'bundle_key') NOT IN ('normal_ust','reverse_charge'))$q$),
    ('Quartal: doppelte Coach/Jahr/Quartal/Bundle-Gruppen',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.billing_mode','coach_invoices.coach_id','coach_invoices.billing_year','coach_invoices.billing_quarter','coach_invoices.bundle_key'],'BLOCKER',
      $q$SELECT count(*) AS n FROM (
        SELECT 1 FROM public.coach_invoices i WHERE to_jsonb(i)->>'billing_mode'='quartal'
        GROUP BY to_jsonb(i)->>'coach_id',to_jsonb(i)->>'billing_year',
                 to_jsonb(i)->>'billing_quarter',to_jsonb(i)->>'bundle_key'
        HAVING count(*)>1) d$q$),
    ('Quartal: beide getrennten Bundles vorhanden',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.billing_mode','coach_invoices.coach_id','coach_invoices.billing_year','coach_invoices.billing_quarter','coach_invoices.bundle_key'],'INFO',
      $q$SELECT count(*) AS n FROM (
        SELECT 1 FROM public.coach_invoices i WHERE to_jsonb(i)->>'billing_mode'='quartal'
        GROUP BY to_jsonb(i)->>'coach_id',to_jsonb(i)->>'billing_year',to_jsonb(i)->>'billing_quarter'
        HAVING count(DISTINCT to_jsonb(i)->>'bundle_key') FILTER
          (WHERE to_jsonb(i)->>'bundle_key' IN ('normal_ust','reverse_charge'))=2) d$q$),
    ('Rechnungen: Coach fehlt/nicht kanonisch',ARRAY['coach_invoices','team_members'],
      ARRAY['coach_invoices.coach_id','team_members.id'],'BLOCKER',
      $q$SELECT count(*) AS n FROM public.coach_invoices i
        WHERE NOT EXISTS (SELECT 1 FROM public.team_members m
          WHERE to_jsonb(m)->>'id'=to_jsonb(i)->>'coach_id')$q$),
    ('Coach: mehrdeutige user_id',ARRAY['team_members'],ARRAY['team_members.user_id'],'BLOCKER',
      $q$SELECT count(*) AS n FROM (
        SELECT 1 FROM public.team_members m WHERE to_jsonb(m)->>'user_id' IS NOT NULL
        GROUP BY to_jsonb(m)->>'user_id' HAVING count(*)>1) d$q$),
    ('Coach: id/user_id-Kollision zwischen Mitgliedern',ARRAY['team_members'],
      ARRAY['team_members.id','team_members.user_id'],'BLOCKER',
      $q$SELECT count(*) AS n FROM public.team_members m JOIN public.team_members x
        ON to_jsonb(m)->>'user_id'=to_jsonb(x)->>'id'
        WHERE to_jsonb(m)->>'id' IS DISTINCT FROM to_jsonb(x)->>'id'$q$),
    ('Steuerprofil: mehrere Zeilen je Coach',ARRAY['therapist_invoice_settings'],
      ARRAY['therapist_invoice_settings.therapist_id'],'BLOCKER',
      $q$SELECT count(*) AS n FROM (
        SELECT 1 FROM public.therapist_invoice_settings t
        GROUP BY to_jsonb(t)->>'therapist_id' HAVING count(*)>1) d$q$),
    ('Steuerprofil: nicht kanonische Coach-Zuordnung',ARRAY['therapist_invoice_settings','team_members'],
      ARRAY['therapist_invoice_settings.therapist_id','team_members.id'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.therapist_invoice_settings t
        WHERE NOT EXISTS (SELECT 1 FROM public.team_members m
          WHERE to_jsonb(m)->>'id'=to_jsonb(t)->>'therapist_id')$q$),
    ('Sitzungen: Coach-Zuordnung fehlt',ARRAY['sessions','team_members'],
      ARRAY['sessions.therapist_id','team_members.id','team_members.user_id'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.sessions s WHERE NOT EXISTS (
        SELECT 1 FROM public.team_members m WHERE to_jsonb(s)->>'therapist_id'
          IN (to_jsonb(m)->>'id',to_jsonb(m)->>'user_id'))$q$),
    ('Sitzungen: Datum fehlt',ARRAY['sessions'],ARRAY['sessions.date'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.sessions s WHERE to_jsonb(s)->>'date' IS NULL$q$),
    ('Sitzungen: Preis fehlt/ungueltig/nichtpositiv',ARRAY['sessions'],ARRAY['sessions.price'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.sessions s
        WHERE CASE WHEN (to_jsonb(s)->>'price') ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
          THEN (to_jsonb(s)->>'price')::numeric <= 0 ELSE true END$q$),
    ('Sitzungen: Anfrage fehlt',ARRAY['sessions','anfragen'],
      ARRAY['sessions.anfrage_id','anfragen.id'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.sessions s WHERE NOT EXISTS (
        SELECT 1 FROM public.anfragen a WHERE to_jsonb(a)->>'id'=to_jsonb(s)->>'anfrage_id')$q$),
    ('Rechnungen: sevDesk-ID vorhanden',ARRAY['coach_invoices'],ARRAY['coach_invoices.sevdesk_invoice_id'],'INFO',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'sevdesk_invoice_id' IS NOT NULL$q$),
    ('Rechnungen: sevDesk-ID fehlt',ARRAY['coach_invoices'],ARRAY['coach_invoices.sevdesk_invoice_id'],'INFO',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'sevdesk_invoice_id' IS NULL$q$),
    ('Rechnungen: sevDesk-ID mehrfach verknuepft',ARRAY['coach_invoices'],ARRAY['coach_invoices.sevdesk_invoice_id'],'WARNUNG',
      $q$SELECT count(*) AS n FROM (
        SELECT 1 FROM public.coach_invoices i
        WHERE nullif(btrim(to_jsonb(i)->>'sevdesk_invoice_id'),'') IS NOT NULL
        GROUP BY btrim(to_jsonb(i)->>'sevdesk_invoice_id') HAVING count(*)>1) d$q$),
    ('Bekannte Quarantaene: betroffene Rechnungen',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.sevdesk_invoice_id'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.coach_invoices i
        WHERE btrim(to_jsonb(i)->>'sevdesk_invoice_id') IN ('135675889','135833778')$q$),
    ('Bekannte Quarantaene: betroffene Coaches',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.sevdesk_invoice_id','coach_invoices.coach_id'],'WARNUNG',
      $q$SELECT count(DISTINCT to_jsonb(i)->>'coach_id') AS n FROM public.coach_invoices i
        WHERE btrim(to_jsonb(i)->>'sevdesk_invoice_id') IN ('135675889','135833778')$q$),
    ('Weitere externe Duplikatgruppen',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.sevdesk_invoice_id'],'WARNUNG',
      $q$SELECT count(*) AS n FROM (
        SELECT 1 FROM public.coach_invoices i
        WHERE nullif(btrim(to_jsonb(i)->>'sevdesk_invoice_id'),'') IS NOT NULL
          AND btrim(to_jsonb(i)->>'sevdesk_invoice_id') NOT IN ('135675889','135833778')
        GROUP BY btrim(to_jsonb(i)->>'sevdesk_invoice_id') HAVING count(*)>1) d$q$),
    ('Externe IDs: ungueltig oder nicht kanonisch',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.sevdesk_invoice_id'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.coach_invoices i
        WHERE to_jsonb(i)->>'sevdesk_invoice_id' IS NOT NULL AND
          ((to_jsonb(i)->>'sevdesk_invoice_id') !~ '^[1-9][0-9]*$')$q$),
    ('Claims: widerspruechliche oder verwaiste Zuordnung',ARRAY['coach_invoice_sevdesk_claims','coach_invoices'],
      ARRAY['coach_invoice_sevdesk_claims.sevdesk_invoice_id','coach_invoice_sevdesk_claims.coach_invoice_id',
        'coach_invoices.id','coach_invoices.sevdesk_invoice_id'],'BLOCKER',
      $q$SELECT count(*) AS n FROM public.coach_invoice_sevdesk_claims c
        WHERE coalesce(to_jsonb(c)->>'sevdesk_invoice_id','') !~ '^[1-9][0-9]*$'
          OR to_jsonb(c)->>'sevdesk_invoice_id' IN ('135675889','135833778')
          OR NOT EXISTS (SELECT 1 FROM public.coach_invoices i
            WHERE to_jsonb(i)->>'id'=to_jsonb(c)->>'coach_invoice_id'
              AND btrim(to_jsonb(i)->>'sevdesk_invoice_id')=to_jsonb(c)->>'sevdesk_invoice_id')$q$),
    ('Claims: doppelte externe oder lokale Schluessel',ARRAY['coach_invoice_sevdesk_claims'],
      ARRAY['coach_invoice_sevdesk_claims.sevdesk_invoice_id','coach_invoice_sevdesk_claims.coach_invoice_id'],'BLOCKER',
      $q$SELECT count(*) AS n FROM (
        SELECT 1 FROM public.coach_invoice_sevdesk_claims c
          GROUP BY to_jsonb(c)->>'sevdesk_invoice_id' HAVING count(*)>1
        UNION ALL
        SELECT 1 FROM public.coach_invoice_sevdesk_claims c
          GROUP BY to_jsonb(c)->>'coach_invoice_id' HAVING count(*)>1) d$q$),
    ('Wiederherstellung: Candidate-ID vorhanden',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.sevdesk_creation_candidate_id'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.coach_invoices i
        WHERE to_jsonb(i)->>'sevdesk_creation_candidate_id' IS NOT NULL$q$),
    ('Status: nicht von 20261009 zugelassen',ARRAY['coach_invoices'],ARRAY['coach_invoices.sevdesk_send_status'],'BLOCKER',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'sevdesk_send_status' IS NOT NULL
        AND to_jsonb(i)->>'sevdesk_send_status' NOT IN
          ('creating','creation_unknown','created','sending','send_failed','send_unknown','sent','finalized')$q$),
    ('Status: finalized vor 20261008',ARRAY['coach_invoices'],ARRAY['coach_invoices.sevdesk_send_status'],'FINALIZED',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'sevdesk_send_status'='finalized'$q$),
    ('Status: laufend/unklar/alter Versandpfad',ARRAY['coach_invoices'],ARRAY['coach_invoices.sevdesk_send_status'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'sevdesk_send_status'
        IN ('creating','creation_unknown','sending','send_failed','send_unknown','sent','finalized')$q$),
    ('Status: ID vorhanden ohne Status',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.sevdesk_invoice_id','coach_invoices.sevdesk_send_status'],'WARNUNG',
      $q$SELECT count(*) AS n FROM public.coach_invoices i
        WHERE to_jsonb(i)->>'sevdesk_invoice_id' IS NOT NULL AND to_jsonb(i)->>'sevdesk_send_status' IS NULL$q$),
    ('Status: created/sent/finalized ohne ID',ARRAY['coach_invoices'],
      ARRAY['coach_invoices.sevdesk_invoice_id','coach_invoices.sevdesk_send_status'],'BLOCKER',
      $q$SELECT count(*) AS n FROM public.coach_invoices i WHERE to_jsonb(i)->>'sevdesk_invoice_id' IS NULL
        AND to_jsonb(i)->>'sevdesk_send_status' IN ('created','sent','finalized')$q$),
    ('Freigaben: doppelte Coach/Jahr/Quartal-Gruppen',ARRAY['coach_quarter_releases'],
      ARRAY['coach_quarter_releases.coach_id','coach_quarter_releases.billing_year','coach_quarter_releases.billing_quarter'],'BLOCKER',
      $q$SELECT count(*) AS n FROM (
        SELECT 1 FROM public.coach_quarter_releases r
        GROUP BY to_jsonb(r)->>'coach_id',to_jsonb(r)->>'billing_year',to_jsonb(r)->>'billing_quarter'
        HAVING count(*)>1) d$q$),
    ('Freigaben: ungueltige Pflichtdaten/Snapshot',ARRAY['coach_quarter_releases'],
      ARRAY['coach_quarter_releases.id','coach_quarter_releases.coach_id','coach_quarter_releases.billing_year',
        'coach_quarter_releases.billing_quarter','coach_quarter_releases.release_version',
        'coach_quarter_releases.release_status','coach_quarter_releases.snapshot','coach_quarter_releases.updated_at'],'BLOCKER',
      $q$SELECT count(*) AS n FROM public.coach_quarter_releases r
        WHERE to_jsonb(r)->>'id' IS NULL OR to_jsonb(r)->>'coach_id' IS NULL
          OR coalesce(to_jsonb(r)->>'billing_year','') !~ '^[2-9][0-9]{3}$'
          OR coalesce(to_jsonb(r)->>'billing_quarter','') NOT IN ('1','2','3','4')
          OR coalesce(to_jsonb(r)->>'release_version','') !~ '^[0-9]+$'
          OR coalesce(to_jsonb(r)->>'release_status','') NOT IN ('released','stale')
          OR jsonb_typeof(to_jsonb(r)->'snapshot') IS DISTINCT FROM 'object'
          OR jsonb_typeof(to_jsonb(r)->'snapshot'->'sessions') IS DISTINCT FROM 'array'
          OR to_jsonb(r)->>'updated_at' IS NULL$q$)
),
data_ready AS (
  SELECT d.*,
    NOT EXISTS (
      SELECT 1 FROM unnest(d.tbls) n(name)
      LEFT JOIN tables t ON t.name=n.name
      WHERE t.oid IS NULL OR t.relkind NOT IN ('r','p')
    ) AND NOT EXISTS (
      SELECT 1 FROM unnest(d.required_columns) k(key)
      LEFT JOIN columns c ON c.tbl||'.'||c.col=k.key
      WHERE c.attnum IS NULL
    ) AS schema_ready,
    NOT EXISTS (
      SELECT 1 FROM tables t WHERE t.name=ANY(d.tbls)
      AND CASE WHEN t.oid IS NULL THEN true
        ELSE NOT pg_catalog.has_table_privilege(t.oid,'SELECT')
          OR pg_catalog.row_security_active(t.oid) END
    ) AS access_ready
  FROM data_spec d
),
data_counts AS MATERIALIZED (
  SELECT d.*,
    CASE WHEN schema_ready AND access_ready THEN
      ((pg_catalog.xpath('/table/row/n/text()',
        pg_catalog.query_to_xml(sql_text,false,false,'')))[1]::text)::bigint
    END AS n
  FROM data_ready d
),
link_guard_verified AS (
  SELECT
    NOT EXISTS (
      SELECT 1 FROM body_spec b JOIN functions f ON f.sig=b.sig
      WHERE b.sig IN (
        'public.check_coach_invoice_link(uuid)',
        'public.guard_coach_invoice_link()',
        'public.reserve_coach_invoice_creation(uuid,uuid,integer,timestamptz)',
        'public.guard_coach_invoice_creation_update()')
      AND (f.oid IS NULL OR md5(f.prosrc) IS DISTINCT FROM b.digest
        OR NOT f.prosecdef OR f.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp'])
    )
    AND EXISTS (
      SELECT 1 FROM tables t JOIN pg_catalog.pg_trigger tr ON tr.tgrelid=t.oid
      WHERE t.name='coach_invoices' AND tr.tgname='coach_invoice_00_link_write_guard'
        AND tr.tgfoid=pg_catalog.to_regprocedure('public.guard_coach_invoice_link()')
        AND tr.tgtype=31 AND tr.tgenabled IN ('O','A')
        AND tr.tgqual IS NULL AND tr.tgattr::text='' AND NOT tr.tgisinternal
    )
    AND NOT EXISTS (
      SELECT 1 FROM constraint_checks WHERE tbl='coach_invoice_sevdesk_claims' AND NOT matches
    )
    AND EXISTS (
      SELECT 1 FROM tables WHERE name='coach_invoice_sevdesk_claims'
        AND oid IS NOT NULL AND relkind='r' AND relrowsecurity
    ) AS verified
),
findings(bereich, pruefung, status, details) AS (
  SELECT 'Ablauf','Migrationsreihenfolge','OK',
    '20261008 -> 20261009 -> 20261011 -> 20261012. 09 benoetigt 08; 11 benoetigt 09; 12 benoetigt 11 und friert Konflikte ohne Bereinigung ein.'
  UNION ALL SELECT 'Historie','supabase_migrations.schema_migrations',
    CASE WHEN pg_catalog.to_regclass('supabase_migrations.schema_migrations') IS NULL THEN 'WARNUNG' ELSE 'OK' END,
    'Nur Existenzpruefung. Fehlende Historie ist kein Schema-Blocker; Objektbestand beweist keinen vollstaendigen Migrationsstand.'
  UNION ALL SELECT 'Tabellen','public.'||name,
    CASE WHEN oid IS NULL THEN CASE WHEN origin LIKE 'NEU:%' THEN 'FEHLT' ELSE 'BLOCKER' END
      WHEN relkind NOT IN ('r','p') THEN 'BLOCKER' ELSE 'OK' END,
    origin||CASE WHEN oid IS NULL THEN '; nicht vorhanden'
      ELSE '; relkind='||relkind::text||'; RLS='||relrowsecurity||'; FORCE RLS='||relforcerowsecurity END
  FROM tables
  UNION ALL SELECT 'Spalten',tbl||'.'||col,
    CASE WHEN attnum IS NULL THEN
      CASE WHEN origin LIKE 'NEU:%' AND table_oid IS NULL THEN 'FEHLT'
        WHEN tbl IN ('coach_quarter_releases','coach_invoice_sevdesk_claims') AND table_oid IS NOT NULL THEN 'BLOCKER'
        WHEN origin LIKE 'NEU:%' THEN 'FEHLT' ELSE 'BLOCKER' END
      WHEN NOT (typname=ANY(accepted)) OR attgenerated<>'' THEN 'BLOCKER' ELSE 'OK' END,
    origin||'; Typ='||coalesce(actual_type,'fehlt')||
    '; erwartet/kompatibel='||array_to_string(accepted,',')||
    CASE WHEN tbl='coach_quarter_releases' AND table_oid IS NOT NULL AND attnum IS NULL
      THEN '; CREATE TABLE IF NOT EXISTS repariert bestehende unvollstaendige Tabelle nicht' ELSE '' END
  FROM columns
  UNION ALL SELECT 'Claim-Tabelle',tbl||'.'||col||' NOT NULL',
    CASE WHEN table_oid IS NULL THEN 'FEHLT'
      WHEN attnum IS NULL OR NOT attnotnull THEN 'BLOCKER' ELSE 'OK' END,
    'NEU: 12; IF NOT EXISTS repariert eine bereits vorhandene unvollstaendige Claim-Tabelle nicht'
  FROM columns WHERE tbl='coach_invoice_sevdesk_claims'
  UNION ALL SELECT 'Claim-Tabelle','CHECK positive numerische externe ID',
    CASE WHEN t.oid IS NULL THEN 'FEHLT'
      WHEN EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        WHERE c.conrelid=t.oid AND c.contype='c' AND c.convalidated
          AND regexp_replace(pg_catalog.pg_get_constraintdef(c.oid),
            '::text|[()[:space:]]','','g') =
            $expected$CHECKsevdesk_invoice_id~'^[1-9][0-9]*$'$expected$
      ) THEN 'OK' ELSE 'BLOCKER' END,
    'NEU: 12; bestehende Tabelle muss den vorgesehenen validierten CHECK bereits besitzen'
  FROM tables t WHERE t.name='coach_invoice_sevdesk_claims'
  UNION ALL SELECT 'Claim-Tabelle','created_at DEFAULT now()',
    CASE WHEN t.oid IS NULL THEN 'FEHLT'
      WHEN EXISTS (
        SELECT 1 FROM pg_catalog.pg_attrdef d
        JOIN pg_catalog.pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
        WHERE d.adrelid=t.oid AND a.attname='created_at'
          AND pg_catalog.pg_get_expr(d.adbin,d.adrelid)='now()'
      ) THEN 'OK' ELSE 'BLOCKER' END,
    'NEU: 12; Claim-INSERT liefert created_at nicht explizit'
  FROM tables t WHERE t.name='coach_invoice_sevdesk_claims'
  UNION ALL SELECT 'Freigabetabelle',tbl||'.'||col||' NOT NULL',
    CASE WHEN table_oid IS NULL THEN 'FEHLT'
      WHEN attnum IS NULL OR NOT attnotnull THEN 'BLOCKER' ELSE 'OK' END,
    'NEU: 20261009; bestehende Tabelle muss Pflichtspalten bereits NOT NULL deklarieren; IF NOT EXISTS ergaenzt keine Constraints'
  FROM columns
  WHERE tbl='coach_quarter_releases'
    AND col IN ('id','coach_id','billing_year','billing_quarter','release_version','release_status','snapshot','updated_at')
  UNION ALL SELECT 'Freigabetabelle','Defaults fuer id/release_version/release_status/updated_at',
    CASE WHEN t.oid IS NULL THEN 'FEHLT'
      WHEN (SELECT count(*) FROM pg_catalog.pg_attrdef d
        JOIN pg_catalog.pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
        WHERE d.adrelid=t.oid AND a.attname IN ('id','release_version','release_status','updated_at'))=4
        THEN 'WARNUNG' ELSE 'BLOCKER' END,
    'NEU: 09; bei vorhandener Tabelle Defaults manuell mit gen_random_uuid(), 0, stale, now() vergleichen. Vorhandensein allein belegt nicht den Ausdruck.'
  FROM tables t WHERE t.name='coach_quarter_releases'
  UNION ALL SELECT 'Freigabetabelle','CHECK billing_quarter / release_status',
    CASE WHEN t.oid IS NULL THEN 'FEHLT'
      WHEN (SELECT count(DISTINCT a.attname)
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
        WHERE c.conrelid=t.oid AND c.contype='c' AND c.convalidated
          AND a.attname IN ('billing_quarter','release_status'))=2
        THEN 'WARNUNG' ELSE 'BLOCKER' END,
    'NEU: 09; vorhandene CHECK-Ausdruecke manuell mit Quartal 1..4 und Status released/stale vergleichen; keine geratene Constraint-Benennung.'
  FROM tables t WHERE t.name='coach_quarter_releases'
  UNION ALL SELECT 'Typabgleich','sessions.anfrage_id = anfragen.id',
    CASE WHEN s.atttypid IS NULL OR a.atttypid IS NULL THEN 'BLOCKER'
      WHEN s.atttypid<>a.atttypid THEN 'WARNUNG' ELSE 'OK' END,
    'Join-Typen: '||coalesce(s.actual_type,'fehlt')||' / '||coalesce(a.actual_type,'fehlt')||
    '; bei Abweichung SQL-Gleichheitsoperator/implizite Konvertierung manuell pruefen'
  FROM columns s CROSS JOIN columns a
  WHERE s.tbl='sessions' AND s.col='anfrage_id' AND a.tbl='anfragen' AND a.col='id'
  UNION ALL SELECT 'Rollen',r.name,
    CASE WHEN p.oid IS NULL THEN 'BLOCKER' ELSE 'OK' END,
    'Explizite GRANT/REVOKE-Abhaengigkeit; bestehende Rechte werden nicht erweitert'
  FROM (VALUES ('anon'),('authenticated'),('service_role')) r(name)
  LEFT JOIN pg_catalog.pg_roles p ON p.rolname=r.name
  UNION ALL SELECT 'System','gen_random_uuid() / plpgsql / Advisory-Lock-Funktionen',
    CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
        WHERE p.proname='gen_random_uuid' AND p.pronargs=0 AND p.prorettype='uuid'::regtype
          AND ns.nspname IN ('pg_catalog','public'))
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_language WHERE lanname='plpgsql')
      AND pg_catalog.to_regprocedure('pg_catalog.hashtextextended(text,bigint)') IS NOT NULL
      AND pg_catalog.to_regprocedure('pg_catalog.pg_advisory_xact_lock(bigint)') IS NOT NULL
      AND pg_catalog.to_regprocedure('pg_catalog.pg_advisory_xact_lock(integer,integer)') IS NOT NULL
      THEN 'OK' ELSE 'BLOCKER' END,
    'gen_random_uuid muss ueber den Migrations-search_path erreichbar sein. Keine zwingende pgcrypto-Extension bei PostgreSQL mit eingebauter UUID-Funktion.'
  UNION ALL SELECT 'System','SQL-Editor-Rolle / Rechte','WARNUNG',
    'Preflight erteilt keine Rechte. Fuer spaetere DDL sind Eigentum, Schema-CREATE und GRANT/REVOKE-Rechte erforderlich; SQL Editor garantiert diese nicht.'
  UNION ALL SELECT 'Index',name,
    CASE WHEN object_oid IS NULL THEN CASE WHEN origin LIKE 'NEU:%' THEN 'FEHLT' ELSE 'BLOCKER' END
      WHEN indrelid IS DISTINCT FROM expected_table_oid OR NOT coalesce(indisvalid AND indisready,false)
        OR indisunique IS DISTINCT FROM is_unique THEN 'BLOCKER'
      WHEN name='coach_invoices_unique_idx' THEN
        CASE WHEN actual_predicate IS NULL AND
          lower(regexp_replace(index_definition,
            '::integer|::text|[()"[:space:]]','','g')) =
            'createuniqueindexcoach_invoices_unique_idxonpublic.coach_invoicesusingbtreecoach_id,billing_mode,billing_year,coalescebilling_quarter,0,coalescebilling_month,0,bundle_key'
          THEN 'OK'
          WHEN indexprs IS NOT NULL THEN 'WARNUNG'
          WHEN NOT (actual_keys @> ARRAY['coach_id','billing_year','bundle_key']) THEN 'BLOCKER'
          WHEN actual_predicate IS NOT NULL OR NOT (actual_keys <@
            ARRAY['coach_id','billing_mode','billing_year','billing_quarter','billing_month','bundle_key'])
            OR NOT ('billing_quarter'=ANY(actual_keys)) THEN 'WARNUNG' ELSE 'OK' END
      WHEN indexprs IS NOT NULL OR actual_keys IS DISTINCT FROM keys OR
        lower(regexp_replace(coalesce(actual_predicate,''),'::text|[()''[:space:]]','','g'))
          IS DISTINCT FROM coalesce(predicate,'') THEN 'BLOCKER'
      ELSE 'OK' END,
    origin||'; pg_get_indexdef='||coalesce(index_definition,'fehlt')||
      '; unique='||coalesce(indisunique::text,'?')||
      '; valid='||coalesce(indisvalid::text,'?')||'; key columns='||
      coalesce(array_to_string(actual_keys,','),'?')||
      '; predicate='||CASE WHEN actual_predicate IS NULL THEN 'keines'
        ELSE 'vorhanden; kanonische Definition wird bei neuen Indexnamen verglichen' END||
      CASE WHEN name='coach_invoices_unique_idx' THEN
        '; kanonischer COALESCE(Quartal,0)/COALESCE(Monat,0)-Index inklusive bundle_key wird als OK erkannt. Andere Expressions: WARNUNG zur manuellen Bewertung, nicht automatisch BLOCKER. Altindex bleibt unveraendert.'
        ELSE '; gleichnamige abweichende Objekte werden durch IF NOT EXISTS nicht repariert; semantisch gleichwertige Predicate-Varianten ggf. manuell bestaetigen.' END
  FROM indexes
  UNION ALL SELECT 'Constraints',tbl||' '||kind||' ('||array_to_string(keys,',')||')',
    CASE WHEN matches THEN 'OK'
      WHEN origin LIKE 'NEU:%' AND table_oid IS NULL THEN 'FEHLT' ELSE 'BLOCKER' END,
    origin||'; strukturelle Pruefung, kein geratener Constraint-Name'||
    coalesce('; FK -> '||ref_table||' ('||array_to_string(ref_keys,',')||'), delete='||delete_action,'')
  FROM constraint_checks
  UNION ALL SELECT 'Constraints',t.name||'.'||c.conname,
    CASE WHEN c.convalidated THEN 'OK' ELSE 'WARNUNG' END,
    'Vorhanden; Typ='||c.contype::text||'; validiert='||c.convalidated||
    '; deferred='||c.condeferrable||'; Definition/Inhaltskompatibilitaet nicht allein durch Existenz bewiesen'
  FROM tables t JOIN pg_catalog.pg_constraint c ON c.conrelid=t.oid
  UNION ALL SELECT 'Constraints','coach_invoices_sevdesk_send_status_check',
    CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c JOIN tables t ON t.oid=c.conrelid
      WHERE t.name='coach_invoices' AND c.conname='coach_invoices_sevdesk_send_status_check')
      THEN 'WARNUNG' ELSE 'FEHLT' END,
    'NEU: 08 legt an, wenn Name fehlt; 09 ersetzt. 08 erlaubt finalized noch nicht. Datencheck unten prueft diese Zwischenstufe.'
  UNION ALL SELECT 'Funktionen',sig,
    CASE WHEN oid IS NULL THEN CASE WHEN origin LIKE 'NEU:%' THEN 'FEHLT' ELSE 'BLOCKER' END
      WHEN prokind<>'f' OR prorettype IS DISTINCT FROM pg_catalog.to_regtype(result)
        OR (arg_names IS NOT NULL AND proargnames IS DISTINCT FROM arg_names) THEN 'BLOCKER'
      ELSE 'OK' END,
    origin||'; erwartet Ergebnis='||result||
    '; vorhandener Returntyp='||coalesce(pg_catalog.format_type(prorettype,NULL),'fehlt')||
    '; vorhandene Signatur ist kein Nachweis des Funktionsbodys; CREATE OR REPLACE kann Returntyp/Parameternamen nicht frei aendern'
  FROM functions
  UNION ALL SELECT 'Funktionsbody',f.sig,
    CASE WHEN f.oid IS NULL THEN 'FEHLT'
      WHEN md5(f.prosrc)=b.digest THEN 'OK' ELSE 'WARNUNG' END,
    'Bytegenauer Bodyvergleich mit den finalen Repository-Migrationen; Abweichung kann Altversion oder Formatierung sein. Kein Funktionsaufruf.'
  FROM functions f JOIN body_spec b ON b.sig=f.sig
  UNION ALL SELECT 'Funktionsschutz',f.sig,
    CASE WHEN f.oid IS NULL THEN 'FEHLT'
      WHEN f.prosecdef AND f.proconfig=ARRAY['search_path=public, pg_temp']
        THEN 'OK' ELSE 'WARNUNG' END,
    'Finaler neuer Stand verlangt SECURITY DEFINER und search_path=public, pg_temp; Migration ersetzt diese Attribute'
  FROM functions f JOIN body_spec b ON b.sig=f.sig
  UNION ALL SELECT 'Funktionsrechte',f.sig,'WARNUNG',
    'EXECUTE vorhanden fuer PUBLIC/anon/authenticated; neue Migrationen widerrufen dies, teilweise vorhandenen Stand separat bewerten'
  FROM functions f
  WHERE f.oid IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_catalog.aclexplode(coalesce(f.proacl,pg_catalog.acldefault('f',f.proowner))) a
    LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
    WHERE a.privilege_type='EXECUTE' AND (a.grantee=0 OR r.rolname IN ('anon','authenticated'))
  )
  UNION ALL SELECT 'Trigger',s.tbl||'.'||s.name,
    CASE WHEN tr.oid IS NULL THEN CASE WHEN s.origin LIKE 'NEU:%' THEN 'FEHLT' ELSE 'BLOCKER' END
      WHEN tr.tgfoid IS DISTINCT FROM pg_catalog.to_regprocedure(s.sig)
        OR tr.tgtype<>s.mask OR tr.tgenabled NOT IN ('O','A') THEN 'WARNUNG' ELSE 'OK' END,
    s.origin||'; erwartet Funktion='||s.sig||
    '; Timing/Event-Maske='||s.mask||'; vorhanden='||coalesce(tr.tgtype::text,'fehlt')||
    '; enabled='||coalesce(tr.tgenabled::text,'?')||
    '; UPDATE-Spalten/WHEN-Ausdruck und Funktionsbody nicht vollstaendig verglichen; neue Trigger werden ersetzt'
  FROM trigger_spec s JOIN tables t ON t.name=s.tbl
  LEFT JOIN pg_catalog.pg_trigger tr ON tr.tgrelid=t.oid AND tr.tgname=s.name AND NOT tr.tgisinternal
  UNION ALL SELECT 'Weitere Trigger',t.name||'.'||tr.tgname,'WARNUNG',
    'Vorhandener weiterer Anwendungstrigger; Wechselwirkungen/Triggerreihenfolge vor Migration manuell pruefen; enabled='||tr.tgenabled::text
  FROM tables t JOIN pg_catalog.pg_trigger tr ON tr.tgrelid=t.oid AND NOT tr.tgisinternal
  WHERE NOT EXISTS (SELECT 1 FROM trigger_spec s WHERE s.tbl=t.name AND s.name=tr.tgname)
  UNION ALL SELECT 'RLS',t.name,
    CASE WHEN t.oid IS NULL THEN 'FEHLT' WHEN t.relrowsecurity THEN 'OK' ELSE 'WARNUNG' END,
    'NEU: 09/12 aktivieren RLS und widerrufen Clientrechte; Claims erhalten service_role nur SELECT. Vorhandene Policies werden nicht geloescht'
  FROM tables t WHERE t.name IN ('coach_quarter_releases','coach_invoice_sevdesk_claims')
  UNION ALL SELECT 'Claim-Rechte','service_role SELECT ohne direkte Schreibrechte',
    CASE WHEN t.oid IS NULL THEN 'FEHLT'
      WHEN r.oid IS NULL THEN 'BLOCKER'
      WHEN pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT')
        AND NOT pg_catalog.has_table_privilege(r.oid,t.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
        THEN 'OK' ELSE 'WARNUNG' END,
    'NEU: 12; INSERT erfolgt im SECURITY-DEFINER-Trigger, nicht ueber direkte service_role-Tabellenschreibrechte'
  FROM tables t LEFT JOIN pg_catalog.pg_roles r ON r.rolname='service_role'
  WHERE t.name='coach_invoice_sevdesk_claims'
  UNION ALL SELECT 'Claim-Rechte','anon/authenticated ohne Tabellenzugriff',
    CASE WHEN t.oid IS NULL THEN 'FEHLT'
      WHEN EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN ('anon','authenticated')
          AND pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      ) THEN 'WARNUNG' ELSE 'OK' END,
    'NEU: 12 widerruft Clientrechte; Rollenvererbung und RLS im Ziel separat abnehmen'
  FROM tables t WHERE t.name='coach_invoice_sevdesk_claims'
  UNION ALL SELECT 'RLS-Policies',t.name||'.'||p.polname,'WARNUNG',
    'Vorhandene Policy; Kommando='||p.polcmd::text||
    '; Policy-Existenz ist kein Nachweis korrekter Autorisierung; keine Policy-Inhalte/Datensaetze ausgegeben'
  FROM tables t JOIN pg_catalog.pg_policy p ON p.polrelid=t.oid
  UNION ALL SELECT 'Daten',name,
    CASE WHEN NOT schema_ready THEN 'FEHLT'
      WHEN NOT access_ready THEN 'WARNUNG'
      WHEN n=0 OR severity='INFO' THEN 'OK'
      WHEN severity='FINALIZED' THEN
        CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c JOIN tables t ON t.oid=c.conrelid
          WHERE t.name='coach_invoices' AND c.conname='coach_invoices_sevdesk_send_status_check')
          THEN 'WARNUNG' ELSE 'BLOCKER' END
      ELSE severity END,
    CASE WHEN NOT schema_ready THEN 'Nicht ausgefuehrt: erforderliche Tabelle/Spalte fehlt; siehe Schemazeilen. Fehlende neue Objekte sind erwartbar.'
      WHEN NOT access_ready THEN 'Nicht ausgefuehrt: keine vollstaendige SELECT-Sicht oder aktive RLS; kein Nullbefund ableitbar.'
      ELSE 'Anzahl='||n||
        CASE WHEN name LIKE '%Gruppen%' THEN ' (Gruppen, nicht Rechnungen)' ELSE ' (Zeilen/Gruppen gemaess Pruefung)' END||
        CASE WHEN severity='INFO' THEN '; Bestandsinformation, kein Konflikt allein durch Anzahl'
          WHEN severity='FINALIZED' THEN '; ohne bestehenden Status-Constraint kann bereits 08 fehlschlagen'
          WHEN n>0 AND name IN (
            'Rechnungen: sevDesk-ID mehrfach verknuepft',
            'Bekannte Quarantaene: betroffene Rechnungen',
            'Bekannte Quarantaene: betroffene Coaches',
            'Weitere externe Duplikatgruppen',
            'Externe IDs: ungueltig oder nicht kanonisch')
            THEN '; coachbezogene Quarantaene durch 12, kein globaler Migrationsblocker. Keine automatische Bereinigung. Andere Coaches erst nach vollstaendigen Guards aktivieren.'
          WHEN n>0 THEN '; vor Aktivierung betroffener Daten manuell klaeren; keine automatische Bereinigung'
          ELSE '; kein Treffer in der aktuellen vollstaendigen Lesesicht' END END
  FROM data_counts
  UNION ALL SELECT 'Quarantaene','Finale Link-Sperrlogik bereits installiert',
    CASE WHEN verified THEN 'OK'
      WHEN NOT EXISTS (SELECT 1 FROM functions WHERE sig='public.guard_coach_invoice_link()' AND oid IS NOT NULL)
        THEN 'FEHLT' ELSE 'WARNUNG' END,
    CASE WHEN verified
      THEN 'Finale Bodies, Sicherheitsattribute, Link-Trigger und Claim-Schluessel erkannt. Historische Konflikte sperren betroffene Coaches, nicht das gesamte Team. Rollen/RLS und Canary trotzdem separat abnehmen.'
      ELSE 'Noch kein Nachweis der finalen Guards im Ziel. Erster Code-Rollout nur mit deaktivierter Erstellung; keine Aktivierung vor Migration 12 und erneuter Pruefung.' END
  FROM link_guard_verified
  UNION ALL SELECT 'Betrieb','Aktuelle Relationslocks','WARNUNG',
    'Anzahl='||(SELECT count(*) FROM pg_catalog.pg_locks l JOIN tables t ON t.oid=l.relation
      WHERE l.pid IS DISTINCT FROM pg_catalog.pg_backend_pid())||
    '; Momentaufnahme ohne SQL-Texte/Personendaten. Migrationen benoetigen Wartungsfenster; Locks nicht automatisch beenden.'
  UNION ALL SELECT 'Grenzen','Teilinstallation / Betrieb / Wiederherstellung','WARNUNG',
    'Katalog/Bodyvergleich ersetzt keinen produktionsnahen Migrationstest, Backup/Restore-Test, Berechtigungsnachweis oder Abgleich der produktiven Codeversion. Kein Nachweis des externen sevDesk-Bestands.'
),
decision AS (
  SELECT
    EXISTS (SELECT 1 FROM findings WHERE status='BLOCKER')
    OR EXISTS (SELECT 1 FROM data_counts WHERE schema_ready AND NOT access_ready)
    OR EXISTS (SELECT 1 FROM findings WHERE bereich='Index'
      AND pruefung='coach_invoices_unique_idx' AND status<>'OK') AS blocked
)
SELECT bereich, pruefung, status, details
FROM (
  SELECT 0 AS sort, * FROM findings
  UNION ALL SELECT 1,'Ergebnis','Erster Rollout-Schritt',
    CASE WHEN blocked THEN 'BLOCKER' ELSE 'OK' END,
    CASE WHEN blocked
      THEN 'NO-GO: echte Blocker, unvollstaendige Lesesicht oder ungeklaerter Altindex. Keine Produktionskompatibilitaet bestaetigt.'
      ELSE 'GO ausschliesslich fuer Code-Rollout mit stillgelegten Schreib-Syncs und serverseitig deaktivierter Erstellung, nach manueller Backup-/Wartungsfreigabe. FEHLT fuer neue Objekte ist erwartbar. KEIN GO fuer Migration, sevDesk-Erstellung oder Teamaktivierung.' END
  FROM decision
) result
ORDER BY sort, CASE status WHEN 'BLOCKER' THEN 0 WHEN 'WARNUNG' THEN 1 WHEN 'FEHLT' THEN 2 ELSE 3 END,
  bereich, pruefung;
