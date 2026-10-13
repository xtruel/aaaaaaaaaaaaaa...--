# Scrapbot City 0.7.0-beta.1 — costruzione modulare, incremento 2: report di consegna

## Consegna

- **Commit del gioco**: `f5a741cd0420217dd7fb4977b056194a6e29fdf9` sul ramo `inc2-g5`, 39 commit sopra `97248dd` (la fine di
  G4). Non è stato pubblicato su nessun remoto. I commit di consegna che seguono `f5a741c` cambiano solo testi e immagini
  di documentazione (`docs/`, `README.md`, `e2e/README.md`): le build restano identiche byte per byte (ricostruite dal
  commit finale e confrontate).
- **Versione** nel menu: «Build_0.7.0-beta.1 / Oct 13 2026», scritta fissa nel codice: la build non dipende
  dall'orologio. `package.json`: 0.7.0-beta.1.
- **Build**, un file unico ciascuna, fatte da una copia pulita (`git archive`) del commit. Due copie indipendenti
  danno gli stessi byte, e gli stessi byte li hanno avuti il verificatore finale, il correttore e la cache della suite
  e2e:

| Build | Comando | Byte | sha256 | Aggancio di test |
|---|---|---:|---|---|
| Rilascio | `npx vite build` (lo stesso file di `npm run build`, che prima esegue `tsc`) | 1.918.597 | `0efef578bf78bce8f1f05e2508dd7d3c2884cb28d14f65d1930453117b960397` | assente |
| Debug | `NODE_ENV=development npx vite build --mode development` | 1.919.672 | `0c89294a134bc4ad6d599be98a852c63bffe0c8adafc462208aa58a4b2a28974` | `window.scrapbot` presente |

- **Come ricostruirle**:

  ```sh
  mkdir /tmp/sc && git archive f5a741c | tar -x -C /tmp/sc     # o il commit finale del ramo: stessi byte
  cd /tmp/sc                                                   # dipendenze di package-lock.json (qui: node_modules già installati)
  npx vite build --outDir rel --emptyOutDir
  NODE_ENV=development npx vite build --mode development --outDir dbg --emptyOutDir
  sha256sum rel/index.html dbg/index.html
  ```

  Le dipendenze usate sono quelle già installate per il progetto (un collegamento a `node_modules`); `npm ci` da zero
  non è stato provato.
- **Riferimenti**: specifica `docs/MODULAR-INC2.md`; modifiche nel dettaglio `CHANGELOG.md` (sezione 0.7.0-beta.1);
  attese `docs/WAITS.md`; test end-to-end `e2e/README.md`; playtest `docs/PLAYTEST.md`.
- **Screenshot**: `docs/beta/`, 39 immagini, tutte dalla build di rilascio di `f5a741c` (vedi «Screenshot»).
- Questa consegna non pubblica la build a un link.

**Che cosa questa beta non è.** Non è un via libera commerciale. Non dichiara 4–6 ore di gioco e non dice niente sul
divertimento né su quanto qualcuno pagherebbe: nessuna persona l'ha ancora giocata, tutte le partite misurate sono di
script. **Nessuna prova è stata fatta su hardware vero**: «mouse», «touch» e «controller» qui sotto sono input
simulati in Chromium senza schermo e senza GPU su Linux (mouse e tastiera di Playwright, eventi touch CDP, Gamepad API
simulata). L'app desktop è stata provata con Electron su Linux sotto Xvfb, senza client Steam. Niente in questo report
certifica Steam Deck, Windows, un controller o uno schermo touch veri.

## In breve

