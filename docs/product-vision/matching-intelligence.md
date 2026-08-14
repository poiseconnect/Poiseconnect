# Matching Intelligence & Topic-based Coach Videos

> Dieses Dokument beschreibt eine zukünftige Produktvision für Poise Connect. Es ist keine technische Spezifikation, keine Freigabe für Architekturänderungen und keine Grundlage für automatische fachliche Entscheidungen. Bestehendes, verifiziertes Systemverhalten hat Vorrang.

## 1. Vision

Poise Connect soll langfristig zwei miteinander verbundene Fähigkeiten entwickeln:

1. **Matching Intelligence:** fachlich passendere Empfehlungen auf Basis mehrerer strukturierter Signale.
2. **Topic-based Coach Videos / Trust Layer:** verständliche, themenspezifische Informationen, die Klient:innen innerhalb einer fachlich passenden Auswahl eine informierte persönliche Entscheidung ermöglichen.

Zusammen können diese Fähigkeiten den Weg von der Anfrage bis zur Zusammenarbeit verbessern:

```text
Anliegen
→ fachliches Matching
→ passende Fachpersonen
→ Vertrauensaufbau
→ informierte Auswahl
→ Terminierung
→ Zusammenarbeit
→ strukturierte Passungs-/Outcome-Signale
→ besseres zukünftiges Matching
```

Das System soll zunächst Empfehlungen und Rankings verbessern. Es soll nicht autonom fachliche Entscheidungen über Klient:innen treffen.

## 2. Matching Intelligence

Poise Connect soll langfristig nicht ausschließlich anhand statischer Themengewichtungen entscheiden, welche Coaches vorgeschlagen werden. Perspektivisch kann das System aus strukturierten Daten lernen, welche Coach-Stärken bei welchen Anliegen und Zielsetzungen besonders häufig zu einer guten Passung beitragen.

Mögliche zukünftige Matching-Signale sind:

- Anliegen der Klient:in
- Kombination mehrerer Anliegen
- Ziele der Klient:in
- Leidensdruck
- strukturierte Coach-Stärken
- besondere fachliche Schwerpunkte eines Coaches
- Ergebnis des Erstgesprächs: Match oder kein Match
- Fortsetzung nach dem Erstgespräch
- früher Abbruch
- Weiterleitung zu einem anderen Coach
- vorhandene Sitzungen
- regulärer Abschluss
- Klient:innenfeedback zur Passung
- Coach-Einschätzung der Passung
- geeignete strukturierte Outcome- und Zielerreichungsdaten

Die Anzahl der Sitzungen allein darf ausdrücklich nicht als Erfolg interpretiert werden. Viele Sitzungen können unterschiedliche Gründe haben und sind für sich genommen kein valides Qualitätssignal.

Ein langfristig sinnvolleres Modell könnte mehrere Signale verbinden:

```text
Klient:innenanliegen
+ Coach-Stärken
+ tatsächliche Passung
+ strukturierte Outcome-Signale
↓
Verbesserung zukünftiger Matching-Empfehlungen
```

Die Entwicklung sollte mit Empfehlungen und Rankings beginnen. Die endgültige fachliche Entscheidung bleibt bei Menschen und bei der Klient:in.

### 2.1 Coach-Dokumentation und Datenminimierung

Coaches führen eigene Dokumentationen über ihre Arbeit. Diese Dokumentation kann langfristig Hinweise auf tatsächliche Coach-Stärken enthalten.

Die vollständige vertrauliche Coach-Dokumentation darf jedoch nicht ungeprüft für Matching oder KI-Training verwendet werden. Stattdessen kann perspektivisch geprüft werden, ob daraus klar definierte, notwendige und datenschutzgerecht minimierte strukturierte Merkmale entstehen können.

```text
vertrauliche Sitzungsdokumentation
↓ geschützt und zweckgebunden
strukturierte Matching-/Outcome-Merkmale
↓ nur nach gesonderter fachlicher und datenschutzrechtlicher Prüfung
Matching Intelligence
```

Datensparsamkeit, Zweckbindung, Zugriffskontrolle und nachvollziehbare fachliche Verantwortung sind dabei zentrale Architekturprinzipien. Eine mögliche spätere Nutzung erfordert eine eigene fachliche, rechtliche und technische Entscheidung.

