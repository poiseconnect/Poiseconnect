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
  nach Verschlüsselung löschen; auf NAS nur `.age`-Dateien ablegen; lokale
  Testdatenbanken ohne Portfreigabe betreiben und sofort danach zerstören.
- Verbindungsstring nur per `read -s` einlesen (keine Shell-History,
  keine Datei) und nach Gebrauch `unset`.

## Voraussetzungen (einmalig)

```bash
brew install libpq age
export PATH="$(brew --prefix libpq)/bin:$PATH"   # pg_dump/pg_restore/psql
pg_dump --version
```

- Die `pg_dump`-Clientversion muss **mindestens** der Supabase-Serverversion
  entsprechen. Serverversion liefert die Kontextzeile der Preflight
  (`scripts/privacy-p0-schema-preflight.sql`, Sektion `context`) oder das
  Supabase-Dashboard.
- Vorhandene Schlüssel aus dem Verfahren vom 17.10.2026:
  `~/Poise-Backup/backup-public.txt` (Empfänger) und
  `~/Poise-Backup/backup-key.txt` (privat, lokal). Falls der private
  Schlüssel fehlt: **Stopp** – ohne ihn ist keine Entschlüsselung und kein
  Restore-Test möglich; dann neues Schlüsselpaar mit `age-keygen` erzeugen
  und ab diesem Backup konsistent verwenden.
- Verbindungsstring aus Supabase → Project → **Connect**: Direktverbindung
  oder **Session Pooler** (Port 5432). Kein Transaction Pooler (6543) –
  ungeeignet für `pg_dump`.

## Backup-Verfahren

```bash
# 1) Arbeitsordner
mkdir -p ~/Poise-Backup && chmod 700 ~/Poise-Backup && cd ~/Poise-Backup
chmod 600 backup-key.txt

# 2) Verbindung einlesen (Eingabe bleibt unsichtbar, keine History)
read -s PGURL && export PGURL

# 3) Zeitstempel
STAMP="$(date +%Y%m%d-%H%M)"

# 4) Rollen und Berechtigungen separat sichern
#    (--no-role-passwords ist auf Supabase erforderlich, da pg_authid
#    nicht lesbar ist; Tabellen-/Spaltenrechte und RLS-Policies stecken
#    ohnehin im Hauptdump)
pg_dumpall -d "$PGURL" --roles-only --no-role-passwords > "roles-$STAMP.sql"

# 5) Vollständiger Dump im Custom-Format (Verfahren vom 17.10.2026)
pg_dump "$PGURL" --format=custom --file="poise-$STAMP.dump"

# 6) Verschlüsseln und Klartext sofort entfernen
age -R backup-public.txt -o "poise-$STAMP.dump.age" "poise-$STAMP.dump"
age -R backup-public.txt -o "roles-$STAMP.sql.age" "roles-$STAMP.sql"
rm "poise-$STAMP.dump" "roles-$STAMP.sql"
unset PGURL
```

Hinweis: Scheitert Schritt 5 an Supabase-verwalteten Schemas
(`storage`, `realtime`, …), Fehlermeldung notieren und bewerten; das
Verfahren vom 17.10.2026 lief mit vollem Dump durch. Das Schema `public`
muss in jedem Fall vollständig enthalten sein.

## Integritätsprüfung (Pflicht, insbesondere vor dem P0-Rollout)

```bash
cd ~/Poise-Backup

# Entschlüsselbarkeit + Inhaltsverzeichnis (ohne Restore)
age -d -i backup-key.txt "poise-$STAMP.dump.age" > /tmp/poise-verify.dump
pg_restore -l /tmp/poise-verify.dump | head -20
pg_restore -l /tmp/poise-verify.dump | grep -c "TABLE DATA public"      # muss > 0 sein
pg_restore -l /tmp/poise-verify.dump | grep -i "allow inserts from api" # darf NICHTS ausgeben

# Rollendump prüfbar?
age -d -i backup-key.txt "roles-$STAMP.sql.age" | grep -c "CREATE ROLE" # muss > 0 sein

rm /tmp/poise-verify.dump
```

**Sessions-INSERT-Sperre vom 28.10.2026:** Das neue Backup muss den
Lockdown-Zustand enthalten. Nachweis auf zwei Ebenen:

1. `pg_restore -l` listet **keine** Policy `allow inserts from api`
   (Prüfung oben).
2. Endgültig im Restore-Test (unten): Compat-Summary-Zeile 16 = OK.

