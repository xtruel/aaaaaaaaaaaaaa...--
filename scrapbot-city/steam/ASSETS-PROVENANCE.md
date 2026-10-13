# Provenienza e licenze della grafica per Steam e delle icone

Inventario dei file in `steam/store-assets/` e delle icone dell'applicazione (`build/`, `electron/icon.png`), con
**da dove vengono**, **con che cosa sono stati fatti**, le **licenze** di ciò che il gioco contiene e **che cosa deve
confermare il titolare**. Scritto l'11 ottobre 2026 sul ramo `steam-package`; i file sono quelli del commit `3629ffa`
(costruiti dalla 0.6.0), salvo dove indicato. **Aggiornato il 13 ottobre 2026 sul ramo `rc-0.7.0`**: gli screenshot in
`screenshots/` e il foglio di controllo sono nuovi, della **0.7.0-rc.1** (sezione 2.3); capsule, logo, icone e le
immagini del titolare **non sono stati toccati**. Gli hash sono i primi 12 caratteri dello sha256.

## 1. Le cinque immagini del titolare (origine prima del progetto: da dichiarare)

Il titolare ha fornito nella conversazione cinque immagini (WebP), indicate qui come `1.webp`–`5.webp`:

| Sorgente | Contenuto | Dimensioni |
|---|---|---|
| `1.webp` | icona: USA-9 e Miso in una cornice rosa arrotondata | 1254×1254 |
| `2.webp` | logo "SCRAPBOT CITY" con targa "2PM" e sottotitolo in katakana, sfondo trasparente | 1448×1086 |
| `3.webp` | poster verticale (logo, robot, città al tramonto) con slogan | 1024×1536 |
| `4.webp` | key art orizzontale (logo, robot, città) con slogan | 1834×857 |
| `5.webp` | banner orizzontale (logo grande, USA-9, Miso) | 2000×754 |

**Da dove vengano prima di arrivare al progetto non lo sappiamo**: chi le ha disegnate o generate, con quale
strumento, con quali diritti. Lo deve dichiarare il titolare (sezione 6). Lo stile (pixel art "AI-like", lettering
coerente) non basta a dire niente con certezza, e qui non si afferma nulla in un senso o nell'altro.

## 2. File per file

**Chi ha fatto le lavorazioni**: tutte quelle descritte in questa sezione (ritagli, ridimensionamenti, cancellatura
degli slogan, ripulitura della trasparenza, icone piccole ridisegnate, copia dell'atlante senza scritte, render e
schermate) le ha fatte **Claude (IA, Anthropic) in questo progetto**, scrivendo ed eseguendo gli script qui sotto, su
indicazione del titolare; nessun generatore di immagini è stato usato. Va detto anche nel Content Survey
([CONTENT-SURVEY-DRAFT.md](CONTENT-SURVEY-DRAFT.md), sezione 3).
Strumenti usati per tutto ciò che è derivato: Python 3 con Pillow e NumPy (ritagli, ridimensionamento Lanczos,
pulizia della trasparenza, cancellatura degli slogan per interpolazione), Chromium + Playwright per i render e le
schermate del gioco. Nessun file è stato ingrandito; ogni ritaglio ha già le proporzioni finali (nessuna deformazione).
Script e registro delle operazioni sono nello scratchpad della sessione che li ha prodotti (`make_assets.py`,
`clean_art.py`, `inpaint.py`, `icons.py`, `patch_atlas.py`, `render-city2.mjs`, `shots.mjs`, `assets-log.json`; per
gli screenshot della RC `make-saves-media.mjs`, `prep.mjs`, `finals.mjs`, `contact_sheet.py` e i loro registri):
**non sono nel repository**, e i ritagli e i passi esatti sono riportati qui sotto.

### 2.1 Capsule e libreria (dalle immagini del titolare)

