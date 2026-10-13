# Playtest di Scrapbot City — come farlo e cosa guardare

Il playtest serve a una cosa sola: vedere **dove si bloccano persone che non conoscono il gioco**.
Chi l'ha sviluppato non lo vede più: sa già dove cliccare.

Versione da provare: **0.7.0-rc.1** (`docs/RC-REPORT.md`, con gli sha256 delle build; il gioco è quello della
0.7.0-beta.1 di `docs/BETA-REPORT.md` con una sola correzione dell'interfaccia). Finora l'hanno giocata solo script,
con mouse, tocco e controller simulati: nessuna persona. Quello che il playtest misura (se si capisce, se è
comodo, dove ci si annoia, se viene voglia di continuare) nessuna partita simulata lo può sostituire, e nessuna
risposta del playtest va riportata come «ore di divertimento» o come «prezzo che la gente pagherebbe»: sono 10–20
persone, danno indicazioni, non stime.

## 1. Chi invitare

- **10–20 persone** in tutto, a gruppi di 5: dopo ogni gruppo si corregge e si riprova.
- Almeno metà **non** gioca abitualmente ai city builder: se capiscono loro, capiscono tutti.
- Qualcuno per lingua: le traduzioni (IT, DE, FR, ES, PT, PL, NL) vanno lette da madrelingua,
  soprattutto i testi lunghi (eventi, finali) e i nomi sui pulsanti degli edifici.
- Almeno 2 persone con **Steam Deck** o un controller, senza tastiera.
- Almeno 2 persone su uno **schermo touch** (tablet o portatile touch) e le altre col mouse: i tre input vanno provati
  tutti, e finora nessuno è stato provato su hardware vero.
- Se la build desktop per Windows è pronta, almeno 2 persone su Windows.

## 2. Come distribuirlo

| Fase | Strumento | Note |
|---|---|---|
| Amici e conoscenti | `dist/index.html` (un solo file) o il link della pagina web | Funziona in qualsiasi browser, anche da telefono per un primo sguardo |
| Gruppo più ampio | **Steam Playtest** (app gratuita collegata al gioco in Steamworks) | Chi si iscrive riceve la build; i dati non toccano le recensioni |
| Prima del lancio | **Demo** per lo Steam Next Fest | Tutorial + Scrapbot City: è già un pezzo chiuso |

Steam Playtest si attiva da Steamworks → *Playtest*: crea l'app collegata, carica la stessa build della beta,
apri le iscrizioni a un numero limitato di persone.

## 3. Le regole della sessione

1. **Non spiegare niente.** Se chiedono "cosa devo fare?", rispondi "cosa faresti?".
2. Chiedi di **pensare ad alta voce** ("ora cerco...", "non capisco perché...").
3. Registra lo schermo (OBS, o la registrazione di Steam) e annota i tempi come nella sezione 6.
4. 30–45 minuti di gioco (fino a 60 se la persona arriva vicino alla Guglia), poi 5 minuti di questionario (sezione 5).
5. Ogni persona parte da un **profilo nuovo**: nel browser una finestra privata o un profilo del browser nuovo; sul
   desktop un utente del sistema nuovo. Non cancellare mai i salvataggi di qualcuno per fare spazio a un playtest.

### Cosa non spiegare (né prima né durante)

Sono le cose che la 0.7 deve far scoprire da sole. Se la persona chiede, rispondi con una domanda; se è bloccata da più
di 2 minuti, aiuta e segna **bloccato** con il minuto.
- Che esiste il catalogo «Oggetti e moduli» (pulsante nella barra, tasto `O`) e cosa c'è dentro.
- Che i 18 oggetti nuovi sono progetti da scoprire con un traguardo, e che la notifica «Nuovo progetto» ha «Apri».
- Che un clic o un tocco sul misuratore dello smog apre «Da dove viene e dove va».
- Che il pannello di un edificio dice perché lavora piano o è fermo, e cosa cambia un modulo.
- Che recinzioni, muri, pavimenti e basamenti si posano trascinando una fila, e come si ruota (`R`, `Y`, «⟳ Ruota»).
- Che muri e recinzioni si raccordano con pilastri e cancelli, e che le decorazioni si spostano con «Sposta».
- Che un secondo clic nello stesso punto raggiunge l'edificio nascosto dietro un altro.
- Che i consigli di USA-9 dopo i 3 gratuiti costano crediti.
- Che dopo la Guglia si può continuare a costruire nella stessa città.
- Le regole del doppio clic e del doppio tocco (una seconda pressione entro 600 ms non compra niente).

## 4. Cosa osservare (e dove guardare nel codice)

| Momento | Domanda | Se va male |
|---|---|---|
| Menu | Trovano "New game" e la lingua? | `src/ui/menu.ts` |
| Tutorial passo 2 | Capiscono che i bot raccolgono da soli? | testi `tut.*` in `src/i18n/` |
| Dopo il tutorial | Seguono il bottone che pulsa nella barra (prossimo obiettivo)? | `tools` degli obiettivi in `src/game/story.ts` |
| Primo Recycler | Lo piazzano vicino ai rottami? Capiscono i pezzi? | `tut.recycler.*`, hint in `src/game/hints.ts` |
| Energia | Si accorgono che manca corrente? | avviso in `src/game/sim.ts`, chip energia nell'HUD |
| Smog | Capiscono la barra e il pericolo sopra il 95%? | `hud.smog*`, `msg.storm` |
| Scelte degli eventi | Leggono il testo o cliccano a caso? | `ev.*`, lunghezza dei testi |
| Suggerimenti | Li usano? Capiscono che dopo i 3 gratis costano? | `hint.*`, prezzo in `src/game/hints.ts` |
| Regione | Capiscono le stelle e la banca regionale? | `region.*`, `trade.*` |
| Controller | Riescono a costruire senza mouse? Il cursore è comodo? | `src/gamepad.ts`, `padFrame` in `src/session.ts` |

Segna ogni momento con: **bloccato** (chiede aiuto o resta fermo più di 30 secondi), **confuso**, **ok**, **divertito**.

### 0.7.0-beta.1: cosa osservare

Per ogni riga: guarda in silenzio, segna minuto e codice (**bloccato**, **confuso**, **ok**, **divertito**), e fai la
domanda solo alla fine, senza suggerire la risposta.

**Economia: si capisce?**

| Momento | Cosa guardare | Domanda alla fine | Se va male |
|---|---|---|---|
| Un edificio rallenta o si ferma | Aprono il pannello? Leggono la causa («Rallentato: poca energia (al 59%)», «Mancano materiali…») e fanno la cosa giusta? | «Quella macchina andava piano: sapevi perché?» | causa dello stato in `src/game/economy.ts` (`statusInfo`), pannello in `src/ui/hud.ts` |
| Colonne «A piena energia» e «Ora» | Le guardano? Capiscono la differenza? | «Che differenza c'era tra le due colonne?» | `src/ui/hud.ts` |
| Smog sulla mappa | Notano le nuvole sopra chi inquina e la foschia? Cliccano o toccano il misuratore? | «Sapevi da dove veniva lo smog?» | `src/ui/smog.ts`, nuvole in `src/render/renderer.ts` |
| Pannello «Da dove viene e dove va» | Dopo averlo letto agiscono (Purificatore, filtro, pausa di una Fonderia)? | «Cosa hai fatto per abbassarlo?» | testi `smog.*` in `src/i18n/` |
| Consigli di USA-9 | Il consiglio corrisponde a quello che manca davvero? Lo seguono? | «Il consiglio ti è servito?» | `src/game/hints.ts` |
| Moduli | Ne installano uno **per una ragione** (deposito pieno, smog alto, energia) o a caso? Capiscono il compromesso (più energia, più rottami)? | «Perché hai messo quel modulo? È servito?» | sezione «Moduli» del pannello, `src/ui/catalog.ts` |

**Decorare: è facile?**

| Momento | Cosa guardare | Se va male |
|---|---|---|
| Prima apertura del catalogo | Dopo quanti minuti, e per cosa? Lo trovano da soli? | posizione del pulsante, `src/ui/hud.ts` |
| Categorie, filtri e stati | Capiscono «Acquistabile», «Non ora» col motivo, «Da scoprire» col traguardo? Usano i filtri? | `src/ui/catalog.ts` |
| Notifica «Nuovo progetto» | La vedono? Premono «Apri»? Vanno poi a comprare l'oggetto? | notifica in `src/ui/hud.ts` |
| Primo pezzo | Capiscono l'anteprima rossa e il motivo, la rotazione, che lo strumento resta in mano dopo la posa? | motivi di `pieceCheck` in `src/game/pieces.ts` |
| File e raccordi | Scoprono la fila trascinata? Angoli e raccordi con pilastri e cancelli vengono come si aspettano? | `fenceMask` in `src/game/pieces.ts` |
| «Sposta» | Lo trovano? Si aspettano di spostare anche recinzioni e muri (che non si spostano)? | pannello del pezzo in `src/ui/hud.ts` |
| Togliere | Usano la ruspa o «Rimuovi»? Si stupiscono del rimborso a metà? | `src/game/pieces.ts` |

**Attrito degli input**

| Input | Cosa guardare |
|---|---|
| Mouse | Provano a trascinare la mappa col tasto sinistro (non la sposta mai: si usa il destro, il centrale o WASD)? Quante volte? |
| Tocco | Il dito sposta la mappa, il tocco posa: c'è confusione? A zoom 1 due caselle vicine distano 17,9 px: tocchi rapidi su caselle vicine possono essere rifiutati con «Troppo presto dopo la pressione di prima». Conta quante volte succede e se infastidisce. |
| Controller | Cursore comodo? `A`/`B` chiari? `Y` ruota l'oggetto in mano: lo scoprono? Si perdono nei menu o nei dialoghi lunghi (la levetta destra scorre)? |
| Doppie pressioni | Segna ogni doppio clic o doppio tocco fatto per abitudine e cosa succede: non deve mai comprare o confermare due volte. Il messaggio «Troppo presto…» confonde? |
| Edifici coperti | Riescono a selezionare un edificio nascosto dietro un altro (secondo clic nello stesso punto)? |

**Attese: dove ci si ferma**

Nelle partite simulate il tratto più lungo senza costruire è il risparmio per la Guglia: 3–10 minuti di gioco a
velocità 1 (`docs/WAITS.md`). È un dato sulle **priorità dello script**, non una prova che il gioco sia lento: «non
costruire» non vuol dire «essere bloccati» (si può controllare gli impianti, scegliere una specializzazione,
riorganizzare i consumi, decorare, guardare la città che lavora). Segna il minuto in cui la persona **smette di prendere
decisioni e si limita ad accelerare**, e subito dopo chiedi, senza suggerire la risposta:

> «Che cosa volevi fare in quel momento, e cosa te lo impediva?»

La risposta separa tre problemi diversi: non capire il prossimo passo; non sapere come avere più pezzi; aver capito tutto e
trovare l'attesa poco interessante. Solo il terzo è un problema di ritmo. Gli oggetti del catalogo devono aggiungere
libertà, non riempire l'attesa: chi risparmia pezzi per la Guglia ha buone ragioni per non spenderli in decorazioni.

**Voglia di continuare**

| Momento | Cosa guardare |
|---|---|
| Finale della prima città | Scelgono «Continua a costruire qui» o la mappa della regione? Cosa fanno nei 5 minuti dopo? |
| Dopo la Guglia | **Tornano a sistemare la città** (recinzioni, pavimenti, decorazioni) senza un obiettivo che lo chieda? È la domanda più importante di questa versione. |
| Sblocchi | Un progetto «Da scoprire» li fa puntare a un traguardo («mi mancano 20 cittadini per la pergola»)? O lo ignorano? |
| Stelle mancanti | Provano a prenderle? |

## 5. Questionario breve (5 minuti, dopo la partita)

Leggi le domande ad alta voce e scrivi le risposte con le parole della persona. Non correggere, non spiegare.

1. Con parole tue: di cosa parla il gioco?
2. Quando una macchina andava piano o era ferma, sapevi perché? (sì · a volte · no) Come l'hai capito?
3. Lo smog: sapevi da dove veniva? (sì · a volte · no) Cosa hai fatto per abbassarlo?
4. Il catalogo «Oggetti e moduli»: l'hai aperto? Quando, e per fare cosa?
5. Decorare la città è stato: 1 faticoso · 2 · 3 · 4 · 5 facile. Cosa ti ha dato fastidio?
6. C'è stato un clic, un tocco o un pulsante che ha fatto una cosa che non volevi? Quale?
7. C'è stato un momento in cui aspettavi senza niente da fare? Quando?
8. **La domanda decisiva:** «Dopo aver capito come funziona, ti è venuta voglia di costruire ancora qualcosa? Cosa?»
   (Non «ti piace la grafica?».)
9. Verde o industria: cosa hai scelto e perché?
10. Lo consiglieresti a un amico? A chi?

Facoltativa, alla fine: «Lo compreresti? A quale prezzo ti sembrerebbe giusto?». Con 10–20 persone è un'indicazione da
leggere insieme alle altre risposte, non una stima di vendite.

## 6. Come registrare i tempi (e cosa contare)

- Registra lo schermo dall'inizio alla fine. In un foglio, per ogni cosa notata: **minuto reale** dall'inizio della
  registrazione (mm:ss), **giorno e ora di gioco** (in alto a destra), **velocità** (1×, 2×, 3×), input, cosa succede,
  codice (bloccato · confuso · ok · divertito).
- Momenti da segnare sempre: tutorial finito o saltato; primo Riciclatore; prima apertura del catalogo; primo pezzo
  posato; prima notifica «Nuovo progetto» e se premono «Apri»; primo modulo installato; primo clic sul misuratore dello
  smog; primo consiglio chiesto e primo pagato; Guglia piazzata; finale; cosa fanno nei 5 minuti dopo.
- Da contare: doppie pressioni fatte per abitudine; tocchi rifiutati («Troppo presto…»); tentativi di spostare la mappa
  col tasto sinistro; minuti a velocità massima senza costruire prima della Guglia; città perse per lo smog.
- Tempo reale e tempo di gioco non sono la stessa cosa: un giorno di gioco dura 60 s a velocità 1, e a velocità 3 un
  secondo reale vale 3 s di gioco. I tempi del report (`npm run pace`, le partite fino alla Guglia) sono minuti di gioco
  di uno script che gioca in fretta: non confrontarli con i minuti reali di una persona, e non usare i minuti del
  playtest per dichiarare quante ore dura il gioco.

Numeri da riportare a fine giornata (mediana e intervallo, con il numero di persone):
- minuti per finire il tutorial (obiettivo: meno di 10) e quante persone lo saltano e poi si bloccano;
- minuti per la prima Scrap Spire nella prima città (obiettivo: 40–60);
- dopo quanti minuti aprono il catalogo per la prima volta (o se non lo aprono mai);
- quanti pezzi decorativi posano senza che serva a un obiettivo, e se continuano dopo la Guglia;
- quanti consigli usati e quanti pagati; quante città perse per lo smog (qualcuna va bene: insegna; tante vuol dire che
  l'avviso non si vede).

Il pilota automatico (`npm run pace`, `npm run waits`) rifà in pochi secondi il controllo dei tempi su tutte le città
dopo ogni modifica ai numeri in `src/game/defs.ts`; il playtest serve per tutto quello che un programma non sente.

## 7. Checklist prima di ogni build di prova

- [ ] `npm run typecheck`, `npm test`, `npm run i18n:check` senza errori; `npm run e2e` 22/22.
- [ ] Lo sha256 della build data ai tester scritto nel foglio della sessione (quelli della 0.7.0-rc.1 sono in
  `docs/RC-REPORT.md`).
- [ ] Partita nuova in ogni lingua: menu, tutorial fino in fondo, un evento, impostazioni.
- [ ] Steam Deck o controller: menu → campagna → costruire → pausa → salvataggio, senza toccare il mouse.
- [ ] Schermo touch: costruire, aprire il catalogo, posare e spostare una decorazione.
- [ ] Chiudere e riaprire il gioco: la città e la lingua devono tornare uguali.
- [ ] Finestra piccola (1024×640 e 1280×720) e grande (2560×1440): niente testi tagliati.
- [ ] Profilo nuovo pronto per ogni persona (sezione 3), senza cancellare salvataggi di nessuno.

## 8. Playtest automatico della 0.5.1: cosa è emerso e cosa è stato corretto

Prima dei playtest con persone vere, quattro "giocatori" automatici hanno giocato attraverso l'interfaccia vera
(clic sulla barra, clic sulla mappa, scelte negli eventi, controller): uno verde prudente, uno industriale,
uno che fa solo quello che dice USA-9, uno "sbadato" che costruisce solo industria. Più il tutorial passo passo,
una partita col solo controller e i casi limite (sconfitta per smog, banca, demolizione, slot, finale della regione).

| Problema trovato | Correzione |
|---|---|
| Nel tutorial il fumetto copriva l'HQ (dove si chiede di costruire) e la carta obiettivi | Il fumetto sceglie la posizione che copre meno HQ, obiettivi, barra e messaggi |
| Strada industriale bloccata: 13.000 crediti, 0 pezzi, 0 rottami, nessun modo evidente di uscirne | Fabbriche e Lab lasciano sempre una scorta di pezzi; i Riciclatori hanno la precedenza sui rottami; il "+" pulsa e apre un acquisto da 10/50/100 pezzi; costruendo senza pezzi il gioco offre "compra i pezzi mancanti e costruisci" |
| Strada verde: 300+ pezzi, zero crediti e giorni di attesa per la Guglia | Solare, Lab Riparatutto e Purificatore costano più pezzi e meno crediti; USA-9 consiglia di convertire i pezzi; con 30 cittadini e i crediti pronti, i Lab mettono da parte i pezzi per la Guglia |
| USA-9 consigliava doppioni già in cantiere ("pods full: 0 cittadini, 0 case"), un Purificatore da 100 crediti al giorno 1, "risparmia" a chi aveva 13.000 crediti | Consigli in ordine con la carta obiettivi, "aspetta il cantiere" gratuito, consigli ripetuti gratuiti, consiglio di importare quando mancano solo i pezzi |
| Città fantasma: 0 abitanti, felicità 5%, nessuna spiegazione | Avviso nel feed e consiglio gratuito: mettere in pausa o demolire l'industria (rimborso del 50%), poi giardini e Purificatore |
| La carta obiettivi restava ferma su "6/9 Costruisci una fonte di crediti" a città finita | Gli obiettivi superati dai progressi successivi vengono saltati |
| Lo stesso evento ("Spring cleaning") tornava 4 volte di fila | Un evento ripetibile aspetta almeno 4 giorni; finiti gli eventi nuovi, quelli vecchi arrivano più di rado |
| Sul pulsante dei suggerimenti a pagamento compariva "¢160", che sembra un prezzo in euro | Una monetina disegnata: si paga in crediti del gioco |
| Primo acquisto sbagliato (un pannello solare o una Fabbrica per primi) lasciava senza pezzi né crediti per il Riciclatore | Il Riciclatore costa solo crediti, e l'HQ dà una piccola rendita fissa (15 crediti al giorno): provate tutte le 20 "prime mosse sbagliate", nessuna blocca più la partita |
| Controller: focus sulla "×" dei dialoghi, due pressioni di A per ogni dialogo, "Travel" da cercare a mano | Focus sul primo pulsante utile, dialoghi semplici già pronti per A, focus automatico su "Travel here" |

Tempi misurati sui giocatori automatici della 0.5.1 (velocità normale; script, non persone): tutorial circa 5 minuti
di lettura; una città completa con 3 stelle in 12–20 minuti di gioco. Non sono la durata per una persona: da qui non
si ricava quante ore dura la campagna, e nessuna durata è dichiarata finché non c'è un playtest con persone.

Prestazioni (0.5.1, Chromium headless senza GPU, non hardware vero): 121 edifici e 35 bot a 60 fps fissi fino a
2560×1440, 10 MB di memoria.