Backups, die vor dem 28.10.2026 erstellt wurden, erfüllen das nicht und
dürfen für den P0-Rollout nicht als Wiederherstellungspunkt dienen.

## Übertragung auf die Synology NAS

```bash
cd ~/Poise-Backup
shasum -a 256 "poise-$STAMP.dump.age" "roles-$STAMP.sql.age" > "poise-$STAMP.sha256"

# Zielordner gemäß Verfahren vom 17.10.2026: Poiseconnectbackup
rsync -av "poise-$STAMP.dump.age" "roles-$STAMP.sql.age" "poise-$STAMP.sha256" \
  "<NAS-BENUTZER>@<NAS-HOST>:/volume1/Poiseconnectbackup/"

# Auf der NAS (SSH) verifizieren:
#   cd /volume1/Poiseconnectbackup && shasum -a 256 -c poise-<STAMP>.sha256
```

Nur `.age`-Dateien und Checksummen übertragen – nie Klartext-Dumps und
nie `backup-key.txt`.

## Wiederherstellungstest in isolierter Testdatenbank

Lokal per Docker, gleiche PostgreSQL-Major-Version wie der Server,
**ohne Portfreigabe** (kein `-p`), Container danach sofort zerstören.

```bash
cd ~/Poise-Backup
docker run -d --name poise-restore-test \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:<MAJOR>-alpine
sleep 5

# 1) Rollen zuerst (Fehler zu bereits existierenden Rollen sind ok)
age -d -i backup-key.txt "roles-$STAMP.sql.age" \
  | docker exec -i poise-restore-test psql -U postgres -q

# 2) Datenbank anlegen und Dump einspielen
docker exec poise-restore-test createdb -U postgres poise_restore
age -d -i backup-key.txt "poise-$STAMP.dump.age" \
  | docker exec -i poise-restore-test pg_restore -U postgres -d poise_restore

# 3) Erfolgskriterien (keine Inhalte ausgeben!)
docker exec poise-restore-test psql -U postgres -d poise_restore -c \
  "select count(*) from information_schema.tables where table_schema='public';"
docker exec poise-restore-test psql -U postgres -d poise_restore -c \
  "select count(*) from pg_policies where schemaname='public'
     and policyname in ('coaches read own request conversations',
                        'coaches read own request messages');"  -- erwartet: 2
docker exec poise-restore-test psql -U postgres -d poise_restore -c \
  "select has_table_privilege('anon','public.sessions','INSERT') as anon_insert,
          has_table_privilege('authenticated','public.sessions','INSERT') as auth_insert;"
  -- erwartet: beide false (Lockdown im Backup erhalten)

# Optional vollständig: scripts/privacy-p0-compat-summary.sql gegen
# poise_restore ausführen; Zeile 16 muss OK sein.

# 4) Aufräumen (Pflicht – Container enthält personenbezogene Daten)
docker rm -f poise-restore-test
```

Bewertung der `pg_restore`-Ausgabe: Fehler zu fehlenden Extensions oder
Supabase-internen Schemas (`auth`, `storage`, `supabase_functions`, …)
sind zu erwarten und einzeln zu bewerten. **Abbruchkriterium ist jeder
Fehler im Schema `public`.**

## Checkliste vor dem P0-Rollout

- [ ] Neues Backup (Dump + Rollen) nach diesem Verfahren erstellt
      (nach dem 28.10.2026).
- [ ] Integritätsprüfung bestanden (TOC lesbar, keine
      `allow inserts from api`-Policy, Rollendump lesbar).
- [ ] `.age`-Dateien + Checksummen auf NAS, Checksummen dort verifiziert.
- [ ] Restore-Test bestanden (public-Schema vollständig, 2 Messaging-
      Policies, Browser-INSERT auf `sessions` = false), Testcontainer
      zerstört, Restore-Dauer notiert.
- [ ] `backup-key.txt` weiterhin nur lokal, `chmod 600`.

## Querverweise

- Rollout-Reihenfolge und NO-GO-Kriterien:
  [privacy-p0-phase1-rollout.md](../privacy-p0-phase1-rollout.md)
- Datenbankreferenz: [database-schema.md](../generated/database-schema.md),
  [database-security.md](../generated/database-security.md),
  [database-dependencies.md](../generated/database-dependencies.md)
- Kompakte Katalogprüfung: `scripts/privacy-p0-compat-summary.sql`
