# Changelog

## 0.6 — 2.5D isometric world (in progress)

### Grafica: da vista dall'alto a isometrico 2.5D
- Il mondo è disegnato in **pixel art isometrica 2.5D** in stile voxel, come il foglio di riferimento v0.6. La simulazione,
  la griglia 56×36, le impronte degli edifici, le regole di piazzamento, l'economia, gli eventi, i finali, gli achievement,
  le lingue e i salvataggi **non sono cambiati**: cambia solo come il mondo viene disegnato e cliccato.
- **Pipeline degli asset** (`npm run art`): ogni edificio, bot, cittadino, oggetto e casella di terreno è un piccolo modello
  voxel, renderizzato in sprite con luce fissa, occlusione ambientale, contorno scuro, ombre portate e un livello di luci
  notturne. Risultato: un atlante unico (`src/assets/iso/atlas.png` + `atlas.json`, con punti di ancoraggio),
  ogni fotogramma come PNG singolo in `art/sprites/`, il foglio `art/contact-sheet.png`. Un PNG messo in `art/overrides/`
  con lo stesso nome sostituisce il fotogramma generato (ritocchi a mano senza toccare il codice).
- **Renderer isometrico** con la stessa interfaccia del precedente: proiezione 2:1 (rombi 32×16), ordinamento per profondità
  topologico (corretto anche con impronte di misure diverse), terreno in cache con ridisegno solo delle caselle cambiate,
  livello delle ombre, zoom 1–5 (il nuovo zoom 1 mostra tutta la città).
- **Clic su quello che si vede**: il tetto o il muro di un edificio lo selezionano anche se sotto c'è un'altra casella;
  il piazzamento resta ancorato alla casella a terra sotto il cursore.
- **Controller**: il D-pad si muove di una casella lungo gli assi della griglia (su = nord-est, destra = sud-est); lo stick
  muove il cursore libero come prima.

### Mondo vivo (tutto collegato allo stato della simulazione)
- Nastri del Riciclatore con rottami che scorrono e rulli che girano solo quando lavora; luci della pista del Bot Dock.
- Bot in 4 direzioni: volano sopra i tetti, scendono sui mucchi a raccogliere (con scintille), portano un cubo di rottami,
  atterrano sul tetto dell'edificio dove scaricano. L'ombra a terra segue la quota.
- Cantieri a 4 stadi con impalcature, un bot saldatore e la barra di avanzamento; le demolizioni sprofondano nella polvere
  con una piccola scossa della camera.
- Cittadini che camminano sui marciapiedi delle vecchie strade (più gente con più abitanti), Miso il gatto in 4 direzioni,
  il dirigibile 2PM che attraversa il cielo con la sua ombra.
- Terreno più vario ma sempre edificabile: marciapiedi lungo le strade, piazzali di cemento, pavimentazioni industriali,
  fango accanto alla melma, terra sporca attorno ai rottami (si pulisce quando i bot li raccolgono).
- Attorno alla mappa un anello di scenografia non giocabile, e la mappa è una "zolla" con i fianchi di terra.
- Di notte finestre, schermi, fornaci e fari si accendono con un alone.

### Correzioni (audit tecnico)
- Saltare o finire il tutorial non sovrascrive più in silenzio la città salvata della partita libera: il gioco chiede.
- Un salvataggio di città danneggiato o di una versione più nuova non viene più rimpiazzato da una città nuova: appare
  "Impossibile caricare". Sul desktop un file danneggiato non viene mai copiato sopra un backup buono, e si legge il
  backup quando il file principale non è valido. Una campagna danneggiata viene messa da parte.
- Nessun salvataggio automatico durante il conto alla rovescia dello smog: "Carica l'ultimo salvataggio" dopo una
  sconfitta per smog non riporta più in una città già persa.
- Una città caricata da uno slot manuale continua a salvarsi in quello slot invece di sostituire la città automatica.
- I rottami trasportati dai bot finiscono nel magazzino al salvataggio invece di sparire.
- HUD e suggerimenti con statistiche aggiornate anche in pausa, sotto l'introduzione e dopo il caricamento.
- Un suggerimento a pagamento rifiutato non conta più come "già chiesto oggi"; il "già chiesto" viene salvato.
- L'Inceneritore non perde più corrente per un istante alla fine di ogni carico di combustibile.
- I fotogrammi lenti non fanno più perdere tempo di gioco (fino a 0,25 s recuperati, poi il limite di 16 passi).
- Partita libera: Invio avvia la città, il seme 0 è valido, "Indietro" conserva nome e seme scritti.
- Menu principale: Invio/Spazio attivano la voce evidenziata anche prima di usare le frecce.
- Impostazioni: aprirle non azzera più niente con lo storage bloccato; lo schermo intero resta allineato quando cambia
  con F11, Esc o i controlli della finestra.

### Audio
- Limitatore sul mix: tanti effetti insieme non distorcono più.
- Tetto alle voci contemporanee e intervallo minimo per ogni effetto; il rumore riusa un unico buffer (niente allocazioni).

### Test
- `tests/iso.test.ts`: andata e ritorno della proiezione, casella giusta per ogni pixel a ogni zoom, ordinamento per
  profondità (3×3 accanto a 1×1, bot sopra un tetto, 300 oggetti).
- `tests/saves.test.ts`: niente autosalvataggio durante lo smog, file del desktop accettati solo se validi.
