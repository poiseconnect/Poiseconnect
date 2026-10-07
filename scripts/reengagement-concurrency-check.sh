#!/usr/bin/env bash
# Reproduzierbarer Parallelitätstest für reserve_reengagement_attempt().
#
# Prüft gegen eine ECHTE, isolierte, lokale Postgres-Instanz (Docker), dass
# bei gleichzeitigen Aufrufen mit identischer (batch_id, anfrage_id) genau
# EIN Aufruf eine Reservierung erhält und alle übrigen Aufrufe sicher
# abgelehnt werden (kein Doppelversand-Fenster in der Datenbank).
#
# Dies ist bewusst KEIN Teil von `npm test` / der Vitest-Suite:
# - erfordert Docker lokal
# - testet reale Nebenläufigkeit auf Datenbankebene, kein Unit-Test
# - nutzt ausschließlich künstliche, isolierte Testdaten
#
# Aufruf: bash scripts/reengagement-concurrency-check.sh
#
# Voraussetzung: Docker ist lokal verfügbar und erreichbar.
# Es werden KEINE Produktionsdaten und KEINE externen Datenbanken verwendet.
# Der Container wird am Ende immer entfernt (auch bei Fehlern/Abbruch).

set -euo pipefail

CONTAINER_NAME="reengage-concurrency-check-$$"
MIGRATION_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/migrations/20261005000000_admin_reengagement_log.sql"
PARALLEL_CALLS=10
BATCH_ID="11111111-1111-1111-1111-111111111111"
ANFRAGE_ID="33333333-3333-3333-3333-333333333333"
CREATED_BY="22222222-2222-2222-2222-222222222222"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starte isolierten Postgres-Testcontainer ($CONTAINER_NAME) ..."
docker run -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=test postgres:15 >/dev/null

echo "Warte auf Datenbankbereitschaft ..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Lege minimales Schema (nur Testdaten) an ..."
docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres >/dev/null <<SQL
create extension if not exists pgcrypto;
create table anfragen (
  id uuid primary key default gen_random_uuid(),
  email text, vorname text, status text, assigned_therapist_id uuid
);
create role anon;
create role authenticated;
create role service_role;
-- Wie in Supabase: Schema-Zugriff vorhanden, aber KEINE Default-Grants auf neue Tabellen.
grant usage on schema public to anon, authenticated, service_role;
SQL

echo "Wende die echte Migration an: $MIGRATION_FILE"
docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres < "$MIGRATION_FILE" >/dev/null

echo "Lege eine künstliche Testanfrage an ..."
docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres -c \
  "insert into anfragen (id, email, vorname, status) values ('$ANFRAGE_ID', 'test@example.invalid', 'Test', 'admin_vorschlaege_gesendet');" >/dev/null

echo "Pruefe Berechtigungen (service_role darf, anon/authenticated nicht) ..."
perm_check() { # rolle sql erwartung(ok|denied)
  local out
  if out=$(docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "set role $1; $2" 2>&1); then
    [ "$3" = "ok" ] || { echo "FEHLER: $1 durfte unerwartet: $2" >&2; exit 1; }
  else
    [ "$3" = "denied" ] || { echo "FEHLER: $1 verweigert: $2" >&2; exit 1; }
  fi
}
LOG=public.anfragen_reengagement_log
perm_check service_role "select count(*) from $LOG;" ok
perm_check service_role "update $LOG set status = status where false;" ok
perm_check service_role "delete from $LOG where false;" denied
perm_check service_role "select (public.reserve_reengagement_attempt('$BATCH_ID'::uuid, '$ANFRAGE_ID'::uuid, '$CREATED_BY'::uuid)).id;" ok
docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres -c "delete from $LOG;" >/dev/null
for r in anon authenticated; do
  perm_check "$r" "select count(*) from $LOG;" denied
  perm_check "$r" "insert into $LOG (batch_id, anfrage_id, created_by) values ('$BATCH_ID','$ANFRAGE_ID','$CREATED_BY');" denied
  perm_check "$r" "update $LOG set status = status where false;" denied
  perm_check "$r" "select public.reserve_reengagement_attempt('$BATCH_ID'::uuid, '$ANFRAGE_ID'::uuid, '$CREATED_BY'::uuid);" denied
done
echo "OK: Berechtigungen wie erwartet."

echo "Feuere $PARALLEL_CALLS parallele Reservierungsversuche fuer dieselbe (batch_id, anfrage_id) ab ..."
pids=()
for i in $(seq 1 "$PARALLEL_CALLS"); do
  docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres -t -A -c \
    "select coalesce((reserve_reengagement_attempt('$BATCH_ID'::uuid, '$ANFRAGE_ID'::uuid, '$CREATED_BY'::uuid)).id::text, 'NULL');" \
    > "/tmp/${CONTAINER_NAME}_result_${i}.txt" &
  pids+=("$!")
done

for pid in "${pids[@]}"; do
  wait "$pid"
done

successes=0
for i in $(seq 1 "$PARALLEL_CALLS"); do
  result="$(cat "/tmp/${CONTAINER_NAME}_result_${i}.txt")"
  if [ "$result" != "NULL" ] && [ -n "$result" ]; then
    successes=$((successes + 1))
  fi
  rm -f "/tmp/${CONTAINER_NAME}_result_${i}.txt"
done

echo "Erfolgreiche Reservierungen: $successes von $PARALLEL_CALLS parallelen Versuchen."

if [ "$successes" -eq 1 ]; then
  echo "OK: Genau eine Reservierung erfolgreich, wie erwartet (atomarer Schutz wirkt)."
  exit 0
else
  echo "FEHLER: Erwartet genau 1 erfolgreiche Reservierung, tatsächlich: $successes" >&2
  exit 1
fi
