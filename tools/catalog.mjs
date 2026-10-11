// Katalog der "bekannten Formen". Jede Zeile: "Glyphe Name".
// Glyphen werden beim Backen zu Silhouetten gerastert (Emoji-Schrift bzw. fette Schrift für Text).

const U = '️'; // erzwingt Emoji-Darstellung

export const CATALOG = [
  {
    id: 'tiere', name: 'Tiere', icon: '🐘', mode: 'emoji', lines: `
🐕 Hund
🐈 Katze
🐎 Pferd
🐄 Kuh
🐖 Schwein
🐑 Schaf
🐐 Ziege
🐪 Dromedar
🐫 Kamel
🦙 Lama
🦒 Giraffe
🐘 Elefant
🦏 Nashorn
🦛 Nilpferd
🐁 Maus
🐀 Ratte
🐇 Hase
🐿 Eichhörnchen
🦔 Igel
🦇 Fledermaus
🐻 Bär
🐨 Koala
🐼 Panda
🦥 Faultier
🦦 Otter
🦨 Stinktier
🦘 Känguru
🦡 Dachs
🐅 Tiger
🐆 Leopard
🦓 Zebra
🦍 Gorilla
🦧 Orang-Utan
🐒 Affe
🦌 Hirsch
🐃 Wasserbüffel
🐂 Ochse
🦬 Bison
🐩 Pudel
🐓 Hahn
🐔 Huhn
🐤 Küken
🐦 Vogel
🐧 Pinguin
🕊 Taube
🦅 Adler
🦆 Ente
🦢 Schwan
🦉 Eule
🦩 Flamingo
🦚 Pfau
🦜 Papagei
🦃 Truthahn
🐸 Frosch
🐊 Krokodil
🐢 Schildkröte
🦎 Eidechse
🐍 Schlange
🐉 Drache
🦕 Langhalssaurier
🦖 Tyrannosaurus
🐳 Pottwal
🐋 Wal
🐬 Delfin
🦭 Seehund
🐟 Fisch
🐠 Tropenfisch
🐡 Kugelfisch
🦈 Hai
🐙 Krake
🦑 Tintenfisch
🦐 Garnele
🦞 Hummer
🦀 Krabbe
🐌 Schnecke
🦋 Schmetterling
🐛 Raupe
🐜 Ameise
🐝 Biene
🐞 Marienkäfer
🦗 Grille
🕷 Spinne
🦂 Skorpion
🦟 Mücke
🪲 Käfer
🦄 Einhorn
🐾 Pfotenabdruck
`,
  },
  {
    id: 'essen', name: 'Essen & Trinken', icon: '🍕', mode: 'emoji', lines: `
🍎 Apfel
🍐 Birne
🍊 Orange
🍋 Zitrone
🍌 Banane
🍉 Wassermelone
🍇 Trauben
🍓 Erdbeere
🫐 Blaubeeren
🍈 Melone
🍒 Kirschen
🍑 Pfirsich
🥭 Mango
🍍 Ananas
🥥 Kokosnuss
🥝 Kiwi
🍅 Tomate
🍆 Aubergine
🥑 Avocado
🥦 Brokkoli
🥬 Salatkopf
🥒 Gurke
🌶 Peperoni
🫑 Paprika
🌽 Maiskolben
🥕 Karotte
🧄 Knoblauch
🧅 Zwiebel
🥔 Kartoffel
🍠 Süßkartoffel
🥐 Croissant
🥯 Bagel
🍞 Brot
🥖 Baguette
🥨 Brezel
🧀 Käse
🥚 Ei
🍳 Spiegelei
🧈 Butter
🥞 Pfannkuchen
🧇 Waffel
🥓 Speck
🥩 Steak
🍗 Hähnchenkeule
🍖 Fleisch am Knochen
🌭 Hot Dog
🍔 Hamburger
🍟 Pommes
🍕 Pizza
🥪 Sandwich
🌮 Taco
🌯 Wrap
🥗 Salat
🍝 Spaghetti
🍜 Nudelsuppe
🍲 Eintopf
🍛 Curry
🍣 Sushi
🍤 Garnele frittiert
🍙 Reisbällchen
🍚 Reis
🥟 Teigtasche
🍡 Dango
🍦 Softeis
🍧 Eisschnee
🍨 Eisbecher
🍩 Donut
🍪 Keks
🎂 Geburtstagstorte
🍰 Kuchenstück
🧁 Cupcake
🥧 Pie
🍫 Schokolade
🍬 Bonbon
🍭 Lutscher
🍮 Pudding
🍯 Honigtopf
🥜 Erdnuss
🌰 Kastanie
🍿 Popcorn
🍼 Babyflasche
🥛 Milchglas
☕ Kaffee
🍵 Tee
🍺 Bier
🍷 Wein
🍸 Cocktail
🥂 Sektgläser
🥃 Whiskyglas
🥤 Becher
🧃 Saftpackung
🍾 Sektflasche
`,
  },
  {
    id: 'natur', name: 'Natur & Pflanzen', icon: '🌳', mode: 'emoji', lines: `
🌲 Tanne
🌳 Laubbaum
🌴 Palme
🌵 Kaktus
🌱 Keimling
🌿 Kraut
☘ Kleeblatt
🍀 Glücksklee
🍁 Ahornblatt
🍂 Herbstlaub
🍃 Windblätter
🍄 Pilz
🌾 Getreideähre
💐 Blumenstrauß
🌷 Tulpe
🌹 Rose
🌺 Hibiskus
🌸 Kirschblüte
🌼 Gänseblümchen
🌻 Sonnenblume
☀ Sonne
🌙 Mondsichel
⭐ Stern
☁ Wolke
⛄ Schneemann
❄ Schneeflocke
🔥 Feuer
💧 Tropfen
🌊 Welle
⚡ Blitz
🌈 Regenbogen
🪨 Stein
🌋 Vulkan
⛰ Berg
🏔 Schneeberg
🏝 Insel
🐚 Muschel
🪵 Baumstamm
🪺 Nest
`,
  },
  {
    id: 'fahrzeuge', name: 'Fahrzeuge', icon: '🚗', mode: 'emoji', lines: `
🚗 Auto
🚕 Taxi
🚙 Geländewagen
🚌 Bus
🚎 Oberleitungsbus
🏎 Rennwagen
🚓 Polizeiauto
🚑 Krankenwagen
🚒 Feuerwehrauto
🚐 Kleinbus
🛻 Pick-up
🚚 Lieferwagen
🚛 Lastwagen
🚜 Traktor
🏍 Motorrad
🛵 Motorroller
🚲 Fahrrad
🛴 Tretroller
🛹 Skateboard
🚂 Dampflok
🚆 Zug
🚄 Schnellzug
🚃 Eisenbahnwagen
🚊 Straßenbahn
🚁 Hubschrauber
✈ Flugzeug
🛩 Propellerflugzeug
🚀 Rakete
🛸 Ufo
🛶 Kanu
⛵ Segelboot
🚤 Schnellboot
🛥 Motorboot
🚢 Schiff
⚓ Anker
🛺 Tuk-Tuk
🛷 Schlitten
🎈 Heißluftballon
`,
  },
  {
    id: 'orte', name: 'Gebäude & Orte', icon: '🏰', mode: 'emoji', lines: `
🏠 Haus
🏢 Hochhaus
🏰 Schloss
🏯 Burg
🗼 Fernsehturm
🗽 Freiheitsstatue
⛪ Kirche
🕌 Moschee
🛕 Tempel
⛩ Schrein
🏭 Fabrik
🏫 Schule
🏥 Krankenhaus
🏪 Kiosk
⛺ Zelt
🌉 Brücke
🎪 Zirkuszelt
🗿 Steinkopf
🏟 Stadion
🗻 Fuji
⛲ Brunnen
🎡 Riesenrad
🎢 Achterbahn
⛱ Sonnenschirm
🏗 Baukran
🪜 Leiter
🚧 Baustelle
🚏 Bushaltestelle
`,
  },
  {
    id: 'dinge', name: 'Alltagsdinge', icon: '🔑', mode: 'emoji', lines: `
🔑 Schlüssel
🗝 Alter Schlüssel
🔨 Hammer
⛏ Spitzhacke
🪓 Axt
🔧 Schraubenschlüssel
🪛 Schraubendreher
🔩 Schraube
⚙ Zahnrad
🧲 Magnet
✂ Schere
📌 Reißzwecke
📎 Büroklammer
✏ Bleistift
🖊 Kugelschreiber
🖌 Pinsel
📖 Buch
📱 Handy
💻 Laptop
⌚ Armbanduhr
⏰ Wecker
⌛ Sanduhr
💡 Glühbirne
🔦 Taschenlampe
🕯 Kerze
🎁 Geschenk
🎀 Schleife
🧸 Teddybär
🪑 Stuhl
🛏 Bett
🛋 Sofa
🚪 Tür
🧦 Socke
🧢 Kappe
👒 Sonnenhut
🎩 Zylinder
👑 Krone
💎 Diamant
💍 Ring
👓 Brille
🕶 Sonnenbrille
👟 Turnschuh
👠 Stöckelschuh
👢 Stiefel
👕 T-Shirt
👖 Jeans
👗 Kleid
🧥 Jacke
🧤 Handschuhe
🧣 Schal
👜 Handtasche
🎒 Rucksack
☂ Regenschirm
🔔 Glocke
🔒 Schloss
🎺 Trompete
🎸 Gitarre
🎷 Saxophon
🎻 Geige
🥁 Trommel
🎹 Klavier
🎤 Mikrofon
🎧 Kopfhörer
📷 Kamera
🔭 Teleskop
🔬 Mikroskop
🪃 Bumerang
🪁 Drachen
🧹 Besen
🪣 Eimer
🧺 Wäschekorb
🛒 Einkaufswagen
🧭 Kompass
🗑 Mülleimer
`,
  },
  {
    id: 'sport', name: 'Sport & Spiel', icon: '⚽', mode: 'emoji', lines: `
⚽ Fußball
🏀 Basketball
🏈 Football
⚾ Baseball
🎾 Tennisball
🏐 Volleyball
🎱 Billardkugel
🏓 Tischtennis
🥊 Boxhandschuh
⛸ Schlittschuh
🎿 Ski
🏆 Pokal
🥇 Medaille
🎯 Zielscheibe
🎲 Würfel
♟ Schachbauer
🧩 Puzzleteil
🪀 Jo-Jo
🎳 Kegeln
🏹 Pfeil und Bogen
🛼 Rollschuh
🎣 Angel
🤿 Taucherbrille
⛳ Golffahne
🏇 Reiter
🏄 Surfer
🏊 Schwimmer
🚴 Radfahrer
🏃 Läufer
💃 Tänzerin
🧘 Yoga
`,
  },
  {
    id: 'koerper', name: 'Figuren & Körper', icon: '🧙', mode: 'emoji', lines: `
👍 Daumen hoch
✌ Victory
👆 Zeigefinger
✋ Hand
👣 Fußspuren
🦶 Fuß
👂 Ohr
👃 Nase
👄 Mund
🦷 Zahn
🦴 Knochen
💪 Bizeps
🧠 Gehirn
🧙 Zauberer
🧚 Fee
🎅 Weihnachtsmann
🧜 Meerjungfrau
👻 Geist
👽 Außerirdischer
🤖 Roboter
💀 Totenkopf
🚶 Fußgänger
🥷 Ninja
🦸 Superheld
🤸 Radschlagen
🕺 Tänzer
`,
  },
  {
    id: 'symbole', name: 'Symbole', icon: '❤️', mode: 'emoji', lines: `
❤ Herz
♠ Pik
♣ Kreuz
♦ Karo
➡ Pfeil rechts
⬆ Pfeil hoch
✨ Funken
💥 Knall
💬 Sprechblase
💭 Gedankenblase
🏁 Zielflagge
🚩 Flagge
❓ Fragezeichen
❗ Ausrufezeichen
☮ Friedenszeichen
☯ Yin und Yang
✔ Haken
➕ Plus
🔺 Dreieck
⬛ Quadrat
🔶 Raute
🔰 Anfänger
♻ Recycling
🎵 Note
🎶 Noten
📍 Standort
🪁 Lenkdrachen
`,
  },
  {
    id: 'buchstaben', name: 'Buchstaben', icon: '🔤', mode: 'text', lines:
      'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ä Ö Ü ß'.split(' ').map((c) => `${c} Buchstabe ${c}`).join('\n'),
  },
  {
    id: 'zahlen', name: 'Zahlen', icon: '🔢', mode: 'text', lines:
      '0 1 2 3 4 5 6 7 8 9 + - = ? ! & % #'.split(' ').map((c) => `${c} Zeichen ${c}`).join('\n'),
  },
];

function slug(s) {
  return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** -> [{ id, name, icon, mode, figures:[{id,name,glyph}] }] */
export function loadCatalog() {
  const seen = new Set();
  return CATALOG.map((cat) => ({
    id: cat.id, name: cat.name, icon: cat.icon, mode: cat.mode,
    figures: cat.lines.trim().split('\n').map((line) => {
      const sp = line.indexOf(' ');
      let glyph = line.slice(0, sp), name = line.slice(sp + 1);
      if (cat.mode === 'emoji' && !glyph.includes(U)) glyph += U;
      let id = slug(name) || `f${seen.size}`;
      if (cat.mode === 'text') {
        const tok = name.split(' ').pop();
        id = `${cat.id}-${slug(tok) || `u${tok.codePointAt(0).toString(16)}`}`;
      }
      if (seen.has(id)) id = `${id}-${cat.id}`;
      seen.add(id);
      return { id, name, glyph };
    }),
  }));
}
