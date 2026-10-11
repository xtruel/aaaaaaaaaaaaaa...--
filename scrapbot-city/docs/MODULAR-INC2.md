# Oggetti e moduli — incremento 2: 18 elementi, sblocchi a traguardi, smog leggibile

Sostituisce la versione precedente di questo documento (catalogo da 24 pezzi), su richiesta del proprietario
(«Aggiornamento del perimetro: potenziamenti, oggetti piazzabili e sblocchi»). Estende «Oggetti e moduli» della 0.7: nessun
secondo sistema di potenziamenti. Dopo questi 18 elementi l'espansione del catalogo si ferma (rifinitura, playtest,
pubblicazione). Restano fuori: mappa più grande, nuovi eventi, modalità infinita, altri sistemi.

Valgono tutte le regole dell'incremento 1 (`docs/MODULAR-INC1.md`): pagamento una volta sola alla conferma, anteprima e
annullamento gratis, rimborso a metà per difetto senza risorse duplicate, nessun modulo orfano, edifici vicini sempre
selezionabili, bot invariati (gli oggetti non li ostacolano), salvataggi compatibili. **Nessun numero degli edifici originali
cambia; la Guglia non costa di più; nessuna produzione rallenta per compensare.**

## 0. Ordine di lavoro (gruppi piccoli, ciascuno verificato e unito prima del successivo)

| Gruppo | Contenuto | Si chiude quando |
|---|---|---|
| G0 | Difetti da chiudere e verifica dei 6 elementi esistenti; **smog leggibile** (vedi §5) | suite dell'incremento 1 verdi sulla nuova build, smog visibile e spiegato, numeri invariati |
| G1 | 6 moduli funzionali (§2) | effetti misurati = dichiarati, pannelli con valori nominali ed effettivi, flussi di installazione/rimozione |
| G2 | 6 oggetti decorativi (§3) | acquisto, posa, rotazione, rimozione, salvataggio con tutti gli input |
| G3 | Sistema di sblocco (§4), catalogo con categorie e filtri | stati, progressi, notifiche, profilo, salvataggi vecchi, gioco libero |
| G4 | Integrazione finale, verifica completa, controllo indipendente, consegna (versione 0.7.0-beta.1) | report con implementato / verificato / da provare |

## 1. Catalogo finale: 18 elementi

| Categoria | Elementi | Disponibilità |
|---|---|---|
| Costruzioni | pavimento industriale, recinzione, cancello | sempre (incremento 1) |
| Decorazioni | lampione | sempre (incremento 1) |
| Decorazioni | **panchina, fioriera, insegna al neon, pergola, casetta di Miso, scultura di rottami** | progetti da scoprire (§4) |
| Moduli | deposito aggiuntivo (Bot Dock), filtro antismog (Fonderia) | sempre (incremento 1) |
| Moduli | **separatore magnetico e selezionatore di precisione (Riciclatore), braccio doppio (Fabbrica 2PM), capsula abitativa (Capsule Bot), pannelli orientabili (Campo Solare), ugello esteso (Purificatore)** | progetti da scoprire (§4) |

Le varianti di colore o di simbolo di uno stesso oggetto non contano come oggetti nuovi.

## 2. Moduli funzionali

Ogni edificio ha **un solo slot modulo**. I due moduli del Riciclatore sono alternativi nello stesso slot. Limite 1 per
edificio: nessun bonus cumulabile. Si installano solo su un edificio completato, si pagano con le risorse della città
corrente, non si applicano mai da soli agli edifici esistenti. Effetti immediati; rimborso a metà alla rimozione e alla
demolizione (mostrato prima).

