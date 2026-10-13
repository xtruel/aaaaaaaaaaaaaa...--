# Costruzione modulare — primo incremento (0.7, incremento 1)

Perimetro approvato dal proprietario: **sei elementi e nient'altro**. Gli altri 18 oggetti del catalogo, i nuovi
eventi e la modalità infinita sono il passo successivo.

## Catalogo dell'incremento 1 (per il proprietario)

| Pezzo | Tipo | Costo | Effetto | Limite | Rotazione | Rimborso alla rimozione |
|---|---|---|---|---|---|---|
| Pavimento industriale | superficie a terra | 3 crediti a casella | nessuno (decorazione); gli edifici si costruiscono sopra | 1 per casella | — | 1 credito |
| Recinzione | oggetto solido | 4 crediti a casella | nessuno (decorazione); si raccorda da sola con recinzioni e cancelli | 1 per casella | solo se isolata (2 versi) | 2 crediti |
| Cancello | oggetto solido | 12 crediti | nessuno (decorazione); si allinea alle recinzioni | 1 per casella | 2 versi | 6 crediti |
| Lampione | oggetto solido | 10 crediti + 2 pezzi | nessuno (decorazione); di notte illumina la strada | 1 per casella | 4 direzioni | 5 crediti + 1 pezzo |
| Deposito aggiuntivo (Bot Dock) | modulo dell'edificio | 30 crediti + 15 pezzi | deposito del Dock 80 → 180 rottami | 1 per Dock | — | 15 crediti + 7 pezzi |
| Filtro (Fonderia) | modulo dell'edificio | 45 crediti + 20 pezzi | inquinamento 0,035 → 0,014 /s; energia −2 → −3; produzione invariata | 1 per Fonderia | — | 22 crediti + 10 pezzi |

Le decorazioni non danno felicità, risorse, stelle o achievement. Nessun pezzo cambia l'allineamento verde/industria.
Nessun pezzo è necessario per finire una città.

## 1. Modello dei dati (pacchetto CORE)

Nuovo file `src/game/pieces.ts` (dati e regole, nessun DOM):

```ts
export type PieceKind = 'floor' | 'fence' | 'gate' | 'lamp';
export type ModuleKind = 'dockStorage' | 'smelterFilter';
export type CatalogKind = PieceKind | ModuleKind;

export interface PieceDef { kind: PieceKind; layer: 'surface' | 'solid'; cost: Cost; rotations: 1 | 2 | 4; joins: boolean }
export interface ModuleDef {
  kind: ModuleKind; building: BuildingType; slot: 'side' | 'roof'; cost: Cost; limit: 1;
  storage?: number;          // added storage
  pollutionMul?: number;     // multiplies the building's pollution
  energy?: number;           // added to the building's energy (negative = consumes more)
}
export const PIECES: Record<PieceKind, PieceDef>;   // values from the table above
export const MODULES: Record<ModuleKind, ModuleDef>;
export const CATALOG_ORDER: CatalogKind[] = ['floor', 'fence', 'gate', 'lamp', 'dockStorage', 'smelterFilter'];
```

`GameState` (src/game/state.ts) gains, all runtime + saved:
- `floor: Uint8Array` (MAP_W×MAP_H; 0 = none, 1 = industrial floor).
- `solid: Uint8Array` (0 none, 1 fence, 2 gate, 3 lamp) and `rot: Uint8Array` (0..3) per tile.
- `Building.modules?: ModuleKind[]` (absent = none; never two of the same kind).
- `stats.piecesPlaced` / `stats.modulesInstalled` (counters, default 0).

Save format: keep `SAVE_VERSION = 2`; new optional JSON fields `floors: number[]` (tile indexes) and
`solids: [index, kind, rot][]`; `buildings[i].modules` as is. `deserialize` fills empty arrays when they are missing,
so **0.6 saves load unchanged** (fixture `tests/fixtures/save-0.6.json`, written by the 0.6 code).

Effective building numbers — one function used by the sim **and** by the UI's before/after:
`buildingStats(b): { energy, pollution, storage }` = BUILDINGS[b.type] values with the installed modules applied
(storage added, pollution × pollutionMul, energy + energy). `computeDerived`, `computeStorage` and `updatePollution` use it.

## 2. Regole

**Superfici (pavimento).** Su caselle dentro la mappa di tipo terreno o erba (no spazzatura, melma, macerie), libere da
edifici (`occ === -1`), senza un altro pavimento. Un oggetto solido sopra non impedisce il pavimento sotto. Gli edifici e gli
oggetti solidi si costruiscono sopra un pavimento, che resta e riappare quando l'edificio viene demolito. La spazzatura delle
tempeste può cadere su un pavimento: quando i bot la raccolgono il pavimento torna visibile.