| File | Hash | Origine | Lavorazione |
|---|---|---|---|
| `header_capsule_920x430.png` | `dce81468c347` | `4.webp` | slogan "TRASH TODAY, A BETTER TOMORROW" e scritta "RECYCLE REBUILD REPEAT" sul muro cancellati; immagine intera, scala 0,50 |
| `library_header_920x430.png` | `dce81468c347` | copia identica del precedente | — |
| `main_capsule_1232x706.png` | `7bb60ce645b9` | `4.webp` senza slogan | ritaglio x 10–1505 a tutta altezza, scala 0,82 |
| `small_capsule_462x174.png` | `42eb0fbe8a17` | `5.webp` | ritaglio 1540×580 da (230, 35), scala 0,30, leggera nitidezza |
| `vertical_capsule_748x896.png` | `c2114356e1cf` | `3.webp` | slogan e quattro frasi in cielo e sulle rocce cancellati; parte alta (y 0–1227), scala 0,73 |
| `library_capsule_600x900.png` | `1d80ca011fa0` | `3.webp` senza slogan | immagine intera (già 2:3), scala 0,59 |
| `library_logo_1280x720.png` | `6c2cb776f3aa` | `2.webp` | trasparenza ripulita (alone della compressione WebP), logo 1142×680 centrato, scala 0,83 |
| `event_cover_800x450.png` | `1ee3073856a4` | `4.webp` senza slogan | parte sinistra, scala 0,53 |
| `event_header_1920x622.png` | `7aa29a59eeb5` | `5.webp` | larghezza intera (y 0–648), scala 0,96 |
| `community_icon_184x184.jpg` | `d7b806d33119` | `1.webp` | con la cornice e lo sfondo scuro (il JPG non ha trasparenza), scala 0,15, qualità 95 |

### 2.2 Icone dell'applicazione (dall'immagine del titolare)

| File | Hash | Origine | Lavorazione |
|---|---|---|---|
| `build/icon.png` (1024×1024) | `d3239150c806` | `1.webp` | esterno della cornice reso trasparente, scala 0,83 |
| `build/icons/48…512.png` | vari | `1.webp` | come sopra, ridotta |
| `build/icons/16x16.png`, `32x32.png` | `0a398df3afcd`, `a0028d988f9d` | `1.webp` | primo piano del muso di USA-9 in una cornice rosa **ridisegnata** (a 16–32 px l'immagine intera è illeggibile) |
| `build/icon.ico`, `steam/store-assets/shortcut_icon.ico` | `06990f935165` | le PNG qui sopra | 16, 24, 32, 48, 64 (BMP) + 128, 256 (PNG) |
| `build/icon.icns` | `be6a0f02fa5f` | le stesse PNG | per macOS (oggi non usato) |
| `electron/icon.png`, `shortcut_icon_256x256.png` | `f42d75689f11` | `build/icons/256x256.png` | copia |
| favicon in `index.html` (64×64, data URL) | — | primo piano a 64 px | 256 colori |

### 2.3 Render del gioco (0.6.0) e screenshot (0.7.0-rc.1)

| File | Hash | Come è stato fatto |
|---|---|---|
| `library_hero_3840x1240.png` | `d8257ebf5df3` | **render del gioco 0.6.0** (build di debug del ramo `steam-package`), zoom 3, ore 20:52; città messa in scena da uno script con le regole di piazzamento del gioco (103 edifici, tutti completati); usata una **copia dell'atlante solo per il marketing** in cui le scritte dipinte ("2PM" su HQ e Inceneritore, stampigliature dei container) sono state cancellate; HUD nascosto. L'atlante del gioco non è stato toccato. **Non rifatto per la 0.7** (mostra solo edifici e terreno, senza gli oggetti del catalogo né i temi) |
| `page_background_1438x810.png` | `e3656f7e5168` | come sopra, zoom 2, ore 23:16; colore 85 %, luminosità 80 % |
| `screenshots/screenshot_01_districts_1920x1080.png` | `cfc572eff593` | **0.7.0-rc.1**, vedi sotto |
| `screenshots/screenshot_02_night_1920x1080.png` | `dfcd923760bf` | idem |
| `screenshots/screenshot_03_catalog_1920x1080.png` | `26cad5f9b42c` | idem |
| `screenshots/screenshot_04_module_1920x1080.png` | `ac89966d4d1b` | idem |
| `screenshots/screenshot_05_smog_1920x1080.png` | `a116c0bdde52` | idem |
| `screenshots/screenshot_06_greenvale_1920x1080.png` | `95766c99b853` | idem |
| `screenshots/screenshot_07_region_1920x1080.png` | `1b5070b85cb3` | idem |
| `extra/menu_1920x1080.png` (prima `screenshot_01_menu…`) | `58fcfbf1d94c` | schermata vera del menu principale (**0.6.0**, non rifatta). **Spostata fuori da `screenshots/` l'11/10/2026**: Steam vuole screenshot "esclusivamente di gameplay" e il menu "solo se è una parte unica del gioco" ([Store Graphical Assets](https://partner.steamgames.com/doc/store/assets/standard), letto l'11/10/2026). Si può usare per stampa o eventi |
| `_contact-sheet.png` | `ce156e72fb7d` | foglio di controllo di tutti i file sopra (screenshot della RC compresi), ridotti, rifatto il 13/10/2026 con lo stesso script; **non va caricato** |

