# Tangram-Generator

Ein Generator für **unbegrenzt viele Tangram-Puzzles** – als **Web-App** und als **Godot-4-Bibliothek (`.gd`)**.
Beide Versionen teilen sich denselben Algorithmus und erzeugen für dieselbe Puzzle-Nummer **dasselbe Puzzle**
(automatisch geprüft, siehe [Tests](#tests)).

* **Bekannte Formen**: 490 Silhouetten in 11 Kategorien – Tiere, Essen & Trinken, Natur, Fahrzeuge, Gebäude,
  Alltagsdinge, Sport, Figuren & Körper, Symbole, Buchstaben, Zahlen – jeweils mit mehreren Varianten.
* **Unendliche Kategorien**: abstrakte Figuren (Zufall, Kompakt, Lang & schlank, Verzweigt) und **Muster**
  (Spiegel, Kaleidoskop, Punktsymmetrie). Jede ganze Zahl – auch `1000000000000000000000` – ist ein eigenes Puzzle.
* **Eigene Kategorien und Formen**: beliebige Emojis, Buchstaben oder ganze Wörter eingeben → bekommen sofort
  unendlich viele Tangram-Varianten. Export/Import als Paket, auch für Godot.
* **Mehr Teile**: 1–4 Sätze (7 / 14 / 21 / 28 Teile) für Profis.

## Web-App starten

Die Web-App ist statisch (kein Build, keine Abhängigkeiten). Sie muss über einen Webserver geöffnet werden
(ES-Module und Web Worker funktionieren nicht per Doppelklick auf `index.html`):

```bash
python3 -m http.server 8080 -d web      # oder: npm run serve
# dann http://localhost:8080 öffnen
```

Der Ordner `web/` lässt sich 1:1 auf jedem statischen Hosting veröffentlichen (GitHub Pages, Netlify, …).

**Bedienung:** Teile ziehen (rasten an Ecken ein) · drehen mit Doppelklick/Mausrad/`R` (45°-Schritte) ·
spiegeln mit `F` · Tipp `H` · Links wie `#tiere/42/1` teilen genau dieses Puzzle.

## Wie es funktioniert (und was „Training“ hier heißt)

Es gibt **kein neuronales Netz und keine Trainingsdaten im Sinne von Machine Learning**. Stattdessen:

1. **Geometrie-Kern** (`web/js/core/`): die 5 Teilformen, Platzierungen in 45°-Schritten, exakte Kollisions-
   und Kontaktprüfung, deterministischer Zufallsgenerator (`cyrb128` + `sfc32`, reine 32-Bit-Arithmetik).
2. **Prozeduraler Generator** (`generate.js`): legt die Teile nacheinander flächig an Kanten an. Aus Seed-String
   (`kategorie:nummer:sätze`) entsteht immer dieselbe Figur. Lochfreiheit und Zusammenhang werden geprüft.
3. **Silhouetten-Solver** (`fit.js`) – das ist das „Lernen der Formen“: Zu einer Zielsilhouette sucht
   *Simulated Annealing* die Anordnung der 7 Teile, die ihr am ähnlichsten ist (Maß: IoU, Überdeckung/Vereinigung).
   Die Silhouetten kommen aus Emoji- bzw. Schrift-Glyphen (`tools/catalog.mjs` – dort lassen sich weitere Formen
   eintragen), werden zu Masken gerastert und mit `npm run bake` zu Paketen unter `web/data/packs/` gelöst.
   Die Ergebnisse sind **Annäherungen** (Ø 82–89 % IoU): mit nur 7 Teilen entsteht eine erkennbare, aber
   keine exakte Tiersilhouette – wie bei echten Tangram-Büchern. Mehr Sätze machen es kaum ähnlicher
   (gemessen Ø 83 % → 85 % bei 14 Teilen), aber schwieriger.
4. **Varianten ohne Ende**: Außerhalb der vorgebackenen Varianten (12 je Form) rechnet der Solver die Variante
   live nach (Web Worker bzw. Godot-Thread), deterministisch aus dem Seed.

### Wie viele verschiedene Puzzles gibt es wirklich?

Puzzle-Nummern sind unbegrenzt (BigInt im Web, Dezimal-Strings in Godot). Wie viele *unterschiedliche* Figuren
dahinterstecken, begrenzt die Geometrie – `npm run space` schätzt das per Geburtstagsparadoxon
(Dubletten bis auf Drehung/Spiegelung/Verschiebung):

| Kategorie | Stichprobe | verschiedene | geschätzter Raum |
|---|---|---|---|
| 7 Teile, Zufall | 60 000 | 59 997 | ≈ 6·10⁸ |
| 7 Teile, Kompakt | 30 000 | 28 337 | ≈ 3·10⁵ |
| 14 Teile, Zufall | 12 000 | 12 000 | > 7·10⁷ (keine Dublette) |
| 14 Teile, Spiegel-Muster | 12 000 | 11 977 | ≈ 3·10⁶ |
| 28 Teile, Spiegel-Muster | 6 000 | 6 000 | > 1,8·10⁷ (keine Dublette) |

Der Raum wächst mit jedem zusätzlichen Teil/Satz exponentiell. **Ehrlich gesagt:** bei 7 Teilen gibt es nicht
10²¹ verschiedene Silhouetten (≈ 10⁸–10⁹ im Zufallsstil); ab 14 Teilen sind Dubletten in Stichproben nicht
mehr zu finden, aber 10²¹ *nachweislich* verschiedene Figuren lassen sich nicht auszählen. Darüber hinaus
wiederholen sich ab irgendeiner Nummer Figuren, aber die Nummern selbst gehen nie aus.

## Eigene Kategorien

* **Web**: „＋ Eigene Kategorie“ → Name + Formen (`🦁 🐍 🦜`, `PALME`, `🍌`, je Zeile/Komma). Im Dialog lässt sich die
  Kategorie als **Paket (`.json`) exportieren** – inklusive berechneter Lösungen.
* **Pakete importieren**: „⇪ Paket importieren“ (Web) bzw. `TangramLibrary.add_pack_from_file()` (Godot).
* **Paket-Format** `tangram-pack/1`:

```jsonc
{
  "format": "tangram-pack/1", "id": "dschungel", "name": "Dschungel", "icon": "🌴",
  "figures": [{
    "id": "löwe", "name": "Löwe", "glyph": "🦁",
    "mask": { "w": 52, "h": 48, "c": 0.0803, "bits": "<base64, zeilenweise, LSB zuerst>" }, // Silhouette, Fläche = 8
    "sols": [ { "iou": 0.84, "p": [[typ, rot, flip, x, y], …7 Teile] } ]                     // optional (vorgerechnet)
  }]
}
```

Eine Platzierung `[typ, rot, flip, x, y]`: `typ` 0 kleines, 1 mittleres, 2 großes Dreieck, 3 Quadrat,
4 Parallelogramm · `rot` 0–7 (×45°) · `flip` 0/1 (Spiegelung) · `x, y` Verschiebung. y zeigt nach unten.
Einheit: Kathete des kleinen Dreiecks = 1; ein Satz hat Fläche 8.

## Godot 4 einbinden

Voraussetzung: **Godot 4.3+**. Der Ordner [`godot/tangram/`](godot/tangram) ist selbstständig – in dein Projekt
nach `res://tangram/` kopieren (inklusive `data/packs/`). `godot/` ist außerdem ein lauffähiges Demo-Projekt
(`demo/main.tscn`).

```gdscript
var lib := TangramLibrary.new()
lib.load_default()                                   # liest res://tangram/data/packs + user://tangram_packs

var board := TangramBoard.new()                      # Control: Ziehen/Drehen/Spiegeln/Einrasten/Gewinnprüfung
board.size_flags_vertical = Control.SIZE_EXPAND_FILL
add_child(board)
board.puzzle_solved.connect(func(info): print("gelöst: ", info))   # {moves, hints, gave_up, ms}

# Puzzle-Nummern sind Strings beliebiger Länge:
lib.request("tiere", "1000000000000000000000", 1, func(pz): board.load_puzzle(pz))
```

* `lib.peek(kategorie, nummer, sätze)` liefert sofort ein Puzzle oder `{}`, wenn der Solver erst rechnen muss;
  `lib.request(...)` rechnet dann in einem **Thread** und ruft den Callback im Hauptthread auf.
* Nur Daten, ohne UI: `TangramGenerator.generate_abstract("kompakt:42:1", "kompakt", 1)` bzw.
  `generate_pattern(...)` → Platzierungen; `TangramGeom.placement_verts(pl)` → Eckpunkte zum Selbstzeichnen.
* **Geschwindigkeit**: GDScript ist ca. 40× langsamer als JS. Vorgebackene Varianten, abstrakte Figuren und Muster
  erscheinen sofort. Live-Varianten rechnen mit `live_restarts=3`, `live_iters=8000` etwa 4 s im Thread
  (für exakt dieselben Varianten wie im Web: 10 / 14000, ca. 25 s).
* Tastatur im Board: `R` drehen, `F` spiegeln, `H` Tipp, Pfeile verschieben. Maus: Doppelklick/Rechtsklick/Mausrad drehen.

## Projektstruktur

```
web/                  statische Web-App (index.html, style.css, js/)
  js/core/            gemeinsamer Kern: prng, geom, raster, generate, mask, fit   ← Referenz-Implementierung
  data/packs/         gebackene Formen-Pakete (JSON)
godot/                Godot-4-Projekt
  tangram/            kopierbare Bibliothek (.gd) + data/packs
  demo/               Demo-Szene
  tests/              Headless-Tests
tools/                Bake-Werkzeug, Katalog, Tests, Prüfskripte
```

## Neue Formen hinzufügen / Pakete neu backen

1. Zeile in `tools/catalog.mjs` ergänzen (`🦁 Löwe`) – oder in der Web-App eine eigene Kategorie anlegen.
2. `npm run bake` (nutzt Playwright/Chromium + Noto Color Emoji zum Rastern, ~7 min für alle Formen auf 4 Kernen).
   Das Skript schreibt die Pakete nach `web/data/packs/` **und** `godot/tangram/data/packs/`.

## Tests

```bash
npm test               # Kern: Gültigkeit aller Figuren/Muster/Pakete, Determinismus, Solver (Node ≥ 18)
npm run e2e            # Browser-Test (Playwright): Navigation, 10²¹, Ziehen+Einrasten bis zum Gewinn, Galerie, eigene Kategorie, Mobil
GODOT=/pfad/godot npm run godot-tests
                       # GDScript: gleiche Zufallszahlen, 231 Generator-Seeds und Solver-Lösungen bit-identisch
                       # zur JS-Version, große Zahlen, Bibliothek, Spielbrett (Maus-Eingaben)
```

Hinweise: Die Silhouetten stammen aus Glyphen der Schrift *Noto Color Emoji* (nur die Umrisse werden als
Binärmaske gespeichert). `npm run e2e` und `bake` erwarten Playwright global installiert und Chromium unter
`/opt/pw-browsers/chromium` – bei anderer Umgebung die Pfade am Dateianfang anpassen.