**Oggetti solidi (recinzione, cancello, lampione).** Su caselle dentro la mappa, terreno o erba, senza edificio e senza un altro
oggetto solido. Occupano la casella in `solid`, **non** in `occ`: l'occupazione degli edifici non cambia.
- `placeCheck` degli edifici rifiuta le caselle con un oggetto solido (motivo: «C'è una recinzione / un cancello / un lampione:
  rimuovilo prima»).
- Spazzatura, melma e macerie non compaiono mai su caselle con un oggetto solido (`spawnJunk`, `spawnSludge`, generazione mappa).
- I bot volano: **nessun cambiamento** al loro movimento. I cittadini sui marciapiedi evitano le caselle con un oggetto solido
  (stessa regola di `occ` in `src/render/iso/life.ts`).
- Raccordi della recinzione: maschera 4 bit dei vicini che sono recinzione **o** cancello: N (y−1) = 1, E (x+1) = 2,
  S (y+1) = 4, W (x−1) = 8. Maschera 0 (isolata): si usa la rotazione (0 = lungo x, 1 = lungo y).
- Cancello: rotazione 0 = lungo x, 1 = lungo y; le recinzioni ai lati si raccordano.
- Lampione: rotazione 0..3 = direzione del braccio (0 = +x, 1 = +y, 2 = −x, 3 = −y).

**Moduli.** Solo su un edificio del tipo giusto e **completato** (`built >= 1`); uno per tipo (limite 1); l'edificio può essere
in pausa. Effetto immediato.

**Acquisto.** Si paga **una sola volta, alla conferma** (clic/tap/A): l'anteprima e l'annullamento non costano nulla. Con il
mouse si può trascinare per posare una fila di pavimenti o recinzioni: ogni casella posata è una conferma e si paga quando
viene posata; le caselle non valide vengono saltate senza costo.

**Rimozione e demolizione.**
- Bulldozer (o «Rimuovi» nel pannello) su un oggetto solido: lo rimuove, rimborso = floor(costo × 0,5).
- Bulldozer su una casella con solo il pavimento: lo rimuove, rimborso 1 credito.
- Bulldozer su un edificio: lo seleziona (come oggi).
- «Rimuovi modulo» nel pannello dell'edificio: rimborso = floor(costo × 0,5), l'edificio resta.
- Demolire un edificio con moduli: rimborso edificio + rimborso di ogni modulo, mostrato **prima** della conferma;
  i moduli spariscono con l'edificio. Nessuna risorsa duplicata (test).

## 3. Grafica (pacchetto ART — nomi dei fotogrammi nell'atlante)

- `t/floor/<k>` k = 0..3: piastre metalliche con rivetti e bordi a strisce di pericolo, disegnate nella cache del terreno.
- `pc/fence/<mask>` mask 1..15, più `pc/fence/x` e `pc/fence/y` per la recinzione isolata (rete metallica o palizzata con
  paletti, altezza ~10 voxel, un cartello di pericolo ogni tanto via hash).
- `pc/gate/x`, `pc/gate/y`: due pilastri e un cancello scorrevole con una lucina (`/g` per il bagliore notturno).
- `pc/lamp/<dir>` dir 0..3, con `pc/lamp/<dir>/g` (lente accesa, visibile dalla camera).
- Icone per il catalogo: `pc/<kind>/icon` e `mod/<kind>/icon`.
- Varianti degli edifici con il modulo, tutti i fotogrammi di lavoro + `off` + bagliore:
  `b/dock+dockStorage/w<f>`, `b/dock+dockStorage/off`; `b/smelter+smelterFilter/w<f>`, `b/smelter+smelterFilter/off`.
  Meta in `atlas.json` → `variants["dock+dockStorage"] = { frames, fps, points }`.
  - Deposito: due silos/container di rottami sul tetto libero dell'hangar (lato anteriore sinistro, lontano dalla pista),
    con tramoggia, tubo verso l'hangar e banda di pericolo; dentro l'impronta 2×2 del Dock.
  - Filtro: torre di depurazione accanto al camino della Fonderia, collegata da tubazioni, con una ventola che gira solo quando
    la Fonderia lavora e una spia verde; punto `steam` in cima alla torre.
- Il modello riceve i moduli: `model(frame, working, modules?: string[])`.

## 4. Renderer (pacchetto RENDER)