Gli screenshot 0.6.0 di prima (`screenshot_02_region`, `03_day`, `04_night`, `05_inspect`, `06_event`, città allestite
con risorse impostate) sono stati **tolti** il 13/10/2026 e sostituiti da questi.

**Gli screenshot della 0.7.0-rc.1 (13/10/2026).** Tutti presi dalla **build di rilascio** della RC, senza aggancio di
debug (`npx vite build` del commit `d976dc9`; `index.html` sha256 `d9f5a6d870ef…`, lo stesso file che è dentro le
build Steam rifatte lo stesso giorno, [README.md](README.md) passo 4), in Chromium headless con Playwright, finestra
1920×1080 a densità 1, gioco in inglese, filtro CRT spento (opzione del gioco: le sue righe fanno moiré nelle
miniature), suoni a zero. Nessun ritocco: PNG della pagina, solo ricompresso senza perdita (pixel identici). Input
**simulato** (mouse e tastiera di Playwright), nessun hardware vero.

Come sono state preparate le città:
1. **Partite del pilota automatico**, come per il trailer (`scripts/trailer/make-saves.mjs`, copia nello scratchpad):
   il pilota automatico del gioco (`scripts/autopilot.ts`) gioca le 5 città della campagna con la simulazione del
   gioco, due partite per città (piano verde e piano industriale) fino al finale, e di ogni città resta un salvataggio
   a metà partita. Nessuna risorsa aggiunta. Le stelle della mappa (13 su 15) sono quelle di quelle dieci partite,
   tenute insieme come fa il gioco; il profilo ha già tutti gli achievement (perché nessuna notifica copra una scena).
   **Unica aggiunta rispetto al trailer**: il profilo dei progetti con i progetti che quelle dieci partite hanno
   raggiunto, letti con le funzioni del gioco (`goalReached`, `goalValue` di `src/game/projects.ts`) a ogni secondo di
   gioco, come il gioco li registra mentre si gioca: 14 su 18. La scultura l'ha aggiunta il gioco stesso all'apertura
   (Guglie finite nel profilo della campagna); casetta di Miso, ugello esteso e pilastro d'angolo restavano da scoprire.
2. **Preparazione sulla build di debug, solo dall'interfaccia** (mouse e tastiera simulati; l'aggancio di debug è
   servito solo a **leggere** dove stanno caselle ed edifici): Scrapbot City aperta con «Continue», orologio in pausa;
   la piazza verde e il cortile industriale comprati dal catalogo pezzo per pezzo con i soldi della città (73 pezzi:
   363 crediti, 23 pezzi, 72 rottami, su 452 crediti, 310 pezzi e 361 rottami che la città aveva; ogni acquisto
   registrato: le risorse sono scese esattamente del prezzo, 27/27 controlli); al 20° pezzo posato la città ha scoperto
   da sé il pilastro d'angolo, poi usato nel cortile. A Neon Heights il filtro antismog installato dal pannello di una
   Fonderia, pagato 45 crediti e 20 pezzi. Uscita con «Region map» (la città della campagna si salva).