| | |
|---|---|
| Implementato | i 24 elementi del catalogo (i 6 dell'incremento 1 e 18 progetti da scoprire), smog leggibile, economia leggibile, temi delle città, salvataggi versione 3, rifinitura G5 (8 punti), 24 correzioni dopo la revisione finale; niente altro |
| Numeri del gioco | nessun numero degli edifici originali cambiato; senza oggetti del catalogo la simulazione è identica a `97248dd`: bilanciamento seminato (semi 42, 7, 1, 99) e attese seminate (5, 42, 3) uguali byte per byte, tutte le 314 righe di `npm run waits` presenti |
| Controlli statici | `tsc` 0 errori; `vitest` 428/428 in 47 file; `i18n:check` 826 chiavi × 8 lingue |
| Test end-to-end | 22/22 in due esecuzioni complete sulla build finale (21,7 e 21,5 minuti), nessun test rieseguito |
| Prima città senza catalogo | script, mouse simulato: finale verde al giorno 10, 2 stelle su 3, 0 oggetti e 0 moduli; gioco libero (seme 4242): finale al giorno 9 |
| Dopo il finale | «Continua a costruire» conserva la città; salvataggio, ricarica della pagina e caricamento tornano alla stessa città |
| Prestazioni (scena pesante, 11 minuti) | 59,4 fotogrammi al secondo (il browser headless si ferma a 60), 0,2% dei fotogrammi oltre 33 ms, memoria stabile |
| App desktop | Electron 33 su Linux sotto Xvfb: 24/24, salvataggi su file scritti e riletti |
| Problemi aperti | nessun critico, nessun alto; il medio (documenti che davano Steam Deck per «testato») corretto in questa consegna; 1 basso aperto |
| Non verificato | hardware vero, Windows, Steam Deck, client Steam, schermi touch veri, suono, playtest con persone |

## IMPLEMENTATO

### Le 24 voci del catalogo

Ogni oggetto occupa **una casella**. I moduli non occupano caselle: vanno nell'unico slot di un edificio completato.
«cr» crediti, «pz» pezzi, «rt» rottami. Il rimborso è sempre metà del prezzo, arrotondato per difetto. «Fila»: si posa
trascinando col tasto sinistro del mouse. I 18 progetti si scoprono in qualsiasi città, campagna o gioco libero.

| # | id | Nome | Categoria | Costo | Ingombro | Rotazioni / varianti | Effetto | Sblocco | Rimborso e regola |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `floor` | Pavimento industriale | Costruzione | 3 cr a casella | superficie, sotto edifici e oggetti; fila | — | nessuno; ci si costruisce sopra e riappare dopo una demolizione | sempre (0.7.0-alpha.1) | 1 cr; una superficie per casella |
| 2 | `fence` | Recinzione | Costruzione | 4 cr a casella | solida; fila | 2 (si vede solo da sola) | nessuno; si raccorda con recinzioni, muri, pilastri e cancelli allineati | sempre | 2 cr |
| 3 | `gate` | Cancello | Costruzione | 12 cr | solida | 2 versi | nessuno; si allinea alle recinzioni | sempre | 6 cr |
| 4 | `lamp` | Lampione | Decorazione | 10 cr + 2 pz | solida | 4 direzioni | luce di notte | sempre | 5 cr + 1 pz; si sposta |
| 5 | `bench` | Panchina | Decorazione | 6 cr | solida | 4 direzioni | nessuno | 10 cittadini | 3 cr; si sposta |
| 6 | `planter` | Fioriera | Decorazione | 5 cr | solida | 1; tulipani o girasoli, dalla casella | nessuno | 300 rottami raccolti | 2 cr; si sposta |
| 7 | `sign` | Insegna al neon | Decorazione | 15 cr + 4 pz | solida | 4 direzioni; muso di bot, frecce del riciclo o cuore, dalla casella | accesa di notte | 25 edifici completati | 7 cr + 2 pz; si sposta |
| 8 | `pergola` | Pergola | Decorazione | 12 cr | solida | 2 orientamenti | nessuno | 50 cittadini | 6 cr; si sposta |
| 9 | `cathouse` | Casetta di Miso | Decorazione | 10 cr | solida | 4 direzioni | nessuno (Miso non cambia abitudini) | accarezza Miso 3 volte | 5 cr; si sposta |
| 10 | `sculpture` | Scultura di rottami | Decorazione | 10 cr + 20 rt | solida | 4 direzioni; occhi accesi di notte | nessuno | Guglia completata | 5 cr + 10 rt, i rottami solo fin dove il deposito ha spazio (la cifra mostrata è quella pagata); si sposta |
| 11 | `base` | Basamento in cemento | Costruzione | 4 cr a casella | superficie, sotto edifici e oggetti; fila | — | nessuno; ci si costruisce sopra | 10 edifici completati | 2 cr; una superficie per casella |
| 12 | `wall` | Muro basso | Costruzione | 2 cr + 4 rt a casella | solida; fila | 2 (si vede solo da solo) | nessuno; si raccorda come la recinzione | 1.000 rottami raccolti | 1 cr + 2 rt, i rottami solo fin dove il deposito ha spazio |
| 13 | `pillar` | Pilastro d'angolo | Costruzione | 6 cr | solida | — | nessuno; muri e recinzioni ci si attaccano da ogni lato; luce in cima di notte | 20 oggetti del catalogo posati | 3 cr |
| 14 | `tree` | Albero | Decorazione | 8 cr | solida | 1; palma, cipresso o acero rosso, dalla casella | nessuno (né smog né felicità) | 20 cittadini | 4 cr; si sposta |
| 15 | `fountain` | Fontana | Decorazione | 25 cr + 5 pz | solida | — | nessuno; getto d'acqua animato, fermo con il movimento ridotto | 10.000 crediti guadagnati | 12 cr + 2 pz; si sposta |
| 16 | `statue` | Statua di USA-9 | Decorazione | 20 cr + 10 pz | solida | 4 direzioni; occhi accesi di notte | nessuno | 40 edifici completati | 10 cr + 5 pz; si sposta |
| 17 | `dockStorage` | Deposito aggiuntivo | Modulo | 30 cr + 15 pz | slot sul tetto dell'Hangar Bot | — | magazzino dell'Hangar Bot 80 → 180 rottami | sempre (0.7.0-alpha.1) | 15 cr + 7 pz; togliendolo si perdono i rottami oltre la nuova capacità (la conferma dice quanti) |
| 18 | `smelterFilter` | Filtro antismog | Modulo | 45 cr + 20 pz | slot laterale della Fonderia | — | smog +2,1 → +0,8 al giorno, energia −2 → −3, stessa produzione | sempre (0.7.0-alpha.1) | 22 cr + 10 pz |
| 19 | `recyclerMagnet` | Separatore magnetico | Modulo | 40 cr + 15 pz | slot laterale del Riciclatore | — | ciclo 2 → 1,5 s (pezzi +33%) | 100 pezzi prodotti | 20 cr + 7 pz; alternativo al selezionatore |
| 20 | `recyclerSorter` | Selezionatore di precisione | Modulo | 40 cr + 15 pz | slot laterale del Riciclatore | — | 3 pezzi per ciclo invece di 2, ciclo 2 → 3 s | 400 pezzi prodotti | 20 cr + 7 pz; alternativo al separatore |
| 21 | `factoryArm` | Braccio doppio | Modulo | 90 cr + 30 pz | slot laterale della Fabbrica 2PM | — | ciclo 3 → 2 s (crediti +50%) | 5.000 crediti guadagnati | 45 cr + 15 pz |
| 22 | `podsCapsule` | Capsula abitativa | Modulo | 35 cr + 15 pz | slot sul tetto della Capsule Bot | — | alloggi 6 → 9 | 30 cittadini | 17 cr + 7 pz; la conferma dice quanti cittadini se ne vanno |
| 23 | `solarTracker` | Pannelli orientabili | Modulo | 60 cr + 40 pz | slot sul tetto del Campo Solare | — | energia +5 → +7 | 30 di energia prodotta (Campi Solari o Inceneritori) | 30 cr + 20 pz; la conferma dice se l'energia non basta più |
| 24 | `purifierNozzle` | Ugello esteso | Modulo | 50 cr + 30 pz | slot laterale del Purificatore | — | raggio di bonifica 5 → 8 caselle | 10 caselle di melma bonificate | 25 cr + 15 pz |

Le fasi dei progetti (MODULAR-INC2 §4): inizio 5–6, 9, 11, 14, 19 (separatore, panchina, casetta, fioriera, basamento,
albero); sviluppo 7, 12, 13, 20, 21, 22, 23, 24; completamento 8, 10, 15, 16.

**Regole comuni** (con mouse, touch e controller)
- Il costo è in vista prima di comprare. Si paga una volta sola, alla conferma; anteprima, rotazione in mano e
  annullamento (`Esc`, tasto destro, `B`, «Fatto») sono gratis. Dopo una posa lo strumento resta in mano.
- Si posa su terreno o erba, mai su edifici, spazzatura, melma, macerie o un altro oggetto solido; l'anteprima rossa
  dice il motivo a parole. Una fila trascinata salta gratis le caselle non valide e, rilasciata sopra un pannello o la
  barra, non posa e non paga niente.
- Costruzioni e decorazioni non hanno effetto su economia, felicità, smog, allineamento, stelle o achievement: le città
  del pilota automatico con decine di pezzi su caselle libere giocano byte per byte come le stesse città senza.
- Solo le 10 decorazioni si spostano («Sposta» nel loro pannello): gratis, nessun rimborso, nessun contatore; rotazione
  e aspetto vanno con l'oggetto. Costruzioni, moduli ed edifici non si spostano.
- Moduli: un solo slot per edificio (i due del Riciclatore si escludono: «Slot occupato da Separatore magnetico:
  rimuovilo prima»); solo su un edificio completato; pagati dalla città in cui si installano; rimborso a metà alla
  rimozione e alla demolizione, mostrato prima.
- Un progetto non scoperto non si compra da nessun input (clic, tocco, `A`, fila, pannello dell'edificio): il rifiuto
  dice traguardo e progresso e non costa niente. Oggetti e moduli già presenti in una città caricata restano e
  funzionano; prima di toglierli un avviso dice che non si potranno ricomprare finché il progetto non è scoperto.
- Un doppio clic, un doppio tocco o `A` `A` non comprano, non rimuovono e non confermano mai due volte, nemmeno dentro i
  dialoghi: una sola regola per tutto il gioco (`src/ui/presses.ts`, 600 ms).

### Moduli: valori nominali, effettivi e compromessi

**Nominale** = a piena energia (`buildingStats`, la sola fonte che usa la simulazione). **Effettivo** = in quel
momento, con la quota di energia, gli straordinari (×1,5 per 60 s) e la pausa (`effectiveStats`, la stessa formula
della simulazione). Il pannello dell'edificio mostra le due colonne «A piena energia» e «Ora». I test unitari
(`tests/modules.test.ts`) controllano che quello che la simulazione fa sia quello dichiarato, nominale ed effettivo.
La colonna «effettivo» qui sotto è letta dagli screenshot 08–15, una città preparata con 13 di energia prodotta su 22
richiesti (59%).

| Modulo | Edificio | Nominale (prima → dopo) | Effettivo al 59% di energia | Compromesso | Nella fase di risparmio per la Guglia (`npm run waits`) |
|---|---|---|---|---|---|
| Deposito aggiuntivo | Hangar Bot | magazzino 80 → 180 rottami | 180 (non dipende dall'energia) | costa pezzi; togliendolo si perdono i rottami oltre la capacità | non aiuta mai: 0 città su 5 in cui si installa, peggiora in 3 (+26, +26, +35 s) |
| Filtro antismog | Fonderia | smog +2,1 → +0,8 al giorno; energia −2 → −3 | smog +0,5 al giorno; ciclo della Fonderia 2,7 s invece di 1,6 | più energia, stessa produzione | aiuta in 1 su 3 (Scrapbot City industriale −76 s), peggiora in 1 (Neon Heights industriale +43 s) |
| Separatore magnetico | Riciclatore | ciclo 2 → 1,5 s; pezzi 60 → 80 al minuto | ciclo 2,5 s; 47 pezzi al minuto | rottami 90 → 120 al minuto; energia −2 → −4 | il solo che aiuta più volte: 3 su 5 (da −21 a −35 s); peggiora a 2PM Company Town industriale (+20 s) |
| Selezionatore di precisione | Riciclatore | 3 pezzi per ciclo invece di 2; ciclo 2 → 3 s; pezzi 60 → 60 al minuto con rottami 90 → 60 | ciclo 5,1 s; 35 pezzi al minuto | gli stessi pezzi al minuto quando i rottami abbondano | 0 su 5, peggiora in 3 |
| Braccio doppio | Fabbrica 2PM | ciclo 3 → 2 s; crediti 600 → 900 al minuto | ciclo 3,4 s; 532 crediti al minuto; smog +3,2 al giorno | pezzi 40 → 60 al minuto; smog +3,6 → +5,4 al giorno; energia −4 → −6 | 0 su 2, peggiora in 2 (+45, +78 s) |
| Capsula abitativa | Capsule Bot | alloggi 6 → 9 | 9 | energia −1 → −2; ogni alloggio costa più di una Capsule Bot nuova (risparmia spazio) | 0 su 5, peggiora in 5 |
| Pannelli orientabili | Campo Solare | energia +5 → +7 | +7 (chi produce energia non rallenta) | 60 cr + 40 pz, più del Campo Solare, per +2 | 0 su 2, peggiora in 2 |
| Ugello esteso | Purificatore | raggio di bonifica 5 → 8 caselle | raggio 8; una casella di melma ogni 10,2 s invece di 6; aria −2,8 al giorno invece di −4,8 | energia −3 → −4; stessa velocità di bonifica e stessa pulizia dell'aria | 0 su 1 |

- **Nessun modulo domina** (`docs/WAITS.md`, sezione 0.7): nessuno accorcia l'attesa della Guglia in tutte le città in
  cui si installa, e nessuno batte la mossa migliore che c'era già (quasi sempre un Riciclatore in più, 50 crediti). La
  misura è di un pilota automatico, con una sola sequenza casuale per città (sotto i 20–30 s è rumore), e guarda solo
  la fase di risparmio per la Guglia, non a cosa servono i moduli nel resto della partita.
- **Combinazioni**: una tabella di più moduli nella stessa città non è stata misurata. Dai numeri: ogni edificio porta
  un solo modulo; l'unico che dà energia (pannelli orientabili, +2) copre il consumo in più di un separatore, di un
  ugello o di una capsula, ma non i loro altri costi (rottami consumati, smog, prezzo in pezzi).
- Con gli straordinari (evento della storia) produzione e smog fanno ×1,5 per 60 s anche sopra i moduli di velocità; la
  bonifica no. I propulsori (bot +30%) non toccano nessun modulo.

### Sblocchi: ritmo e primi minuti

`npm run pace`: il pilota automatico gioca le 5 città della campagna e 2 semi di gioco libero, ciascuno verde e
industriale (14 partite), fino a 45 minuti di gioco a velocità 1. L'uscita è identica a quella di `97248dd` (cambia solo
la riga della versione). Sono tempi di uno script che gioca in fretta, non di una persona.

| Fase | Progetto | Traguardo | Minuto di gioco: mediana [min–max] | Partite | Prima della Guglia |
|---|---|---|---|---:|---:|
| inizio | Basamento | 10 edifici | 0:58 [0:27–2:52] | 14/14 | 14 |
| inizio | Separatore magnetico | 100 pezzi prodotti | 1:17 [1:06–1:33] | 14/14 | 14 |
| inizio | Panchina | 10 cittadini | 1:29 [1:16–2:08] | 14/14 | 14 |
| inizio | Fioriera | 300 rottami raccolti | 1:33 [1:08–2:10] | 14/14 | 14 |
| inizio | Albero | 20 cittadini | 2:44 [2:22–4:36] | 14/14 | 14 |
| inizio | Casetta di Miso | 3 carezze a Miso | — | 0/14 | — |
| sviluppo | Pannelli orientabili | 30 di energia prodotta | 2:59 [0:26–17:17] | 12/14 | 8 |
| sviluppo | Capsula abitativa | 30 cittadini | 4:06 [3:16–6:16] | 14/14 | 14 |
| sviluppo | Muro basso | 1.000 rottami raccolti | 4:09 [2:26–7:18] | 14/14 | 14 |
| sviluppo | Insegna al neon | 25 edifici | 4:34 [2:21–16:55] | 14/14 | 13 |
| sviluppo | Braccio doppio | 5.000 crediti guadagnati | 5:50 [3:34–22:40] | 14/14 | 7 |
| sviluppo | Selezionatore di precisione | 400 pezzi prodotti | 5:55 [4:05–8:09] | 14/14 | 14 |
| sviluppo | Ugello esteso | 10 caselle di melma bonificate | — | 0/14 | — |
| sviluppo | Pilastro d'angolo | 20 oggetti del catalogo posati | — | 0/14 | — |
| completamento | Fontana | 10.000 crediti guadagnati | 9:25 [6:50–34:10] | 14/14 | 7 |
| completamento | Statua di USA-9 | 40 edifici | 11:02 [4:51–17:50] | 14/14 | 5 |
| completamento | Scultura di rottami | Guglia completata | 11:53 [8:33–16:40] | 14/14 | alla Guglia |
| completamento | Pergola | 50 cittadini | 11:54 [8:26–19:29] | 14/14 | 6 |

- **I tre progetti mai raggiunti dal pilota** sono un limite del pilota: non accarezza il gatto (casetta), non posa
  oggetti del catalogo (pilastro) e bonifica poca melma (ugello). In una prova a parte, partite verdi con fino a 3
  Purificatori accanto alla melma: 10 caselle bonificate tra 1:15 e 6:29 in 5 città su 7; a Rustbay (6 caselle di melma
  all'inizio) e Greenvale (8) mai entro 45 minuti in quelle partite. Il profilo dei progetti è uno solo, quindi
  l'ugello si scopre in un'altra città.
- **Primi minuti** (obiettivo della specifica: almeno tre elementi estetici usabili nei primi 5–10 minuti): in tutte le
  14 partite panchina, fioriera, basamento e albero sono scoperti e pagabili entro 5 minuti di gioco a velocità 1
  (l'ultimo, l'albero, a 4:36); nella prova dall'interfaccia di G4 (mouse simulato) entro 4:30. La casetta di Miso
  dipende dal giocatore. Nessuna soglia è stata ritoccata.

### Il resto dell'incremento 2 (dettaglio in `CHANGELOG.md`)

- **Smog leggibile (G0)**: nuvole sopra chi inquina in quel momento, foschia che cresce con lo smog della città, fumi
  sulla melma; un clic o un tocco sul misuratore apre «Da dove viene e dove va» con fonti, pulizia e totale al giorno,
  calcolati dalla simulazione (le parti sommano al ritmo vero). Nessun numero cambiato.
- **Economia leggibile (G1)**: il pannello di ogni edificio dice i numeri veri «A piena energia» e «Ora» e la causa
  dello stato a parole (in pausa, energia insufficiente, mancano materiali, pezzi tenuti da parte, cantiere…);
  «+N in attesa» accanto ai rottami; i consigli di USA-9 puntano al collo di bottiglia vero.
- **Catalogo e progetti (G2–G4)**: 18 elementi nuovi, raccordi di muri e pilastri, «Sposta» per le decorazioni;
  categorie Costruzioni / Decorazioni / Moduli con i filtri Tutti / Disponibili / Da scoprire; quattro stati con
  parola e icona; notifica «Nuovo progetto» con «Apri»; profilo `projects` versionato, che cresce soltanto.
- **Temi delle città**: Rustbay, Neon Heights, Greenvale e 2PM Company Town con terreno, scenario e luce propri; solo
  grafica.
- **Salvataggi**: versione 3 (il carico dei bot non si perde più); una copia di sicurezza prima di sovrascrivere un
  salvataggio di un'altra versione; i salvataggi 0.5, 0.6 e 0.7.0-alpha.1 si caricano.
- **Comodità**: una sola regola per il doppio clic, il doppio tocco e `A` `A`; un secondo clic nello stesso punto
  raggiunge l'edificio o il pezzo nascosto dietro quello disegnato davanti; il tasto sinistro non sposta mai la mappa.
- **Rifinitura G5**: nomi della barra dentro la loro scheda in 8 lingue; messaggi ripetuti mostrati una volta con ×N;
  testi di aiuto con i comandi dell'input in uso (tastiera e mouse, tocco, controller); schede del menu con la città
  isometrica; testo nitido a 100–200%; catalogo più comodo sulle finestre basse; pannello dello smog e catalogo aperti
  insieme senza coprirsi; smog notturno col colore della notte della città.
- **Suite end-to-end nel repository** (`npm run e2e`, 22 test).

### Correzioni dopo la revisione finale

Una revisione indipendente in tre lenti (risorse, input, aspetto) sulla build `70a28f4` ha trovato 24 problemi. Tutti
sono stati riprodotti e corretti (19 commit da `e198ba7` a `85848fc`, poi `f5a741c` per il CHANGELOG); ogni correzione ha un test che
fallisce prima e passa dopo, e ogni commit da solo passa `tsc` e `vitest`. Due problemi sono stati trovati da due lenti e
contano due volte.

| Gravità | Quanti | Quali |
|---|---:|---|
| critici o alti | 10 | doppia pressione su «Ricomincia questa città» che cancellava il salvataggio della città (due lenti); doppia pressione su «Invia» del dirigibile cargo che inviava due volte, con la commissione del 10% persa (due lenti, anche `A` `A`); uscire durante il conto alla rovescia dello smog sostituiva il salvataggio di inizio giornata e il «riprova» perdeva di nuovo; città di addestramento tenuta: «Salva e torna al menu» non salvava niente; doppia pressione su «Costruisci» nel consiglio di USA-9 che comprava l'edificio; doppia pressione su «Salva partita» / «Carica partita» che sovrascriveva o caricava uno slot; una pressione subito dopo l'arrivo di un evento della storia ne prendeva la scelta; `Y` sul controller con una decorazione selezionata consumava un consiglio gratuito |
| medi | 6 | consiglio che ignorava un Riciclatore messo in pausa; versione desktop: un file danneggiato letto in silenzio dal `.bak` e un `projects.sav` danneggiato che bloccava di nuovo l'ultima scoperta; un secondo salvataggio della versione 2 nello stesso slot migrato senza copia; ricominciare una città con un salvataggio illeggibile lo cancellava senza copia; controller: caselle delle Impostazioni irraggiungibili, parte degli Extra impossibile da scorrere |
| bassi | 8 | doppio clic su «Impostazioni» che cambiava «Riduci le animazioni»; doppio clic su «Fatto» a 1024×640 che cambiava scheda del catalogo; su nel menu principale che saltava una voce; un clic su «Avanti» del tutorial perso passando dal tocco al mouse; selezione spostata di una parte di pixel dopo una panoramica col tasto destro; scritta della build sotto il logo; scritta a mano sopra «Dai forma alla città»; un trofeo che copriva i pulsanti di un finale |

La correzione della versione desktop è stata verificata con lo store dei file in Node e `electron/main.cjs` caricato con
un modulo `electron` simulato, non con Electron vero; l'app desktop intera è stata poi riprovata con Electron vero su
Linux (vedi «App desktop»).

## VERIFICATO

Tutto sulle build di `f5a741c` qui sopra, salvo dove detto. Accanto a ogni prova: l'input usato.

### Controlli statici e numeri

| Controllo | Input | Esito |
|---|---|---|
| `tsc --noEmit` | — | 0 errori |
| `vitest` | — | 428/428 in 47 file (378 su `97248dd`) |
| `i18n:check` | — | 826 chiavi in 8 lingue, segnaposto e tag uguali all'inglese |
| Bilanciamento seminato, semi 42, 7, 1, 99 | — | identico byte per byte a `97248dd` |
| Attese seminate, semi 5, 42, 3 | — | identiche byte per byte a `97248dd` |
| `npm run waits` | — | tutte le 314 righe di `97248dd` presenti, nello stesso ordine; la divisione verde rigoroso / industriale / ibrido uguale riga per riga a `docs/WAITS.md` |
| `npm run pace` | — | identico a `97248dd` |
| File dei numeri del gioco (`defs.ts`, `piecedefs.ts`, `projects.ts`, `sim.ts`, `state.ts`) | — | invariati da `97248dd`; in `src/game/` cambia solo `hints.ts` (il consiglio del Riciclatore in pausa) |

`tsc`, `vitest`, `i18n:check` e il confronto dei numeri sono stati rifatti per questo report su una copia pulita di
`f5a741c`, con gli stessi esiti del verificatore finale.

### Test riproducibili

```sh
npm run typecheck
npm test                  # vitest: 428 test in 47 file, circa 20 s
npm run i18n:check
npm run waits             # sequenza casuale fissa: ogni esecuzione dà la stessa uscita
npm run pace              # idem
npm run e2e               # 22 test nel browser, circa 22 minuti con 2 test alla volta su 4 core
npm run e2e -- items-pad  # un test; npm run e2e:list li elenca con il loro input
```

`npm run e2e` cerca Playwright fuori dal progetto (non è una dipendenza: `PLAYWRIGHT_MODULE`, poi la risoluzione di
Node, poi `/opt/node22/lib/node_modules`) e costruisce da sé le due build in `.cache/e2e/<commit>/`.

**Confronto dei numeri** con un'altra versione: `npm run balance` da solo usa `Math.random` senza seme e non dà due
volte la stessa uscita, quindi non va confrontato così com'è. Si confrontano invece le uscite con `Math.random`
sostituito da un generatore con seme, sulle due versioni:

```js
// seeded.mjs — uso: node seeded.mjs <seme> <script.mjs>
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
let st = Number(process.argv[2]) | 0;
Math.random = () => {
  st = (st + 0x6d2b79f5) | 0;
  let t = Math.imul(st ^ (st >>> 15), 1 | st);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
await import(pathToFileURL(resolve(process.argv[3])).href);
```

```sh
npx esbuild scripts/balance.ts --bundle --platform=node --format=esm --outfile=out/balance.mjs
npx esbuild scripts/wait-analysis.ts --bundle --platform=node --format=esm --outfile=out/waits.mjs
for s in 42 7 1 99; do node seeded.mjs $s out/balance.mjs > out/balance-s$s.txt; done
for s in 5 42 3;    do node seeded.mjs $s out/waits.mjs   > out/waits-s$s.txt;   done
node out/waits.mjs > out/waits.txt
# le stesse righe su una copia di 97248dd, poi: cmp (balance-*, waits-s*) e «ogni riga di prima c'è ancora» (waits.txt)
```

### Test end-to-end

`npm run e2e` sulla build finale, due esecuzioni complete, 2 test alla volta su 4 core con altri lavori in corso sulla
macchina: **22/22 tutte e due le volte** (21,7 e 21,5 minuti), nessun test rieseguito. Ogni test usa la build indicata;
l'aggancio della build di debug serve solo a leggere la città e a preparare una scena (scritto nel log del test), e ogni
pressione passa dall'input del test. Nessun test usa risorse infinite.

| Test | Input (simulato) | Build | Controlli | Cosa verifica |
|---|---|---|---:|---|
| release-smoke | mouse e tastiera | rilascio | 26/26 | niente aggancio né risorse di rete, dialoghi del menu, una città, il catalogo, 120 tasti che non cambiano le risorse |
| items-mouse | mouse e tastiera | debug | 304/304 | i 24 oggetti: prezzo, presa, rotazione, posa pagata una volta, spostamento, salvataggio, ricarica, rimozione con rimborso mostrato = pagato, moduli installati e tolti |
| items-touch | touch CDP | debug | 302 e 301 (cambia il numero di panoramiche tra le due esecuzioni) | come sopra |
| items-pad | Gamepad API | debug | 296/296 | come sopra |
| comfort-mouse / -touch / -pad | uno per riga | debug | 281/281 ciascuno | regole di comodità sui 24 oggetti, doppie pressioni, panoramiche, pannello dello smog |
| discovery-mouse / -touch / -pad | uno per riga | debug | 32/32 ciascuno | profilo nuovo, schede e filtri, quattro stati, notifica con «Apri», progetto e trofeo insieme |
| module-slots | mouse | debug | 14/14 | lo slot del Riciclatore nei cinque stati |
| saves | mouse | debug e rilascio | 67/67 | slot, autosalvataggi, salvataggi 0.6 e 0.7.0-alpha.1 con copia di sicurezza, carico dei bot |
| double-press-mouse / -touch / -pad | uno per riga | debug | 21, 21, 19 | doppie pressioni a 120 e 450 ms su Rimuovi, Demolisci, Installa, Sposta, Fatto |
| covered-mouse / -touch / -pad | uno per riga | debug | 6/6 ciascuno | una recinzione dietro un edificio raggiunta col secondo clic |
| left-mouse | mouse | debug | 11/11 | il tasto sinistro non sposta mai la mappa |
| fit | nessuno (misure nel DOM) | debug | 168/168 | barra, catalogo, pannelli, angoli del menu e trofeo sopra un finale in 8 lingue a 1024×640, 1280×720, 1280×800, 1920×1080 |
| campaign-home | mouse | debug | 4/4 | la prima città della campagna fino al finale con soli edifici |
| cities | mouse | rilascio | 20/20 | le cinque città, di giorno e di notte |

### Partite normali fino alla Guglia

Uno script gioca attraverso l'interfaccia (mouse e tastiera simulati, italiano, profilo nuovo, «costruttore verde» a
velocità 3, nessuna risorsa preparata), sulla build di debug, dove l'aggancio legge soltanto la città. Nessun oggetto del
catalogo né modulo prima della Guglia.

| | Campagna, Scrapbot City | Gioco libero, seme 4242 |
|---|---|---|
| Guglia piazzata | giorno 9 | giorno 8 |
| Finale verde | giorno 10, 2 stelle su 3 (manca «Raggiungi 50 cittadini») | giorno 9 |
| Tempo di gioco | 9,97 giorni (10,0 minuti a velocità 1) | 8,85 giorni (8,8 minuti a velocità 1) |
| Tempo reale dello script | 3,7 minuti | 3,4 minuti |
| Controlli | 15/15 | 14/14 |

Dopo il finale. Campagna: «Continua a costruire qui» tiene gli stessi 39 edifici e le stelle, passa più di un giorno
senza un altro finale, si costruiscono un Giardino Pixel dalla barra e una panchina dal catalogo; «Menu principale
(questa città è salvata)» scrive la città nel suo slot (tempo 704,8, stessi crediti); ricaricata la pagina, «Continua» e
poi la mappa della regione («Continua Giorno 13») riaprono la stessa città, che va avanti. Gioco libero: «Continua a
costruire» tiene la città; «Salva partita» nello slot 2, ricarica della pagina, «Carica partita»: la stessa città;
«Salva e torna al menu», poi «Continua»: la stessa. Sono partite di uno script: non dicono quanto giocherà una persona.

### App desktop (Electron su Linux)

Electron 33.4.11 sotto Xvfb, build di rilascio, nessun client Steam, mouse simulato: **24/24**.
- `npx electron .` parte e resta aperto; il processo principale scrive «Steam not available: Cannot find module
  'steamworks.js'» e, per il resto, solo avvisi del server X.
- Città nuova di gioco libero: un Riciclatore (crediti 150 → 100), poi pavimento, recinzione e lampione dal catalogo,
  ciascuno pagato una volta (3, 4 e 10 crediti). A velocità 3 si scopre il primo progetto e `projects.sav` lo scrive.
- «Salva partita» nello slot 1, «Menu principale», «Esci»: il processo termina con codice 0. Riaperto: «Continua»
  riapre la città; «Carica» slot 1 e «Salva» slot 2 danno la stessa città su disco. Chiudere la finestra termina con
  codice 0.
- File in `~/.config/Scrapbot City/saves` (qui con `XDG_CONFIG_HOME` di prova): `save_1`, `meta_1`, `save_2`, `meta_2`,
  `save_auto`, `meta_auto`, `last`, `projects`, `achievements`, `migrated`, `tutorial-done` e le copie `.bak`; tutti si
  leggono come JSON, nessun file `.tmp` lasciato.

### Adattamento delle finestre in 8 lingue

- `fit` (e2e): 168/168 in tutte e due le esecuzioni.
- Una prova in più del verificatore (`fitx`, misure nel DOM): 24 dialoghi e pannelli, notifica e trofeo, i due finali, in
  8 lingue a 4 misure: 758/758.
- Nomi della barra degli edifici (rifinitura G5): testo sul bordo della scheda in 10 casi su 40 prima, 0 su 40 dopo (8
  lingue × 1024×640, 1024×768, 1280×720, 1280×800, 1920×1080).

### Due quartieri con gli stessi oggetti di gioco

Una città di gioco libero normale (seme 2026), costruita dall'interfaccia vera col mouse simulato, con il solo denaro di
partenza e un profilo di prova con i 18 progetti già scoperti (scritto prima del caricamento, come lo scrive il gioco).
La città ha guadagnato da sé il denaro dei due quartieri giocando a velocità 3, con gli eventi della storia risposti:
**33/33**.
- **Cortile industriale** accanto a un Hangar Bot e a una Fonderia: 13 muri trascinati in fila, 4 pilastri d'angolo, un
  cancello, 12 basamenti, 2 lampioni, una scultura di rottami.
- **Piazza verde**: 16 recinzioni, 12 pavimenti, 3 alberi, fontana, statua, 2 panchine, 2 fioriere, pergola, casetta
  di Miso, insegna al neon.
- Tutti i 73 acquisti registrati: ogni passo ha mosso le risorse esattamente del suo prezzo (0 passi sbagliati).
  Salvata di giorno nello slot 1 e di notte nello slot 2 dal menu di pausa, riaperta nella build di rilascio con «Carica
  partita» (screenshot 21–24).

### Vecchi script ritirati

Gli script delle verifiche precedenti con fallimenti noti prima di G5 (fuori dal repository) sono stati rieseguiti sulla
build finale: nessuno mostra un difetto del gioco, e quello che controllavano lo controlla ora la suite e2e. Sono
ritirati, con il motivo scritto in `e2e/README.md`: `saves-v4` e `dbl-mouse` (premevano a meno di 600 ms, cosa che il
gioco ora ignora di proposito; `saves-v4` con pressioni a 700 ms passa 74/74), `ui-saves` (48/1 come su `97248dd`: lo
script non vede mai «stabile» il clic su Rimuovi), `release-keys` (non conosce la copia di sicurezza con l'impronta),
`fixture-07a1` e `fixture-06-release` (si aspettavano la versione 2 dei salvataggi), `hidden-fence` (schede del catalogo
cambiate), `label-sweep-1024-de` (chiedeva una cosa che il gioco non promette, vedi «Limiti noti»), `play.mjs` sulla
campagna (si fermava su un dialogo comparso da solo; sostituito da `campaign-home`).

## NUMERI

### Prestazioni

**Scena pesante.** Neon Heights (tema neon), quasi sempre di notte: 61 edifici finiti, 13 moduli, 350 pezzi del
catalogo (260 solidi di tutti i 14 tipi e 90 pavimenti e basamenti), 23 bot, cittadini da 7 a 90, velocità 3. Preparata
con l'aggancio sulla build di debug (edifici, pezzi e denaro messi con le regole del gioco, eventi spenti), poi aperta
nella **build di rilascio** con «Continua». È una scena per le prestazioni, non una prova di bilanciamento.

Macchina: Intel Xeon a 2,30 GHz, 4 core, 15,7 GB di memoria; Chromium 141 headless, **nessuna GPU** (WebGL su
SwiftShader); finestra 1280×800 a densità 1; carico medio della macchina 1,7–1,8 con altri lavori in corso.

| Prova | Durata reale | Fotogrammi | Tempo di un fotogramma p50 / p95 / p99 | Massimo | Lavoro JS per fotogramma p50 / p95 / p99 | Memoria JS dopo GC (inizio / metà / fine) |
|---|---|---:|---|---|---|---|
| 1280×800 | 11 minuti (661,8 s; dal giorno 2 al giorno 34 di gioco) | 39.299 (59,4 al secondo) | 16,7 / 16,8 / 16,8 ms | 83 ms; 84 fotogrammi oltre 33 ms (0,2%), 9 oltre 50 ms | non misurato | 5,78 / 6,51 / 6,74 MB |
| 1280×800 | 4 minuti | — | — | — | 4,9 / 7,2 / 8,8 ms | 5,79 / 6,48 / 6,67 MB |
| 1920×1080 | 4 minuti | — | — | — | 4,6 / 6,8 / 8,4 ms | 5,78 / 6,48 / 6,68 MB |

- Solo di notte, nella prova da 11 minuti: p99 33,3 ms (52 fotogrammi oltre 33 ms su 14.690).
- Il browser headless si ferma a 60 fotogrammi al secondo, quindi i tempi dei fotogrammi mostrano quel limite; la colonna
  «lavoro JS» dice quanto dei 16,7 ms di un fotogramma usa il gioco (senza il disegno dei pixel da parte del browser).
- Nessun segno di perdite di memoria: le prove da 4 e da 11 minuti finiscono alla stessa memoria (la crescita è la città
  che si riempie); nodi del DOM (circa 1.000) e gestori di eventi (152–153) restano fermi.
- Questi numeri non dicono niente sulla GPU di uno Steam Deck o di un PC vero.

**Durata reale delle partite fino alla Guglia**: vedi «Partite normali fino alla Guglia» (3,7 e 3,4 minuti reali a
velocità 3 per uno script; 10,0 e 8,8 minuti di gioco a velocità 1).

### Due quartieri: quanto costano

| Quartiere | Pezzi | Costo |
|---|---|---|
| Cortile industriale | 4 pilastri (24 cr), cancello (12 cr), 13 muri (26 cr + 52 rt), 12 basamenti (48 cr), 2 lampioni (20 cr + 4 pz), scultura (10 cr + 20 rt) | 140 cr + 4 pz + 72 rt |
| Piazza verde | 16 recinzioni (64 cr), 12 pavimenti (36 cr), 3 alberi (24 cr), fontana (25 cr + 5 pz), statua (20 cr + 10 pz), 2 panchine (12 cr), 2 fioriere (10 cr), pergola (12 cr), casetta di Miso (10 cr), insegna (15 cr + 4 pz) | 228 cr + 19 pz |

Lo script li ha pagati con quello che la città guadagnava: il cortile nel giorno 1, la piazza entro la mattina del giorno
2 (con tutti i progetti già scoperti nel profilo di prova). È un dato dello script, non del ritmo di un giocatore.

### Attese (sintesi di `docs/WAITS.md`, nessun ritocco)

- In tutte le 10 partite del pilota (5 città × 2 percorsi) l'attesa più lunga è il risparmio per la Guglia: da 150 a
  614 s di gioco, cioè 3–10 minuti a velocità 1 e 1–3 minuti a velocità 3.
- La causa cambia con la città: crediti (Neon Heights e Company Town verdi), rottami che finiscono a Fonderie e
  Inceneritori (industriale), energia (Greenvale verde). Quasi sempre conviene un Riciclatore in più; a Company Town verde
  nessuna delle mosse provate aiuta.
- Nessuna variazione economica è proposta in questa consegna.

## LIMITI NOTI

Problemi residui per gravità, dopo la verifica finale indipendente di `f5a741c`.

**Critici**: nessuno. **Alti**: nessuno.

**Medi**
- *Documenti che davano per provato l'hardware* (corretto in questa consegna, solo testo): `docs/STEAM.md` diceva
  «Controller / Steam Deck (1280×800) ✔ testato», mostrava la lista «Steam Deck Verified» tutta con ✔ e dava la tastiera
  a schermo «✔ con steamworks.js», che non è installato; il README elencava «Controller e Steam Deck» e achievement
  «inviati a Steam». Ora dicono che il controller è stato provato solo simulato, che lo Steam Deck e la tastiera a
  schermo sono da provare e che il ponte verso Steam e Steam Cloud non sono ancora attivi.

**Bassi**
- *Pannello di un pezzo tagliato a 1024×640* (aperto, uguale su `97248dd`): il pannello scorre e la descrizione sta
  sotto il bordo; in tedesco, francese e portoghese, con un profilo nuovo, l'avviso «non ancora scoperto: rimosso non si
  potrà ricomprare» resta sotto il pulsante Rimuovi, e solo mezza riga visibile fa capire che si può scorrere.
- *Vecchi script non ritirati per iscritto*: chiuso in questa consegna (`e2e/README.md`, e sopra).

**Limiti di comportamento, voluti o già dichiarati**
- La regola del doppio tocco vale 600 ms: due pressioni più distanti sono due pressioni. `A` e poi `A` dopo 700 ms
  confermano «Sì, ricomincia» (è una conferma voluta); un doppio clic a 650 ms su un'impostazione la cambia.
- A zoom alto su una finestra piccola una scritta lunga sulla mappa può finire sotto un pannello (l'effetto del filtro
  in tedesco, circa 715 px, accanto al catalogo di 400 px a 1024×640): il gioco promette di evitarlo solo «quando c'è
  posto». Andare a capo su due righe sarebbe una decisione di prodotto.
- L'ugello esteso non si raggiunge in una città con poca melma (Rustbay, Greenvale nelle partite del pilota): si scopre
  altrove, il profilo è uno solo.
- L'identità al pixel con `97248dd` è dimostrata per Scrapbot City e il gioco libero (108 immagini su 108), non per la
  città affollata usata come prova, perché due prove sulla stessa build non danno le stesse immagini.
- Steam: achievement su Steam, Steam Cloud, overlay e tastiera a schermo dipendono da `steamworks.js` e da un App ID, che
  non ci sono. Il gioco gira senza Steam e non invia niente.
- Il pacchetto Steam (ramo `steam-package`, build Windows e Linux) non è stato rifatto da questa versione.

## DA PROVARE

Cose che solo hardware vero o persone vere possono dire. **Non è stato verificato**:
- **Steam Deck**: tutto il gioco col solo controller, leggibilità sullo schermo da 7", tastiera a schermo, prestazioni
  sulla sua GPU, sospensione e ripresa.
- **Windows**: l'app desktop non è mai stata avviata su Windows per questa versione (cartella dei salvataggi in
  `%APPDATA%`, scala dello schermo al 125–150%, `F11`, uscita).
- **Controller veri** (Xbox, PlayStation) e **schermi touch veri** (precisione del dito su oggetti piccoli; tocchi
  rapidi su caselle vicine a zoom 1).
- **Client Steam**: achievement, Steam Cloud tra due computer, overlay.
- **Suono**: nessuna prova ha ascoltato il gioco.
- **Playtest con persone** (`docs/PLAYTEST.md`): se l'economia si capisce dal pannello, dallo smog e dai consigli; se
  decorare è facile (catalogo, raccordi, «Sposta»); dove l'input dà fastidio (doppie pressioni, tocchi a zoom 1); dove si
  aspetta senza decidere; se dopo la Guglia e con gli sblocchi viene voglia di continuare.
- **Traduzioni** lette da madrelingua.
- **Durata, divertimento, prezzo**: non dichiarati. L'unico tempo misurato è quello di script che giocano in fretta (prima
  città in circa 10 minuti di gioco a velocità 1), e non dice quanto giocherà una persona. **Questa beta non è un via
  libera commerciale.**

## Prima di una release candidate

**Decisioni del proprietario**
- [ ] Il pannello di un pezzo a 1024×640 (limite basso aperto): lasciarlo, o portare l'avviso sopra il pulsante Rimuovi.
- [ ] Le scritte lunghe sulla mappa a zoom alto: lasciarle come sono o farle andare a capo.
- [ ] Il traguardo dell'ugello nelle città con poca melma: lasciarlo (si scopre altrove) o proporre un ritocco, solo
  come proposta separata con dati prima e dopo.
- [ ] Qualsiasi variazione economica: solo come proposta separata con dati prima e dopo, mai unita alla RC.
- [ ] `steamworks.js` è una dipendenza nuova: va decisa prima di collegare Steam.

**Hardware vero**
- [ ] Steam Deck: partita completa col solo controller, leggibilità a 1280×800, tastiera a schermo, prestazioni,
  sospensione.
- [ ] Windows 10 e 11: app desktop avviata, salvataggi in `%APPDATA%\Scrapbot City\saves`, chiusura e riapertura,
  scala dello schermo al 125–150%.
- [ ] Un controller vero su PC e uno schermo touch vero.
- [ ] Suono con cuffie e altoparlanti.

**Persone**
- [ ] Playtest con 10–20 persone secondo `docs/PLAYTEST.md` (metà non giocano ai city builder), con il questionario e
  i tempi registrati.
- [ ] Revisione delle 7 traduzioni da madrelingua.

**Steam**
- [ ] App ID, achievement creati in Steamworks, Auto-Cloud configurato, prova su un ramo `beta` di Steam.
- [ ] Pacchetto Steam rifatto da questo commit (ramo `steam-package`), con lo sha256 del `index.html` spedito uguale a
  quello qui sopra.
- [ ] `npm test`, `npm run e2e` e il confronto dei numeri rieseguiti sul commit della RC.
- [ ] Dichiarazione dei contenuti generati con l'IA in Steamworks (`docs/STEAM.md`, sezione 9).

## Screenshot

Tutti in `docs/beta/`, dalla **build di rilascio** di `f5a741c`, nominati come nella verifica finale. Per stare in un
peso ragionevole (5,7 MB invece di 17) sono ridotti a 256 colori: la differenza media dagli originali è sotto 2 livelli
su 255 per canale. Input: mouse simulato.

| File | Cosa mostra |
|---|---|
| `01-catalog-tab-costruzioni-filter-tutti.png` … `05-catalog-decorazioni-filter-da-scoprire.png` | il catalogo in italiano col denaro di partenza vero, con un profilo che ha 7 progetti scoperti: schede Costruzioni, Decorazioni e Moduli con il filtro Tutti, poi Decorazioni con Disponibili e con Da scoprire; righe «Acquistabile», «Da scoprire» con traguardo e progresso, «Non ora» col motivo («Mancano 20 rottami», «Solo su un Hangar Bot completato») |
| `06-notice-nuovo-progetto-apri.png`, `07-notice-apri-opens-catalog-row.png` | profilo nuovo, un Riciclatore posato col mouse: la notifica «Nuovo progetto: Separatore magnetico» con «Apri», e «Apri» che apre il catalogo su quella riga senza comprare niente |
| `08-…` … `15-module-…-on-building-panel.png` | ciascuno degli 8 moduli installato sul suo edificio, con il pannello aperto: colonne «A piena energia» e «Ora» (energia al 59%) e il pulsante Rimuovi col rimborso; nei pannelli del Riciclatore l'altro modulo è «Slot occupato» |
| `16-pieces-16-overview.png`, `17-pieces-16-closeup.png` | i 16 pezzi del catalogo, da lontano e da vicino |
| `18-smog-before-clean-0pct.png`, `19-smog-after-75pct-clouds.png`, `20-smog-after-75pct-smog-panel.png` | la stessa città con lo smog a 0 e al 75% (nuvole e foschia), e il pannello «Da dove viene e dove va» al 75% |
| `21-district-industrial-yard-day.png` … `24-district-green-square-night.png` | i due quartieri, di giorno e di notte (gioco in inglese) |
| `25-theme-home-day.png` … `34-theme-company-night.png` | le cinque città con i loro temi, di giorno e di notte (dal test e2e `cities`, 1920×1080) |
| `35-ending-first-city-green.png`, `36-ending-first-city-green-later.png` | il finale della prima città, «La Città Giardino», con un trofeo che compare sotto i pulsanti senza coprirli |
| `37-stress-neon-night-61-buildings-350-pieces.png` | la scena pesante delle prestazioni, di notte |
| `38-electron-linux-menu.png`, `39-electron-linux-city-pieces.png` | la finestra Electron su Linux: menu, e una città con un Riciclatore, un pavimento, una recinzione e un lampione |

**Come sono state preparate le scene.** 01–05: gioco libero nuovo col denaro di partenza; il profilo con 7 progetti è
scritto prima del caricamento. 06–07: profilo nuovo, partita giocata a velocità 3. 08–20: sulla build di debug la città
è preparata con l'aggancio (8 edifici finiti; 9.000 crediti, 900 pezzi e 100 rottami, una cifra finita; eventi spenti),
gli 8 moduli e i 16 pezzi sono comprati dal catalogo col mouse, lo smog è impostato a 0 e al 75%; la città è salvata in
tre slot e riaperta nella build di rilascio con «Carica partita». 21–24: vedi «Due quartieri». 25–34: test `cities`
sulla build di rilascio. 35–36: il salvataggio della partita fino alla Guglia, riaperto con «Continua» nella build di
rilascio. 37: vedi «Prestazioni». 38–39: app desktop su Linux. Gli screenshot 08–20 mostrano risorse preparate: non
dicono niente sul bilanciamento.
