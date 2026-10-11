# Costruzione modulare — secondo incremento (0.7, incremento 2): gli altri 18 oggetti

Completa il catalogo di 24 pezzi della proposta originale («Un primo catalogo da circa 24 pezzi»): quattro famiglie da sei.
L'incremento 1 (`docs/MODULAR-INC1.md`, consegnato in 0.7.0-alpha.1) ha fatto pavimento, recinzione, cancello, lampione,
deposito del Bot Dock e filtro della Fonderia. Restano esattamente questi 18:

| Famiglia | Già fatti (inc. 1) | Nuovi (inc. 2) |
|---|---|---|
| Strutture | pavimento metallico, recinzione, cancello | **basamento**, **muro basso**, **pilastro d'angolo** |
| Moduli macchina | deposito (Dock), filtro (Fonderia) | **antenna** (Dock), **braccio meccanico** (Fonderia), **selezionatore** (Riciclatore), **raffreddamento** (Bruciatore) |
| Collegamenti | — | **passerella**, **tubo**, **canalina**, **raccordo a L**, **raccordo a T**, **incrocio** |
| Vita urbana (decorazioni) | lampione | **albero**, **panchina**, **fioriera**, **insegna al neon**, **scultura di rottami** |

Restano fuori, come concordato: nuovi eventi, modalità infinita, sblocchi a obiettivi, impilamento su più piani, logistica vera
(tubi e nastri che trasportano materiali). Tutte le regole dell'incremento 1 restano valide (pagamento solo alla conferma,
anteprima e annullamento gratis, rimborso a metà per difetto, nessuna risorsa duplicata, edifici vicini sempre selezionabili,
bot invariati, salvataggi compatibili, prima città completabile senza oggetti nuovi). **Nessun numero degli edifici originali
cambia.**

## Catalogo dell'incremento 2 (per il proprietario)

Prezzi in crediti (cr), pezzi (pz), rottami (rt). Rimborso = metà per difetto; i rottami restituiti non superano lo spazio
libero nel deposito in quel momento (il testo del rimborso mostra sempre la cifra vera).

