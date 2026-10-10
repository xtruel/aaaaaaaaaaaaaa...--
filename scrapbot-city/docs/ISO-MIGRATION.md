# Migrazione a 2.5D isometrico — piano tecnico

Obiettivo: passare dalla vista dall'alto a una vista isometrica 2.5D in pixel art (stile "voxel" del
foglio di riferimento v0.6) **senza toccare la simulazione**. La griglia, le impronte degli edifici, le
regole di piazzamento, l'economia, gli eventi, i salvataggi e l'interfaccia restano come sono: cambia
solo il modo in cui il mondo viene disegnato e come un punto dello schermo diventa una casella.

## 1. Architettura attuale (cosa c'è e cosa cambia)

| Parte | File | Cosa fa oggi | Con l'isometrico |
|---|---|---|---|
| Simulazione | `src/game/*` | Griglia 56×36, `TILE` = 16 unità mondo, bot in coordinate mondo (x, y) | **Invariata** |
| Salvataggi | `src/storage.ts`, `src/game/state.ts` | Stato serializzato (v2) | **Invariati**: nessun campo nuovo nello stato |
| Renderer | `src/render/renderer.ts` | Mondo = canvas dall'alto, camera in unità mondo | Sostituito da `src/render/iso/` con la stessa interfaccia pubblica |
| Sprite | `src/render/sprites.ts` | Pixel art procedurale dall'alto, in memoria | Resta per menu e ritratti; il mondo usa l'atlante isometrico generato |
| Input | `src/session.ts` | Clic → `screenToTile`, D-pad e riquadro HQ calcolati a mano con `cam`/`TILE` | Passano tutti dalle funzioni del renderer (`tileToScreen`, `tileStep`, `buildingScreenBox`) |
| Icone barra | `src/render/icons.ts` | Disegnate dagli sprite dall'alto | Le icone degli edifici usano gli sprite isometrici, stessa barra |
| Test scriptati | `scratchpad/*.mjs` | Calcolano lo schermo con la formula dall'alto | Usano `renderer.tileToScreen()` |

Interfaccia pubblica del renderer che il resto del gioco usa (deve restare): `canvas`, `zoom`, `cam`,
`pxZoom`, `resize()`, `setZoom(z, sx, sy)`, `centerOn(wx, wy)`, `clampCam()`, `screenToWorld()`,
`screenToTile()`, `paintAllTerrain()`, `onFx()`, `render()`. Nuove: `worldToScreen()`, `tileToScreen()`,
`pickBuilding()`, `buildingScreenBox()`, `tileStep()`.

## 2. Proiezione

