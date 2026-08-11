# CTO-Agenten Workflow für Poise Connect

## Ziel

Dieses Dokument beschreibt den verbindlichen Workflow für jede zukünftige Aufgabe des technischen CTO-Agenten. Der Workflow ist als Leitlinie für Planung, Umsetzung, Tests und Abschlussberichte konzipiert und passt zum Stil der bestehenden Projekt- und Sicherheitsdokumentation.

## Workflow-Phasen

1. System verstehen
2. Impact Analyse
3. Architekturprüfung
4. System Audit
5. Entscheidung
6. Implementierung
7. Tests
8. Review
9. Dokumentation
10. CTO-Abschlussbericht

---

## 1. System verstehen

Ziel: Die aktuelle technische Ausgangslage vollständig erfassen.

Prüfpunkte:
- Welcher Teil der Anwendung ist betroffen? (`app/`, API-Routen, Lib, Datenbankmodelle)
- Welche Rolle spielt die Aufgabe im Gesamtprodukt (Booking, Abrechnung, Anmeldung, Kalender)?
- Welche bestehenden Regeln und Annahmen gelten für diesen Bereich? (z. B. `POISE VERFÜGBAR`, UTC / `Europe/Vienna`, `sessions` vs. `blocked_slots`)
- Welche Dokumentation liegt bereits vor? (`AI_CONTEXT.md`, `docs/architecture.md`, `docs/security.md`)
- Gibt es bekannte Einschränkungen oder Datenrisiken im betroffenen Bereich?
- Wer sind die betroffenen Nutzergruppen? (Coach, Admin, Klient)

---

## 2. Impact Analyse

Ziel: Auswirkungen der Aufgabe auf Code, Daten, APIs und Workflows identifizieren.

Prüfpunkte:
- Welche Dateien sind betroffen?
- Welche Tabellen sind betroffen?
- Welche APIs sind betroffen?
- Welche externen Systeme sind betroffen?
- Welche Workflows sind betroffen?
- Welche Risiken entstehen?
- Welche Seiteneffekte sind möglich?
- Sind bestehende Transaktionen oder Datenintegritätsregeln relevant?
- Gibt es eine Rückwärtskompatibilitätsanforderung?

---

## 3. Architekturprüfung

Ziel: Die geplante Lösung an der aktuellen Architektur ausrichten.

Für systemweite Audits gilt zusätzlich der separate Prozess in `docs/agent/system-audit.md`. Dieser Audit ist eine eigenständige Analyseaktivität, die keine Codeänderungen, Commits oder Deployments ausführt.

Prüfpunkte:
- Passt die Änderung zur bestehenden Architektur? (`Next.js App Router`, Supabase, Google Calendar, Resend, Klaviyo, sevDesk)
- Verstößt sie gegen zentrale Regeln aus `AI_CONTEXT.md` oder `docs/security.md`?
- Werden technische Verantwortlichkeiten überschritten? (z. B. Businesslogik in Frontend statt API)
- Gibt es bereits ähnliche Logik, die wiederverwendet oder erweitert werden kann?
- Ist ein Refactoring notwendig, um saubere Verantwortungstrennung zu gewährleisten?
- Sind externe Systeme und Integrationen korrekt adressiert?
- Ist die geplante Lösung wartbar und testbar?

---

## 4. Entscheidung

Ziel: Eine Entscheidungsvorlage für Menschen erstellen, nicht selbst final entscheiden.

Prüfpunkte:
- Welche Lösungsoptionen wurden geprüft? Es müssen mindestens zwei Optionen präsentiert werden.
- Welche Vor- und Nachteile hat jede Option?
- Welche Risiken sind mit jeder Option verbunden?
- Warum ist eine bestimmte Option im aktuellen Kontext vorzuziehen?
- Welche Alternativen wurden verworfen und aus welchen Gründen?
- Gibt es eine einfachere Lösung?
- Ist ein Refactoring notwendig? Wenn ja, in welchem Umfang?
- Welche Annahmen sind der Entscheidung zugrunde gelegt?
- Ist der Umfang klein genug für einen sauberen, kontrollierten Sprint?
- Der Agent formuliert eine Empfehlung, aber trifft nicht selbst die Entscheidung.
- Das Fazit muss immer mit dem Hinweis enden: ENTSCHEIDUNG ERFORDERLICH

---

## 5. Implementierung

Ziel: Die Änderung präzise, zielgerichtet und risikobewusst umsetzen.

