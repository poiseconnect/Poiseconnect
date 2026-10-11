"""Synthetic PostgreSQL-only regression. Never connects to a configured database."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import time


ROOT = Path(__file__).resolve().parent.parent
CONTAINER = "poise-coach-link-test-" + str(time.time_ns())


def command(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)


def sql(query, expect_error=False):
    result = command(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres",
         "-v", "ON_ERROR_STOP=1", "-At", "-P", "pager=off"],
        input=query, timeout=30,
    )
    if expect_error:
        assert result.returncode != 0, "Expected database rejection"
        return result.stderr
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


READINESS_PROBES = [
    "select sevdesk_send_status, sevdesk_send_error_code, coach_quarter_release_version, "
    "sevdesk_draft_invoice_number, sevdesk_creation_candidate_id from public.coach_invoices limit 1;",
    "select coach_id from public.coach_quarter_releases limit 1;",
    "select public.check_coach_invoice_link('00000000-0000-0000-0000-000000000000');",
]


def assert_workflow_ready(expected):
    """Mirrors app/lib/coachQuarterWorkflowReadiness.js with plain read-only SELECTs."""
    if expected:
        for probe in READINESS_PROBES[:2]:
            sql(probe)
        assert sql(READINESS_PROBES[2]) == "missing"
        return
    assert any(
        command(["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres",
                 "-v", "ON_ERROR_STOP=1", "-At"], input=probe, timeout=30).returncode != 0
        for probe in READINESS_PROBES
    ), "Workflow must not look ready before all migrations"


def coach(n):
    return f"00000000-0000-0000-0000-{n:012d}"


def reserve(invoice):
    return (
        "select public.reserve_coach_invoice_creation("
        f"'{invoice}', '{coach(1)}', 1, "
        f"(select updated_at from public.coach_invoices where id='{invoice}'));"
    )


created_container = False
try:
    result = command([
        "docker", "run", "--name", CONTAINER, "-e",
        "POSTGRES_PASSWORD=synthetic-test-only", "-d", "postgres:15-alpine",
    ], timeout=60)
    assert result.returncode == 0, result.stderr
    created_container = True
    for _ in range(100):
        if command(["docker", "exec", CONTAINER, "pg_isready", "-U", "postgres"]).returncode == 0:
            break
        time.sleep(0.2)
    else:
        raise RuntimeError("Isolated PostgreSQL did not become ready")
    sql((ROOT / "tests/postgres/coach-invoice-link-fixture.sql").read_text())
    history = sql("select md5(string_agg(to_jsonb(i)::text, '' order by id)) "
                  "from public.coach_invoices i;")
    index_before = sql("select pg_get_indexdef('public.coach_invoices_unique_idx'::regclass);")
    assert_workflow_ready(False)
    for migration in [
        "20260927000000_coach_invoice_lifecycle.sql",
        "20261008000000_sevdesk_coach_invoice_send_state.sql",
        "20261009000000_coach_quarter_release.sql",
        "20261011000000_coach_invoice_creation_guards.sql",
    ]:
        sql((ROOT / "supabase/migrations" / migration).read_text())
    history = sql("select md5(string_agg(to_jsonb(i)::text, '' order by id)) "
                  "from public.coach_invoices i;")
    assert_workflow_ready(False)
    sql((ROOT / "supabase/migrations/20261012000000_coach_invoice_link_guards.sql").read_text())
    assert_workflow_ready(True)
    assert index_before == sql("select pg_get_indexdef('public.coach_invoices_unique_idx'::regclass);")
    assert history == sql("select md5(string_agg((to_jsonb(i)-'sevdesk_creation_candidate_id')::text, '' order by id)) "
                          "from public.coach_invoices i;")
    assert sql("select count(*) from public.coach_invoices where "
               "public.check_coach_invoice_link(id)='quarantined';") == "5"
    for action in [
        "update public.coach_invoices set updated_at=now() where sevdesk_invoice_id='135675889';",
        "delete from public.coach_invoices where sevdesk_invoice_id='135833778';",
    ]:
        assert "sevdesk_invoice_link_conflict" in sql(action, expect_error=True)

    for n in [1, 2, 3, 5, 6]:
        sql(f"select public.release_coach_quarter('{coach(n)}',2026,3,'{coach(1)}');")
        sql("insert into public.coach_invoices(coach_id,billing_mode,billing_year,billing_quarter,"
            f"bundle_key,coach_quarter_release_version) values ('{coach(n)}','quartal',2026,3,"
            "'normal_ust',1);")
    sql("insert into public.coach_invoices(coach_id,billing_mode,billing_year,billing_quarter,"
        f"bundle_key,coach_quarter_release_version) values ('{coach(1)}','quartal',2026,3,'reverse_charge',1);")
    first = sql(f"select id from public.coach_invoices where coach_id='{coach(1)}' and bundle_key='normal_ust';")
    second = sql(f"select id from public.coach_invoices where coach_id='{coach(1)}' and bundle_key='reverse_charge';")
    with ThreadPoolExecutor(2) as pool:
        outputs = list(pool.map(lambda i: sql("begin;" + reserve(i) + "select pg_sleep(0.2);commit;"), [first, second]))
    assert sum("reserved" in output for output in outputs) == 1, outputs
    assert sum("blocked" in output for output in outputs) == 1, outputs
    active = sql("select id from public.coach_invoices where sevdesk_send_status='creating';")
    assert sql(reserve(active)) == "blocked"
    assert "coach_invoice_creation_in_progress" in sql(
        f"update public.sessions set price=101 where therapist_id='{coach(1)}';", expect_error=True)
    sql(f"update public.coach_invoices set sevdesk_invoice_id='9900001',sevdesk_send_status='created' where id='{active}';")
    remaining = second if active == first else first
    assert sql(reserve(remaining)) == "reserved"
    sql(f"update public.coach_invoices set sevdesk_invoice_id='9900002',sevdesk_send_status='created' where id='{remaining}';")
    assert sql(f"select count(distinct sevdesk_invoice_id) from public.coach_invoices where coach_id='{coach(1)}';") == "2"
    assert "duplicate key" in sql(
        "insert into public.coach_invoices(coach_id,billing_mode,billing_year,billing_quarter,billing_month,bundle_key) "
        f"values ('{coach(1)}','quartal',2026,3,10,'normal_ust');", expect_error=True)
    assert "linked_coach_invoice_is_readonly" in sql(
        f"update public.coach_invoices set sevdesk_invoice_id='9900002' where id='{active}';", expect_error=True)

    ids = []
    for n in [2, 3]:
        invoice = sql(f"select id from public.coach_invoices where coach_id='{coach(n)}';")
        assert sql(reserve(invoice)) == "reserved"
        ids.append(invoice)

    def bind(invoice):
        return command(
            ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
            input="begin; update public.coach_invoices set sevdesk_invoice_id='9900003',"
                  f"sevdesk_send_status='created' where id='{invoice}'; select pg_sleep(0.2); commit;",
            timeout=30,
        )

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(bind, ids))
    assert sum(result.returncode == 0 for result in results) == 1
    assert any("sevdesk_invoice_link_conflict" in result.stderr for result in results)
    assert sql("select count(*) from public.coach_invoices where sevdesk_invoice_id='9900003';") == "1"
    unresolved = sql("select id from public.coach_invoices where sevdesk_send_status='creating';")
    sql("update public.coach_invoices set sevdesk_send_status='creation_unknown',"
        f"sevdesk_creation_candidate_id='9900003' where id='{unresolved}';")
    assert sql(reserve(unresolved)) == "blocked"
    assert "coach_invoice_manual_reconciliation_required" in sql(
        f"update public.coach_invoices set sevdesk_send_status=null where id='{unresolved}';", expect_error=True)
    assert "sevdesk_link_requires_creation_reservation" in sql(
        "insert into public.coach_invoices(sevdesk_invoice_id) values ('9900004');", expect_error=True)
    assert sql("select count(*) from public.coach_invoices where "
               "sevdesk_invoice_id in ('135675889','135833778');") == "5"
    repeatable_ids = []
    for n in [5, 6]:
        invoice = sql(f"select id from public.coach_invoices where coach_id='{coach(n)}';")
        assert sql(reserve(invoice)) == "reserved"
        repeatable_ids.append(invoice)

    def repeatable_bind(invoice):
        return command(
            ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
            input="begin isolation level repeatable read; select count(*) from public.coach_invoices;"
                  "select pg_sleep(0.4); update public.coach_invoices set sevdesk_invoice_id='9900005',"
                  f"sevdesk_send_status='created' where id='{invoice}'; commit;",
            timeout=30,
        )

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(repeatable_bind, repeatable_ids))
    assert sum(result.returncode == 0 for result in results) == 1
    assert sql("select count(*) from public.coach_invoices where sevdesk_invoice_id='9900005';") == "1"
    assert sql("select count(*) from public.coach_invoice_sevdesk_claims where sevdesk_invoice_id='9900005';") == "1"
    assert_workflow_ready(True)
    sql((ROOT / "supabase/migrations/20261012000000_coach_invoice_link_guards.sql").read_text())
    assert_workflow_ready(True)
    assert index_before == sql("select pg_get_indexdef('public.coach_invoices_unique_idx'::regclass);")
    preflight = sql((ROOT / "docs/sql/coach-quarter-readonly-preflight.sql").read_text())
    assert "Index|coach_invoices_unique_idx|OK|" in preflight
    assert "|BLOCKER|" not in preflight
    assert "Ergebnis|Erster Rollout-Schritt|OK|" in preflight
    print("PASS: historical five rows unchanged; COALESCE index unchanged; bundle concurrency; "
          "single external binding at READ COMMITTED and REPEATABLE READ; source-write guard; "
          "ambiguous-result freeze; readonly preflight; workflow readiness probes before/after migrations.")
finally:
    if created_container:
        cleanup = command(["docker", "rm", "-f", CONTAINER], timeout=30)
        if cleanup.returncode:
            raise RuntimeError("Could not remove the named isolated test container")