Coordinate mondo: x, y in unità mondo (1 casella = 16), z = altezza (stessa unità).
Coordinate iso (pixel dell'arte, prima dello zoom):

```
isoX = x − y
isoY = (x + y) / 2 − z
```

Una casella diventa un rombo 32×16 px; un cubo alto 16 unità è alto 16 px (rapporto classico 2:1).
Inversa sul terreno (z = 0): `x = isoY + isoX / 2`, `y = isoY − isoX / 2`.
Lo schermo: `screen = (iso − cam) · pxZoom`, con `cam` in pixel iso e `pxZoom` intero sui pixel del
dispositivo (come oggi: arte nitida anche al 125/150%).

La direzione di vista è (1, 1, 1): un punto è più vicino alla camera quanto più è grande x + y + z.
Questo dà l'ordine di disegno e il ray casting degli sprite (sezione 3).

## 3. Asset: generati, non disegnati a mano una volta sola

`npm run art` esegue `scripts/art/build.ts`:

1. **Modelli voxel** (`scripts/art/models/*.ts`): ogni edificio, bot, cittadino, oggetto è un piccolo
   modello 3D a voxel (1 voxel = 1 unità mondo) fatto di primitive: scatole, cilindri, tubi, tetti,
   scritte a voxel ("HQ", "2PM"). Materiali dalla palette del gioco (lime, rosa, viola, acciaio...).
2. **Ray casting** (`scripts/art/voxel.ts`): per ogni pixel un raggio lungo (−1, −1, −1). Tre facce con
   luce fissa (sopra chiara, sinistra media, destra scura con tinta viola), occlusione ambientale ai bordi,
   contorno scuro di 1 px, luci delle finestre su un livello "emissivo" separato e alone di 2 px per la notte,
   ombra portata sul terreno. Niente filtri, niente sfumature: pixel interi, palette limitata.
3. **Fotogrammi**: ogni edificio ha uno stato `off` (fermo, senza corrente o in pausa) e 4 fotogrammi
   `work` (nastri, bracci, pale, fiamme). I bot hanno 4 direzioni × volo/trasporto/lavoro. Cittadini e gatto
   4 direzioni × 2 passi. Terreno: rombi 32×16 con varianti (terra, strada, incrocio, erba, cemento,
   melma a 16 connessioni × 2 fotogrammi, base della discarica).
4. **Atlante** (`src/assets/iso/atlas.png` + `atlas.json`): un'unica texture, impacchettata a scaffali.
   Ogni fotogramma ha `x, y, w, h` e un **punto di ancoraggio** `ax, ay` = il pixel del vertice posteriore
   dell'impronta (x0, y0, z = 0). Per disegnare: `iso(x0, y0) − (ax, ay)`. Scala identica per tutto.
5. **PNG singoli** in `art/sprites/` (uno per fotogramma) e un foglio di controllo `art/contact-sheet.png`.
6. **Override a mano**: un PNG in `art/overrides/<nome>.png` con lo stesso nome sostituisce il fotogramma
   generato (stesse dimensioni e ancoraggio). Così un artista può ritoccare senza toccare il codice.

L'atlante è importato da Vite e finisce dentro `dist/index.html` come oggi (file unico).

## 4. Renderer isometrico (`src/render/iso/`)

- `projection.ts`: formule pure (testate con vitest).
- `atlas.ts`: carica l'immagine una volta, maschere alfa per il clic sugli sprite.
- `depth.ts`: ordinamento topologico per profondità. Ogni oggetto ha un volume (x0..x1, y0..y1, z0..z1);
  per le coppie che si sovrappongono sullo schermo, A sta dietro B se è separato su un asse
  (`A.x1 ≤ B.x0` o `A.y1 ≤ B.y0` o `A.z1 ≤ B.z0`). Corretto anche per impronte di misure diverse
  (3×3 accanto a 1×1), dove l'ordinamento per somma x + y sbaglia. Nessuna allocazione per fotogramma
  (array riusati).
- **Livelli**: sfondo → terreno in cache (rombi + mucchi di rottami, ridisegnati solo nelle caselle
  "sporche") → evidenziazione dell'impronta / raggio → oggetti ordinati (edifici, bot, cittadini, gatto,
  dirigibile) → particelle (fumo, scintille) → anteprima di costruzione → luci della notte (emissivi in
  `lighter`) → smog → testi fluttuanti.
- **Bordo del mondo**: la mappa è una "zolla" con un fianco di terra; attorno, 6 caselle di decorazioni
  non giocabili (rovine, container, gru, alberi, cartellone 2PM) perché la mappa non sembri vuota.

## 5. Clic, controller, zoom

- **Casella sotto il cursore**: inversa della proiezione sul piano z = 0 (`screenToTile`).
- **Edificio sotto il cursore**: si prova prima lo sprite più vicino alla camera (maschera alfa dei pixel).
  Cliccare il tetto di un edificio alto lo seleziona anche se la casella a terra è un'altra.
- **Costruzione**: l'anteprima resta ancorata alla casella a terra, come prima (stesse regole di
  `placeCheck`); il rombo verde/giallo/rosso è disegnato sul terreno.
- **Controller**: lo stick sinistro muove il cursore libero come prima. Il D-pad si muove di una casella
  lungo gli assi della griglia, ruotati di 45°: su = nord-est, destra = sud-est, giù = sud-ovest,
  sinistra = nord-ovest (ogni casella raggiungibile, niente salti a scacchiera).