## 3. Topic-based Coach Videos / Trust Layer

Coaches besitzen aktuell jeweils ein allgemeines Vorstellungsvideo. Perspektivisch können sie zusätzlich themenspezifische Kurzvideos für ihre tatsächlichen Kernthemen anbieten.

Beispiel:

```text
Anliegen: Partnerschaft & Beziehung
→ Matching schlägt drei passende Coaches vor
→ jeder Coach zeigt sein passendes Beziehungsvideo
→ Klient:in trifft eine informierte persönliche Auswahl
```

Das Ziel ist ausdrücklich nicht nur Marketing oder eine höhere Klickrate. Die Klient:in soll besser verstehen können:

- Versteht dieser Coach mein konkretes Problem?
- Wie betrachtet dieser Coach dieses Thema?
- Worauf achtet dieser Coach dabei?
- Wie würde dieser Coach daran arbeiten?
- Welche Haltung hat dieser Coach?
- Passt diese Arbeitsweise zu mir?

Dadurch kann die Coach-Auswahl persönlicher und nachvollziehbarer werden. Gleichzeitig kann das Erstgespräch entlastet werden, weil die Klient:in bereits vor dem Termin Gesicht, Stimme, Haltung, fachliche Perspektive und einen Teil der Arbeitsweise kennt.

## 4. Gemeinsame Video-Struktur

Die Videos sollten eine gemeinsame Grundstruktur besitzen, damit Coaches vergleichbar bleiben. Sie sollten ausdrücklich kein identisches Skript verwenden. Die individuellen Unterschiede in Perspektive und Arbeitsweise sollen sichtbar werden.

Empfohlene Länge: ungefähr 60 bis 90 Sekunden.

### 4.1 Ich erkenne dein Thema

Der Coach beschreibt eine typische Situation oder Problemerfahrung, die ihm bei diesem Thema häufig begegnet.

### 4.2 So verstehe ich das Problem

Der Coach erklärt seine individuelle fachliche Perspektive auf das Thema.

### 4.3 So würde ich mit dir arbeiten

Der Coach beschreibt möglichst konkret seine Arbeitsweise bei diesem Thema.

### 4.4 Du könntest bei mir richtig sein, wenn ...

Der Coach beschreibt, welche Klient:innen besonders gut zu seiner Arbeitsweise passen könnten.

Diese Struktur schafft Orientierung, ohne die Coaches sprachlich oder inhaltlich zu vereinheitlichen.

## 5. Differenzierung der Coaches

Ein wesentliches Ziel der Videos ist Differenzierung. Nicht alle Coaches sollen zu einem Thema dasselbe sagen.

Beim Oberthema **Partnerschaft & Beziehung** könnten unterschiedliche fachliche Schwerpunkte sichtbar werden:

- Coach A: Beziehungsmuster und Bindung
- Coach B: Bedürfnisse und Grenzen
- Coach C: Konflikte und Kommunikation
- Coach D: Trennung und Entscheidungsfindung

Austauschbare Aussagen wie ausschließlich „wertschätzend“, „ressourcenorientiert“, „sicherer Raum“ oder „individuelle Begleitung“ reichen für diese Differenzierung nicht aus.

Die Klient:in sollte nach einem Video sagen können:

> Jetzt verstehe ich besser, wie dieser Coach mit meinem Thema arbeiten würde.

## 6. Kernthemen statt Vollabdeckung

Nicht jeder Coach benötigt Videos für alle vorhandenen Matching-Themen. Entscheidend sind die tatsächlichen Kernthemen und besonderen Stärken des jeweiligen Coaches.

Beispiel:

```text
Coach A: Beziehung, Selbstwert, Bindung
Coach B: Angst, Stress, Burnout
```

Dadurch kann die thematische Positionierung präziser werden, ohne von jedem Coach eine vollständige Videobibliothek zu verlangen.

## 7. FIT und TRUST / CHOICE

Die Produktvision trennt zwei unterschiedliche Ebenen.

### 7.1 FIT

**Frage:** Welche Coaches passen fachlich wahrscheinlich besonders gut zu dieser Klient:in und ihrem Anliegen?

Mögliche Grundlagen:

- Anliegen
- Themenkombinationen
- Coach-Stärken
- Erfahrung
- Verfügbarkeit
- später strukturierte Passungs- und Outcome-Daten

FIT ist eine fachliche Empfehlungs- und Rankingfrage.

### 7.2 TRUST / CHOICE

**Frage:** Welche Informationen helfen der Klient:in, innerhalb der fachlich passenden Coaches eine informierte persönliche Entscheidung zu treffen?

Mögliche Grundlagen:

- themenspezifisches Coach-Video
- Arbeitsweise
- Haltung
- persönliche Vorstellung
- konkrete thematische Perspektive

TRUST / CHOICE ist eine Entscheidungsunterstützung für die Klient:in. Sie ersetzt nicht das fachliche Matching.

Popularität, Videoaufrufe oder Klickrate dürfen nicht automatisch mit fachlicher Qualität oder Matching-Erfolg gleichgesetzt werden.

## 8. Langfristige Lernschleife

Die langfristige Produktvision ist:

```text
Klient:innenanliegen
↓
fachliches Matching
↓
z. B. drei passende Coaches
↓
themenspezifische Darstellung dieser Coaches
↓
Klient:in trifft informierte Auswahl
↓
Erstgespräch
↓
weitere Zusammenarbeit
↓
strukturierte Passungs-/Outcome-Signale
↓
Verbesserung zukünftiger Matching-Empfehlungen
```

Langfristig könnte dadurch nicht nur sichtbar werden:

> Coach X arbeitet mit Beziehungsthemen.

Sondern beispielsweise:

> Coach X erzielt besonders gute Passung bei bestimmten Kombinationen von Beziehung, Selbstwert und bestimmten Zielsetzungen.

Das ist ausschließlich eine Zukunftsvision. Solche Aussagen würden nur auf Basis geeigneter, geprüfter und ausreichend erklärbarer strukturierter Signale in Betracht kommen.

## 9. Productization

Das Grundprinzip

```text
Anfrage
→ Matching
→ passende Fachpersonen
→ Vertrauensaufbau
→ Auswahl
→ Terminierung
→ Zusammenarbeit
→ Outcome
→ lernendes Matching
```

könnte langfristig auch für andere Beratungs-, Coaching-, Therapie- oder Vermittlungsorganisationen relevant sein.

Die Architektur sollte perspektivisch nicht ausschließlich für Poise gedacht werden. Zukünftige Entscheidungen sollten nach Möglichkeit vermeiden, neue unnötige Poise-spezifische Hardcodings einzuführen.

Das ist kein Auftrag, die bestehende App jetzt zu generalisieren oder Multi-Tenant-Funktionen zu bauen. Es ist eine langfristige Produkt- und Architekturleitplanke.

### 9.1 Productization-Fragen für größere Entscheidungen

Bei größeren zukünftigen Architekturentscheidungen können folgende Fragen berücksichtigt werden:

- Ist diese Funktion Poise-spezifisch?
- Ist sie für andere Organisationen wiederverwendbar?
- Wird neues Hardcoding eingeführt?
- Sollte etwas langfristig konfigurierbar sein?
- Beeinflusst die Entscheidung zukünftige Mandantenfähigkeit?
- Könnte die Funktion ein SaaS-Kernfeature werden?

Diese Fragen sind Leitplanken und keine unmittelbaren Implementierungsanforderungen.

## 10. Noch nicht implementieren

Diese Vision ist kein Implementierungsauftrag. Noch nicht implementieren:

- kein Datenbankschema ändern
- keine Migration erstellen
- keine Tracking-Funktionen einbauen
- keine Video-Integration bauen
- keine bestehende Matching-Logik verändern
- keine Outcome-Berechnung implementieren
- keine KI auf Coach-Dokumentationen anwenden
- keine zusätzlichen personenbezogenen oder gesundheitsbezogenen Daten speichern
- keine automatische Coach-Entscheidung implementieren
- keine bestehende API verändern
- keine bestehenden Komponenten verändern

Jede spätere Umsetzung benötigt eine eigene fachliche, technische, Security- und Datenschutzprüfung. Bei Architekturentscheidungen gilt weiterhin: ENTSCHEIDUNG ERFORDERLICH.
