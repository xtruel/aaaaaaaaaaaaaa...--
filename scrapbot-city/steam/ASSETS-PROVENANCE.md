# Provenienza e licenze della grafica per Steam e delle icone

Inventario dei file in `steam/store-assets/` e delle icone dell'applicazione (`build/`, `electron/icon.png`), con
**da dove vengono**, **con che cosa sono stati fatti**, le **licenze** di ciò che il gioco contiene e **che cosa deve
confermare il titolare**. Scritto l'11 ottobre 2026 sul ramo `steam-package`; i file sono quelli del commit `3629ffa`
(costruiti dalla 0.6.0), salvo dove indicato. Gli hash sono i primi 12 caratteri dello sha256.

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
`clean_art.py`, `inpaint.py`, `icons.py`, `patch_atlas.py`, `render-city2.mjs`, `shots.mjs`, `assets-log.json`):
**non sono nel repository**, e i ritagli esatti sono riportati qui sotto.

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

### 2.3 Render e schermate del gioco (dal gioco stesso, versione 0.6.0)

| File | Hash | Come è stato fatto |
|---|---|---|
| `library_hero_3840x1240.png` | `d8257ebf5df3` | **render del gioco 0.6.0** (build di debug del ramo `steam-package`), zoom 3, ore 20:52; città messa in scena da uno script con le regole di piazzamento del gioco (103 edifici, tutti completati); usata una **copia dell'atlante solo per il marketing** in cui le scritte dipinte ("2PM" su HQ e Inceneritore, stampigliature dei container) sono state cancellate; HUD nascosto. L'atlante del gioco non è stato toccato |
| `page_background_1438x810.png` | `e3656f7e5168` | come sopra, zoom 2, ore 23:16; colore 85 %, luminosità 80 % |
| `screenshots/screenshot_02_region_1920x1080.png` | `bc70382e424d` | schermata vera della mappa della regione (0.6.0, build di debug); il **profilo della campagna** (stelle, banca) è stato scritto a mano nello storage prima di aprire il gioco |
| `screenshots/screenshot_03_day_…`, `04_night_…`, `05_inspect_…`, `06_event_…` | `de1d9d71ef10`, `b9a2bdd566e2`, `e9a5121d10db`, `55bfba2a94e1` | schermate vere dell'interfaccia (0.6.0, build di debug), ma di una città **messa in scena**: edifici piazzati da script con le regole del gioco, poi completati d'ufficio; popolazione, crediti, pezzi, smog e ora del giorno impostati dallo script; l'evento di `06` forzato; notifiche degli achievement nascoste; filtro CRT spento |
| `extra/menu_1920x1080.png` (prima `screenshot_01_menu…`) | `58fcfbf1d94c` | schermata vera del menu principale (0.6.0). **Spostata fuori da `screenshots/` l'11/10/2026**: Steam vuole screenshot "esclusivamente di gameplay" e il menu "solo se è una parte unica del gioco" ([Store Graphical Assets](https://partner.steamgames.com/doc/store/assets/standard), letto l'11/10/2026). Si può usare per stampa o eventi |
| `_contact-sheet.png` | `f422f8ee732c` | foglio di controllo di tutti i file sopra, ridotti; **non va caricato** |

**Giudizio onesto sugli screenshot**: mostrano il vero motore e la vera interfaccia, ma della **0.6.0** e di città
allestite con uno script (risorse e popolazione impostate, edifici completati d'ufficio). Per la pagina della 0.7
vanno **rifatti sulla build finale**: `scripts/trailer/run.sh` produce anche `rec/stills/*.png`, schermate senza
perdita della build filmata, con città giocate dal pilota automatico del gioco e azioni fatte solo dall'interfaccia
(nessuna risorsa aggiunta). Vedi `scripts/trailer/README.md`.

### 2.4 Trailer e schermate della pipeline (fuori dal repository)

| File | Dove | Come è stato fatto |
|---|---|---|
| `trailer.mp4` (+ `.contact.jpg`, `.thumbnail.jpg`) | prodotto da `scripts/trailer/run.sh` in una cartella fuori da git; la prova dell'11/10/2026 è nello scratchpad della sessione | **ripresa del gioco vero**: la build di rilascio gira in Chromium guidato da Playwright; le 5 città sono state giocate prima dal pilota automatico del gioco (`scripts/autopilot.ts`) con la simulazione del gioco; poi solo clic, trascinamenti e tasti sull'interfaccia. Il profilo di partenza ha già tutti gli achievement (perché le notifiche non coprano le scene) e le stelle guadagnate da due partite per città (piano verde e piano industriale). Montaggio con ffmpeg: tagli, dissolvenze agli estremi, nessun testo né immagine aggiunti, audio muto. Script scritti ed eseguiti da Claude (IA) |
| `rec/stills/*.png` | stessa cartella | schermate senza perdita degli stessi momenti (candidate per gli screenshot del negozio) |

La prova dell'11/10/2026 mostra la **0.7.0-alpha.1** (ramo principale `04d782e`), non la build finale: non va caricata.

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
| Screenshot 02–06 | ✔ 1920×1080, 5 file (il minimo) | gameplay della 0.6.0, città allestite | dimensioni conformi; **da rifare sulla build finale** |
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
- [ ] Che le schermate per la pagina saranno rifatte sulla build finale (sezione 2.3).
