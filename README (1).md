# Funkstation & Smart City Lindau

Ein Projekt des P-Seminars Physik 2026/27 am Bodensee-Gymnasium Lindau.

## Überblick

Wir planen und bauen als Schülerteam eine Funkstation am Bodensee-Gymnasium Lindau. Sie soll eine vielseitig nutzbare technische Infrastruktur schaffen, mit der wir Funktechnik praktisch erforschen und gemeinnützige Anwendungen für Lindau und die Region ermöglichen. Im Mittelpunkt stehen Umweltmessungen, offene Funkinfrastruktur, ausfallsichere Kommunikation und der Empfang von Funksignalen aus aller Welt und aus dem Weltraum.

Das Projekt verbindet technische Entwicklung und praktische Teamarbeit mit Umwelt- und Wissenschaftsbildung. Fachliche Unterstützung erhalten wir unter anderem vom Deutschen Amateur-Radio-Club (DARC) e. V.

## Ziele

- Eine Funkstation auf dem Schulgelände aufbauen und in Betrieb nehmen.
- Umwelt- und Stadtdaten mit Sensoren erfassen und drahtlos übertragen.
- Messwerte über einen Webserver zugänglich und anschaulich darstellbar machen.
- Eine frei nutzbare LoRaWAN-Infrastruktur für eigene und externe Anwendungen bereitstellen.
- Alternative Kommunikationswege erproben, die auch bei Ausfällen herkömmlicher Netze hilfreich sein können.
- Interesse an Funktechnik, Naturwissenschaften und technischen Berufsfeldern fördern.

## Teilprojekte

### 1. Funksensoren und Umweltmonitoring mit LoRaWAN

Wir möchten Sensoren entwickeln, aufstellen und betreiben, die Messdaten aus der Umwelt erfassen und per LoRaWAN an unsere Station senden. Ein Schwerpunkt liegt auf Parametern des Bodensee-Wassers. Weitere mögliche Anwendungen sollen Bedürfnisse der Stadt Lindau und des Landkreises aufgreifen.

Geplante Messgrößen sind unter anderem:

- Wasserparameter und Wasserstand des Bodensees
- Luftqualität, zum Beispiel Feinstaub
- Temperatur und Luftfeuchtigkeit
- Licht und Lärm, zum Beispiel Helligkeit und Geräuschpegel

Die Daten sollen über einen Webserver bereitgestellt werden, damit Interessierte sie auswerten und visualisieren können. Für das Thema Seeforschung besteht bereits Kontakt zum Institut für Seenforschung in Langenargen.

### 2. LoRaWAN-Gateway für The Things Network

Auf dem Schulgelände soll ein Gateway für **The Things Network (TTN)** entstehen. TTN ist eine gemeinschaftlich betriebene Infrastruktur, über die LoRaWAN-Sensoren ihre Daten ins Internet übertragen können.

Ein öffentlich nutzbarer Zugangspunkt würde eigene Projekte unterstützen und zugleich anderen Menschen und Organisationen in der Region ermöglichen, Sensoren und Anwendungen anzubinden. Je nach Projektverlauf sind weitere Gateway-Standorte an geeigneten Punkten denkbar.

### 3. Funkkontakt zu Forschungsstationen und Raumfahrt

Ein Ziel ist es, Funkkontakte zu wissenschaftlichen Einrichtungen und Raumfahrtmissionen als öffentlichkeitswirksame Lern- und Wissenschaftserlebnisse vorzubereiten. Im Förderantrag werden insbesondere die Forschungsstation **Neumayer III** am Südpol sowie das Forschungsschiff **Polarstern** genannt. Der Flyer formuliert darüber hinaus die Vision, mit einer Forschungsstation am Nordpol und anlässlich des 500-jährigen BOGY-Jubiläums mit der **Internationalen Raumstation (ISS)** in Kontakt zu treten.

Solche Kontakte sollen die Bedeutung von Forschung und Umweltschutz greifbar machen und das Interesse an Wissenschaft fördern. Ihre technische Umsetzung hängt von den jeweiligen Funkmöglichkeiten und Rahmenbedingungen ab.

### 4. MeshCore für robuste Kommunikation

