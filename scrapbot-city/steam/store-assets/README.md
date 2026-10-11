# Grafica per Steam — Scrapbot City

Tutti i file da caricare in Steamworks per la pagina del negozio e per la libreria, ricavati dalle 5 immagini
del proprietario (`1.webp`–`5.webp`) e, dove Steam vuole un'immagine **senza testo**, dal gioco stesso.
Anteprima di tutto insieme: [`_contact-sheet.png`](_contact-sheet.png).

**Ricontrollo dell'11/10/2026** (regole attuali di Steamworks, file per file): tutte le dimensioni sono giuste; la
schermata del menu è stata tolta dagli screenshot (Steam vuole solo gameplay) e spostata in `extra/`; gli screenshot
vanno **rifatti sulla build finale**; restano tre decisioni del titolare sul logo. Dettagli, provenienza e licenze:
**[../ASSETS-PROVENANCE.md](../ASSETS-PROVENANCE.md)**.

Requisiti controllati sulla documentazione Steamworks (ottobre 2026):
[Graphical Assets](https://partner.steamgames.com/doc/store/assets),
[regole](https://partner.steamgames.com/doc/store/assets/rules),
[Library Assets](https://partner.steamgames.com/doc/store/assets/libraryassets).
Le dimensioni sono quelle in vigore dall'agosto 2024 (Steam non accetta più quelle vecchie).

## Cosa caricare e dove

Nessun file è stato ingrandito: ogni ritaglio è stato solo rimpicciolito (Lanczos) o, per i render del gioco,
preso a scala 1:1. Nessuna immagine è deformata: ogni ritaglio ha già esattamente le proporzioni finali.

| File | Campo Steamworks | Dimensioni | Origine |
|---|---|---|---|
| `header_capsule_920x430.png` | Store Assets → **Header Capsule** (obbligatorio) | 920×430 PNG | `4.webp` intera (stesse proporzioni), scala 0,50, senza lo slogan |
| `small_capsule_462x174.png` | Store Assets → **Small Capsule** (obbligatorio) | 462×174 PNG | `5.webp`, ritaglio stretto sul logo (1540×580 da x 230, y 35), scala 0,30 + leggera nitidezza |
| `main_capsule_1232x706.png` | Store Assets → **Main Capsule** (obbligatorio) | 1232×706 PNG | `4.webp`, parte sinistra (x 10–1505, altezza intera), scala 0,82, senza lo slogan |
| `vertical_capsule_748x896.png` | Store Assets → **Vertical Capsule** (obbligatorio) | 748×896 PNG | `3.webp`, parte alta (y 0–1227), scala 0,73, senza gli slogan |
| `page_background_1438x810.png` | Store Assets → **Page Background** (facoltativo) | 1438×810 PNG | render del gioco, zoom 2, ore 23:16; colore 85 %, luminosità 80 % perché resti uno sfondo |
| `screenshots/screenshot_02_region_1920x1080.png` | Store Assets → **Screenshots** (almeno 5, 16:9, almeno 1920×1080, solo gameplay) | 1920×1080 PNG | mappa della Scrap Coast (campagna a 5/15 stelle, Neon Heights selezionata) |
| `screenshots/screenshot_03_day_1920x1080.png` | Screenshots | 1920×1080 PNG | città grande di giorno, zoom 2, Pixel Garden in mano |
| `screenshots/screenshot_04_night_1920x1080.png` | Screenshots | 1920×1080 PNG | la stessa città di notte, zoom 3, luci accese |
| `screenshots/screenshot_05_inspect_1920x1080.png` | Screenshots | 1920×1080 PNG | pannello di un edificio (Recycler) aperto, zoom 3 |
| `screenshots/screenshot_06_event_1920x1080.png` | Screenshots | 1920×1080 PNG | evento con K. Kurogane (2PM Corp): scelta industriale o verde |
| `extra/menu_1920x1080.png` | **non** come screenshot di Steam ("menu solo se parte unica del gioco"): stampa, eventi | 1920×1080 PNG | menu principale (ex `screenshot_01`) |
| `library_capsule_600x900.png` | Library Assets → **Library Capsule** (obbligatorio) | 600×900 PNG | `3.webp` intera (già 2:3), scala 0,59, senza gli slogan |
| `library_header_920x430.png` | Library Assets → **Library Header Capsule** (obbligatorio) | 920×430 PNG | copia di `header_capsule_920x430.png` |
| `library_hero_3840x1240.png` | Library Assets → **Library Hero** (obbligatorio, nessuna parola) | 3840×1240 PNG | render del gioco, zoom 3 (1 pixel d'arte = 3×3 pixel), ore 20:52; città al centro |
| `library_logo_1280x720.png` | Library Assets → **Library Logo** (obbligatorio, sfondo trasparente) | 1280×720 PNG RGBA | `2.webp`, logo 1142×680 centrato (margini 20 px sopra/sotto, 69 px ai lati), scala 0,83 |
| `event_cover_800x450.png` | Eventi → **Event Cover** (obbligatorio per ogni evento) | 800×450 PNG | `4.webp`, parte sinistra, scala 0,53, senza lo slogan |
| `event_header_1920x622.png` | Eventi → **Event Header** (facoltativo) | 1920×622 PNG | `5.webp`, larghezza intera (y 0–648), scala 0,96 |
| `community_icon_184x184.jpg` | Community Assets → **App Icon** (obbligatorio, .jpg) | 184×184 JPG (qualità 95) | `1.webp` con la sua cornice rosa e lo sfondo scuro (il JPG non ha trasparenza), scala 0,15 |
| `shortcut_icon_256x256.png` | Community Assets → **Shortcut Icon** (obbligatorio, .ico o .png) | 256×256 PNG RGBA | uguale a `build/icons/256x256.png`; Steam genera da solo il `.ico` |
| `shortcut_icon.ico` | in alternativa al PNG qui sopra | 16–256 px | copia di `build/icon.ico` |

Icone dell'applicazione (fuori da questa cartella, usate da `electron-builder` e da Electron):

| File | Uso | Dimensioni | Origine |
|---|---|---|---|
| `build/icon.png` | icona di base per `electron-builder` | 1024×1024 PNG RGBA | `1.webp`, cornice rosa ritagliata (angoli trasparenti), scala 0,83 |
| `build/icon.ico` | icona di `Scrapbot City.exe` (scritta da `scripts/after-pack.cjs`) | 16, 24, 32, 48, 64 (BMP 32 bit) + 128, 256 (PNG) | come sotto |
| `build/icons/NxN.png` | Linux (16, 32, 48, 64, 128, 256, 512) | N×N PNG RGBA | da 48 px in su: l'immagine intera; 16–32 px: primo piano del muso di USA-9 in una cornice rosa ridisegnata |
| `electron/icon.png` | icona della finestra su Linux | 256×256 PNG RGBA | uguale a `build/icons/256x256.png` |
| `build/icon.icns` | macOS (non usato finché `build.icon` punta a `icon.png`) | 16–1024 px | stesse immagini |
| favicon in `index.html` | scheda del browser (build web) | 64×64 PNG, data URL di 3,6 KB | primo piano a 64 px, 256 colori; `dist/index.html` resta un file unico |

## Scelte e compromessi

- **Slogan tolti dalle capsule.** Steam ammette solo artwork, nome del gioco e sottotitolo ufficiale
  ("No other miscellaneous text"). Da `4.webp` sono stati cancellati "TRASH TODAY, A BETTER TOMORROW" e la scritta
  "RECYCLE REBUILD REPEAT" sul muro; da `3.webp` lo stesso slogan e le quattro frasi in cielo e sulle rocce.
  Il riempimento (interpolazione + grana presa dai dintorni) al 100 % si vede appena, alle dimensioni di Steam no.
- **Restano le insegne dentro la città** ("2PM" sugli edifici, "SCRAP" nel poster): fanno parte del disegno e
  riportano il nome del gioco. Se la revisione di Valve le contesta, sono gli unici punti da ritoccare.
- **Il logo contiene "2PM" e il sottotitolo in katakana** "スクラップボット・シティ 2PM" (il titolo in giapponese):
  Steam li ammette come logo/sottotitolo. Resta da fare la verifica legale del nome "2PM" (docs/STEAM.md, sezione 15).
- **Small capsule**: il ritaglio di `5.webp` basta, non è servito ricomporla; il logo si legge a 462, 231, 184 e
  120 px di larghezza (provato).
- **Hero e sfondo pagina senza parole**: sono render del gioco fatti con una copia dell'atlante solo per il
  marketing, in cui le scritte dipinte sono state cancellate (pannelli "2PM" di HQ e Scrap Burner, stampigliature dei
  container, striscione "2PM" delle gru). Fuori dall'inquadratura: cartellone "BETTER ROBOTS", insegne, muro con
  graffito, dirigibile 2PM e 2PM Factory; niente scritte fluttuanti né icone di stato. La città (103 edifici,
  tutti completati, robot in volo a velocità 3) è stata piazzata da uno script con le regole del gioco.
  L'atlante del gioco non è stato toccato.
- **Hero**: la città sta tutta dentro l'immagine e al centro (80–90 px liberi sopra e sotto), dove Steam non
  taglia mai. Con il logo in basso a sinistra (posizione predefinita) il logo copre strade e prati e appena il
  bordo sinistro della città; posizione e grandezza del logo si scelgono nell'anteprima di Steamworks.
- **Screenshot**: della **0.6.0**, da una build di debug con città allestite da uno script (risorse e popolazione
  impostate, edifici completati d'ufficio): vanno **sostituiti** con schermate della build finale, che
  `scripts/trailer/run.sh` produce in `rec/stills/` senza toccare lo stato del gioco. Veri, con l'interfaccia; filtro CRT spento (opzione del gioco) perché le righe del CRT fanno
  moiré nelle miniature di Steam; notifiche degli achievement nascoste; portafoglio da metà partita (~5 000 crediti).
  La città è la stessa per 03–06: per più varietà conviene aggiungere una città verde e una industriale con lo
  smog (non ancora fatte).
- **Icone piccole**: a 16, 24 e 32 px l'immagine intera diventa una macchia, quindi si usa un primo piano del muso
  di USA-9 (occhi rosa leggibili) nella stessa cornice rosa. La cornice originale è un po' più larga che alta:
  in `icon.png` tocca i bordi a destra e sinistra e lascia 16–17 px trasparenti sopra e sotto.
- Non inclusi (non obbligatori o non grafica di questa consegna): immagini dei bundle, Artwork Override, icone
  degli achievement (64×64), trailer.
- **Mac Icon** (.icns, campo delle icone community): serve solo per i collegamenti sul desktop di macOS, quindi solo
  con una build Mac, che oggi non c'è. Se arriverà, il file pronto è `build/icon.icns`.
