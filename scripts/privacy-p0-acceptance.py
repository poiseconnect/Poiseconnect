"""Prepare by default; execute only in a newly created, networkless PostgreSQL.

No DSN, .env, Supabase SDK, host port, bind mount, or existing database is used.
The --run-isolated switch requires a separate human execution approval.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import select
import subprocess
import time
import uuid


ROOT = Path(__file__).resolve().parent.parent
IMAGE = "postgres:15-alpine"
DOCKER = ["docker", "--host", "unix:///var/run/docker.sock"]
FILES = [
    "tests/postgres/privacy-p0-fixture.sql",
    "supabase/migrations/20260901000000_request_messaging_foundation.sql",
    "supabase/migrations/20261005000000_admin_reengagement_log.sql",
    "supabase/migrations/20261016000000_client_link_recovery.sql",
    "supabase/migrations/20261017000000_anfrage_health_data_consent.sql",
    "tests/postgres/privacy-p0-legacy-messaging.sql",
    "supabase/migrations/20261028020000_sessions_insert_lockdown.sql",
    "tests/postgres/privacy-p0-session-inserts.sql",
    "supabase/migrations/20261028000000_privacy_phase1_access.sql",
    "supabase/migrations/20261028010000_privacy_delete_request.sql",
    "tests/postgres/privacy-p0-acceptance.sql",
    "tests/postgres/privacy-p0-delete-acceptance.sql",
]


def identity(n):
    return f"00000000-0000-0000-0000-{n:012d}"


def manifest():
    return [
        {"path": name, "sha256": hashlib.sha256((ROOT / name).read_bytes()).hexdigest()}
        for name in FILES
    ]


def clean_environment():
    # Do not inherit DATABASE_URL, PG*, Supabase/provider keys or Docker contexts.
    return {"PATH": os.defpath, "LANG": "C.UTF-8"}


class IsolatedPostgres:
    def __init__(self):
        self.container_id = None
        self.label = "poise.privacy-p0.acceptance=" + str(uuid.uuid4())

    def command(self, args, **kwargs):
        return subprocess.run(
            DOCKER + args, env=clean_environment(), text=True,
            capture_output=True, check=True, timeout=30, **kwargs,
        )

    def psql_args(self):
        if not self.container_id:
            raise RuntimeError("No owned isolated container")
        return [
            "exec", "-i", self.container_id, "psql", "-X", "-qAt",
            "-h", "/var/run/postgresql", "-U", "postgres", "-d", "postgres",
            "-v", "ON_ERROR_STOP=1", "-P", "pager=off",
        ]

    def sql(self, statement, *, service=False, application="p0-acceptance"):
        prefix = (
            f"set application_name='{application}';"
            "set statement_timeout='12s'; set lock_timeout='10s';"
            "set timezone='UTC';"
        )
        if service:
            prefix += "set role service_role;"
        return self.command(self.psql_args(), input=prefix + statement).stdout.strip()

    def error(self, statement, message, *, service=True):
        try:
            self.sql(statement, service=service)
        except subprocess.CalledProcessError as error:
            if message not in (error.stderr or ""):
                raise AssertionError(f"Expected {message}, got {error.stderr}") from error
        else:
            raise AssertionError(f"Database should have rejected: {message}")

    def start(self):
        # Fail if the image is missing. Never pull/install anything automatically.
        image_id = self.command(["image", "inspect", IMAGE, "--format", "{{.Id}}"]).stdout.strip()
        result = self.command([
            "run", "--detach", "--pull=never", "--network=none", "--read-only",
            "--user=postgres", "--cap-drop=ALL", "--security-opt=no-new-privileges",
            "--tmpfs=/var/lib/postgresql/data:rw,nosuid,noexec,mode=1777,size=256m",
            "--tmpfs=/var/run/postgresql:rw,nosuid,noexec,mode=1777,size=16m",
            "--tmpfs=/tmp:rw,nosuid,noexec,mode=1777,size=32m",
            "--env=PGDATA=/var/lib/postgresql/data/pgdata",
            "--env=POSTGRES_HOST_AUTH_METHOD=trust", "--label", self.label,
            IMAGE,
        ])
        candidate = result.stdout.strip()
        if not re.fullmatch(r"[a-f0-9]{64}", candidate):
            raise RuntimeError("Docker returned no immutable owned container ID")
        self.container_id = candidate
        config = json.loads(self.command(["inspect", candidate]).stdout)[0]
        if (config["HostConfig"]["NetworkMode"] != "none"
                or config["HostConfig"].get("Binds")
                or config["HostConfig"].get("PortBindings")
                or any(m["Type"] != "tmpfs" for m in config["Mounts"])
                or config["Config"]["Labels"].get(self.label.split("=")[0])
                != self.label.split("=")[1]
                or config["Image"] != image_id):
            raise RuntimeError("Container isolation/ownership validation failed")
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                self.command(["exec", candidate, "pg_isready", "-h",
                              "127.0.0.1", "-U", "postgres"])
                break
            except subprocess.CalledProcessError:
                time.sleep(0.1)
        else:
            raise RuntimeError("Owned isolated PostgreSQL did not become ready")
        if self.sql("select current_setting('server_version_num')::int/10000;") != "15":
            raise RuntimeError("PostgreSQL 15 required for this acceptance fixture")
        print(f"ISOLATED_IMAGE_ID={image_id}", flush=True)

    def close(self):
        if self.container_id:
            container = self.container_id
            self.command(["rm", "--force", "--volumes", container])
            self.container_id = None
            remaining = self.command([
                "ps", "--all", "--quiet", "--no-trunc", "--filter", f"id={container}",
            ]).stdout.strip()
            if remaining:
                raise RuntimeError("Owned test container was not removed")
            print("Owned container removed; PostgreSQL data existed only in tmpfs.", flush=True)

    @contextmanager
    def holding(self, statement, *, rollback=False):
        process = subprocess.Popen(
            DOCKER + self.psql_args(), env=clean_environment(),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, bufsize=1,
        )
        try:
            process.stdin.write(
                "\\o /dev/null\nbegin; set local role service_role; set local statement_timeout='12s';"
                "set local lock_timeout='10s';" + statement + "\n\\o\n\\echo P0_LOCK_READY\n"
            )
            process.stdin.flush()
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                if select.select([process.stdout], [], [], 0.1)[0]:
                    if process.stdout.readline().strip() == "P0_LOCK_READY":
                        break
                if process.poll() is not None:
                    raise RuntimeError(f"Lock-holder failed: {process.stderr.read()}")
            else:
                raise RuntimeError("Lock-holder did not confirm barrier")
            yield
            process.stdin.write("rollback;\n" if rollback else "commit;\n")
            process.stdin.flush()
            process.stdin.close()
            if process.wait(timeout=15) != 0:
                raise RuntimeError(f"Lock-holder commit failed: {process.stderr.read()}")
        finally:
            if process.poll() is None:
                process.kill()  # Exact child process only; connection close rolls back.
                process.wait(timeout=5)
            for stream in (process.stdin, process.stdout, process.stderr):
                if not stream.closed:
                    stream.close()

    def race(self, holder, contender, *, error=None, rollback=False, contains=None):
        application = "p0-race-" + uuid.uuid4().hex
        # Observe an actual PostgreSQL lock wait before committing/rolling back.
        # Sleeps only bound polling; they never decide ordering.
        with ThreadPoolExecutor(max_workers=1) as pool:
            with self.holding(holder, rollback=rollback):
                future = pool.submit(self.sql, contender, service=True, application=application)
                deadline = time.monotonic() + 8
                while time.monotonic() < deadline:
                    waiting = self.sql(
                        "select count(*) from pg_stat_activity where "
                        f"application_name='{application}' and wait_event_type='Lock';"
                    )
                    if waiting == "1":
                        break
                    if future.done():
                        raise AssertionError("Contender completed without expected lock barrier")
                    time.sleep(0.02)
                else:
                    raise AssertionError("No observable PostgreSQL lock wait")
            try:
                output = future.result(timeout=15)
            except subprocess.CalledProcessError as failure:
                if not error or error not in (failure.stderr or ""):
                    raise AssertionError(f"Unexpected contender error: {failure.stderr}") from failure
            else:
                if error:
                    raise AssertionError(f"Expected contender rejection: {error}")
                if contains is not None and contains not in output:
                    raise AssertionError(f"Expected {contains!r} in contender output, got {output!r}")


def read_health(n, coach=1):
    return ("select public.privacy_read_request_health("
            f"array['{identity(n)}'::uuid],'{identity(coach)}');")


def revoke(n):
    return ("select public.privacy_revoke_intake_consent("
            f"'{identity(n)}','{identity(100000+n)}',repeat(md5('{n}'),2));")


def handover(n, operation=None, target=2):
    return (f"select privacy_test.handover({n},0,{operation or 200000+n},{target});")


def appointment(n):
    return ("select public.privacy_begin_appointment_operation("
            f"'{identity(n)}','{identity(1)}',0,'{identity(300000+n)}');")


def concurrency_tests(db):
    # Every scenario has its own synthetic request; no reset/truncation of live data.
    for n in range(100, 118):
        db.sql(f"select privacy_test.new_case({n});")
    db.race(revoke(100), read_health(100), contains='"__healthAllowed": false')
    db.race(read_health(101), revoke(101), contains="t")
    if "SYNTHETIC_HEALTH_ONLY" in db.sql(read_health(101), service=True):
        raise AssertionError("A new read after committed withdrawal returned health")
    db.race(revoke(102), "select privacy_test.save(102);", error="HEALTH_DATA_CONSENT_REQUIRED")
    db.race("select privacy_test.save(103);", revoke(103), contains="t")
    if "SYNTHETIC_UPDATED" in db.sql(read_health(103), service=True):
        raise AssertionError("Committed save must not restore withdrawn read access")
    db.race(handover(104), read_health(104), contains="[]")
    db.race(read_health(105), handover(105), contains='"ok": true')
    db.race(appointment(106), handover(106), error="CARE_OPERATION_IN_PROGRESS")
    db.race(handover(107), appointment(107), error="CARE_VERSION_CONFLICT")
    db.race(handover(108), handover(108), contains='"ok": true')
    if db.sql(f"select count(*) from public.request_care_transfers where request_id='{identity(108)}';") != "1":
        raise AssertionError("Concurrent idempotent replay duplicated transfer")
    db.race(handover(109), handover(109, 900109), error="CARE_VERSION_CONFLICT")
    db.race(handover(110), read_health(110), rollback=True, contains="SYNTHETIC_HEALTH_ONLY")
    db.race(revoke(111), read_health(111), rollback=True, contains="SYNTHETIC_HEALTH_ONLY")
    db.race(appointment(112), handover(112), rollback=True, contains='"ok": true')
    # A child inserted while A is current is committed before the transfer check.
    db.race(
        "insert into public.sessions(anfrage_id,therapist_id,date,duration_min) values("
        f"'{identity(113)}','{identity(1)}',now()+interval '1 day',50.5);",
        handover(113), error="FUTURE_APPOINTMENTS_REQUIRE_DECISION",
    )
    def save_invoice(n):
        return (
            "select public.privacy_save_client_invoice("
            f"'{identity(1001)}',null,'{identity(n)}',0,jsonb_build_object("
            f"'anfrage_id','{identity(n)}','therapist_id','{identity(1)}',"
            "'invoice_number','SYNTHETIC-RACE','total_gross',80,'line_items','[]'::jsonb));"
        )

    db.race(handover(114), save_invoice(114), error="CARE_VERSION_CONFLICT")
    db.race(save_invoice(115), handover(115), contains='"ok": true')
    if db.sql(f"select therapist_id from public.invoices where anfrage_id='{identity(115)}';") != identity(1):
        raise AssertionError("Transfer changed a concurrently committed historical invoice owner")
    for n in [116, 117]:
        db.sql("insert into public.sessions(id,anfrage_id,therapist_id,date) values("
               f"'{identity(900000+n)}','{identity(n)}','{identity(1)}','2000-01-01');")

    def delete_session(n):
        return ("select public.privacy_delete_care_session("
                f"'{identity(1001)}','{identity(900000+n)}');")

    db.race(handover(116), delete_session(116), error="NO_ACCESS")
    db.race(delete_session(117), handover(117), contains='"ok": true')
    if db.sql(f"select count(*) from public.sessions where id='{identity(900116)}';") != "1":
        raise AssertionError("Former coach deleted a historical session after transfer")
    db.sql(f"insert into public.anfragen(id,status) values('{identity(118)}','papierkorb');")
    db.race(
        "select public.privacy_delete_request("
        f"'{identity(118)}','{identity(3)}');",
        "insert into public.client_link_recovery_queue(request_id) "
        f"values('{identity(118)}');",
        error="REQUEST_NOT_FOUND",
    )
    if db.sql(f"select count(*) from public.anfragen where id='{identity(118)}';") != "0":
        raise AssertionError("Request deletion did not commit in queue insertion race")
    if db.sql(f"select count(*) from public.client_link_recovery_queue where request_id='{identity(118)}';") != "0":
        raise AssertionError("Queue race inserted an orphan after request deletion")
    print("19 real lock-barrier concurrency scenarios completed.", flush=True)


def migration_rollback_test(db, candidate):
    if not candidate.rstrip().endswith("commit;"):
        raise RuntimeError("Candidate must have an explicit final COMMIT for rollback injection")
    failing = candidate.rstrip()[:-len("commit;")] + "select 1/0;\ncommit;"
    db.error(failing, "division by zero", service=False)
    if db.sql("select to_regclass('public.request_care_assignments') is null;") != "t":
        raise AssertionError("Failed candidate left a care table behind")
    if db.sql("select count(*) from information_schema.columns where "
              "table_schema='public' and table_name='anfragen' and column_name='care_version';") != "0":
        raise AssertionError("Failed candidate left a care version column behind")
    if db.sql("select has_column_privilege('authenticated','public.anfragen','anliegen','SELECT');") != "t":
        raise AssertionError("Failed candidate did not roll back privilege changes")
    print("Injected migration failure rolled back DDL and grants in isolated fixture.", flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-isolated", action="store_true",
                        help="After approval only: creates disposable PostgreSQL and applies test SQL")
    args = parser.parse_args(argv)
    print(json.dumps({"mode": "EXECUTE_ISOLATED" if args.run_isolated else "PREPARED_ONLY",
                      "files": manifest()}, indent=2), flush=True)
    if not args.run_isolated:
        print("No Docker call, database connection, SQL execution or provider action.")
        return
    db = IsolatedPostgres()
    try:
        db.start()
        for name in FILES:
            print("Executing ONLY inside owned tmpfs database: " + name, flush=True)
            text = (ROOT / name).read_text()
            if name.endswith("20261028000000_privacy_phase1_access.sql"):
                migration_rollback_test(db, text)
            db.sql(text)
        concurrency_tests(db)
        print("ISOLATED ACCEPTANCE PASSED; not a production schema/rollout approval.", flush=True)
    except subprocess.CalledProcessError as error:
        print("ISOLATED ACCEPTANCE FAILED:", (error.stderr or "").strip(), flush=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