| Modulo | Edificio (base) | Costo | Rimborso | Effetto (prima → dopo) | Compromesso |
|---|---|---|---|---|---|
| Separatore magnetico | Riciclatore (50 cr; 3 rt → 2 pz ogni 2 s; energia −2) | 40 cr + 15 pz | 20 cr + 7 pz | ciclo 2 → 1,5 s: +33% pezzi al secondo | energia −2 → −4; +33% rottami al secondo |
| Selezionatore di precisione | Riciclatore | 40 cr + 15 pz | 20 cr + 7 pz | 3 rt → 3 pz invece di 2: +50% pezzi per rottame | ciclo 2 → 3 s: pezzi al secondo invariati quando i rottami abbondano |
| Braccio doppio | Fabbrica 2PM (120 cr + 30 pz; 2 pz → 30 cr ogni 3 s; energia −4; smog 0,06 /s) | 90 cr + 30 pz | 45 cr + 15 pz | ciclo 3 → 2 s: +50% crediti al secondo | energia −4 → −6; smog 0,06 → 0,09 /s; +50% pezzi consumati al secondo |
| Capsula abitativa | Capsule Bot (50 cr + 20 pz; 6 alloggi; energia −1) | 35 cr + 15 pz | 17 cr + 7 pz | alloggi 6 → 9 | energia −1 → −2; costa di più per alloggio di una Capsula nuova (risparmia spazio) |
| Pannelli orientabili | Campo Solare (40 cr + 35 pz; energia +5) | 60 cr + 40 pz | 30 cr + 20 pz | energia +5 → +7 | investimento alto: costa più del Campo Solare stesso per +2 |
| Ugello esteso | Purificatore (70 cr + 50 pz; raggio 5; energia −3; −0,08 smog/s) | 50 cr + 30 pz | 25 cr + 15 pz | raggio di bonifica 5 → 8 | energia −3 → −4; **stessa velocità** (una casella di melma ogni 6 s) e stessa pulizia dell'aria |

Controllo con gli eventi esistenti: solo «propulsori» (bot +30% di velocità, permanente) e «straordinari» (produzione e smog
×1,5 per 60 s) danno potenziamenti. Nessun modulo duplica i propulsori; gli straordinari si sommano ai moduli di velocità
solo per 60 s (limitato, documentato nel pannello). Nessun altro sistema concorrente.

**Pannello dell'edificio**: per ogni valore che il modulo cambia, «prima → dopo» **nominale** (a piena energia) e il valore
**effettivo** in quel momento (con l'energia disponibile e gli straordinari: es. «Ciclo 1,5 s · effettivo 1,9 s, energia al
80%»). Stati: installato; slot occupato da un altro modulo («Slot occupato da Separatore magnetico: rimuovilo prima»);
progetto da scoprire (requisito e progresso); acquistabile; non acquistabile (motivo).

**Dati e simulazione (CORE)**: `ModuleKind` aggiunge `recyclerMagnet`, `recyclerSorter`, `factoryArm`, `podsCapsule`,
`solarTracker`, `purifierNozzle`; `ModuleDef` aggiunge `cycleMul`, `output`, `housing`, `cleanRadius` (in più a `storage`,
`pollutionMul`, `energy`); lo slot è unico per edificio (`moduleCheck` rifiuta un secondo modulo con il motivo).
`BuildingStats` = `{ energy, pollution, storage, housing, cycle, input, output, cleanRadius }`, sempre e solo da
`buildingStats(b)` / `buildingStatsWith(b, modules)`: `computeDerived` (alloggi), `runProcess` (ciclo, ingressi, uscite),
`cleanSludge` (raggio, **non** la cadenza di 6 s), smog ed energia. Nuovo `effectiveStats(s, b)` per i valori effettivi
mostrati (stessa formula della simulazione). Senza moduli tutto resta byte per byte come prima (`npm run balance` seminato,
`npm run waits`).

## 3. Oggetti decorativi

Oggetti solidi 1×1 con le regole dell'incremento 1 (terreno o erba, niente edifici o altri oggetti, mai in `s.occ`; spazzatura
mai sopra; i cittadini ci girano attorno; i bot ci volano sopra senza collisioni nuove). **Nessun effetto su economia,
felicità, smog, stelle o achievement.** Sagome proprie, stessa pixel art voxel.

