# Datenbank-Backup und Wiederherstellungstest (Supabase-Produktion)

Dauerhaftes Betriebsverfahren, rekonstruiert aus dem erfolgreich
durchgeführten Backup vom 17.10.2026. Zielgruppe: Betreiber (manuelle
Ausführung auf dem Mac). Stand: 31.10.2026.

## Verbindliche Sicherheitsregeln

- **Agenten führen dieses Verfahren niemals aus.** KI-Agenten dürfen keine
  Produktionsdatenbank-Dumps erzeugen, keine Produktionsverbindungen
  öffnen und keine Restores ausführen (siehe `docs/security.md`,
  `AI_CONTEXT.md`). Diese Anleitung dokumentiert das menschliche Verfahren.
- Niemals im Repository, in Chats oder Tickets: Verbindungsstrings,
  Passwörter, `backup-key.txt` (privater age-Schlüssel), unverschlüsselte
  Dumps, Datenbankinhalte, Checksummen-Dateien mit internen Hostnamen.
- Der private Schlüssel `backup-key.txt` bleibt ausschließlich lokal auf
  dem Mac (`chmod 600`), niemals auf NAS, Cloud oder im Repository. Der
  öffentliche Schlüssel `backup-public.txt` ist unkritisch.
- Dumps enthalten personenbezogene Gesundheitsdaten: Klartext-Dumps sofort
  nach erfolgreicher Roundtrip-Prüfung löschen; auf NAS nur
  `.age`-Dateien ablegen; lokale Testdatenbanken ohne Portfreigabe
  betreiben und sofort danach zerstören.
- Datenbankpasswort nur per `read -s` als `PGPASSWORD` einlesen (keine
  Shell-History, keine Datei) und nach Gebrauch `unset`. **Niemals einen
  Verbindungsstring mit Passwort als Kommandoargument übergeben** –
  Argumente sind in der Prozessliste sichtbar; `PGPASSWORD` als
  Umgebungsvariable ist es nicht.

## Voraussetzungen (einmalig)

```bash
brew install libpq age
export PATH="$(brew --prefix libpq)/bin:$PATH"   # pg_dump/pg_restore/psql
pg_dump --version
```

- Die `pg_dump`-Clientversion muss **mindestens** der Supabase-Serverversion
  entsprechen; die Serverversion wird in Schritt 3 des Backup-Verfahrens
  direkt abgefragt (zusätzlich sichtbar in der Preflight-Sektion `context`
  und im Supabase-Dashboard). Die Major-Version bestimmt auch das
  Docker-Image des Restore-Tests.
- Vorhandene Schlüssel aus dem Verfahren vom 17.10.2026:
  `~/Poise-Backup/backup-public.txt` (Empfänger) und
  `~/Poise-Backup/backup-key.txt` (privat, lokal). Falls der private
  Schlüssel fehlt: **Stopp** – ohne ihn ist keine Entschlüsselung und kein
  Restore-Test möglich; dann neues Schlüsselpaar mit `age-keygen` erzeugen
  und ab diesem Backup konsistent verwenden.
- Verbindungsdaten (Host, Port, Benutzer, Datenbankname) aus Supabase →
  Project → **Connect** ablesen: Direktverbindung oder **Session Pooler**
  (Port 5432). Kein Transaction Pooler (6543) – ungeeignet für `pg_dump`.

## Backup-Verfahren