3. **Scatti sulla build di rilascio**, con lo storage del browser lasciato dal passo 2: menu → «New game» → campagna →
   mappa → città → «Continue». L'orologio portato all'ora voluta con i pulsanti della velocità; inquadrature con i tasti
   dello zoom, `H` e trascinamenti col tasto destro misurati sulla build di debug; gli eventi della storia comparsi
   intanto hanno avuto una risposta, come da un giocatore. 01, 02 e 06 sono presi con l'orologio a ×1 (tre scatti a un
   secondo l'uno dall'altro; scelto quello senza scritte di produzione sopra gli edifici: in 06 resta una scritta
   «+… PARTS» appena visibile sull'HQ); 03, 04, 05 e 07 con il gioco in pausa (pannelli aperti).

| Screenshot | Città e momento | Cosa mostra |
|---|---|---|
| `01_districts` | Scrapbot City (partita verde del pilota), giorno 8, 12:06, zoom 3 | la città con i due quartieri costruiti dal catalogo: la piazza verde (pavimento, recinzione con entrata, alberi, panchine, fioriere, fontana, statua di USA-9, pergola, insegna al neon) e il cortile industriale (pilastri d'angolo, cancello, muri bassi, basamenti in cemento, due lampioni, scultura di rottami) |
| `02_night` | Scrapbot City, giorno 8, 00:09, zoom 4 | gli stessi quartieri di notte: lampioni, luci in cima ai pilastri, insegna e occhi della scultura accesi, finestre della città |
| `03_catalog` | Scrapbot City, giorno 8, 12:10, in pausa | il catalogo «Objects & modules», scheda Modules, filtro All (All 8, Available 7, To discover 1): righe «Can be bought», «Not now · Only on a finished 2PM Factory» e «To discover · Clean up 10 sludge tiles · 0 / 10 in this city · best 5», con i compromessi scritti; accanto, la piazza e il cortile |
| `04_module` | Neon Heights (partita industriale), giorno 5, 10:09, in pausa | il pannello di una Fonderia col filtro antismog installato: colonne «Full power / Now», smog al giorno +2,1 → +0,8, energia −2 → −3, «Remove» col rimborso; il tema di Neon Heights e le nuvole di smog sopra chi inquina |
| `05_smog` | 2PM Company Town (partita industriale), giorno 5, 10:06, in pausa | smog al 57%: nuvole sopra Inceneritori e Fonderie e il pannello «Where it comes from and where it goes» (fonti, pulizia, totale al giorno, la regola del 95% per 30 secondi); il tema della città aziendale |
| `06_greenvale` | Greenvale (partita verde), giorno 6, 11:28, zoom 2 | il tema di Greenvale: erba e terra, il fiume e la scenografia di contorno al bordo della mappa, la città al centro |
| `07_region` | mappa della regione | le 5 città della Scrap Coast con le loro stelle (13 su 15) e la scheda di 2PM Company Town (regole, obiettivi delle stelle, «Continue») |

**Giudizio onesto sugli screenshot**: sono la vera build di rilascio della RC con la sua interfaccia, senza risorse
messe a mano e senza stato ritoccato. Restano diversi da una partita di una persona: le città le ha giocate il pilota
automatico; le stelle vengono da due partite per città; il profilo dei progetti l'ha scritto lo script (passo 1, con
le regole del gioco); i due quartieri li ha costruiti uno script attraverso l'interfaccia, non una persona; il profilo
ha già tutti gli achievement. Non dicono niente su bilanciamento, durata o divertimento. Se la build in vendita cambia
l'aspetto del gioco, vanno rifatti.

### 2.4 Trailer e schermate della pipeline (fuori dal repository)