| Oggetto | Costo | Rimborso | Rotazioni / varianti |
|---|---|---|---|
| Panchina | 6 cr | 3 cr | 4 direzioni |
| Fioriera | 5 cr | 2 cr | 1; due varietà di fiori scelte dalla casella |
| Insegna al neon | 15 cr + 4 pz | 7 cr + 2 pz | 4 direzioni; tre simboli senza testo (muso di bot, frecce del riciclo, cuore) scelti dalla casella; accesa di notte |
| Pergola | 12 cr | 6 cr | 2 orientamenti; struttura con rampicanti |
| Casetta di Miso | 10 cr | 5 cr | 4 direzioni; cuccia per il gatto della città, con cuscino e orma sul tetto; solo decorazione (Miso non cambia comportamento) |
| Scultura di rottami | 10 cr + 20 rt | 5 cr + 10 rt | 4 direzioni; robot fatto di rottami; usa i rottami in eccesso |

Rottami restituiti: al massimo lo spazio libero del deposito in quel momento; `pieceRefundAt(s, kind)` dà la cifra vera,
`removePieceAt` paga esattamente quella e l'interfaccia mostra quella. Codici salvati in coda: 4 bench, 5 planter, 6 sign,
7 pergola, 8 cathouse, 9 sculpture (1–3 restano fence, gate, lamp).

## 4. Sblocchi: progetti da scoprire

I 12 elementi nuovi sono **progetti**. Si scoprono raggiungendo traguardi di gioco che usano statistiche già registrate dal
gioco, **in qualsiasi città: campagna o gioco libero** (stessi traguardi, nessun obbligo di giocare la campagna). Nessuna
valuta di ricerca, nessun acquisto reale, nessun caso, nessuna attesa a tempo reale, nessuna ricompensa giornaliera. Nessun
traguardo obbliga a inquinare o a non inquinare. I 6 elementi dell'incremento 1 e tutti gli edifici restano disponibili
come prima. Nessun requisito circolare (nessun progetto richiede un altro progetto).

| Progetto | Traguardo (in una città) | Statistica | Fase |
|---|---|---|---|
| Separatore magnetico | Produci 100 pezzi | `stats.partsMade` | inizio |
| Panchina | Raggiungi 10 cittadini | `pop` | inizio |
| Casetta di Miso | Accarezza Miso 3 volte | `stats.catPets` | inizio |
| Fioriera | Raccogli 300 rottami | `stats.scrapCollected` | inizio |
| Capsula abitativa | Raggiungi 30 cittadini | `pop` | sviluppo |
| Selezionatore di precisione | Produci 400 pezzi | `stats.partsMade` | sviluppo |
| Ugello esteso | Bonifica 10 caselle di melma | `stats.cleaned` | sviluppo |
| Pannelli orientabili | Arriva a 30 di energia prodotta (Campo Solare o Bruciatori) | `derived.energyProd` | sviluppo |
| Insegna al neon | Costruisci 25 edifici | `stats.built` | sviluppo |
| Braccio doppio | Guadagna 5.000 crediti | `stats.creditsEarned` | sviluppo |
| Pergola | Raggiungi 50 cittadini | `pop` | completamento |
| Scultura di rottami | Completa la Guglia di Rottami (campagna o gioco libero) | `spireDone` | completamento |

