# Sicherheits- und Datenschutzkonzept

## Geltungsbereich

Dieses Dokument beschreibt die Sicherheitsregeln für:

- das private GitHub-Repository,
- technische Projektdokumentation,
- zukünftige KI-Suchfunktionen,
- Entwicklungs- und Deployment-Prozesse.

Es ersetzt keine individuelle juristische Datenschutzprüfung.

## Grundsatz

KI-Systeme erhalten nur Zugriff auf technische Informationen,
die für Softwareentwicklung, Dokumentation und Fehlersuche
erforderlich sind.

Produktionsdaten von Klientinnen und Klienten werden nicht
in einen KI-Suchindex übernommen.

## Zulässige Inhalte

- Quellcode
- Dateipfade
- API-Routen
- Tabellennamen
- Spaltennamen
- technische Datenflüsse
- Statusmodelle
- technische Architekturentscheidungen
- datensatzfreie SQL-Migrationen
- anonymisierte Fehlertypen
- künstliche Testdaten

## Unzulässige Inhalte

- Produktionsdatenbank-Dumps
- Klientenprofile
- Gesundheitsangaben
- echte Namen
- echte E-Mail-Adressen
- echte Telefonnummern
- echte Anschriften
- Geburtsdaten
- Support-E-Mails mit Personendaten
- Kalendertermine mit realen Klientennamen
- Booking-Tokens
- API-Schlüssel
- Passwörter
- Supabase-Service-Role-Keys
- OAuth-Access- oder Refresh-Tokens
- Resend-Schlüssel
- Meeting-Links mit vertraulichem Zugriff

## Zugriffskontrolle

- Repository bleibt privat.
- Zugriff wird nach dem Least-Privilege-Prinzip vergeben.
- KI-Zugriff beginnt read-only.
- Kein direkter KI-Zugriff auf die Produktionsdatenbank.
- Kein direkter KI-Push auf den produktiven Branch.
- Kein automatisches Deployment durch KI.
- Kein automatisches Ausführen von SQL in Produktion.

## SevDesk-API-Routen

Die nicht authentifizierten Routen `/api/sevdesk/create-provision-invoice`
und `/api/sevdesk/test-invoice` wurden entfernt. Sie konnten mit serverseitigen
sevDesk-Zugangsdaten externe Rechnungsaktionen auslösen. Zum Zeitpunkt der
Entfernung gab es keine Aufrufer im Repository und keine dokumentierte oder
konfigurierte interne Verwendung. Neue SevDesk-Aktionen müssen authentifiziert
und autorisiert sein und Rechnungsdaten serverseitig aus vertrauenswürdigen
Quellen laden.

## Coach-Rechnungen und UID-Bestätigung

Coach-UIDs werden nicht durch ihre Eingabe als bestätigt behandelt. Nur aktive
Admins dürfen sie manuell über `/api/accounting-settings/confirm-uid`
bestätigen. Änderungen an `vat_number` oder `business_country_code` löschen
`uid_confirmed_at` und `uid_confirmed_by` datenbankseitig.

Poise→Coach-Rechnungen bleiben bearbeitbare Entwürfe. Die automatische
Sessionberechnung darf einen gespeicherten Entwurf nur nach einer ausdrücklichen
Admin-Aktion überschreiben. `review_required` blockiert steuerlich relevante
Weiterverarbeitung. PDF- und sevDesk-Ausgabe müssen in einem späteren Schritt
den bewusst gespeicherten Rechnungsstand verwenden.

## Entwicklungsprozess

1. Änderung auf einem separaten Branch.
2. Lokale Syntax- und Buildprüfung.
3. Menschliche Kontrolle der Änderung.
4. Vercel Preview Deployment.
5. Funktionstest mit künstlichen Daten.
6. Pull Request.
7. Kontrollierter Merge in den produktiven Branch.
8. Produktives Deployment beobachten.
9. Rollback-Möglichkeit bereithalten.

## Logging

Serverlogs dürfen keine vollständigen Request-Bodies mit
personenbezogenen Daten enthalten.

Zu entfernen oder zu maskieren sind insbesondere:

- E-Mail-Adressen
- Telefonnummern
- Anschriften
- Freitext-Anliegen
- Diagnosen
- Booking-Tokens
- OAuth-Tokens
- Meeting-Links

Zulässige technische Logwerte sind beispielsweise:

- Request-ID
- anonymisierte Datensatz-ID
- API-Routenname
- technischer Fehlercode
- HTTP-Status
- Dauer einer Anfrage

## Draft-Recovery-Consent

Der optionale Consent für genau eine spätere Draft-Fortsetzungs-Erinnerung ist
technisch getrennt von Datenschutz- und Newsletter-Feldern. Neue Datensätze
speichern bei ausdrücklicher Zustimmung einen serverseitigen Zeitpunkt und
eine stabile Consent-Version. Der eigentliche Text wird nicht pro Datensatz
dupliziert. Bestehende Drafts erhalten keinen impliziten Consent; ihr Status
bleibt für Recovery effektiv unbekannt bzw. nicht berechtigt. Versandstatus und
Funnel-Messung sind separate Konzepte. Der tägliche Cronjob `/api/reminders/send`
verarbeitet ausschließlich berechtigte Drafts (>48h inaktiv, Consent `true`,
bisher un-erinnert) und sendet eine strikt neutrale E-Mail ohne psychologische
Details oder Themen. Die Idempotenz wird sichergestellt, indem `draft_reminder_sent_at`
erst nach erfolgreichem Mailversand in UTC aktualisiert wird.

Der bestehende öffentliche Resume-Mechanismus lädt `anfragen` aktuell anhand
von `rid` beziehungsweise `anfrageId` und verwendet `select("*")`. Der
Endpunkt hat keine zusätzliche Token-Autorisierung. Wer eine gültige ID kennt,
kann daher potentiell auch sensible Felder laden. Eine Token-Lösung ist eine
separate sicherheitskritische Entscheidung und wurde in dieser Änderung nicht
umgesetzt.

## Testdaten

Tests verwenden ausschließlich künstliche Datensätze.

Beispiel:

- Name: Test Klient
- E-Mail: test@example.invalid
- Telefonnummer: 0000000000

Keine Produktionsdaten in Preview Deployments kopieren.

## Schlüsselverwaltung

Zugangsschlüssel werden ausschließlich als geschützte
Umgebungsvariablen verwaltet.

Sie dürfen nicht vorkommen in:

- Quellcode
- Markdown-Dateien
- Screenshots
- Issues
- Pull Requests
- Chat-Nachrichten
- Testdaten
- Logs

## Vorfall mit Zugangsdaten

Bei Verdacht auf einen geleakten Schlüssel:

1. betroffenen Schlüssel sofort widerrufen,
2. neuen Schlüssel erzeugen,
3. Vercel-Umgebungsvariable aktualisieren,
4. Git-Historie prüfen,
5. GitHub Secret Scanning prüfen,
6. Logs auf unbefugte Verwendung kontrollieren,
7. Auswirkungen dokumentieren,
8. datenschutzrechtliche Meldepflicht prüfen.

## Produktion

Das laufende Poise-System bleibt während der Einführung der
KI-Dokumentation unverändert.

Dokumentations- und Indexierungsfunktionen werden vom
Produktivsystem getrennt eingeführt.