**Strutture** (decorazioni: nessun effetto sull'economia)

| Pezzo | Costo | Rimborso | Note |
|---|---|---|---|
| Basamento in cemento | 4 cr a casella | 2 cr | superficie come il pavimento; ci si costruisce sopra; aspetto diverso (cemento con cordolo) |
| Muro basso | 2 cr + 4 rt a casella | 1 cr + 2 rt | blocchi di rottami pressati; si raccorda con muri, recinzioni, cancelli e pilastri; usa i rottami in eccesso |
| Pilastro d'angolo | 6 cr | 3 cr | colonna a cui si raccordano muri e recinzioni da ogni lato; luce sulla cima di notte |

**Moduli macchina** (uno per tipo per edificio; un edificio può avere tutti i moduli che gli spettano)

| Modulo | Edificio | Costo | Rimborso | Effetto (prima → dopo) | Compromesso |
|---|---|---|---|---|---|
| Antenna | Bot Dock | 35 cr + 15 pz | 17 cr + 7 pz | bot del Dock 2 → 3 | energia −1 → −2 |
| Braccio meccanico | Fonderia | 50 cr + 25 pz | 25 cr + 12 pz | ciclo 1,6 → 1,2 s (stessi 3 rt → 9 cr: +33% crediti al secondo) | energia −2 → −4; consuma +33% rottami al secondo |
| Selezionatore | Riciclatore | 40 cr + 20 pz | 20 cr + 10 pz | 3 rt → 3 pz invece di 2 (+50% pezzi per rottame; +20% pezzi al secondo) | ciclo 2 → 2,5 s; energia −2 → −3 |
| Raffreddamento | Bruciatore | 35 cr + 15 pz | 17 cr + 7 pz | energia +9 → +12 | un carico di rottami dura 3 → 2,25 s (+33% carburante); smog ×1,3 (0,045 → 0,0585 /s) |

Con due moduli sullo stesso edificio gli effetti si sommano come dichiarato: Dock con deposito e antenna = deposito 180, 3 bot,
energia −2; Fonderia con filtro e braccio = smog 0,014 /s, ciclo 1,2 s, energia −5.

**Collegamenti** (decorazioni: **non trasportano materiali**; il testo lo dice)

| Pezzo | Costo | Rimborso | Note |
|---|---|---|---|
| Passerella | 6 cr a casella | 3 cr | passerella metallica rialzata con parapetti; si raccorda con passerelle e raccordi |
| Tubo | 5 cr a casella | 2 cr | tubo su supporti; si raccorda con tubi e raccordi |
| Canalina | 3 cr a casella | 1 cr | canalina portacavi bassa; si raccorda con canaline e raccordi |
| Raccordo a L | 6 cr | 3 cr | nodo con due lati aperti ad angolo (4 rotazioni) |
| Raccordo a T | 8 cr | 4 cr | nodo con tre lati aperti (4 rotazioni) |
| Incrocio | 10 cr | 5 cr | nodo con quattro lati aperti |

Passerelle, tubi e canaline prendono da soli la forma giusta (dritto, curva, T, incrocio) come le recinzioni. I tre raccordi
servono a fare un nodo visibile (valvola, manometro, centralina) e a **collegare tra loro tipi diversi**: un tubo, una canalina
e una passerella si attaccano a un raccordo dai suoi lati aperti.

**Vita urbana** (decorazioni: nessun effetto su felicità, risorse, stelle o achievement)

| Pezzo | Costo | Rimborso | Note |
|---|---|---|---|
| Albero | 8 cr | 4 cr | tre varietà scelte dalla casella; diverso dal Giardino Pixel (che resta l'unico verde con effetto) |
| Panchina | 6 cr | 3 cr | 4 direzioni |
| Fioriera | 5 cr | 2 cr | due varietà di fiori scelte dalla casella |
| Insegna al neon | 15 cr + 4 pz | 7 cr + 2 pz | 4 direzioni; simboli senza testo (bot, riciclo, cuore) scelti dalla casella; accesa di notte |
| Scultura di rottami | 10 cr + 20 rt | 5 cr + 10 rt | robot fatto di rottami, 4 direzioni; usa i rottami in eccesso |

## 1. Dati (pacchetto CORE)

`src/game/piecedefs.ts` (dati) e `src/game/pieces.ts` (regole), estesi senza rompere l'API dell'incremento 1:

```ts
export type PieceKind = 'floor' | 'base' | 'fence' | 'gate' | 'wall' | 'pillar'
  | 'walkway' | 'pipe' | 'duct' | 'elbow' | 'tee' | 'cross'
  | 'lamp' | 'tree' | 'bench' | 'planter' | 'sign' | 'sculpture';
export type ModuleKind = 'dockStorage' | 'dockAntenna' | 'smelterFilter' | 'smelterArm' | 'recyclerSorter' | 'burnerCooling';
export type CategoryKind = 'structures' | 'modules' | 'links' | 'decor';
export const CATEGORIES: Record<CategoryKind, CatalogKind[]> = {
  structures: ['floor', 'base', 'fence', 'gate', 'wall', 'pillar'],
  modules: ['dockStorage', 'dockAntenna', 'smelterFilter', 'smelterArm', 'recyclerSorter', 'burnerCooling'],
  links: ['walkway', 'pipe', 'duct', 'elbow', 'tee', 'cross'],
  decor: ['lamp', 'tree', 'bench', 'planter', 'sign', 'sculpture'],
};
export const CATALOG_ORDER: CatalogKind[] = [
  ...CATEGORIES.structures, ...CATEGORIES.modules, ...CATEGORIES.links, ...CATEGORIES.decor,
];

export interface PieceDef {
  kind: PieceKind; layer: 'surface' | 'solid'; cost: Cost;
  rotations: 1 | 2 | 4;
  group: 'barrier' | 'walkway' | 'pipe' | 'duct' | null; // what it joins (null = stands alone)
  hub?: 'barrier' | 'link';    // pillar: barriers join it from any side; elbow/tee/cross: links join its open sides
  row: boolean;                // can be laid as a dragged row (floor, base, fence, wall, walkway, pipe, duct)
  height: number;              // voxels, for drawing order and bots' flying height
  note: 'decor' | 'link';      // panel text: "no effect on the economy" / "does not carry materials"
}
export interface ModuleDef {
  kind: ModuleKind; building: BuildingType; slot: 'roof' | 'side' | 'front'; cost: Cost; limit: 1;
  storage?: number; pollutionMul?: number; energy?: number; // as in increment 1
  cycleMul?: number;  // × process cycle time
  output?: Cost;      // replaces the process output per cycle
  fuelMul?: number;   // × seconds one load of fuel lasts
  bots?: number;      // added bots
}
export interface BuildingStats {   // buildingStats(b) / buildingStatsWith(b, modules): the ONLY source for sim and UI
  energy: number; pollution: number; storage: number;
  bots: number; cycle: number; input: Cost; output: Cost; fuelSeconds: number; // 0 / {} when the building has none
}
```

Slot: Dock deposito `roof`, antenna `side`; Fonderia filtro `side`, braccio `front`; Riciclatore selezionatore `side`;
Bruciatore raffreddamento `side`. L'ordine relativo dei moduli dello stesso edificio resta quello di `CATALOG_ORDER`.

**Codici salvati (solo in coda, mai riordinare):** oggetti solidi 1 fence, 2 gate, 3 lamp (incremento 1), poi 4 wall,
5 pillar, 6 walkway, 7 pipe, 8 duct, 9 elbow, 10 tee, 11 cross, 12 tree, 13 bench, 14 planter, 15 sign, 16 sculpture.
Superfici in `s.floor`: 1 floor, 2 base. Salvataggio: `SAVE_VERSION` resta 2; `floors: number[]` resta per il codice 1;
nuovo campo facoltativo `surfaces: [index, code][]` per gli altri codici; `solids: [index, code, rot][]` come prima; i moduli
nuovi in `buildings[i].modules`. I salvataggi 0.6.x e 0.7.0-alpha.1 si caricano invariati; codici e moduli sconosciuti si
scartano come nell'incremento 1.

**Effetti nella simulazione** (solo attraverso `buildingStats`): `runProcess` usa `cycle`, `input`, `output`; il carburante usa
`fuelSeconds`; `botTarget` e la ripartizione dei bot tra le basi (`homeFor`) usano `bots`; energia, smog e deposito come
nell'incremento 1. Togliere l'antenna toglie un bot con le regole già esistenti (prima un bot vuoto e fermo; i rottami di un
bot carico vanno nel deposito finché c'è posto). Senza moduli ogni numero resta quello della 0.6.1: `npm run balance` (con la
stessa sequenza casuale) e `npm run waits` devono dare uscite identiche byte per byte a prima.

## 2. Regole

**Superfici.** Basamento come il pavimento: terreno o erba, nessun edificio, nessun'altra superficie; gli edifici e gli
oggetti solidi ci stanno sopra; la ruspa su una casella con solo la superficie la toglie.

**Oggetti solidi.** Tutti i nuovi pezzi tranne il basamento: 1×1, terreno o erba, nessun edificio, nessun altro oggetto
solido; in `s.solid`, mai in `s.occ`. Valgono le regole dell'incremento 1 (gli edifici rifiutano le caselle con un oggetto,
spazzatura/melma/macerie mai sugli oggetti, i cittadini ci girano attorno, i bot ci volano sopra: il loro volo si alza sopra
i pezzi alti come già sopra i lampioni).

**Raccordi** (maschera a 4 bit dei vicini: N (y−1) = 1, E (x+1) = 2, S (y+1) = 4, W (x−1) = 8):
- gruppo `barrier` (recinzione, muro basso): un vicino conta se è recinzione, muro, pilastro, oppure un cancello **allineato**
  (cancello lungo x: si raccorda con i vicini E/W; lungo y: con N/S). Recinzioni e muri si raccordano anche tra loro.
  Questo corregge il limite noto dell'incremento 1 (una recinzione contro il fianco di un cancello).
- pilastro: maschera dei vicini `barrier` (recinzione, muro, cancello allineato, pilastro); disegno per maschera.
- gruppi `walkway`, `pipe`, `duct`: un vicino conta se è dello stesso tipo, oppure un raccordo (L, T, incrocio) con un lato
  aperto verso questa casella. Tipi diversi non si raccordano tra loro direttamente.
- lati aperti dei raccordi per rotazione: L 0 = N+E, 1 = E+S, 2 = S+W, 3 = W+N; T 0 = N+E+S, 1 = E+S+W, 2 = S+W+N,
  3 = W+N+E; incrocio = tutti. Due raccordi vicini si collegano se entrambi hanno il lato aperto l'uno verso l'altro.
- maschera 0 (pezzo isolato di un gruppo): si usa la rotazione (0 = lungo x, 1 = lungo y).
API: `pieceMask(s, x, y, kind)` (funziona anche su caselle vuote, per l'anteprima) e `hubSides(kind, rot)`; `fenceMask`
resta e vale `pieceMask(s, x, y, 'fence')`.

**Rotazioni.** basamento, pilastro, incrocio, albero, fioriera: 1; recinzione, muro, passerella, tubo, canalina (orientamento
da isolati), cancello: 2; raccordi L e T, lampione, panchina, insegna, scultura: 4. Ruotare è gratis; un pezzo di un gruppo
raccordato segue i vicini e si ruota solo da isolato (come la recinzione). Albero, fioriera e insegna scelgono la varietà
dalla casella (hash), non dalla rotazione.

**Acquisto e rimozione.** Come nell'incremento 1. File trascinate per i pezzi `row`. I pezzi che costano rottami li prendono
dal deposito; una fila si ferma (anteprima rossa) dove mancano crediti, pezzi o rottami. Rimborso a metà per difetto;
i rottami restituiti si fermano allo spazio libero del deposito: `pieceRefundAt(s, kind)` dice il rimborso vero in quel momento
e `removePieceAt` dà esattamente quello. I moduli non costano rottami.

## 3. Grafica (pacchetto ART)

Stessa pipeline voxel, stesso stile e palette. Nomi dei fotogrammi (più `/shadow` dove serve, come nell'incremento 1):
- superficie: `t/base/0..3`;
- gruppi raccordati: `pc/wall/1..15`, `pc/wall/x|y`; `pc/walkway/...`, `pc/pipe/...`, `pc/duct/...` (stessi nomi);
  `pc/pillar/0..15` (con la luce sulla cima `/g`);
- raccordi: `pc/elbow/0..3`, `pc/tee/0..3`, `pc/cross/0`;
- decorazioni: `pc/tree/0..2`, `pc/bench/0..3`, `pc/planter/0..1`, `pc/sign/<motivo 0..2>/<dir 0..3>` con `/g`,
  `pc/sculpture/0..3`;
- icone: `pc/<kind>/icon`, `mod/<kind>/icon` per tutti e 18.
- varianti degli edifici, con la chiave di `variantKey` (moduli **in ordine alfabetico** dopo il tipo):
  `b/dock+dockAntenna/…`, `b/dock+dockAntenna+dockStorage/…`, `b/smelter+smelterArm/…`, `b/smelter+smelterArm+smelterFilter/…`,
  `b/recycler+recyclerSorter/…`, `b/burner+burnerCooling/…`; tutti i fotogrammi di lavoro + `off` + bagliore + ombra, meta in
  `atlas.json` → `variants`. Le varianti esistenti (`dock+dockStorage`, `smelter+smelterFilter`) e tutti i fotogrammi della
  0.7.0-alpha.1 restano identici al pixel.
- Ogni modulo è riconoscibile sull'edificio e non copre gli altri moduli dello stesso edificio: antenna (traliccio con parabola,
  luce che lampeggia quando il Dock ha corrente), braccio (braccio articolato che si muove solo quando la Fonderia lavora),
  selezionatore (tamburo o nastro corto che gira solo quando il Riciclatore lavora), raffreddamento (piccola torre con ventola
  che gira solo quando il Bruciatore ha carburante). Con il movimento ridotto nessuna animazione.
- I collegamenti hanno l'aria di impianti ma nulla che sembri un trasporto in corso (niente scatole che scorrono).

## 4. Renderer (pacchetto RENDER)

Come nell'incremento 1 (contratto `ViewState.piece/selectedPiece/pieceRow/pieceLabel`, `pickPiece`, `pieceScreenBox`), esteso a
tutti i 24: superficie `base` nella cache del terreno; tutti i solidi come `K_PIECE` con l'altezza della definizione; fotogrammi
per maschera/rotazione/varietà; bagliori notturni (insegna, cima del pilastro, lampione); varianti degli edifici per ogni
combinazione di moduli; animazioni dei moduli legate allo stato dell'edificio (lavoro, carburante, corrente, pausa); anteprime
con i raccordi calcolati dai vicini veri **e dai fantasmi della fila**; i bot volano sopra i pezzi alti; i cittadini girano
attorno a tutti i solidi.

## 5. Interfaccia e input (pacchetto UI)

- Il pannello «Oggetti e moduli» passa a **quattro schede**: Strutture, Moduli macchina, Collegamenti, Vita urbana (6 voci
  ciascuna; ricorda l'ultima scheda). Ogni voce: icona, nome, costo (anche rottami), effetto, limite, motivo se non disponibile.
  Schede raggiungibili con mouse, touch e cursore del controller; la barra degli strumenti non cambia.
- Sezione «Moduli» del pannello edificio per Dock (2), Fonderia (2), Riciclatore (1), Bruciatore (1), con prima → dopo per ogni
  valore che cambia (deposito, bot, ciclo, prodotto per ciclo, durata del carburante, energia, smog), limite, Installa/Rimuovi.
  Le righe del pannello (ciclo, energia, smog, deposito) usano i numeri di `buildingStats`.
- Pannello di un oggetto selezionato: per i collegamenti «Decorazione: non trasporta materiali»; per gli altri «Decorazione:
  nessun effetto sull'economia»; Ruota per i pezzi ruotabili; Rimuovi con il rimborso vero (`pieceRefundAt`).
- Rotazione, file trascinate, annullamento, ruspa, controller e touch come nell'incremento 1, per tutti i pezzi.
- Tutti i testi in 8 lingue.

## 6. Accettazione

1. Test unitari: piazzamento e raccordi di ogni gruppo (compresi raccordi tra tipi diversi e cancelli allineati), rotazioni,
   costi in rottami e rimborsi limitati dal deposito, effetti di ogni modulo e delle combinazioni nella simulazione (uguali a
   quelli mostrati), bot aggiunti e tolti dall'antenna, nessuna risorsa creata in sequenze casuali di posa/rimozione/
   installazione/demolizione con tutti i 24, salvataggio e caricamento, salvataggi 0.6 e 0.7.0-alpha.1 (nuovo fixture con i sei
   pezzi dell'incremento 1).
2. Playwright sulla build consegnata: tutti i 18 nuovi pezzi comprati e posati dall'interfaccia almeno una volta; flusso
   completo acquisto → posa → funzionamento → salvataggio → chiusura e riapertura → caricamento → demolizione con mouse, touch
   CDP e Gamepad API simulata (rotazione con ciascuno); annullamento gratis.
3. Prima città della campagna completata senza comprare nessuno dei 24 oggetti; suite esistenti verdi; bilanciamento senza
   moduli identico; prestazioni con molti pezzi.
4. Misura (non riequilibrio): con `scripts/wait-analysis.ts`, le stesse partite con ciascun modulo installato all'inizio del
   risparmio per la Guglia, per dire quali moduli sono specializzazioni utili e dove.
5. Screenshot dalla build consegnata: catalogo con le quattro schede; un cortile con muri, pilastri e cancello; un impianto con
   tubi, canaline, passerelle e raccordi; una piazza con alberi, panchine, fioriere, insegne e scultura di notte; ogni modulo
   nuovo e le due combinazioni (Dock, Fonderia); pannelli con prima → dopo; tre quartieri diversi con gli stessi edifici di
   partenza.
6. Versione 0.7.0-alpha.2; report con implementato / verificato (con l'input usato) / da provare; nessuna durata dichiarata.
