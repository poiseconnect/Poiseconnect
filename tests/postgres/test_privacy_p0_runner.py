"""Offline runner safety tests. Docker, SQL and all subprocesses are mocked."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("privacy_runner", ROOT / "scripts/privacy-p0-acceptance.py")
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class RunnerSafetyTests(unittest.TestCase):
    def test_default_only_reads_manifest_and_never_starts_subprocess(self):
        with patch.object(runner.subprocess, "run") as run, \
                patch.object(runner.subprocess, "Popen") as popen, \
                contextlib.redirect_stdout(io.StringIO()) as output:
            runner.main([])
        run.assert_not_called()
        popen.assert_not_called()
        self.assertIn("PREPARED_ONLY", output.getvalue())
        self.assertIn("No Docker call", output.getvalue())

    def test_no_database_url_host_or_image_override_is_accepted(self):
        for flag in ["--dsn", "--database-url", "--host", "--image"]:
            with self.subTest(flag=flag), contextlib.redirect_stderr(io.StringIO()), \
                    patch.object(runner.IsolatedPostgres, "start") as start:
                with self.assertRaises(SystemExit):
                    runner.main([flag, "synthetic-invalid"])
                start.assert_not_called()

    def test_manifest_contains_real_candidate_and_no_env_or_dump(self):
        manifest = runner.manifest()
        self.assertEqual(len(manifest), 12)
        self.assertTrue(any("20261028000000_privacy_phase1_access.sql" in x["path"] for x in manifest))
        self.assertTrue(any("20261028010000_privacy_delete_request.sql" in x["path"] for x in manifest))
        paths = [item["path"] for item in manifest]
        lockdown = "supabase/migrations/20261028020000_sessions_insert_lockdown.sql"
        checks = "tests/postgres/privacy-p0-session-inserts.sql"
        access = "supabase/migrations/20261028000000_privacy_phase1_access.sql"
        self.assertLess(paths.index(lockdown), paths.index(checks))
        self.assertLess(paths.index(checks), paths.index(access))
        for item in manifest:
            self.assertRegex(item["sha256"], r"^[a-f0-9]{64}$")
            self.assertTrue(item["path"].endswith(".sql"))
            self.assertNotIn(".env", item["path"])

    def test_host_database_provider_and_docker_environment_is_discarded(self):
        with patch.dict(os.environ, {
            "DATABASE_URL": "synthetic-forbidden", "PGHOST": "synthetic-forbidden",
            "DOCKER_HOST": "synthetic-forbidden", "SUPABASE_URL": "synthetic-forbidden",
            "RESEND_API_KEY": "synthetic-forbidden",
        }):
            db = runner.IsolatedPostgres()
            with patch.object(runner.subprocess, "run") as run:
                db.command(["version"])
            args, kwargs = run.call_args
        self.assertEqual(args[0][:3], ["docker", "--host", "unix:///var/run/docker.sock"])
        self.assertEqual(set(kwargs["env"]), {"PATH", "LANG"})
        self.assertTrue(kwargs["check"])
        self.assertEqual(kwargs["timeout"], 30)

    def test_missing_local_image_does_not_create_pull_or_install(self):
        db = runner.IsolatedPostgres()
        with patch.object(db, "command", side_effect=subprocess.CalledProcessError(1, ["image"])) as command:
            with self.assertRaises(subprocess.CalledProcessError):
                db.start()
        command.assert_called_once_with(["image", "inspect", runner.IMAGE, "--format", "{{.Id}}"])
        self.assertIsNone(db.container_id)

    def test_networkless_tmpfs_container_is_created_without_ports_or_bind_mounts(self):
        db = runner.IsolatedPostgres()
        container = "a" * 64
        image_id = "sha256:" + "b" * 64
        key, value = db.label.split("=")
        config = {
            "HostConfig": {"NetworkMode": "none", "Binds": [], "PortBindings": {}},
            "Mounts": [{"Type": "tmpfs"}], "Config": {"Labels": {key: value}},
            "Image": image_id,
        }
        calls = []

        def command(args, **kwargs):
            calls.append(args)
            if args[:2] == ["image", "inspect"]:
                output = image_id
            elif args[0] == "run":
                output = container
            elif args[0] == "inspect":
                output = json.dumps([config])
            else:
                output = ""
            return subprocess.CompletedProcess(args, 0, stdout=output, stderr="")

        with patch.object(db, "command", side_effect=command), \
                patch.object(db, "sql", return_value="15"), \
                contextlib.redirect_stdout(io.StringIO()):
            db.start()
        run = next(call for call in calls if call[0] == "run")
        for required in ["--network=none", "--pull=never", "--read-only", "--user=postgres",
                         "--cap-drop=ALL", "--security-opt=no-new-privileges"]:
            self.assertIn(required, run)
        self.assertEqual(sum(arg.startswith("--tmpfs=") for arg in run), 3)
        self.assertFalse(any(arg in ["-p", "-v", "--mount", "--volume", "--env-file"] for arg in run))
        self.assertEqual(db.container_id, container)

    def test_cleanup_targets_only_created_immutable_container(self):
        db = runner.IsolatedPostgres()
        db.container_id = "c" * 64
        with patch.object(db, "command", return_value=subprocess.CompletedProcess([], 0, stdout="")) as command, \
                contextlib.redirect_stdout(io.StringIO()):
            db.close()
        self.assertEqual(command.call_args_list[0].args[0],
                         ["rm", "--force", "--volumes", "c" * 64])
        self.assertIn("id=" + "c" * 64, command.call_args_list[1].args[0])
        self.assertIsNone(db.container_id)

    def test_start_or_sql_failure_still_cleans_own_container(self):
        with patch.object(runner.IsolatedPostgres, "start"), \
                patch.object(runner.IsolatedPostgres, "sql", side_effect=RuntimeError("synthetic")), \
                patch.object(runner.IsolatedPostgres, "close") as close, \
                contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, "synthetic"):
                runner.main(["--run-isolated"])
        close.assert_called_once()

    def test_sql_cannot_connect_until_owned_container_exists(self):
        with self.assertRaisesRegex(RuntimeError, "No owned isolated container"):
            runner.IsolatedPostgres().sql("select 1")

    def test_expected_error_requires_database_failure_not_successful_return(self):
        db = runner.IsolatedPostgres()
        with patch.object(db, "sql", return_value=""):
            with self.assertRaisesRegex(AssertionError, "should have rejected"):
                db.error("select 1", "NO_ACCESS")
        with patch.object(db, "sql", side_effect=subprocess.CalledProcessError(
                1, [], stderr="synthetic unrelated failure")):
            with self.assertRaisesRegex(AssertionError, "Expected NO_ACCESS"):
                db.error("select 1", "NO_ACCESS")


if __name__ == "__main__":
    unittest.main()
