# ShareFrame

Ein verschiebbarer roter Rahmen markiert den Bildschirmbereich, den du teilen möchtest. Das separate Fenster **„ShareFrame – Freigabe“** zeigt diesen Ausschnitt live. Teile dieses Fenster in Teams, Zoom, Meet oder einer anderen App mit Fensterfreigabe.

Ein transparentes Fenster enthält selbst keine Bilddaten der darunterliegenden Fenster. ShareFrame verwendet deshalb ScreenCaptureKit und ein eigenes Freigabefenster. Die eigene App wird aus der Aufnahme ausgeschlossen, damit Rahmen, Bedienelemente und Freigabefenster keine Bildschleife erzeugen.

## Starten

Voraussetzungen: macOS 13 oder neuer, Xcode / Swift 5.9 oder neuer zum Bauen. Keine externen Abhängigkeiten.

```sh
./build.sh
open build/ShareFrame.app
```

Die fertige App liegt unter `build/ShareFrame.app`. Du kannst sie auch nach `/Applications` kopieren. Der Build verwendet standardmäßig eine lokale Ad-hoc-Signatur. Für eine stabile Bildschirmaufnahme-Berechtigung über mehrere Builds hinweg kannst du eine vorhandene Signieridentität verwenden:

```sh
SHAREFRAME_SIGN_IDENTITY='Apple Development: …' ./build.sh
```

## Verwenden

1. **Bereich starten** anklicken und die macOS-Berechtigung für Bildschirmaufnahme erteilen. Falls nötig: Systemeinstellungen → Datenschutz & Sicherheit → Bildschirm- & Systemaudioaufnahme → ShareFrame aktivieren und ShareFrame neu starten. Die Bezeichnung hängt von der macOS-Version ab.
2. An einem roten Rand oder an der dunklen Leiste ziehen, um den Bereich zu verschieben. Am Griff **unten rechts** ziehen, um seine Größe zu ändern. Im Inneren des Rahmens kannst du die darunterliegenden Apps normal bedienen.
3. In der Konferenz-App die **Fensterfreigabe** auswählen und **„ShareFrame – Freigabe“** teilen. Das Freigabefenster geöffnet lassen und bei Bedarf zur Seite schieben. Es wird nicht in seine eigene Aufnahme übernommen.
4. **Pause** in der Rahmenleiste oder **⌘P** bei aktiver ShareFrame-App blendet das Livebild aus und beendet die Aufnahme. **⌘1** holt das Freigabefenster nach vorne. **⌘B** blendet den Rahmen ein/aus. Diese Tastenkürzel gelten, wenn ShareFrame aktiv ist; es sind keine globalen Hotkeys.
5. Über das Bildschirm-Symbol oder das Menüleistensymbol kannst du einen anderen Bildschirm auswählen, den Bereich zentrieren oder die App beenden. **⌘Q** beendet die App ebenfalls.

Der Ausschnitt bleibt innerhalb eines Bildschirms. Retina-Skalierung und Bildschirme links/oberhalb des Hauptbildschirms werden berücksichtigt. Bei einer Änderung der Bildschirmkonfiguration, beim Ruhezustand oder beim Benutzerwechsel pausiert die App; vor dem Fortsetzen kannst du den Bereich prüfen. Die zuletzt gespeicherte Position wird pro Bildschirm wiederhergestellt.

## Umfang und Grenzen

- Bis zu 30 Bilder pro Sekunde, mit Mauszeiger; kein Ton und keine Mikrofonaufnahme.
- Lokale Verarbeitung. Keine Netzwerkverbindungen, Aufnahmen oder Videodateien.
- macOS gewährt Bildschirmaufnahme für den Bildschirm. ShareFrame verarbeitet dessen Frames im Speicher; nur der zugeschnittene Bereich gelangt ins Freigabefenster.
- Die Konferenz-App muss ein normales macOS-Fenster teilen können. Ein tatsächlicher Anruf und das Verhalten beim Minimieren sind je Konferenz-App zu prüfen; das Freigabefenster während der Freigabe nicht minimieren.
- Geschützte Videoinhalte können von macOS geschwärzt werden.
- Die lokale App ist nicht notarisiert. Für die Weitergabe an andere Macs wären eine Developer-ID-Signatur und Notarisierung sinnvoll.

## Prüfen

```sh
swift test
```

Die Tests prüfen den Ausschnitt bei Retina-Skalierung und versetzten Bildschirmen, das Einhalten der Bildschirmgrenzen sowie Größenänderungen mit festem oberen linken Eckpunkt. Die Systemberechtigung und die Freigabe in einer Konferenz-App erfordern zusätzlich einen manuellen Test.

Grundlage: [Apple: Capturing screen content in macOS](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos).
