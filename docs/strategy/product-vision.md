# Poise Product Vision

> **Hinweis zum Status dieses Dokuments**
> Dies ist ein strategisches Vision-Dokument, **keine technische Spezifikation** und **keine Freigabe für Architekturänderungen**. Es dient dem CTO-Agenten als langfristiger Produktkontext, um technische Entscheidungen einzuordnen. Entscheidungen bleiben immer beim Menschen. Bei Widerspruch zwischen dieser Vision und bestehendem, verifiziertem Systemverhalten gilt die Priorität aus Abschnitt 8.

## 1. Kernvision

Poise soll langfristig weder nur Vermittlungsplattform noch nur Praxissoftware sein.

Poise soll die Plattform werden, die Menschen zur passenden psychologischen Unterstützung bringt und anschließend den gesamten Prozess für Klient:innen und Psycholog:innen organisiert.

## 2. Vier miteinander verbundene Systeme

### A. Aufmerksamkeit & Vertrauen

Linda ist zunächst der wichtigste Content-, Vertrauens- und Nachfragekanal.

Langfristig soll aus bestehendem psychologischem Content eine wiederverwendbare Wissensbasis entstehen:

Content
→ Transkription
→ Poise Content Knowledge Base
→ Instagram
→ SEO
→ Newsletter
→ internationale Inhalte
→ perspektivisch KI-gestützte Content-Produktion

Lindas Wissen soll dadurch zu einem wiederverwendbaren digitalen Asset werden.

Poise soll langfristig jedoch nicht ausschließlich von Lindas Reichweite abhängig sein.

Weitere Nachfragequellen können sein:

- SEO / Google
- Empfehlungen
- Ärzt:innen
- Unternehmen
- Psycholog:innen
- weitere Partnerschaften

### B. Poise Matching

Matching ist ein zentraler Produktkern.

Nicht:
„Hier sind viele Psycholog:innen – such dir jemanden aus.“

Sondern:
„Erzähl uns, was du brauchst. Wir helfen dir, eine passende Person zu finden.“

Matching kann langfristig unter anderem berücksichtigen:

- Anliegen
- Spezialisierung
- Qualifikation
- persönliche Präferenzen
- Sprache
- online / vor Ort
- Standort
- Preis
- Verfügbarkeit
- Beratungs-/Therapieform
- weitere fachlich sinnvolle Kriterien

Wichtig:
Qualität und sinnvolle Balance zwischen Nachfrage und verfügbarem Angebot sind wichtiger als maximale Netzwerkgröße.

### C. Poise App

Die bestehende eigene App bleibt der operative Kern.

Aktueller grundlegender Flow:

Anfrage
→ Matching
→ Terminfindung / Booking
→ Kalender
→ Kommunikation
→ Sitzungen
→ Abrechnung

Die eigene App soll schrittweise um moderne Scheduling- und Praxisverwaltungsfunktionen erweitert werden.

Calendly ist dabei ein Funktionsbenchmark, NICHT das Ziel einer Ablösung der eigenen App.

Wir wollen sinnvolle Calendly-artige Funktionen in Poise selbst integrieren, wenn sie zum Produkt passen.

Dazu können langfristig gehören:

- Self-Service Booking
- Terminvorschläge
- Verfügbarkeiten
- Terminverschiebung
- Terminabsage
- Erinnerungen
- Zeitzonen
- Buchungsregeln
- Pufferzeiten
- Kalender-Synchronisation
- weitere Scheduling-Funktionen

Bestehende funktionierende Poise-spezifische Prozesse dürfen dabei nicht unnötig durch Standard-Scheduling-Logik ersetzt werden.

### D. Poise Netzwerk + SaaS

Langfristig soll der technische Kern so entwickelt werden können, dass Poise nicht ausschließlich für die eigene Organisation funktioniert.

Mögliche Modelle:

1. Software only
Psycholog:innen/Praxen nutzen die Software für eigene Klient:innen.

2. Software + Poise Netzwerk
Sie nutzen die Software und können zusätzlich Klient:innen über das Poise Matching erhalten.

3. Poise Vermittlung
Poise vermittelt weiterhin passende Klient:innen und behält das bestehende Vermittlungsmodell.