```bash
# 1) Arbeitsordner
mkdir -p ~/Poise-Backup && chmod 700 ~/Poise-Backup && cd ~/Poise-Backup
chmod 600 backup-key.txt

# 2) Zugangsdaten sicher setzen: Passwort unsichtbar in die Umgebung,
#    Host/Benutzer als harmlose Variablen (aus Supabase -> Connect)
read -s PGPASSWORD && export PGPASSWORD
DBHOST="<DB-HOST>"; DBUSER="<DB-USER>"; DBNAME="postgres"

# 3) Serverversion pruefen (Client >= Server; Major fuer Restore-Test notieren)
psql -h "$DBHOST" -p 5432 -U "$DBUSER" -d "$DBNAME" -At -c "show server_version;"
pg_dump --version

# 4) Zeitstempel
STAMP="$(date +%Y%m%d-%H%M)"

# 5) Rollen und Berechtigungen separat sichern
#    (--no-role-passwords ist auf Supabase erforderlich, da pg_authid
#    nicht lesbar ist; Tabellen-/Spaltenrechte und RLS-Policies stecken
#    ohnehin im Hauptdump)
pg_dumpall -h "$DBHOST" -p 5432 -U "$DBUSER" -l "$DBNAME" \
  --roles-only --no-role-passwords > "roles-$STAMP.sql"

# 6) Vollstaendiger Dump im Custom-Format (Verfahren vom 17.10.2026)
pg_dump -h "$DBHOST" -p 5432 -U "$DBUSER" -d "$DBNAME" \
  --format=custom --file="poise-$STAMP.dump"

# 7) Verschluesseln, Roundtrip BEWEISEN, erst dann Klartext loeschen
age -R backup-public.txt -o "poise-$STAMP.dump.age" "poise-$STAMP.dump"
age -R backup-public.txt -o "roles-$STAMP.sql.age"  "roles-$STAMP.sql"
age -d -i backup-key.txt "poise-$STAMP.dump.age" | cmp - "poise-$STAMP.dump" \
  && echo "DUMP-ROUNDTRIP-OK"
age -d -i backup-key.txt "roles-$STAMP.sql.age" | cmp - "roles-$STAMP.sql" \
  && echo "ROLES-ROUNDTRIP-OK"
# Nur fortfahren, wenn BEIDE Roundtrips OK sind:
rm "poise-$STAMP.dump" "roles-$STAMP.sql"
unset PGPASSWORD
```

Hinweis: Scheitert Schritt 5 an Supabase-verwalteten Schemas
(`storage`, `realtime`, …), Fehlermeldung notieren und bewerten; das
Verfahren vom 17.10.2026 lief mit vollem Dump durch. Das Schema `public`
muss in jedem Fall vollständig enthalten sein.

## Integritätsprüfung (Pflicht, insbesondere vor dem P0-Rollout)

```bash
cd ~/Poise-Backup

# Inhaltsverzeichnis lesbar und plausibel? (nur Plausibilitaet!)
age -d -i backup-key.txt "poise-$STAMP.dump.age" | pg_restore -l | head -20
age -d -i backup-key.txt "poise-$STAMP.dump.age" | pg_restore -l \
  | grep -c "TABLE DATA public"                                        # muss > 0 sein
age -d -i backup-key.txt "roles-$STAMP.sql.age" | grep -c "CREATE ROLE" # muss > 0 sein
```

Wichtig: `pg_restore -l` zeigt nur das Inhaltsverzeichnis. Es **beweist
weder die Abwesenheit einer Policy noch einen Rechtezustand** (eine
fehlende Zeile kann auch ein unvollständiger Dump oder ein
Suchmuster-Fehler sein). Der verbindliche Nachweis erfolgt ausschließlich
im Wiederherstellungstest durch Abfragen der wiederhergestellten
Datenbank.

**Sessions-INSERT-Sperre vom 28.10.2026:** Das neue Backup muss den
Lockdown-Zustand enthalten. Nachweis:

1. Das Backup wurde nach dem 28.10.2026 erstellt (Zeitstempel).
2. Im Wiederherstellungstest (unten): `pg_policies` enthält **keine**
   Policy `allow inserts from api` auf `public.sessions`, beide
   Browser-INSERT-Privilegien sind `false`, und die Positivkontrollen
   belegen, dass Policies und ACLs überhaupt wiederhergestellt wurden
   (sonst wäre der Negativbefund wertlos).

Backups, die vor dem 28.10.2026 erstellt wurden, erfüllen das nicht und
dürfen für den P0-Rollout nicht als Wiederherstellungspunkt dienen.

## Übertragung auf die Synology NAS