- `ViewState` aggiunge `piece: { kind: CatalogKind; rot: number } | null` e `selectedPiece: number` (indice casella o −1).
- Pavimenti nella cache del terreno (ridisegno delle caselle cambiate tramite `s.dirtyTiles`).
- Oggetti solidi come elementi ordinati per profondità (nuovo tipo `K_PIECE`, impronta 1×1, altezze: recinzione 10, cancello
  12, lampione 22), con ombra.
- Edifici con moduli: `buildingFrameName` sceglie la variante `b/<type>+<moduli ordinati>/...`.
- Fonderia con filtro che lavora: niente fumo scuro dal camino; vapore chiaro e più rado dal punto `steam`.
- Lampioni piazzati: bagliore e pozza di luce di notte come quelli delle strade.
- Anteprima: fantasma del pezzo (rotazione e raccordi calcolati con i vicini reali) verde/rosso, con il motivo in parole sulla
  mappa (stessa etichetta dei piazzamenti degli edifici). Per i moduli: contorno dell'edificio compatibile sotto il cursore e
  un'etichetta con l'effetto («Deposito 80 → 180») o il motivo («Già installato», «Solo su un Bot Dock completato»).
- Selezione: `pickPiece(sx, sy)` con maschera alfa, dopo gli edifici davanti; un oggetto selezionato ha il contorno come gli
  edifici. Il clic su un edificio deve continuare a selezionarlo (le recinzioni sono basse).
- Movimento ridotto: nessuna animazione decorativa; la ventola del filtro resta ferma.

## 5. Interfaccia e input (pacchetto UI)

- Pulsante **«Oggetti e moduli»** (`O` da tastiera) che apre un **pannello laterale** (lato destro, come il pannello
  dell'edificio, che si chiude): sezione «Costruzioni» (4 pezzi) e «Moduli macchina» (2), ciascuno con icona, nome, costo,
  effetto, limite e un motivo se non disponibile. La barra degli strumenti **non si allarga**: verificare 1280×800, 1280×720,
  1024×640 in tutte le 8 lingue senza traboccare.
- Scegliere un pezzo attiva lo strumento (esclusivo con costruzione e bulldozer). Esc, tasto destro o B annullano senza costo.
- Rotazione: `R` (Shift+R al contrario), rotella con Shift; controller **Y** quando uno strumento ruotabile è attivo (altrimenti
  Y resta il consiglio); touch: pulsante «⟳ Ruota» nel pannello del catalogo mentre lo strumento è attivo.
- Controller: il cursore virtuale apre il pannello e sceglie i pezzi (come gli altri pulsanti); A posa/installa; il D-pad sposta
  di una casella; B annulla.
- Pannello dell'edificio (Dock, Fonderia): sezione **«Moduli»** con lo slot, costo, effetto **prima → dopo** (deposito,
  inquinamento, energia), limite «0/1» o «1/1», pulsante Installa (disabilitato con il motivo se non si può) e, se installato,
  «Rimuovi (+rimborso)». La conferma della demolizione mostra il rimborso totale moduli compresi.
- Pannello di un oggetto selezionato: nome, «Decorazione: nessun effetto sull'economia», «Ruota» (cancello, lampione),
  «Rimuovi (+rimborso)».
- Tutti i testi in 8 lingue (`npm run i18n:check`).

## 6. Accettazione

1. Test unitari: regole di piazzamento (edifici, oggetti solidi, superfici, spazzatura), un solo pagamento alla conferma,
   annullamento gratuito, raccordi delle recinzioni, limite dei moduli, effetti prima/dopo, rimborsi senza duplicazioni
   (posa/rimuovi ripetuto non crea risorse), demolizione dell'edificio con moduli senza moduli orfani, salvataggio e
   caricamento, **caricamento del salvataggio 0.6** (`tests/fixtures/save-0.6.json`), spazzatura mai su oggetti solidi.
2. Playwright sulla build consegnata: acquisto → posizionamento → funzionamento (deposito che sale a 180, inquinamento della
   Fonderia più basso) → salvataggio → chiusura e riapertura della pagina → caricamento → demolizione con rimborso; con
   mouse, touch (eventi touch reali via CDP) e controller (Gamepad API simulata). Rotazione con ciascuno.
3. La prima città della campagna completata **senza acquistare nessuno dei sei oggetti**, con gli edifici originali.
4. Tutte le suite esistenti verdi; prestazioni invariate.
5. Screenshot dalla build consegnata: due quartieri visivamente diversi costruiti con gli stessi edifici di partenza, il Dock
   con il deposito, la Fonderia con il filtro di giorno e di notte, il catalogo, il pannello dell'edificio con i moduli.