| File | Dove | Come è stato fatto |
|---|---|---|
| `trailer.mp4` (+ `.contact.jpg`, `.thumbnail.jpg`) | prodotto da `scripts/trailer/run.sh` in una cartella fuori da git; la prova dell'11/10/2026 è nello scratchpad della sessione | **ripresa del gioco vero**: la build di rilascio gira in Chromium guidato da Playwright; le 5 città sono state giocate prima dal pilota automatico del gioco (`scripts/autopilot.ts`) con la simulazione del gioco; poi solo clic, trascinamenti e tasti sull'interfaccia. Il profilo di partenza ha già tutti gli achievement (perché le notifiche non coprano le scene) e le stelle guadagnate da due partite per città (piano verde e piano industriale). Montaggio con ffmpeg: tagli, dissolvenze agli estremi, nessun testo né immagine aggiunti, audio muto. Script scritti ed eseguiti da Claude (IA) |
| `rec/stills/*.png` | stessa cartella | schermate senza perdita degli stessi momenti (candidate per gli screenshot del negozio) |

La prova dell'11/10/2026 mostra la **0.7.0-alpha.1** (ramo principale `04d782e`), non la build finale: non va caricata.
**Il trailer va rigenerato con `scripts/trailer/run.sh` sulla build finale prima di caricarlo**: per la 0.7.0-rc.1 la
pipeline non è stata rieseguita (scelta del titolare), quindi un trailer della RC non c'è. Nota sulle schede del
catalogo e la scena «decorate» in [STORE-COPY.md](STORE-COPY.md), sezione 7.

## 3. Il gioco: chi ha fatto che cosa

Dal repository del gioco (ramo principale, sola lettura): i 93 commit che toccano il gioco (`scrapbot-city/`) sono
tutti firmati "Claude"; i 2 commit del titolare sono quelli iniziali del repository (un altro progetto, fuori dalla
cartella del gioco).