```bash
cd ~/Poise-Backup
shasum -a 256 "poise-$STAMP.dump.age" "roles-$STAMP.sql.age" > "poise-$STAMP.sha256"

# Zielordner gemäß Verfahren vom 17.10.2026: Poiseconnectbackup
rsync -av "poise-$STAMP.dump.age" "roles-$STAMP.sql.age" "poise-$STAMP.sha256" \
  "<NAS-BENUTZER>@<NAS-HOST>:/volume1/Poiseconnectbackup/"

# Auf der NAS (SSH) verifizieren – Synology/BusyBox nutzt sha256sum,
# das Format von `shasum -a 256` ist dazu kompatibel:
#   cd /volume1/Poiseconnectbackup && sha256sum -c poise-<STAMP>.sha256
```

Nur `.age`-Dateien und Checksummen übertragen – nie Klartext-Dumps und
nie `backup-key.txt`.

## Wiederherstellungstest in isolierter Testdatenbank

Lokal per Docker, **gleiche PostgreSQL-Major-Version** wie der Server
(aus Backup-Schritt 3), **ohne Portfreigabe** (kein `-p`), Container
danach sofort zerstören.

```bash
cd ~/Poise-Backup
docker run -d --name poise-restore-test \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:<MAJOR>-alpine
until docker exec poise-restore-test pg_isready -U postgres -q; do sleep 1; done

# 0) Supabase-Umgebung minimal nachbilden: Extensions-Schema und die
#    Standard-Extensions, auf die public-Objekte verweisen koennen
docker exec poise-restore-test psql -U postgres -q -c \
  'create schema if not exists extensions;
   create extension if not exists pgcrypto with schema extensions;
   create extension if not exists "uuid-ossp" with schema extensions;'

# 1) Rollen zuerst einspielen (legt auch anon/authenticated/service_role
#    und supabase_*-Rollen an), Meldungen sammeln
age -d -i backup-key.txt "roles-$STAMP.sql.age" \
  | docker exec -i poise-restore-test psql -U postgres -q 2> /tmp/poise-roles.log
grep -i "error" /tmp/poise-roles.log
# ERWARTBAR und unkritisch: "role \"postgres\" already exists" sowie
# Hinweise zu reservierten Attributen einzelner supabase_*-Rollen.
# Jede andere Fehlermeldung klaeren, bevor es weitergeht.

# 2) Datenbank anlegen, vollstaendigen Dump einspielen, Fehler sammeln
docker exec poise-restore-test createdb -U postgres poise_restore
age -d -i backup-key.txt "poise-$STAMP.dump.age" \
  | docker exec -i poise-restore-test pg_restore -U postgres -d poise_restore \
    2> /tmp/poise-restore.log || true

# 3) Fehler klassifizieren
grep -c "ERROR" /tmp/poise-restore.log

# ECHTE Wiederherstellungsfehler: jede ERROR-Zeile mit Bezug auf das
# Schema public. Diese Pruefung MUSS leer bleiben (graphql_public zaehlt
# nicht als public):
grep "ERROR" /tmp/poise-restore.log | grep -E '[^_[:alnum:]]public\.' \
  ; echo "---- leer = keine echten Fehler"
```

**Erwartbare Umgebungsfehler** (Supabase-spezifisch, im Vanilla-Container
ohne Belang, sofern sie *nicht* das Schema `public` betreffen):

- `CREATE EXTENSION`-Fehler zu nicht installierbaren Supabase-Extensions
  (`pgjwt`, `pg_graphql`, `pg_net`, `supabase_vault`, `pgsodium`,
  `pg_stat_statements`, …) und Folgefehler zu davon abhängigen Objekten.
- Fehler in den Supabase-verwalteten Schemas `auth`, `storage`,
  `realtime`, `_realtime`, `graphql`, `graphql_public`, `vault`,
  `supabase_functions`, `pgsodium`, `extensions`.
- Fehlende Sonderrechte der Rollen `supabase_admin`,
  `supabase_auth_admin`, `authenticator`, `pgbouncer` sowie
  Event-Trigger-/`ALTER ... OWNER`-Meldungen zu diesen Rollen.