- **Zoom**: interi 1..5 (1 = vista d'insieme della città intera, nuova). Lo zoom resta centrato sul cursore.
- **Camera**: limiti calcolati sul rombo della mappa in coordinate iso.

## 6. Animazioni collegate alla simulazione

| Animazione | Quando | Dato della simulazione |
|---|---|---|
| Nastro del Riciclatore con rottami che scorrono | Solo se lavora | `b.status === 'ok'`, non in pausa |
| Pale eoliche | Velocità secondo la produzione | `derived.powerProd`, notte = pannelli spenti |
| Bracci robotici, presse (Fabbrica, Lab) | Solo se lavora | `status`, `paused` |
| Fumo dai camini | Solo con combustibile / produzione | `b.fuel`, `status`; più scuro con l'inquinamento |
| Fornace incandescente | Fornace accesa | `status === 'ok'` |
| Bot: volo, raccolta (scendono sul mucchio), consegna (cubo di rottami appeso) | Sempre | `bot.state`, `bot.carry` |
| Quota di volo dei bot | Salgono sopra gli edifici alti | Altezza del modello sotto il bot (solo grafica) |
| Cantiere: impalcature, scintille, barra | Durante la costruzione | `b.built < 1` |
| Demolizione: polvere e detriti | Alla demolizione | evento `demolish` |
| Cittadini a piedi sulle strade | Più gente con più abitanti | `s.pop` (solo grafica) |
| Finestre accese di notte | Con corrente | ora del giorno, `noPower` |

## 7. Prestazioni

- Una sola texture (atlante): `drawImage` con ritagli, niente canvas temporanei per fotogramma.
- Terreno in cache, ridisegno solo delle caselle cambiate.
- Ordinamento solo degli oggetti visibili; array e oggetti riusati.
- Obiettivo: 60 fps con 120 edifici e 35 bot a 2560×1440 (misurato con lo stesso script della 0.5.1).

## 8. Ordine di lavoro

1. **Fetta verticale**: generatore + atlante; HQ, Riciclatore, Bot Dock, bot animati, terreno;
   renderer isometrico con piazzamento, selezione, zoom, controller. Gli altri edifici temporaneamente come
   blocchi semplici dello stesso stile. **Verifica** prima di andare avanti (sezione 9).
2. **Migrazione** degli altri 9 edifici (Fonderia, Pannelli solari, Inceneritore, Capsule, Giardino,
   Fabbrica 2PM, Lab Riparatutto, Purificatore, Guglia), cittadini, gatto, oggetti di scena, decorazioni del
   bordo, dirigibile.
3. **Verifica completa** e consegna.

## 9. Verifiche

- vitest: andata e ritorno della proiezione, `screenToTile` ai bordi delle caselle a tutti gli zoom,
  ordinamento per profondità (casi 3×3 + 1×1, bot sopra un tetto), atlante (ogni tipo di edificio ha i suoi
  fotogrammi, ancoraggi dentro lo sprite).
- Playwright: clic su ogni casella di un'area a zoom 1–5 → la casella evidenziata è quella giusta;
  clic sul tetto → si apre l'ispettore giusto; piazzamento di ogni edificio; D-pad e stick; tutte e
  5 le città della campagna avviate e giocate a velocità alta; fps misurati.
- Salvataggi della 0.5.1 caricati senza perdite (nessun campo nuovo).

## 10. Rischi

| Rischio | Cosa si fa |
|---|---|
| La mappa iso è larga il doppio in pixel | Zoom 1 per la vista d'insieme; centratura sull'HQ come prima |
| Ordine di disegno sbagliato con impronte diverse | Ordinamento topologico + test |
| Bot che attraversano edifici alti | Quota di volo sopra il modello più alto sotto di loro |
| Il tutorial punta all'HQ con coordinate dall'alto | `buildingScreenBox()` dal renderer |
| Arte "generata" che sembra finta | Palette del gioco, contorni e luci regolari, override PNG a mano |