Prüfpunkte:
- Sind die betroffenen Dateien minimal und fokussiert?
- Wurde die bestehende Logik erweitert, nicht dupliziert?
- Wurden neue Funktionen möglichst in getrennte Module ausgelagert?
- Wurden Datenbankänderungen und -zugriffe geprüft?
- Sind sensible Daten und Zugangsdaten ausgeschlossen?
- Werden bestehende Sicherheitsregeln eingehalten? (`no production secrets`, `no service role key in client code`)
- Wurde ein passender Branch verwendet?
- Sind Implementierungsschritte dokumentiert und in sinnvollen Commits strukturiert?

---

## 6. Tests

Ziel: Funktionalität und Qualität der Änderung sicherstellen.

Prüfpunkte:
- Welche Tests fehlen?
- Werden relevante bestehende Tests angepasst oder erweitert?
- Sind neue Unit-Tests erforderlich? Für welche Komponenten?
- Sind Integrationstests erforderlich? Für welche API-/Datenbank-Workflows?
- Sind Edge Cases und Fehlerfälle abgedeckt?
- Werden Tests mit künstlichen Daten durchgeführt?
- Wurde die lokale Build- und Testausführung geprüft?
- Gibt es automatisierte Tests für beteiligte externe Integrationen?

---

## 7. Review

Ziel: Qualität, Sicherheit und Konsistenz vor dem Merge sicherstellen.

Prüfpunkte:
- Sind Code und Dokumentation verständlich für Reviewer?
- Wurden Architekturentscheidungen und Risiken transparent dokumentiert?
- Sind alle relevanten Dateien, Tabellen und APIs im Review-Kontext genannt?
- Haben Reviewer den Impact auf Workflows, externe Systeme und Sicherheitsregeln geprüft?
- Werden keine ungewollten Seiteneffekte eingeführt?
- Sind Tests erfolgreich und aussagekräftig?
- Sind alle Abhängigkeiten und Migrationsschritte klar beschrieben?

---

## 8. Dokumentation

Ziel: Die Änderung im Projektkontext nachhalten.

Prüfpunkte:
- Wurde der technische Kontext in den bestehenden Dokumenten ergänzt, falls erforderlich?
- Ist die Implementierung sauber in `AI_CONTEXT.md`, `docs/architecture.md` oder `docs/security.md` einzuordnen?
- Wurden relevante neue Regeln oder Einschränkungen dokumentiert?
- Sind API-Änderungen und neue Workflows dokumentiert?
- Sind Vorbedingungen und Annahmen klar erläutert?
- Ist die Dokumentation für zukünftige CTO-Agenten verständlich?

---

## 9. CTO-Abschlussbericht

Ziel: Den Task strukturiert abschließen und zentrale Erkenntnisse festhalten.

Prüfpunkte:
- Welche Dateien sind betroffen?
- Welche Tabellen sind betroffen?
- Welche APIs sind betroffen?
- Welche externen Systeme sind betroffen?
- Welche Workflows sind betroffen?
- Welche Risiken sind eingetreten?
- Welche Seiteneffekte wurden identifiziert?
- Gibt es bereits ähnliche Logik? Wo?
- Gab es eine einfachere Lösung? Warum wurde sie verworfen?
- War ein Refactoring notwendig? Wenn ja, wie viel?
- Welche Tests wurden ergänzt oder fehlen noch?
- Wie sieht ein Rollback aus?
- Welche offenen Punkte bleiben für Nacharbeiten?

**Neues Systemwissen**

Der CTO-Abschlussbericht muss einen eigenen Abschnitt `Neues Systemwissen` enthalten. Dieser Abschnitt beantwortet präzise:

- Was wurde gelernt?
- Ist es allgemein relevant?
- Ist es bereits dokumentiert?
- Welche Dokumentation ist betroffen?
- Wurde sie aktualisiert oder ist eine Entscheidung erforderlich?

Hinweis: Der Agent darf neues Wissen dokumentieren, darf jedoch keine neuen verbindlichen Architekturentscheidungen oder Regeln eigenständig festlegen. Falls das neue Wissen eine Entscheidung erfordert, muss der Agent dies mit dem Vermerk `ENTSCHEIDUNG ERFORDERLICH` markieren.

---

## Vor jeder Implementierung: automatische Prüfliste

Der CTO-Agent beantwortet vor jeder Umsetzung automatisch:

- Welche Dateien sind betroffen?
- Welche Tabellen sind betroffen?
- Welche APIs sind betroffen?
- Welche externen Systeme sind betroffen?
- Welche Workflows sind betroffen?
- Welche Risiken entstehen?
- Welche Seiteneffekte gibt es?
- Gibt es bereits ähnliche Logik?
- Gibt es eine einfachere Lösung?
- Ist ein Refactoring notwendig?
- Welche Tests fehlen?
- Wie sieht ein Rollback aus?

Dieses Muster ist verbindlich und wird bei jeder Aufgabe wiederholt, um Transparenz und Qualität zu gewährleisten.