Mit LoRa-Technologie möchten wir eine alternative, redundante Kommunikationsinfrastruktur erproben. Über MeshCore können Knoten Nachrichten über ein Mesh-Netz weiterleiten. Das Konzept ist besonders interessant, wenn WLAN, Mobilfunk oder andere Kommunikationswege nicht verfügbar sind.

Geplant ist ein Knotenpunkt auf dem Schulgelände. Langfristig könnte eine solche Infrastruktur auch weitere Akteure einbinden und beispielsweise bei der Kommunikation zwischen kommunalen Einrichtungen und Einsatzorganisationen unterstützen.

### 5. WebSDR - eine Funk-Hörstation im Browser

Mit einem **WebSDR** möchten wir eine Funkempfangsstation einrichten, die über den Webbrowser genutzt werden kann. Interessierte sollen damit Funkstationen hören und - abhängig von Empfang, Frequenz und Ausstattung - auch Signale aus dem Umfeld der Raumfahrt empfangen können.

Die Station soll möglichst über die Schulhomepage erreichbar oder dort verlinkt sein, damit die Technik auch außerhalb des Seminars ausprobiert werden kann.

## Technischer Ansatz

Das Projekt kombiniert mehrere Funk- und Datentechnologien:

- **LoRaWAN:** energiesparende Funkübertragung von Sensordaten über größere Entfernungen
- **The Things Network:** gemeinschaftliche Infrastruktur zur Weiterleitung von LoRaWAN-Daten ins Internet
- **MeshCore:** dezentrale, über mehrere Knoten weiterleitbare Nachrichtenkommunikation
- **Amateurfunk und Satellitenfunk:** für Experimente und mögliche Kontakte zu Forschungs- und Raumfahrtmissionen
- **WebSDR:** browserbasierter Zugriff auf Funkempfang
- **Webserver und Visualisierung:** Veröffentlichung und Darstellung ausgewählter Messwerte

Welche Komponenten im Einzelnen umgesetzt werden, richtet sich nach dem Projektverlauf, der technischen Machbarkeit und den verfügbaren Mitteln.

## Nutzen für die Region und die Öffentlichkeit

Die Funkstation soll nicht nur ein Schulprojekt sein, sondern eine Grundlage für Anwendungen mit gesellschaftlichem Nutzen bieten. Dazu zählen Umweltbeobachtung, öffentlich zugängliche Messdaten, eine gemeinsam nutzbare Sensorinfrastruktur und Experimente mit alternativen Kommunikationswegen.

Gleichzeitig erwerben die Schülerinnen und Schüler praktische Kenntnisse in Elektronik, Funktechnik, Sensorik, Datenübertragung und der Veröffentlichung von Messdaten. Die Entwicklung und der Betrieb der Station bieten Einblicke in unterschiedliche technische Berufsfelder.

## Umsetzung und Unterstützung

Das Projekt wird im Schuljahr **2026/27** vom P-Seminar Physik der 11. Jahrgangsstufe am Bodensee-Gymnasium Lindau geplant und schrittweise umgesetzt. Das Team besteht laut Förderantrag aus 16 Schülerinnen und Schülern und wird von der Schule begleitet.

Die benötigte Ausrüstung umfasst unter anderem Funkgeräte, Antennen und Zubehör, ein LoRaWAN-Gateway sowie Komponenten für Experimente mit Satellitenfunk. Für einzelne Ausrüstungsposten nennt der Förderantrag Richtwerte; die tatsächliche Beschaffung hängt von Finanzierung und Projektplanung ab.

## Projektvision

Wir möchten eine offene, vielseitige Funkstation aufbauen, die Umweltmessungen, gemeinschaftliche technische Infrastruktur und spannende Funkexperimente verbindet. So soll das Projekt Wissenschaft erlebbar machen und einen langfristigen Mehrwert für die Schulgemeinschaft und die Region Lindau schaffen.

---

**Projekt:** Aufbau einer Funkstation und Smart City  
**Schule:** Bodensee-Gymnasium Lindau  
**Zeitraum:** Schuljahr 2026/27  
**Projektgruppe:** P-Seminar Physik, 11. Jahrgangsstufe