**Abbruchkriterium:** jede ERROR-Zeile mit Bezug auf `public.` sowie jede
Meldung, die sich nicht eindeutig einer der obigen Kategorien zuordnen
lässt. Im Zweifel gilt der Test als nicht bestanden.

```bash
# 4) Erfolgskriterien – tatsaechliche Pruefung der wiederhergestellten DB
#    (niemals Inhalte ausgeben!)
docker exec poise-restore-test psql -U postgres -d poise_restore -At -c \
  "select count(*) from information_schema.tables where table_schema='public';"
# Soll: plausible Tabellenzahl (mit Vorbefund vergleichen, notieren)

# Lockdown-Beweis (Policy wirklich abwesend):
docker exec poise-restore-test psql -U postgres -d poise_restore -At -c \
  "select count(*) from pg_policies where schemaname='public'
     and tablename='sessions' and policyname='allow inserts from api';"
# Soll: 0

# Positivkontrolle Policies (sonst waere der Negativbefund wertlos):
docker exec poise-restore-test psql -U postgres -d poise_restore -At -c \
  "select count(*) from pg_policies where schemaname='public'
     and policyname in ('coaches read own request conversations',
                        'coaches read own request messages');"
# Soll: 2

# Lockdown-Beweis Rechte + Positivkontrolle ACL-Wiederherstellung:
docker exec poise-restore-test psql -U postgres -d poise_restore -At -c \
  "select has_table_privilege('anon','public.sessions','INSERT'),
          has_table_privilege('authenticated','public.sessions','INSERT'),
          has_table_privilege('authenticated','public.request_conversations','SELECT');"
# Soll: f|f|t – die ersten beiden false (Lockdown), die dritte true.
# Ist auch die dritte false, wurden ACLs nicht wiederhergestellt und der
# Lockdown-Nachweis ist UNGUELTIG (Test nicht bestanden).

# Optional vollstaendig: scripts/privacy-p0-compat-summary.sql gegen
# poise_restore ausfuehren; Zeile 16 muss OK sein.

# 5) Aufraeumen (Pflicht – Container und Logs koennen PII-Bezug haben)
docker rm -f poise-restore-test
rm -f /tmp/poise-roles.log /tmp/poise-restore.log
```

Hinweis zu Positivkontrollen vor/nach P0: Vor dem P0-Rollout ist
zusätzlich `has_table_privilege('anon','public.anfragen','INSERT') = true`
eine gültige Positivkontrolle (Preflight-Befund 31.10.2026). Nach dem
P0-Rollout ist dieser Wert `false`; die
`request_conversations`-Kontrolle bleibt in beiden Zuständen gültig.

## Checkliste vor dem P0-Rollout

- [ ] Neues Backup (Dump + Rollen) nach diesem Verfahren erstellt
      (nach dem 28.10.2026), beide age-Roundtrips OK.
- [ ] Integritätsprüfung bestanden (TOC lesbar, `TABLE DATA public` > 0,
      Rollendump lesbar).
- [ ] `.age`-Dateien + Checksummen auf NAS, dort mit `sha256sum -c`
      verifiziert.
- [ ] Restore-Test bestanden: keine ERROR-Zeile mit `public.`-Bezug,
      Policy `allow inserts from api` = 0, Messaging-Policies = 2,
      Browser-INSERT auf `sessions` = false bei gültiger
      ACL-Positivkontrolle; Testcontainer und Logs entfernt,
      Restore-Dauer notiert.
- [ ] `backup-key.txt` weiterhin nur lokal, `chmod 600`;
      `PGPASSWORD` nach Abschluss `unset`.

## Querverweise

- Rollout-Reihenfolge und NO-GO-Kriterien:
  [privacy-p0-phase1-rollout.md](../privacy-p0-phase1-rollout.md)
- Datenbankreferenz: [database-schema.md](../generated/database-schema.md),
  [database-security.md](../generated/database-security.md),
  [database-dependencies.md](../generated/database-dependencies.md)
- Kompakte Katalogprüfung: `scripts/privacy-p0-compat-summary.sql`