Das bestehende Vermittlungsgeschäft soll nicht vorschnell durch SaaS ersetzt werden.
SaaS ist eine mögliche zusätzliche Wachstumsebene.

## 3. Langfristige technische Richtung

Bei neuen Architekturentscheidungen soll geprüft werden, ob sie langfristig folgende Eigenschaften unterstützen oder zumindest nicht unnötig verhindern:

- konfigurierbar
- modular
- sicher
- DSGVO-tauglich
- skalierbar
- perspektivisch mandantenfähig / Multi-Tenant
- perspektivisch White-Label-fähig

ABER:

Diese Punkte sind strategische Leitplanken.

Sie sind KEINE Anweisung, das bestehende System jetzt auf Multi-Tenant umzubauen.

Keine bestehende funktionierende Architektur darf allein aufgrund dieser Vision refactored werden.

Wenn eine konkrete Architekturentscheidung nötig wird:
ENTSCHEIDUNG ERFORDERLICH.

## 4. KI und Entwicklungsarchitektur

Poise soll langfristig über eine strukturierte technische Wissensschicht verfügen, damit KI-Agenten Auswirkungen von Änderungen verstehen können.

Zielbild:

Codebase
→ Architekturwissen / Knowledge Layer
→ APIs
→ Datenbank
→ Statusmodelle
→ Kalender
→ E-Mail
→ Abrechnung
→ Abhängigkeiten

Der CTO-Agent soll dieses Wissen verwenden, um vor Änderungen Auswirkungen und Risiken zu analysieren.

Regelmäßige System- und Security-Audits bleiben Teil des CTO-Workflows.

## 5. KI für Psycholog:innen

Perspektivisch kann Poise eigene KI-gestützte Funktionen für Psycholog:innen anbieten, beispielsweise:

- Dokumentationsunterstützung
- Zusammenfassungsentwürfe
- Vorbereitung von Sitzungen
- Workbooks / Übungen
- Verlaufsübersichten

Diese Funktionen sind ausdrücklich Zukunftsvision.

Gesundheits- und Sitzungsdaten benötigen eine besonders strenge Datenschutz-, Security- und Einwilligungsarchitektur.

Keine solche Funktion darf allein aufgrund dieses Vision-Dokuments implementiert werden.

## 6. Wachstumsprinzip

Die langfristige Schleife ist:

Content / SEO / Empfehlungen
→ Nachfrage
→ Matching
→ Vermittlungen
→ Umsatz
→ besseres Produkt und Netzwerk
→ attraktiver für Psycholog:innen
→ besseres Angebot
→ bessere Matches
→ bessere Erfahrung
→ Empfehlungen
→ erneutes Wachstum

## 7. Entwicklungsprinzip

Die Vision soll NICHT dazu führen, viele Dinge gleichzeitig zu bauen.

Grundprinzip:

1. bestehendes System sicher und stabil halten
2. kritische Security-Lücken schließen
3. Architekturwissen verbessern
4. bestehende Kernprozesse verbessern
5. eigene Scheduling-/Calendly-artige Funktionen ausbauen
6. Nachfrage und Matching verbessern
7. Multi-Tenant/SaaS schrittweise vorbereiten
8. externe Praxis erst als Pilot, wenn der Kern stabil genug ist

## 8. Entscheidungsregel für den CTO-Agenten

Bei größeren Features oder Architekturänderungen soll der CTO-Agent zusätzlich fragen:

- Unterstützt die Änderung den aktuellen Poise-Kern?
- Passt sie zur langfristigen Product Vision?
- Erzeugt sie unnötigen Vendor Lock-in?
- Verbaut sie spätere Konfigurierbarkeit oder Mandantenfähigkeit?
- Erhöht sie unnötig Komplexität?
- Welche bestehenden Funktionen könnten betroffen sein?

Die Vision darf niemals bestehendes Repository-Wissen überschreiben.

Priorität bei Widersprüchen:

1. Security / Datenschutz
2. tatsächlich bestehendes Systemverhalten und verifizierte Source-of-Truth
3. explizite aktuelle menschliche Entscheidung
4. dokumentierte Architektur
5. Product Vision

Bei Widerspruch oder notwendiger strategischer Entscheidung:

ENTSCHEIDUNG ERFORDERLICH