**Stati nel catalogo** (e per i moduli anche nel pannello dell'edificio):
1. **Da scoprire**: anteprima (icona attenuata), descrizione, requisito e progresso nella città corrente («Pezzi prodotti
   120 / 400»); non si può comprare.
2. **Scoperto ma non acquistabile ora**: motivo («Mancano 20 crediti», «Serve una Fabbrica 2PM completata»).
3. **Acquistabile**.
4. **Modulo installato / slot occupato o non compatibile** (pannello dell'edificio).
Non si mostrano contenuti che non esistono nel gioco.

**Profilo**: i progetti scoperti stanno nel profilo locale (`storage.ts`, chiave `projects`, JSON versionato
`{ version: 1, discovered: [...] }`, anche nei salvataggi su file di Electron/Steam Cloud). Una volta scoperto un progetto
resta scoperto (non si riblocca se popolazione, felicità o smog cambiano). Ogni installazione si paga nella città corrente;
cambiare città non applica nulla. In gioco `GameState.unlocked` (solo in memoria, non nel salvataggio della città) viene
riempito dal profilo; `pieceCheck`/`moduleCheck` rifiutano i progetti non scoperti con il motivo, così nessun input può
aggirarlo.

**Salvataggi vecchi**: caricando una città salvata da 0.5/0.6/0.7.0-alpha.1 restano edifici, oggetti e moduli; i traguardi
ricostruibili dai dati salvati (statistiche, popolazione, Guglia, e le città con la Guglia nel profilo della campagna) scoprono
i progetti corrispondenti; nessun progresso storico inventato; scoprire un progetto non dà risorse (niente ricompense o
rimborsi duplicati).

**Notifica**: breve messaggio «Nuovo progetto: Panchina» con «Apri» che porta il catalogo a quella voce, senza comprare
nulla; raggiungibile con mouse, touch e controller.

**Catalogo**: tre categorie (Costruzioni, Decorazioni, Moduli) e filtri (Tutti · Disponibili · Da scoprire); nessun pulsante
nuovo nella barra degli strumenti.

## 5. Smog leggibile (G0)

Lo smog funziona (le fonti lo alzano, il filtro e i Purificatori lo abbassano, la felicità cala, sopra il 95% per 30 s la città
finisce), ma si vede poco: all'85% la città è appena velata e non si capisce da dove viene. Senza cambiare nessun numero:
- **sulla mappa**: nuvole di smog che si addensano attorno agli edifici che inquinano e sopra la melma, proporzionali a quanto
  emettono; foschia generale che cresce con lo smog della città già dal 20% (più scura e desaturata oltre il 50%, cielo
  coperto oltre l'80%); aria limpida sotto il 10%; con il movimento ridotto niente deriva; prestazioni invariate;
- **nell'interfaccia**: toccando o cliccando il misuratore di smog (o con il cursore del controller) si apre il dettaglio
  «da dove viene e dove va»: fonti (per tipo di edificio e melma), pulizia (Purificatori, Giardini), ricambio d'aria, totale
  al giorno, e la soglia del 95%; i numeri vengono da una scomposizione calcolata dalla simulazione con gli stessi totali.

Altri difetti da chiudere in G0: una fila trascinata rilasciata sopra un pannello o la barra **non posa niente e non paga
niente** (prima pagava caselle nascoste); con la ruspa, quando il clic toglierebbe un oggetto nascosto dietro un edificio, è
l'oggetto a essere evidenziato, non l'edificio.

## 6. Accettazione finale (G4)

1. Test unitari: regole, stati e progressi degli sblocchi (scoperta una sola volta, mai riblocco, profilo versionato,
   ricostruzione da salvataggi vecchi senza inventare), slot unico e alternativa del Riciclatore, effetti di ogni modulo
   misurati = dichiarati (nominali ed effettivi), rimborsi (anche in rottami) mostrati = pagati, nessuna risorsa creata in
   sequenze casuali con tutti i 18 elementi, salvataggi 0.6 e 0.7.0-alpha.1.
2. Playwright sulla build consegnata: scoperta di un progetto con la notifica che apre il catalogo; acquisto, posa,
   installazione, rimozione, salvataggio, chiusura e riapertura, cambio città e gioco libero; con mouse, touch CDP e Gamepad
   API simulata.
3. Prima città della campagna completata senza nessuno dei 12 elementi nuovi; nessuna combinazione di moduli annulla tutti i
   compromessi tra energia, materiali, smog e profitto (tabella misurata); quando si scopre ciascun progetto nelle partite del
   pilota automatico (verifica del ritmo inizio / sviluppo / completamento).
4. Suite esistenti verdi; prestazioni; screenshot dalla build consegnata (catalogo con stati e filtri, ogni modulo
   sull'edificio, le decorazioni, lo smog prima e dopo, la notifica di sblocco).
5. Nessuna affermazione su durata o divertimento senza playtest con persone.