| Parte | Origine | Note |
|---|---|---|
| Codice (TypeScript, Electron, script) | scritto con l'assistenza dell'IA (Claude, Anthropic) in questo progetto, su indicazioni del titolare | — |
| Sprite, edifici, terreno, personaggi, scenografia | **generati da codice**: modelli voxel scritti in `scripts/art/models/` (con l'IA), resi in PNG da `scripts/art/voxel.ts` (`npm run art`) → `src/assets/iso/atlas.png`, `art/sprites/` | nessuna immagine esterna; la cartella dei ritocchi a mano (`art/overrides/`) non esiste nel ramo principale: nessun fotogramma ritoccato |
| Menu, mappa della regione, icone dell'interfaccia | disegnati da codice (`src/render/menuBg.ts`, `regionBg.ts`, `icons.ts`, `pixelfont.ts`) | — |
| Musica (4 brani) | note scritte in `src/music.ts` (con l'IA) e **sintetizzate dal vivo** con WebAudio | nessun file audio nel gioco |
| Effetti sonori | sintetizzati con WebAudio (`src/audio.ts`) | nessun campione registrato |
| Testi e traduzioni (8 lingue) | scritti e tradotti con l'IA; nessuna revisione madrelingua finora | — |
| Mockup del menu (`docs/mockup-main-menu.png`) | documento di progetto, non è nel gioco né nella pagina | origine da confermare dal titolare |
| Capsule, logo, icone | dalle 5 immagini del titolare (sezione 1) | origine da dichiarare |

## 4. Licenze di ciò che il gioco contiene e non abbiamo fatto noi

| Componente | Versione | Licenza | Copyright (dal file di licenza) | Dove si trova |
|---|---|---|---|---|
| Bungee (font) | @fontsource 5.3.0 | SIL OFL 1.1 | 2023 The Bungee Project Authors | dentro `dist/index.html` |
| DotGothic16 (solo katakana) | @fontsource 5.3.0 | SIL OFL 1.1 | 2020 The DotGothic16 Project Authors | idem |
| Lilita One | @fontsource 5.3.0 | SIL OFL 1.1 (Reserved Font Name "Lilita One") | 2011 Juan Montoreano | idem |
| Nunito | @fontsource 5.3.0 | SIL OFL 1.1 | 2014 The Nunito Project Authors | idem |
| Permanent Marker | @fontsource 5.3.0 | **Apache 2.0** | 2010 Font Diner, Inc. (dal README del pacchetto; il file LICENSE non ha la riga di copyright; `package.json` indica come autore Google Inc.) | idem |
| Silkscreen | @fontsource 5.3.0 | SIL OFL 1.1 | 2001 The Silkscreen Project Authors | idem |
| steamworks.js | 0.4.0 | MIT | 2022 Gabriel Francisco Dos Santos | `resources/app.asar.unpacked/node_modules/steamworks.js/` |
| Steamworks API (`steam_api64.dll`, `libsteam_api.so`) | SDK incluso in steamworks.js 0.4.0 | Steamworks SDK Access Agreement (Valve) | Valve Corporation | idem |
| Electron / Chromium | 33.4.11 / 130 | MIT / varie | — | `LICENSE.electron.txt`, `LICENSES.chromium.html` nella radice delle build |

Cosa è stato fatto l'11/10/2026: le build Steam (`npm run dist:steam`) ora contengono la cartella **`licenses/`**
(scritta da `scripts/after-pack.cjs`): `THIRD-PARTY-NOTICES.txt` con l'elenco qui sopra, il testo di licenza di ognuno
dei sei font (`licenses/fonts/<font>-LICENSE.txt`, copiato dal pacchetto @fontsource) e quello di steamworks.js. OFL 1.1
e Apache 2.0 chiedono che avviso di copyright e testo della licenza accompagnino i font distribuiti. Per Permanent
Marker l'avviso di copyright (Font Diner, Inc.) non è nel file LICENSE del pacchetto: `after-pack.cjs` lo prende dal
README e lo mette in testa al file e nell'elenco (corretto e ricostruito l'11/10/2026 in revisione).

**Corretto nella 0.7.0-beta.1** (e quindi nella 0.7.0-rc.1, ramo `rc-0.7.0`): la schermata Crediti diceva «Bungee,
Lilita One, Nunito, Silkscreen, Permanent Marker, DotGothic16 (SIL Open Font License)»; ora dice «Bungee, Lilita One,
Nunito, Silkscreen, DotGothic16 (SIL Open Font License); Permanent Marker (Apache License 2.0)» (`src/ui/dialogs.ts`).

## 5. Controllo con le regole attuali di Steamworks

Regole lette l'11/10/2026: [Graphical Assets](https://partner.steamgames.com/doc/store/assets) (dimensioni in vigore
da agosto 2024, "le vecchie non sono più accettate"), [Store Graphical Asset Rules](https://partner.steamgames.com/doc/store/assets/rules)
(in vigore dal 1/9/2022: sulle capsule base solo artwork, nome del gioco ed eventuale sottotitolo ufficiale; niente
punteggi, premi, sconti, inviti all'azione, altri prodotti, "nessun altro testo"),
[Library Assets](https://partner.steamgames.com/doc/store/assets/libraryassets) (hero senza testo, area sicura
centrale 860×380; logo solo logotipo su sfondo trasparente, 1280 px di larghezza e/o 720 di altezza),
[Store Graphical Assets](https://partner.steamgames.com/doc/store/assets/standard) (almeno 5 screenshot, 1920×1080
16:9, solo gameplay).

| File | Dimensioni | Contenuto | Esito |
|---|---|---|---|
| Header 920×430 | ✔ | logo + artwork; slogan tolti | **conforme**, con i due dubbi sotto (targa "2PM", insegne nella città) |
| Small 462×174 | ✔ | logo leggibile anche piccolo | **conforme** (stessi dubbi) |
| Main 1232×706 | ✔ | logo + artwork | **conforme** (stessi dubbi) |
| Vertical 748×896 | ✔ | logo + artwork; slogan tolti | **conforme** (stessi dubbi; in città restano le insegne "2PM" e "SCRAP") |
| Library capsule 600×900 | ✔ | logo + artwork | **conforme** (stessi dubbi) |
| Library header 920×430 | ✔ | = header | **conforme** |
| Library hero 3840×1240 | ✔ PNG | solo artwork, nessuna parola (controllato al 50 %) | **conforme** |
| Library logo 1280×720 | ✔ PNG RGBA, sfondo trasparente | logotipo + targa "2PM" + titolo in katakana | **da decidere** (sotto) |
| Page background 1438×810 | ✔ | scuro, "ambient" | **conforme** |
| Screenshot 01–07 | ✔ 1920×1080 PNG, 7 file (minimo 5) | gameplay della 0.7.0-rc.1, build di rilascio, con l'interfaccia (sezione 2.3) | **conforme**; da rifare solo se la build in vendita cambia l'aspetto |
| ex screenshot 01 (menu) | ✔ | menu principale | **corretto**: tolto da `screenshots/` (vedi 2.3) |
| Community icon 184×184 JPG | ✔ | icona | **conforme** |
| Shortcut icon 256×256 PNG / .ico | ✔ | icona | **conforme** |
| Event cover 800×450 / header 1920×622 | ✔ | logo + artwork (qui il testo promozionale sarebbe ammesso) | **conforme** |

Nessuna dimensione era sbagliata: l'unica correzione fatta è lo spostamento della schermata del menu.

**Dubbi che può sciogliere solo il titolare:**
1. **Targa "2PM" sul logo.** Se il nome ufficiale del gioco su Steam è "Scrapbot City", "2PM" (la multinazionale del
   gioco) è testo in più su tutte le capsule. Se invece fa parte del logotipo ufficiale (o "2PM" è il sottotitolo
   ufficiale), va bene. Decidilo e scrivi il nome del gioco in Steamworks di conseguenza; se va tolta, serve una
   versione del logo senza targa (dal file originale di `2.webp`).
2. **Katakana sotto il logo** ("スクラップボット・シティ 2PM"): è il titolo trascritto in giapponese. Le regole dicono
   che nel Library Logo non devono esserci "altre parole oltre al logotipo". Se il katakana non è parte del logo
   ufficiale, conviene una versione del logo senza.
3. **Insegne dentro le illustrazioni** ("2PM" sugli edifici, "SCRAP" nel poster): fanno parte del disegno; se la
   revisione di Valve le contesta, sono gli unici punti da ritoccare.
4. **Logo nel Library Logo**: oggi 1142×680 dentro una tela 1280×720 con margini trasparenti. È ammesso; un ritaglio
   aderente (altezza 720) lo farebbe apparire un po' più grande nella libreria. Scelta estetica.

## 6. Che cosa deve confermare il titolare (per iscritto, prima di caricare)

- [ ] **Origine e diritti delle 5 immagini** (`1.webp`–`5.webp`): chi le ha fatte, con quali strumenti (sono state
      generate con un'IA? quale servizio, con quali condizioni d'uso commerciale?), e che puoi usarle e modificarle
      per vendere il gioco. La risposta serve anche per il Content Survey (sezione IA).
- [ ] Che "Scrapbot City", "2PM", "USA-9", "Miso", "Kurogane" e le facce/loghi nelle immagini non riprendono marchi o
      personaggi altrui (la verifica legale dei nomi è già nella lista di docs/STEAM.md).
- [ ] Le decisioni dei punti 1–4 della sezione 5.
- [ ] Origine di `docs/mockup-main-menu.png` (non è nel gioco: solo per completezza).
- [ ] Che gli screenshot della 0.7.0-rc.1 vanno bene così come sono stati preparati (sezione 2.3: città del pilota
      automatico, profilo dei progetti scritto dallo script, quartieri costruiti da uno script dall'interfaccia).
- [ ] Il trailer, da rigenerare sulla build finale con `scripts/trailer/run.sh` prima di caricarlo (sezione 2.4).
