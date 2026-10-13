# Changelog

## 0.7.0-beta.1 — costruzione modulare, incremento 2: 24 oggetti, progetti da scoprire, smog leggibile

Tutto l'incremento 2 dopo la 0.7.0-alpha.1 (gruppi G0–G5, temi delle città, salvataggi), secondo
[docs/MODULAR-INC2.md](docs/MODULAR-INC2.md). Il catalogo si ferma a questi 24 oggetti.

### In breve: cosa noterà chi gioca

- Il catalogo «Oggetti e moduli» (`O`) passa da 6 a 24 oggetti, in tre categorie con tre filtri: 3 costruzioni nuove
  (basamento in cemento, muro basso, pilastro d'angolo), 9 decorazioni nuove (panchina, fioriera, insegna al neon,
  pergola, casetta di Miso, scultura di rottami, albero, fontana, statua di USA-9) e 6 moduli nuovi; ogni edificio ha
  uno slot per un modulo.
- I 18 oggetti nuovi sono **progetti da scoprire**: si sbloccano raggiungendo un traguardo in una città, e una notifica
  «Nuovo progetto» con «Apri» porta alla voce. I 6 oggetti della 0.7.0-alpha.1 e tutti gli edifici restano disponibili
  come prima.
- Le decorazioni già comprate si spostano gratis con «Sposta»; muri e recinzioni si raccordano con pilastri e cancelli.
- Lo smog si vede sulla mappa (nuvole sopra chi inquina, foschia sulla città) e un clic o un tocco sul misuratore apre
  il pannello con le fonti e la pulizia.
- Il pannello di ogni edificio dice i numeri veri, a piena energia e adesso, e a parole perché l'edificio lavora,
  rallenta o è fermo.
- Un doppio clic, un doppio tocco o `A` `A` non comprano, non rimuovono e non confermano mai due volte; un secondo
  tocco rifiutato perché arriva troppo presto dopo il primo lo dice.
- Un secondo clic nello stesso punto raggiunge l'edificio o il pezzo nascosto dietro quello disegnato davanti.
- I testi di aiuto nominano i comandi dell'input in uso (tastiera e mouse, tocco o controller); un messaggio ripetuto
  si mostra una volta sola con ×N.
- Rustbay, Neon Heights, Greenvale e 2PM Company Town hanno ciascuna il suo tema, anche di notte.
- I salvataggi conservano il carico dei bot (versione 3); prima di sovrascrivere un salvataggio di una versione
  precedente il gioco ne tiene una copia.
- Nessun numero degli edifici originali cambia: costi, produzioni e tempi sono quelli di prima.

### Catalogo dei 24 oggetti

- **Il pannello «Oggetti e moduli»** (pulsante nella barra accanto alla ruspa, tasto `O`): tre categorie
  (**Costruzioni**, **Decorazioni**, **Moduli**) e tre filtri (Tutti, Disponibili, Da scoprire, ciascuno con il suo
  numero), ricordati finché si gioca la città. Ogni voce mostra icona, nome, costo (anche in rottami), il suo stato con
  una parola e un'icona (vedi «Sblocchi»), effetto, «1 per casella» e, se non si può comprare, cosa manca. Gli stati
  cambiano sul posto, senza ridisegnare la lista (nessun clic perso). La didascalia delle Costruzioni non dice più
  «Decorazione». Un oggetto preso in mano si mostra nella sua categoria; una categoria premuta subito dopo averlo preso
  resta scelta.
- **Il catalogo sulle finestre basse**: fino a 760 px di altezza (1280×720, 1024×640) il pannello è un po' più largo e
  più compatto. Con un oggetto in mano, fino a 820 px di altezza (anche 1024×768 e 1280×800), la scheda dell'oggetto
  prende il posto della testata e le righe dicono nome, prezzo e stato (effetto e traguardo tornano quando l'oggetto si
  mette via, e la riga dell'oggetto appena messo via resta in vista): almeno due righe intere in vista in tutte le 8
  lingue (prima una a 1024×640; a 1024×768 alcune righe dei moduli erano più alte della lista e non si vedevano mai per
  intero). Ogni voce si porta per intero in vista in tutte le 8 lingue a 1024×640, 1024×768, 1280×720, 1280×800 e
  1920×1080.
- **Costruzioni**: pavimento industriale, recinzione e cancello (0.7.0-alpha.1) e tre nuove.
  - **Basamento in cemento**: 4 crediti a casella, rimborso 2. Una superficie come il pavimento industriale (lastre di
    cemento con il cordolo, diverse dalle piastre metalliche): ci si costruisce sopra, resta sotto l'edificio e
    riappare quando lo si demolisce; file trascinate col mouse; una superficie per casella («Qui c'è già il
    basamento», «Qui c'è già il pavimento»).
  - **Muro basso**: 2 crediti + 4 rottami a casella, rimborso 1 credito + 2 rottami (i rottami solo fin dove il
    deposito ha spazio in quel momento, come la scultura: «Rimuovi», la ruspa e la riga sotto il pulsante dicono la
    cifra vera e la rimozione paga quella); blocchi di rottami pressati; file trascinate; si raccorda come la recinzione.
  - **Pilastro d'angolo**: 6 crediti, rimborso 3. Muri e recinzioni ci si attaccano da ogni lato (un moncone verso
    ogni vicino); di notte si accende la luce in cima. Non si ruota.
- **Raccordi**: recinzioni e muri si raccordano con recinzioni, muri, pilastri e con i cancelli **allineati** (un
  cancello lungo x con i vicini a est e a ovest, lungo y con quelli a nord e a sud). Una recinzione o un muro da soli
  seguono la loro rotazione e si ruotano; raccordati seguono i vicini. **Recinzioni già posate**: cambiano aspetto solo
  dove ora un muro o un pilastro le raccorda, e dove stanno contro il fianco di un cancello: lì prima la recinzione
  entrava nel fianco del cancello (il limite noto dell'incremento 1), ora sta da sola nel verso della sua rotazione e
  si può ruotare. Le altre recinzioni e tutti i cancelli restano come prima. Nel catalogo la recinzione dice «Si
  raccorda con recinzioni, muri, pilastri e cancelli».
- **Decorazioni**: il lampione (0.7.0-alpha.1) e nove nuove, oggetti solidi da una casella con le regole del lampione:
  su terreno o erba, anche sopra il pavimento, mai su edifici, spazzatura, melma, macerie o un altro oggetto (con il
  motivo in parole: «C'è una panchina: rimuovila prima»); la spazzatura non ci cade mai sopra, i cittadini ci girano
  attorno, i bot ci volano sopra.
  - **Panchina**: 6 crediti, rimborso 3; 4 direzioni.
  - **Fioriera**: 5 crediti, rimborso 2; tulipani o girasoli, scelti dalla casella.
  - **Insegna al neon**: 15 crediti + 4 pezzi, rimborso 7 + 2; 4 direzioni; muso di bot, frecce del riciclo o cuore
    (scelti dalla casella); di notte si accende.
  - **Pergola**: 12 crediti, rimborso 6; 2 orientamenti; glicine rampicante.
  - **Casetta di Miso**: 10 crediti, rimborso 5; 4 direzioni; cuscino e orma sul tetto; Miso non cambia abitudini.
  - **Scultura di rottami**: 10 crediti + 20 rottami, rimborso 5 crediti + 10 rottami; 4 direzioni; di notte gli occhi
    si accendono quando guarda verso la camera. I rottami tornano **solo fin dove il deposito ha spazio** in quel
    momento: il pulsante «Rimuovi» del pannello dice la cifra vera (aggiornata mentre i bot riempiono il deposito, con
    una riga quando una parte non può tornare) e la rimozione paga esattamente quella, ruspa compresa.
  - **Albero**: 8 crediti, rimborso 4; palma, cipresso o acero rosso, scelti dalla casella; diverso dal Giardino Pixel
    e dagli alberi di contorno; nessun effetto su smog o felicità.
  - **Fontana**: 25 crediti + 5 pezzi, rimborso 12 + 2; vasca con il getto d'acqua che gioca (fermo con il movimento
    ridotto).
  - **Statua di USA-9**: 20 crediti + 10 pezzi, rimborso 10 + 5; 4 direzioni; di notte gli occhi si accendono quando
    guarda verso la camera.
- **Rotazione e pannello delle decorazioni**: si ruotano come il lampione (`R`, `Shift`+rotella, il pulsante
  «⟳ Ruota», `Y` sul controller), prima di posarle o dal loro pannello; l'anteprima mostra già direzione e aspetto
  (fiori, simbolo, albero) che avranno. Il pannello di una decorazione selezionata dice «Decorazioni», «Decorazione:
  nessun effetto sull'economia», «Ruota» se ruota e «Rimuovi (+rimborso)»; i pulsanti vengono prima della
  descrizione, così su una finestra bassa restano in vista (in tedesco la scultura ora si chiama «Schrottfigur», più
  corto).
- **Spostare le decorazioni già comprate** (lampione, panchina, fioriera, insegna, pergola, casetta di Miso, scultura,
  albero, fontana, statua): nel loro pannello «Sposta», poi la casella, con la stessa anteprima e le stesse regole di
  posa. Gratis: nessun pagamento, nessun rimborso, nessun contatore (gli oggetti posati restano quelli); rotazione e
  aspetto (fiori, simbolo, albero) vanno con l'oggetto, anche dopo il salvataggio. Esc, il tasto destro, `B` o «Fatto»
  lo lasciano dov'era; una casella non valida è rifiutata con il motivo e lo spostamento continua; un clic sull'oggetto
  stesso lo lascia lì. Durante lo spostamento `R`, `Shift`+rotella e `Y` ruotano l'oggetto (con `Y` mai un consiglio).
  Costruzioni (pavimenti, basamenti, recinzioni, muri, pilastri, cancelli), moduli ed edifici non si spostano.
- **Moduli macchina**: deposito aggiuntivo e filtro antismog (0.7.0-alpha.1) e sei nuovi, con la loro icona nel
  catalogo e nel pannello dell'edificio. Ogni edificio ha **un solo slot**: i due moduli del Riciclatore sono
  alternativi («Slot occupato da Separatore magnetico: rimuovilo prima», anche sulla mappa con lo strumento del
  catalogo). Si installano solo su un edificio completato; rimborso a metà alla rimozione e alla demolizione, mostrato
  prima. Nessun numero degli edifici cambia.
  - **Separatore magnetico** (Riciclatore, 40 cr + 15 pz): ciclo 2 → 1,5 s, pezzi 60 → 80 al minuto; rottami 90 → 120
    al minuto, energia −2 → −4.
  - **Selezionatore di precisione** (Riciclatore, 40 cr + 15 pz): 3 rottami → 3 pezzi invece di 2, ciclo 2 → 3 s: gli
    stessi 60 pezzi al minuto con 60 rottami invece di 90.
  - **Braccio doppio** (Fabbrica 2PM, 90 cr + 30 pz): ciclo 3 → 2 s, crediti 600 → 900 al minuto; pezzi 40 → 60 al
    minuto, smog 0,06 → 0,09 al secondo, energia −4 → −6.
  - **Capsula abitativa** (Capsule Bot, 35 cr + 15 pz): alloggi 6 → 9, energia −1 → −2.
  - **Pannelli orientabili** (Campo Solare, 60 cr + 40 pz): energia +5 → +7.
  - **Ugello esteso** (Purificatore, 50 cr + 30 pz): raggio di bonifica 5 → 8 caselle (anche l'anello sulla mappa),
    energia −3 → −4; stessa velocità (una casella ogni 6 s) e stessa pulizia dell'aria.
- **Costruzioni e decorazioni non hanno effetto su economia, felicità, smog, allineamento, stelle o achievement**:
  città del pilota automatico con decine di decorazioni, muri, pilastri, basamenti, alberi, fontane e statue (alcune
  spostate durante la partita) su caselle che la città non usa giocano byte per byte come le stesse città senza; dove
  un oggetto occupa una casella vale la regola di ogni oggetto solido (la spazzatura cade altrove, lì non si
  costruisce), con esiti identici a una recinzione sulla stessa casella.

### Sblocchi: progetti da scoprire

- **Progetti da scoprire** (docs/MODULAR-INC2.md §4): i 18 elementi nuovi si scoprono raggiungendo un traguardo in una
  città, campagna o gioco libero (anche il Campo Scuola), misurato sulle statistiche della città corrente: separatore
  magnetico 100 pezzi prodotti; panchina 10 cittadini; casetta di Miso 3 carezze; fioriera 300 rottami raccolti;
  basamento 10 edifici completati; albero 20 cittadini; capsula abitativa 30 cittadini; selezionatore 400 pezzi; ugello
  esteso 10 caselle di melma bonificate; pannelli orientabili 30 di energia prodotta (Campi Solari o Inceneritori);
  insegna 25 edifici; braccio doppio 5.000 crediti guadagnati; muro basso 1.000 rottami; pilastro 20 oggetti del
  catalogo posati (non la risorsa «pezzi»); pergola 50 cittadini; scultura la Guglia completata; fontana 10.000
  crediti; statua 40 edifici. I sei elementi dell'incremento 1 e tutti gli edifici restano disponibili come prima.
  Nessuna valuta di ricerca, nessun acquisto, nessun caso, nessuna attesa a tempo reale; nessun progetto richiede un
  altro progetto; scoprire non dà risorse; una volta scoperto un progetto resta scoperto. La scoperta legge soltanto la
  città (nessun `Math.random`).
- **Nessun ingresso lo aggira**: comprare un progetto non scoperto (clic, tocco, `A`, fila trascinata, installazione dal
  pannello) è rifiutato con il traguardo e il progresso («Progetto da scoprire: Produci 400 pezzi (120 / 400 in questa
  città)») e non costa niente; dal catalogo non si prende in mano. Oggetti e moduli che una città caricata ha già
  restano dove sono, si ruotano, si spostano e si tolgono come prima (prima di toglierli un avviso dice che non si
  potranno ricomprare finché il progetto non è scoperto).
- **Gli stati nel catalogo**: «Da scoprire» con il traguardo e il progresso («120 / 400 in questa città · massimo 260»,
  il massimo quando un'altra città è andata più avanti), «Non ora» con il motivo, «Acquistabile».
- **Pannello dell'edificio**: un modulo da scoprire mostra «Da scoprire», il traguardo e il progresso, con «Installa»
  spento; poi «Installabile», «Installato», «Slot occupato» (con il modulo che lo occupa), «Non ora» (con il motivo).
- **Notifica «Nuovo progetto: Panchina» con «Apri»**: apre il catalogo su quella voce, evidenziata, senza prendere né
  comprare niente; più progetti insieme fanno una notifica sola («Nuovi progetti (3)»). Sta sotto la barra in alto o
  sopra la barra degli edifici, dove non copre il fumetto del tutorial (anche quando il fumetto si sposta al passo
  dopo), i pannelli, la scheda dell'obiettivo né il punto del mouse, del cursore del controller o dell'ultimo tocco
  sulla mappa; resta ferma finché niente le va sopra, e se un pannello o il fumetto le va sopra si sposta, di nuovo
  lontano da quei punti; mentre compare o si sposta lascia passare i colpi alla mappa e «Apri» non prende il secondo
  colpo di un doppio clic. Un trofeo non sposta una notifica già ferma e una notifica nuova non compare sopra un
  trofeo (quando un progetto e un trofeo arrivavano insieme, come a 50 cittadini con pergola e trofeo o caricando un
  salvataggio vecchio, il trofeo le passava sul bordo, la notifica si spostava in basso lasciando passare i colpi e un
  clic diretto ad «Apri» con un oggetto in mano lo comprava sulla mappa). Un numerino sul pulsante «Oggetti e moduli»
  (nessun pulsante nuovo) conta i progetti che il catalogo non ha ancora mostrato.
- **Profilo dei progetti**: chiave `projects` (`{ version: 1, discovered: [...], best: {...} }`), nei file del gioco
  desktop come i salvataggi (`projects.sav`, Steam Cloud). `best` tiene per ogni traguardo il massimo raggiunto **in
  una** città: ricaricare la stessa città non somma niente, città diverse non si sommano. Il profilo cresce soltanto (i
  progetti si uniscono, i massimi salgono); un testo danneggiato (anche uno «versione 1» con un elenco o un massimo
  che non si legge) o di un'altra versione viene copiato a parte (`backup:projects:v…`) prima di essere riscritto, e i
  progetti che contiene si conservano. I progetti non stanno mai nel salvataggio della città; un salvataggio in uno
  slot dal menu di pausa scrive anche i massimi, come ogni altro salvataggio.
- **Salvataggi vecchi**: caricando una città di 0.5, 0.6 o 0.7.0-alpha.1 si scopre solo quello che i suoi dati provano
  (statistiche, cittadini, Guglia; e le città con la Guglia completata nel profilo della campagna), annunciato con la
  notifica: il salvataggio 0.6 di prova (211 pezzi, 594 rottami) scopre separatore magnetico e fioriera, quello
  0.7.0-alpha.1 (35 oggetti posati) il pilastro; una statistica che il salvataggio non ha conta 0.
- **Ritmo misurato** con `npm run pace` (pilota automatico, cinque città e gioco libero, verde e industriale, minuti a
  velocità 1): panchina, fioriera, basamento e albero usabili entro 5 minuti in tutte le 14 partite (e nella prova
  dall'interfaccia: entro 4:30); nessuna soglia ritoccata. È una misura del pilota automatico, non del tempo di un
  giocatore.

### Smog

- **Lo smog si vede sulla mappa.** Sopra ogni edificio che inquina in quel momento (Fonderia, Inceneritore, Fabbrica
  2PM) si forma una nuvola che il vento porta via in una scia: tanto più grande e densa quanto più smog emette
  l'edificio adesso (con l'energia che ha, con gli straordinari, con il filtro); un edificio in pausa, senza
  combustibile o senza materiale non fa nuvola. La Fonderia col filtro fa una scia piccola accanto al suo vapore chiaro.
  Sulla melma tossica strisciano fumi verdastri. Sopra il 10% la città si vela: polvere chiara verso il 20%, foschia
  scura e spenta oltre il 50%, cielo coperto di nuvole basse oltre l'80%; sotto il 10% l'aria è limpida. Di notte le
  nuvole prendono la luce della città e la foschia diventa un bagliore torbido. Con il movimento ridotto le nuvole
  restano ferme. Il fumo dei camini e il vapore del filtro restano come prima.
- **Fumo, vapore e animazioni seguono lo stato reale**: il fumo segue lo smog che l'edificio emette davvero (meno con
  poca energia, ×1,5 con gli straordinari, niente da fermo); il camino della Fabbrica tiene il suo fumo e lo scarico
  del braccio doppio aggiunge il fumo in più del modulo; l'ugello spruzza una nebbiolina mentre il Purificatore lavora;
  le gocce del Purificatore non salgono più quando è in pausa. Con il movimento ridotto niente particelle.
- **Da dove viene e dove va.** Un clic o un tocco sul misuratore dello smog (o il cursore del controller e `A`) apre un
  pannello con le fonti per tipo di edificio e la melma, la pulizia (Purificatori, Giardini Pixel) e il ricambio
  d'aria naturale, ciascuno al giorno, il totale al giorno, la soglia del 95% e, quando parte, il conto alla rovescia
  dei 30 secondi; segnala anche gli straordinari e l'energia che manca. I numeri sono quelli della simulazione: le parti
  sommano esattamente al ritmo con cui lo smog cambia. Si chiude con `Esc`, `B`, la × o un clic fuori. Misuratore,
  freccia e allarme restano come prima. In 8 lingue; i nomi lunghi vanno a capo invece di essere tagliati. Su una
  finestra molto bassa (1024×640) il pannello aperto prende il posto dell'allarme, di cui ripete il conto alla
  rovescia, così le liste restano visibili; mentre è aperto, i trofei compaiono in basso invece di coprirlo.
- **Pannello dello smog e catalogo aperti insieme**: sulle finestre larghe 1024 px il pannello dello smog finiva sotto
  il catalogo (7 testi su 12 coperti a 1024×640); ora sta tra la scheda dell'obiettivo e il catalogo, più stretto se
  serve; centrato come prima dove c'è posto.
- **L'allarme dello smog resta leggibile accanto al catalogo** sulle finestre basse (1280×720, 1024×640): il catalogo
  più largo copriva la fine dell'avviso del 95% (a 1024×640 anche i secondi rimasti); mentre il catalogo è aperto
  l'avviso sta nello spazio tra la scheda dell'obiettivo e il pannello, su più righe se serve.
- **Le scritte sulla mappa** (perché un edificio o un pezzo non va lì, l'effetto di un modulo) si disegnano sopra lo
  smog e il buio, come i numeri che salgono dagli edifici: restano leggibili anche nella foschia più fitta e di notte.

### Economia leggibile

- **Il pannello di ogni edificio legge la simulazione**: per ogni valore la colonna «A piena energia» (con il modulo) e
  la colonna «Ora» (con l'energia disponibile, gli straordinari, la pausa): energia, smog, ingressi e uscite di un
  ciclo, durata del ciclo, quanto produce e consuma al minuto, alloggi, deposito, raggio e ritmo della bonifica. Un
  edificio fermo per i materiali o per la riserva di pezzi segna «in attesa» e 0 al minuto. Durante gli straordinari
  una nota dice quanti secondi restano (si sommano ai moduli solo finché durano).
- **La causa dello stato, a parole e con un'icona** (non solo col colore): funziona normalmente; in pausa (l'hai
  fermato tu); fermo: energia insufficiente; rallentato: poca energia (al N%); mancano materiali (quali); in attesa:
  pezzi tenuti da parte per costruire (quanti); in costruzione (secondi rimasti); senza carburante.
- **Lo slot nel pannello**: per ogni modulo lo stato (installato · slot occupato · installabile · non ora, col motivo;
  «Da scoprire» per un progetto, vedi «Sblocchi»), costo e rimborso, prima → dopo a piena energia e, se installato, il
  valore di ora. «Installa» avvisa se lascerebbe la città senza energia sufficiente; «Rimuovi» e «Demolisci» dicono
  cosa si perde: rottami oltre il deposito che resta, cittadini oltre gli alloggi che restano, energia che non basta
  più.
- **I numeri giusti nel pannello**: la riga del deposito ha la sua unità («180 rottami», non «180») e occupa le due
  colonne; nelle schede dei moduli «Pezzi usati / min» e «Rottami usati / min» restano su una riga anche con la barra
  di scorrimento (colonne un po' più strette, barra sottile come negli altri pannelli; nelle lingue più lunghe le
  etichette vanno a capo tra le parole, mai dentro una parola). La descrizione di un edificio dice i suoi numeri veri:
  il Purificatore con l'ugello «nel raggio di 8 caselle», la Capsule Bot con la capsula 9 alloggi, il Campo Solare coi
  pannelli +7, il Riciclatore col selezionatore 3 pezzi, il Bot Dock col deposito aggiuntivo +180; senza modulo, e
  nella barra degli strumenti, le parole di sempre.
- **Pannello dell'edificio più compatto**: le colonne dei numeri stanno 6 px l'una dall'altra (come nelle schede dei
  moduli) e i pulsanti delle schede usano il corpo della scheda; in inglese «Sludge radius (tiles)», «Sludge tile every
  (s)» (prima «One sludge tile every (s)») e «Remove (+25 credits + 15 parts)» stanno su una riga a 1280×800 e a
  1024×640; nelle altre lingue le etichette lunghe vanno ancora a capo tra le parole, ma meno (righe in più: da 142 a
  102 su 48 pannelli misurati), nessuna più di prima, nessun testo che esce dal pannello. Il pannello di un altro
  edificio si apre dall'inizio, non più dove era scorso quello di prima.
- **«+N in attesa»** accanto al contatore dei rottami quando i bot ne hanno portati più di quanti ne stanno nel
  deposito; il suggerimento al passaggio del mouse spiega che entrano da soli appena c'è posto.
- **Consigli di USA-9** sul collo di bottiglia reale: con il deposito pieno e pochi crediti propone un convertitore
  (Lab Riparatutto o Fonderia, secondo il percorso) e non più un Bot Dock; un nuovo Riciclatore solo se c'è energia e
  ci sono rottami da lavorare, altrimenti «prima l'energia» o «niente rottami da riciclare» (l'energia conta gli
  edifici in costruzione: i consumi, i Campi Solari e i Bruciatori quando c'è rottame da bruciare). In «Prima
  l'energia» l'energia che avanza è quella che mostra la barra in alto (prodotta meno consumata); se gli edifici in
  costruzione ne useranno una parte, il consiglio lo dice a parte («ora te ne avanza 3, ma gli edifici in costruzione
  ne useranno altri 2») invece di dare un numero che contraddice la barra.
- **L'anello del Purificatore si legge**: invece di 72 puntini da un pixel quasi invisibili, un anello tratteggiato
  (trattini di due pixel con un bordino scuro sotto) e una velatura leggerissima sul terreno raggiunto, al raggio vero
  (5 caselle, 8 con l'ugello), anche per il fantasma quando lo si piazza; disegnato sul terreno, sotto edifici, bot e
  rottami, quindi non copre la mappa. Con il movimento ridotto i trattini stanno fermi.

### Comodità e input

- **Regole di costruzione** (brief §3), per tutti i pezzi del catalogo, con mouse, touch e controller: il costo è in
  vista prima di comprare, annullare è gratis, una posa paga una volta, dopo la posa lo strumento resta in mano.
- **Una sola regola per il doppio clic in tutto il gioco** (`src/ui/presses.ts`): un doppio clic, un doppio tocco o
  `A` premuto due volte durano fino a 500 ms (il doppio clic di Windows), letti con 100 ms di margine (600 ms: il gioco
  vede una pressione un po' dopo, il controller si legge una volta per fotogramma e due pressioni a 500 ms arrivavano
  anche a 515 ms), con il secondo colpo entro 10 px (mouse e controller) o 24 px (dito, perché i due tocchi di un dito
  non cadono mai nello stesso punto) e con lo stesso strumento in mano. La usano la mappa con uno strumento in mano, il
  catalogo, i pulsanti costosi del pannello dell'edificio, il secondo clic che raggiunge l'edificio nascosto e i
  pulsanti delle finestre. Un tasto o `A` non preme un pulsante di una finestra nei suoi primi 600 ms (prima 400 ms);
  una pressione a sé, dopo, risponde come prima. Un tocco su un'altra casella, o dopo un attimo, funziona come prima.
- **Cosa non fa più il secondo colpo di un doppio clic, doppio tocco o `A` `A`**:
  - sulla mappa non compra niente, né a cavallo tra due caselle (prima comprava due pezzi), né dietro una finestra o
    il pannello dello smog appena chiusi con quel doppio tocco (prima comprava un pezzo); sulla stessa casella viene
    rifiutato con il motivo, come prima; un tocco sulla mappa che chiude il pannello dello smog lo chiude e basta (il
    secondo tocco non conta come «la stessa casella» e non compra);
  - con la ruspa un doppio clic su una recinzione non toglie anche il pavimento sotto, e un doppio clic sull'edificio
    già selezionato non dà il messaggio (non cambia niente);
  - su una voce del catalogo o su «Fatto» non prende più un'altra voce quando la lista si sposta sotto il dito;
  - non conferma una demolizione o la rimozione di un modulo comparse dove era la prima pressione e non ricompra un
    modulo appena tolto: questi pulsanti ignorano una pressione per 600 ms dopo la precedente (nella 0.7.0-alpha.1 la
    soglia era 350 ms: una rimozione seguita da «Installa» dopo 352–450 ms ricomprava il modulo a prezzo pieno contro
    metà rimborso; anche col deposito del Dock). Una pressione a sé sulla conferma, dopo, funziona come prima.
    «Installa» ignora le pressioni solo sull'edificio a cui si è appena tolto il modulo: quello di un altro edificio,
    aperto subito dopo, funziona;
  - quando il primo colpo, con un edificio in mano e solo i pezzi mancanti, apre l'offerta di 2PM («compra i pezzi
    mancanti e costruisci»), il secondo non compra più (prima `A` `A` a 450–550 ms, o un secondo clic o tocco che
    cadeva sul pulsante dell'offerta, comprava i pezzi e costruiva; anche nella 0.7.0-alpha.1);
  - «Rimuovi» e «Installa» non lo prendono mai: su una fioriera, un albero o una fontana (che non si ruotano)
    «Rimuovi» compare dove era «Fatto» quando lo spostamento finisce, e un doppio colpo su «Fatto» toglieva la
    decorazione (rimborso a metà): con il touch e il controller ogni volta, col mouse a volte. Lo stesso, già prima
    (anche in 600e82d), per un oggetto o un edificio sulla destra della mappa, dove si apre il suo pannello: il primo
    colpo lo selezionava e apriva il pannello, il secondo cadeva su «Rimuovi» (l'oggetto tolto) o su «Installa» (un
    Bot Dock comprava il deposito, 30 crediti + 15 pezzi). Ora quel secondo colpo non fa niente; un colpo a sé, dopo,
    rimuove o installa come prima. Il secondo colpo di un doppio clic su «Sposta» non preme «Fatto» che prende il suo
    posto, e viceversa.
- **Tocchi veloci su caselle vicine**: a zoom 1 due caselle vicine distano 17,9 px, meno dei 24 px di un dito, e il
  secondo tocco era preso per un doppio tocco e rifiutato in silenzio; ogni tocco rifiutato allungava l'attesa, così
  sei tocchi a 300 o 450 ms ne compravano 1 su 6. Ora un tocco rifiutato lo dice («Troppo presto dopo la pressione di
  prima: premi di nuovo se era voluto», in tutte le lingue, come gli altri rifiuti) e non allunga l'attesa, che si
  conta dall'ultima pressione accettata: gli stessi sei tocchi ne comprano 3 su 6 (uno sì e uno no), da 650 ms 6 su 6,
  a zoom 2 sempre 6 su 6; un doppio tocco continua a non comprare mai due volte.
- **Un doppio clic che scivola oltre il bordo di una casella non posa una fila di due**: con il pavimento o la
  recinzione in mano, se il secondo clic di un doppio clic si spostava di pochi pixel sulla casella vicina prima del
  rilascio, diventava una fila di due caselle e comprava un secondo pezzo. Ora quella pressione conta come il secondo
  clic che è: sulla casella del primo può solo essere rifiutata, con il motivo («Qui c'è già il pavimento»), sulla
  casella vicina dice «Troppo presto dopo la pressione di prima». Una fila trascinata davvero (oltre 12 px) si posa
  come prima, anche subito dopo un clic; una pressione a sé, dopo 600 ms, pure.
- **`Y` sul controller con un oggetto del catalogo in mano non chiede mai un consiglio a USA-9**: con un pezzo che
  ruota lo ruota, con uno che non ruota (pavimento, fioriera, un modulo) dice «Fioriera: non si ruota» (anche `R` da
  tastiera). Prima `Y` con la fioriera in mano apriva un consiglio e consumava un consiglio gratis (o, finiti quelli,
  apriva la finestra per pagarlo). Senza oggetti del catalogo in mano `Y` resta il consiglio.
- **«Rimuovi» paga quello che dice nel momento in cui lo premi**: la cifra del pulsante di un oggetto selezionato si
  aggiorna a ogni fotogramma (prima ogni 100 ms): se un bot scaricava rottami tra l'aggiornamento e la pressione, la
  scultura poteva dire «+10 rottami» e renderne 4. Ora la scritta e il pagamento coincidono sempre.
- **La ruspa dice prima cosa rende**: sopra un oggetto o un pavimento che toglierebbe, la mappa mostra «Rimuovi (+5
  crediti + 4 rottami)», la cifra vera (i rottami della scultura solo fin dove il deposito ha spazio), come fa
  l'effetto di un modulo; il clic paga esattamente quella. Col mouse e col cursore del controller; col dito, che non
  ha un «sopra», la cifra resta nel pannello dell'oggetto e nella scritta che sale dopo la rimozione.
- **Si clicca quello che si vede**: un lampione o una decorazione davanti a un edificio prende il clic sui propri pixel
  (selezione, ruspa, evidenziazione); prima metà di un'insegna davanti al Quartier Generale selezionava l'edificio.
  Albero, fontana e statua prendono il clic sui propri pixel come le altre decorazioni; recinzioni, cancelli, muri e
  pilastri restano «trasparenti» al clic (un clic sopra raggiunge l'edificio dietro).
- **Edifici nascosti selezionabili** (studio della mappa §9): con la ruspa il clic va all'edificio che la ruspa mostra
  attraverso quello trasparente (il Giardino Pixel dietro la Guglia); senza ruspa un secondo clic nello stesso punto
  sul sopra-selezionato passa a ciò che nasconde (l'edificio o la recinzione, il cancello, il lampione su quella
  casella) e un terzo torna indietro; un doppio clic non conta (il secondo clic conta da 500 ms). L'edificio davanti
  diventa trasparente finché la selezione dura, anche quando il puntatore va sul pannello dell'edificio scelto per
  demolirlo (prima la Guglia tornava piena appena il puntatore lasciava la mappa). Con la ruspa una sola regola decide
  cosa prende il clic e cosa si illumina (`dozeTarget`): prima le macerie o la recinzione, il cancello, il lampione su
  quella casella, poi l'edificio che sta su quella casella dietro quello disegnato, poi quello disegnato. Sulla mappa la
  ruspa mostra come prima la casella sotto il puntatore.
- **Istruzioni per l'input in uso**: il gioco distingue tastiera e mouse, tocco e controller (un dito che tocca lo
  schermo prende il posto del controller, come già faceva il mouse) e ogni testo che dice come fare qualcosa usa i
  comandi giusti: azioni e ultimo consiglio del tutorial, aiuto del catalogo con un oggetto in mano (posa, fila,
  modulo, rotazione), aiuto di «Sposta», ultima riga dell'introduzione, consiglio della pausa, messaggi «tutorial
  saltato» e «macerie»; gli Extra elencano i comandi di tutti gli input, prima quelli in uso (aggiunta la riga del
  tocco). I testi sullo schermo cambiano sul posto quando il giocatore cambia input; i tasti sulle schede della barra
  si nascondono con il controller o il tocco. 18 testi nuovi e 4 riformulati (solo mouse) in 8 lingue; il test elenca
  ogni testo inglese che nomina un comando.
- **Messaggi ripetuti raggruppati**: una riga che torna mentre è ancora sullo schermo (7,2 s dopo l'ultima volta) si
  mostra una volta sola con il numero («Qui c'è già qualcosa ×3») e scende al posto più recente, invece di impilare
  copie che spingono via le altre notizie; solo lo stesso testo con lo stesso tono si raggruppa (un altro numero o un
  altro nome è un'altra riga) e niente aspetta: ogni riga compare nel fotogramma in cui arriva (il conto alla rovescia
  dello smog e gli avvisi di energia hanno un posto loro). Lo stesso trofeo in coda non si ripete.
- **Nomi della barra degli edifici dentro la loro scheda in tutte le 8 lingue**: sotto i 1280 px le schede sono larghe
  72 px e alcuni nomi sono una parola sola («Incineradora», «Naprawialnia», «Inceneritore», «Incinérateur»): uscivano
  sul bordo. Solo su quella scheda il nome perde la spaziatura tra le lettere e, se serve, rimpicciolisce di mezzo
  pixel alla volta (mai sotto 10 px); parole e significato restano gli stessi. Misurato a 1024×640, 1024×768,
  1280×720, 1280×800 e 1920×1080: testo sul bordo in 10 casi su 40 prima, 0 ora; da 1280 px in su non cambia niente.

### Salvataggi

- **Il carico dei bot non si perde più**: un salvataggio metteva i rottami che i bot stavano portando nel deposito solo
  fin dove ci stavano, e con il deposito pieno il resto spariva (3 bot dell'HQ: 165 rottami prima del salvataggio, 150
  dopo); lo stesso per il carico dei due bot di un Bot Dock demolito con il deposito pieno. Ora quello che non ci sta
  resta in attesa (`scrapPending`, scritto nel salvataggio) ed entra nel deposito appena c'è posto, contato una volta
  sola fra i rottami raccolti, come quando un bot scarica. I salvataggi passano alla **versione 3** (si leggono le
  versioni 1–3; una più nuova è rifiutata); quelli vecchi si caricano con 0 in attesa.
- **Una copia prima di ogni migrazione**: prima di sovrascrivere per la prima volta un salvataggio scritto da un'altra
  versione (0.6 e 0.7.0-alpha.1 scrivono la versione 2), il gioco ne tiene una copia identica, una volta sola per slot
  e versione (`backup:save:<slot>:v<n>` nel browser, `backup_save_<slot>_v2.sav` e `backup_meta_<slot>_v2.sav` sul
  desktop, sincronizzate con Steam Cloud); se la copia non si può scrivere il vecchio salvataggio resta com'è. Le copie
  non vengono mai cancellate; come riaprirne una è scritto in docs/STEAM.md.
- **Deposito che scende** (modulo tolto, Dock demolito): la regola resta esplicita, i rottami oltre la nuova capacità
  si perdono e la conferma mostra esattamente quella quantità (il carico dei bot non ne fa parte).
- **Pezzi nuovi nel salvataggio**: codici in coda, 4 panchina … 9 scultura (dopo recinzione 1, cancello 2, lampione
  3), 10 muro, 11 pilastro, 12 albero, 13 fontana, 14 statua; il basamento è la superficie 2, nel nuovo campo
  facoltativo `surfaces` (`[casella, codice]`; `floors` resta per il pavimento); l'aspetto di una decorazione spostata
  su una casella che gliene darebbe un altro va nel nuovo campo facoltativo `varieties` (`[casella, codice, aspetto]`).
  I due campi si scrivono solo quando servono: una città senza basamenti né decorazioni spostate si salva come prima.
  I moduli nuovi stanno in `buildings[i].modules`; un salvataggio danneggiato con due moduli sullo stesso edificio
  tiene solo il primo che ci sta.
- **Compatibilità**: i salvataggi vecchi si caricano come prima; una versione precedente che apre un salvataggio nuovo
  ignora i campi e i codici che non conosce (quei pezzi mancano, il resto c'è). Il tema di una città e i progetti
  scoperti non stanno nel salvataggio (il tema viene dalla città della campagna, i progetti dal profilo: vedi
  «Sblocchi»).

### Temi delle città

- **Rustbay, Neon Heights, Greenvale e 2PM Company Town** si disegnano con i loro temi (ruggine, neon, verde,
  aziendale): terreno, strade, acqua e bordi della mappa, scenario attorno alla mappa con i pezzi tipici della città
  (i più alti solo dietro), e la loro luce: un colore del giorno cotto nel terreno e un velo notturno del loro colore.
  Di notte le finestre dello scenario dietro la mappa si accendono senza trasparire attraverso gli edifici davanti.
  Scrapbot City, il gioco libero e il tutorial restano come prima. Solo grafica: nessun numero cambia, niente nel
  salvataggio.
- **Lo smog di notte prende il colore della notte della città**: nelle città a tema la foschia notturna prende il buio
  della città e si sposta quanto la notte del tema si discosta da quella del gioco (ruggine e verde un po' più verdi,
  neon viola, compagnia più calda); Scrapbot City e il gioco libero si disegnano identici pixel per pixel, di giorno,
  al tramonto e di notte.

### Correzioni

- **Una fila trascinata e rilasciata sopra un pannello non posa niente**: una fila di pavimenti o recinzioni
  trascinata col tasto sinistro e rilasciata sopra un pannello o la barra degli strumenti non posa e non paga nulla
  (prima posava e faceva pagare caselle nascoste sotto il pannello); finché il puntatore è sopra un pannello la fila
  non si vede. Lo stesso per un edificio: premuto sulla mappa e rilasciato sulla barra non viene costruito. Rilasciare
  sulla mappa funziona come prima.
- **La ruspa illumina ciò su cui agirà il clic**: quando il clic toglierebbe un oggetto nascosto dietro un edificio si
  illumina quell'oggetto (con la sua casella), non l'edificio; con la ruspa sulla casella del Giardino Pixel dietro la
  Guglia si illumina il Giardino.
- **Le luci notturne non passano più attraverso ciò che sta davanti**: un'insegna, un lampione, un cancello o una
  scultura nascosti dietro un edificio non brillano più attraverso di esso (prima, di notte, un cuore al neon dietro il
  Quartier Generale compariva sul suo tetto). L'insegna al neon, la lente e la pozza del lampione, la luce del
  pilastro, gli occhi della statua e della scultura e il bagliore di un edificio (il neon del Bot Dock) non si
  disegnano più sopra un albero, una statua o una fontana che sta davanti: i pezzi alti (fontana, insegna, scultura,
  statua, albero) le coprono dove le coprono anche di giorno; quelli bassi (recinzioni, muri, cancelli, panchine,
  pilastri, lampioni) non arrivano all'altezza di una luce dietro di loro e restano fuori dal conto. Le luci in vista e
  quelle davanti agli edifici restano come prima; un cortile di lampioni e recinzioni costa quanto prima (luci 0,1 ms
  per fotogramma), un cortile fitto di 192 pezzi G3 di notte 0,8 ms invece di 0,2.
- **Menu principale**: le quattro schede dei percorsi erano disegnate un attimo prima che l'atlante delle immagini
  fosse pronto e restavano con i vecchi disegni piatti della 0.5; ora mostrano la città isometrica (anche i bot e Miso
  di «Plasma la città»). La mappa della regione e le schede dei salvataggi erano già attuali;
  `docs/mockup-main-menu.png` non viene distribuito con il gioco.
- **Testo nitido**: controllato a devicePixelRatio 1, 1,25, 1,5 e 2 e nelle cinque misure di finestra: immagini e
  canvas sempre a pixel netti. La scheda dell'obiettivo non è più ruotata di 1°: il suo testo e il ritratto di USA-9
  venivano ricampionati (nitidezza +13–16 %). Le righe dell'effetto CRT cadono su pixel interi dello schermo anche al
  125 % e al 150 % (prima si addensavano in bande irregolari sopra i testi piccoli). L'effetto CRT resta attivo per
  impostazione predefinita: nell'angolo più scuro il contrasto dei testi piccoli resta almeno 7,4:1.
- **Pannello di una costruzione**: una recinzione, un cancello, un muro, un pilastro, un pavimento o un basamento
  selezionati dicono «Costruzione: nessun effetto sull'economia», come la loro etichetta e la didascalia del catalogo
  (prima «Decorazione»). Le decorazioni restano come prima.
- **Crediti**: Permanent Marker è indicato con la sua licenza vera, Apache 2.0; gli altri cinque font restano SIL
  Open Font License (prima la riga li dava tutti sotto OFL).

### Correzioni dopo la revisione finale

- **Doppie pressioni dentro i dialoghi**: la seconda pressione di un doppio clic, di un doppio tocco o di `A` `A` non
  fa più nulla neppure sui controlli nel corpo di un dialogo, non solo sui pulsanti in fondo: lo slot «Sovrascrivi» o
  «Carica» che compare sotto «Salva partita» / «Carica partita» del menu di pausa (prima uno slot veniva sovrascritto, o
  la città sostituita da un caricamento), un'impostazione sotto «Impostazioni» (prima «Riduci le animazioni» cambiava),
  «Invia» e «Preleva» del dirigibile cargo (prima due invii e due commissioni del 10 %). Un evento della storia o un
  finale, che compaiono da soli, non prendono una pressione del mouse o di un dito cominciata nei loro primi 600 ms
  (prima un clic o un tocco destinato alla mappa sceglieva la risposta comparsa sotto).
- **«Ricomincia questa città»** (mappa della regione): «Sì, ricomincia» compare al suo posto e per 600 ms non prende
  pressioni, da nessun input: un doppio clic, un doppio tocco o `A` `A` non cancellano più il salvataggio della città.
  Una pressione a sé, dopo, ricomincia come prima.
- **«Costruisci …» nel consiglio di USA-9**: la seconda pressione di un doppio clic, di un doppio tocco o di `A` `A` sul
  pulsante non costruisce più l'edificio dove cade sulla mappa scoperta dal dialogo: «Troppo presto dopo la pressione
  di prima».
- **Allarme smog**: uscire dalla città durante il conto alla rovescia (Pausa → «Menu principale» o «Mappa della
  regione», «Salva e torna al menu» nel gioco libero) non sostituisce più il salvataggio di inizio giornata, come già
  i salvataggi automatici: «Carica l'ultimo salvataggio automatico — inizio della giornata» riporta davvero all'inizio
  della giornata (prima ricaricava il conto alla rovescia e la città si perdeva di nuovo). Il menu di pausa lo dice
  («salvata a inizio giornata»).
- **Città di addestramento tenuta accanto alla propria** («Tieni la mia città salvata»): salvata in uno slot, quello
  slot diventa il suo (salvataggi automatici, «Salva e torna al menu», «Continua»); finché non è salvata l'ultimo
  pulsante della pausa dice «Menu principale — questa città di addestramento non è salvata» (prima «Salva e torna al
  menu» non salvava nulla).
- **Controller**: `Y` con un pezzo selezionato lo ruota come `R` o dice che non si ruota (prima chiedeva un consiglio
  a USA-9 e ne consumava uno gratuito); su e giù raggiungono le quattro caselle delle Impostazioni; su e giù nel menu
  principale seguono l'ordine delle voci (prima ne saltavano una a 1280×720 e 1024×640); la levetta destra scorre un
  dialogo più alto della finestra (Extra a 1280×720 e 1024×640).
- **Consigli**: con ogni Riciclatore messo in pausa dal giocatore e pochi pezzi, USA-9 dice di premere «Riprendi
  produzione», gratis, invece di consigliare un altro Riciclatore o di importare pezzi.
- **Salvataggi**: un secondo salvataggio diverso della stessa versione precedente nello stesso slot ha una copia sua
  (`backup:save:<slot>:v<n>:<impronta>`, come già il profilo dei progetti); ricominciare una città il cui salvataggio
  viene da una versione più nuova («Impossibile caricare») ne tiene prima una copia, come fa il gioco libero. Versione
  desktop: un file danneggiato letto al posto della sua copia `.bak` viene prima messo da parte così com'è
  (`<file>.damaged-<n>`, mai sovrascritto), e il profilo dei progetti aggiunge i progetti leggibili da un
  `projects.sav` danneggiato a quelli del `.bak`, così l'ultima scoperta non torna bloccata. Verificato con lo store dei
  file in Node e `electron/main.cjs` caricato con un modulo `electron` simulato, non con Electron vero.
- **Catalogo**: a 1024×640, la seconda pressione di un doppio clic su «Fatto» con in mano un oggetto che si ruota non
  cambia più categoria o filtro (le schede salivano sotto il puntatore).
- **Tutorial**: quando il mouse prende il posto del tocco con la pressione stessa, il fumetto riscrive solo le sue
  righe e il clic su «Avanti» non va più perso.
- **Mappa**: ciò che una pressione prende e la casella sotto il puntatore si leggono con la camera come è disegnata,
  su pixel interi, anche dopo una panoramica col tasto destro (prima una pressione poteva mancare il pixel esterno di
  un oggetto). Niente cambia nel disegno né nella simulazione.
- **Menu principale**: fino a 1000 px di altezza la scritta della build sta accanto al nome dello studio, fuori dalla
  stella e dalla S del logo; fino a 780 px la scritta a mano «Different futures, same city» non si mostra più sopra
  l'etichetta di «Dai forma alla città».
- **Notifiche sopra un dialogo**: su finestre alte fino a 760 px vanno nell'angolo in alto a destra e non coprono più
  i pulsanti di un finale.

### Numeri e test

- **Nessun numero degli edifici originali è cambiato**: a ogni gruppo `npm run balance` con la stessa sequenza casuale
  e le attese seminate di `npm run waits` hanno dato le stesse uscite byte per byte di prima, e ogni riga già esistente
  di `npm run waits` è rimasta. `npm run waits` ha in più una riga per modulo e tre configurazioni confrontabili (verde
  rigoroso, industriale, ibrida).
- **Immagini**: Scrapbot City e il gioco libero (smog 0, 40 e 75 %, giorno, tramonto e notte, tre inquadrature, zoom 1
  e 3) si disegnano identici prima di G3 (600e82d), alla fine di G4 (97248dd) e in questa versione: 108 immagini su 108,
  confrontate canale per canale. I confronti «identico pixel per pixel» fatti durante G3 e G4 usavano uno strumento che,
  con la versione di Pillow installata, guardava solo la trasparenza e non vedeva le differenze di colore: per queste due
  città sono stati rifatti con il confronto corretto; per la città affollata (un salvataggio con molti edifici) no,
  perché due prove sulla stessa build non danno le stesse immagini, quindi lì l'identità non è dimostrata.
- **`npm run e2e`**: 22 test end-to-end giocano la build attraverso l'interfaccia in Chromium headless (i 24 oggetti,
  le regole di comodità, la scoperta dei progetti, gli slot dei moduli, i salvataggi, le doppie pressioni, gli edifici
  coperti, il tasto sinistro, l'adattamento dei pannelli in 8 lingue, la prima città della campagna, le cinque città
  dalla build di rilascio); guida in `e2e/README.md`. Gli input sono **simulati** (mouse e tastiera di Playwright,
  tocco CDP, controller con la Gamepad API simulata): non certificano Steam Deck, Windows, un controller o uno schermo
  touch veri, e non misurano il divertimento né il tempo di gioco.

## 0.7.0-alpha.1 — costruzione modulare, incremento 1

- **Sei elementi nuovi nel pannello «Oggetti e moduli»** (pulsante nella barra degli strumenti accanto alla ruspa, tasto
  `O`), divisi in Costruzioni e Moduli macchina; ogni voce mostra icona, nome, costo, effetto, limite e, se non si può
  avere, il motivo:
  - **Pavimento industriale**: 3 crediti a casella. Ci si costruiscono sopra edifici e oggetti; riappare quando
    l'edificio sopra viene demolito. Rimborso 1 credito.
  - **Recinzione**: 4 crediti a casella, si raccorda da sola con recinzioni e cancelli. Rimborso 2 crediti.
  - **Cancello**: 12 crediti, si allinea alle recinzioni. Rimborso 6 crediti.
  - **Lampione**: 10 crediti + 2 pezzi, braccio in 4 direzioni, di notte illumina la strada. Rimborso 5 crediti + 1 pezzo.
  - **Deposito aggiuntivo** per l'Hangar Bot (Bot Dock): 30 crediti + 15 pezzi, deposito del Dock 80 → 180 rottami.
    Rimborso 15 crediti + 7 pezzi.
  - **Filtro antismog** per la Fonderia: 45 crediti + 20 pezzi, smog della Fonderia 0,035 → 0,014 al secondo
    (+2,1 → +0,8 al giorno), energia −2 → −3, stessa produzione. Rimborso 22 crediti + 10 pezzi.

  Pavimenti, recinzioni, cancelli e lampioni sono decorazioni: nessun effetto su economia, felicità, stelle,
  achievement o indicatore Green ◀ ▶ Industry. Nessuno dei sei elementi serve per finire una città.
- **Si paga una sola volta, alla conferma** (clic, tocco o `A`): l'anteprima (fantasma verde o rosso, con il motivo
  scritto sulla mappa) e l'annullamento (`Esc`, clic destro, `B`, «Fatto») non costano nulla.
- **File col mouse**: con pavimento o recinzione in mano, trascinare col tasto sinistro posa una fila, anche ad L.
  Ogni casella si paga quando viene posata; quelle occupate o fuori budget vengono saltate senza costo. Il tasto
  sinistro continua a non spostare la mappa; sul touch un dito sposta la mappa come prima.
- **Rotazione**: `R` (`Shift+R` al contrario) o `Shift` + rotellina; sul controller `Y` quando lo strumento in mano si
  può ruotare (altrimenti `Y` resta il suggerimento); sul touch il pulsante «⟳ Ruota» nel pannello. Un oggetto già
  posato si seleziona con un clic e si ruota o si rimuove dal suo pannello.
- **Rimozione e rimborsi**: la ruspa, o «Rimuovi» nel pannello, su una recinzione, un cancello o un lampione rende
  metà del prezzo; su un pavimento libero 1 credito; su un edificio lo seleziona come prima. Come già per le macerie,
  la ruspa toglie anche un oggetto che sta sulla casella indicata dietro un edificio (che mostra in trasparenza), anche
  se l'edificio lo nasconde del tutto.
- **Moduli nel pannello dell'edificio** (Hangar Bot, Fonderia): sezione «Moduli» con lo slot, l'effetto prima → dopo
  (deposito, smog, energia), il limite 0/1 o 1/1, «Installa» (disattivato con il motivo) e «Rimuovi (+rimborso)» con
  conferma, che avvisa se dei rottami andranno persi. I numeri del pannello (energia, smog, deposito) contano i moduli.
- **Demolizione**: la conferma mostra il rimborso totale, moduli compresi, e i moduli spariscono con l'edificio. Come
  la conferma della rimozione di un modulo, non accetta clic nei primi 350 ms: un doppio clic su «Demolisci» non
  demolisce più l'edificio senza che la conferma sia stata vista (succedeva già nella 0.6.1).
- **Grafica**: pavimenti disegnati nel terreno, recinzioni che si raccordano, cancelli e lampioni con la luce notturna,
  il Dock con i silos del deposito sul tetto, la Fonderia con la torre del filtro (niente fumo scuro, vapore chiaro).
  I cittadini girano attorno a recinzioni, cancelli e lampioni; i bot ci volano sopra.
- Le scritte sulla mappa (effetto di un modulo, motivo di un rifiuto) restano fuori dal pannello laterale aperto e dalla
  carta dell'obiettivo quando nella finestra c'è posto (su una finestra piccola a zoom alto una scritta lunga può
  restarci sotto). I prezzi con quantità 1 sono al singolare in tutte le 8 lingue («1 credito», «1 pezzo», in
  polacco «1 część»).
- **Salvataggi**: stesso formato (versione 2, con campi nuovi facoltativi); i salvataggi della 0.6 si caricano senza
  cambiamenti.
- **Non in questo incremento**: gli altri 18 oggetti del catalogo, i nuovi eventi e la modalità infinita.

## 0.6.1 — comandi della camera

- **Il tasto sinistro del mouse non sposta più la mappa**: serve solo a selezionare e costruire. La mappa si sposta
  trascinando col tasto destro o centrale, con WASD/frecce, con i bordi dello schermo (opzione) e, sul touch, con un dito
  come prima. Un trascinamento col sinistro senza strumento in mano non seleziona nulla.
- **La mappa non resta più bloccata al centro**: a ogni zoom e con qualsiasi dimensione della finestra (anche stretta e
  verticale) si può spostare finché ogni bordo e ogni angolo della mappa arriva al centro dello schermo. Prima, quando la
  mappa entrava quasi tutta nello schermo, la camera la teneva ferma al centro.
- H/Home centrano l'HQ nella parte di schermo libera tra la barra in alto e la barra degli strumenti.
- Tutorial e aiuto dei comandi aggiornati in 8 lingue ("tieni premuto il tasto destro e trascina, o usa WASD").

## 0.6.0 — 2.5D isometric world (release candidate)

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

### I 12 edifici: sagome riconoscibili e animazioni legate alla produzione
Ogni edificio ha fotogrammi "al lavoro" che cambiano davvero da uno all'altro, un fotogramma "spento" (senza corrente,
in pausa o senza materiale) e 4 stadi di cantiere; un test controlla che ogni passo dell'animazione cambi almeno lo
0,4% dei pixel e che "spento" sia diverso da "al lavoro".
- **HQ**: schermi e faccia del bot, finestre accese, faro; senza corrente tutto si spegne.
- **Riciclatore**: nastro con i rottami che scorre e rulli che girano, solo mentre lavora.
- **Bot Dock**: luci che girano attorno alla pista sul tetto, torre di controllo con la faccia del bot.
- **Fonderia**: fiamme nella bocca del forno, linea di colata con gli stampi che si riempiono e diventano lingotti.
- **Inceneritore**: lingue di fuoco sopra la griglia, anello caldo che gira sul camino, fiamme in cima, contatore di energia.
- **Fabbrica 2PM**: insegna "2PM" leggibile, braccio robotico che impila casse, ventola sul tetto.
- **Pannelli solari**: pannelli inclinati con un riflesso che li attraversa, batterie che si caricano.
- **Giardino**: alberi che ondeggiano, farfalla, lampione acceso solo quando lavora.
- **Fix-It Lab**: monitor col battito, schermo con il testo che scorre, braccio saldatore.
- **Depuratore**: torre-serbatoio con l'acqua che sale nel tubo di vetro, ventola, faro.
- **Bot Pods**: ascensore che sale e scende in 12 fotogrammi, appartamenti che accendono le luci, un bot che saluta dal tetto.
- **Guglia dei Rottami**: gru che solleva una cassa, antenna, insegna al neon, corona con gemma, luci che salgono la torre.
- 6 cittadini diversi, Miso il gatto, il dirigibile 2PM e 25 elementi di scenografia attorno alla mappa (alberi,
  container, gru, pala eolica, cartellone, insegne, auto distrutte, tubi, pali della luce...).
- Le icone della barra usano gli stessi sprite isometrici, sempre a ingrandimento intero (nitide).

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
- Di notte finestre, schermi, fornaci e fari si accendono con un alone; i lampioni lungo i marciapiedi accendono
  una pozza di luce sulla strada; lucciole sopra l'erba, cartacce portate dal vento di giorno.
- Ogni stato si riconosce a colpo d'occhio: al lavoro l'edificio si anima; fermo (niente da lavorare) resta spento e
  immobile; **senza corrente** si spegne e mostra un fulmine giallo; **in pausa** si spegne e mostra il simbolo di pausa;
  in costruzione ha impalcature, saldatore e barra; HQ e Bot Dock spengono finestre, schermi e fari senza corrente.

### Leggibilità e feedback
- Un lampo sull'edificio che ha appena prodotto, un lampo più forte e un anello verde a terra quando un cantiere finisce;
  uno sbuffo di scintille quando un bot consegna il carico; i bot carichi fanno oscillare il cubo di rottami.
- Durante il piazzamento gli edifici davanti all'impronta diventano trasparenti, così la casella scelta resta visibile.
- Qualità adattiva: se i fotogrammi restano lenti per 2 secondi si tolgono ombre, riflessi e particelle; tornano quando
  il gioco è di nuovo fluido. Il terreno in cache si disegna solo per la parte visibile.

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
- Banca regionale: "Ricomincia questa città" riprende dalla banca quello che la vecchia partita ci aveva messo
  (prima si potevano stampare crediti e pezzi all'infinito); niente scambi durante il conto alla rovescia dello smog
  o dopo una sconfitta per smog (i crediti di una città persa esistevano due volte).
- Barra del percorso: demolire restituisce solo lo spostamento che l'edificio aveva davvero fatto (al limite ±100
  si poteva comprare un finale costruendo e demolendo); il giardino regalato non sposta la barra.
- Demolendo un magazzino i rottami in eccesso si perdono invece di restare sopra il limite e fermare i bot.
- Bot: un Dock nuovo fa partire i suoi bot da sé; quando i bot calano si ritirano prima quelli vuoti e il carico
  degli altri va nel magazzino; un bot in volo davanti a un edificio non ne blocca più il clic.
- L'offerta dei propulsori per i bot ("tieni i progetti per dopo") torna davvero finché non la compri.
- Il consiglio a pagamento è quello scelto prima di pagare (pagare non lo cambia più).
- Finestre di dialogo: tutto quello che sta dietro è inerte (Tab e tastiera restano nel dialogo).
- Il salvataggio quando la finestra viene nascosta segue le stesse regole dell'autosalvataggio.
- Impostazioni: aprirle non azzera più niente con lo storage bloccato; lo schermo intero resta allineato quando cambia
  con F11, Esc o i controlli della finestra, anche con la finestra delle impostazioni aperta.
- Tasto Home: come H, riporta la camera sull'HQ.
- Fine del tutorial con una città già salvata: la domanda "Sostituire la città?" non si chiude più con Esc, B o un clic
  fuori (prima la città salvata veniva poi sovrascritta in silenzio), e finché non si risponde non si salva nulla.
- Un clic o un trascinamento iniziato prima che si apra un dialogo (evento, finale) non costruisce e non sposta più la
  città dietro il dialogo.
- Esc, B, × e il clic fuori tornano indietro di un passo nei dialoghi aperti da un altro (Impostazioni e Salvataggi dalla
  pausa, Partita libera dal menu "Nuova partita") invece di chiudere tutto; chiuso l'ultimo dialogo, il focus torna al
  pulsante che l'aveva aperto. Il menu principale tiene la voce evidenziata dopo un cambio di lingua e il passaggio del
  mouse su "Continua" disattivato non sposta più l'evidenziazione.
- Controller: ai bordi sud della mappa il cursore non finisce più sotto la barra degli strumenti (la camera ha margini
  pari all'HUD e il D-pad sposta la mappa quando la casella sarebbe coperta); il D-pad si ferma al bordo della mappa;
  "Ricomincia questa città", la banca regionale e i salvataggi tengono il focus sul pulsante giusto dopo ogni pressione;
  staccare il controller toglie il cursore virtuale; lo scorrimento ai bordi (opzione mouse) non trascina più la mappa
  quando il cursore del controller è fermo al bordo.
- Touch: due dita insieme spostano la mappa mentre fanno zoom, e il dito rimasto dopo un pinch continua a trascinare.
- Qualità adattiva: decide in base al lavoro di disegno e alla frequenza dello schermo, quindi su schermi a 30/40 Hz
  (Steam Deck a 40 Hz, risparmio energetico del browser) non resta più bloccata in qualità bassa.
- Testi fluttuanti disegnati una volta e riusati, saltati fuori schermo e al massimo 48: alla velocità massima erano metà
  del costo del disegno.
- Desktop: la tastiera a schermo di Steam Deck si apre davvero (la risposta della richiesta veniva riletta come vuota).
- Le notifiche degli achievement si spostano in basso mentre è aperto un dialogo: non coprono più il titolo di un finale.
- Desktop/Steam: steamworks.js (quando installato) si carica all'avvio, così l'overlay di Steam funziona; lanciato dal
  client Steam il gioco prende l'App ID da Steam anche senza `steam_appid.txt`.

### Audio
- Limitatore sul mix: tanti effetti insieme non distorcono più.
- Tetto alle voci contemporanee e intervallo minimo per ogni effetto; il rumore riusa un unico buffer (niente allocazioni).

### Test
- `tests/timing.test.ts`: la stessa produzione a 1×, 2×, 3× e a 144/60/30/10/4 fps; nessun tempo perso con fotogrammi
  lenti; l'Inceneritore non perde corrente tra due carichi (il test ritrova il vecchio bug: 65 interruzioni).
- `tests/economy.test.ts`: banca e riavvio, scambi bloccati nello smog, barra del percorso al limite, magazzino dopo
  una demolizione, bot dei Dock, offerta dei propulsori.
- `tests/storage.test.ts`: slot nel browser, salvataggi danneggiati o più nuovi che non vengono mai sostituiti.
- `tests/iso.test.ts`: andata e ritorno della proiezione, casella giusta per ogni pixel a ogni zoom, ordinamento per
  profondità (3×3 accanto a 1×1, bot sopra un tetto, 300 oggetti).
- `tests/saves.test.ts`: niente autosalvataggio durante lo smog, file del desktop accettati solo se validi.
- `tests/art.test.ts`: l'atlante ha tutti i fotogrammi di ogni edificio; i fotogrammi di animazione cambiano davvero
  l'uno dall'altro; "spento" è diverso da "al lavoro"; i cantieri crescono; bot e terreno completi.
  `scripts/art/check-frames.ts` misura lo stesso prima di generare l'atlante.
- `tests/modal.test.ts`: Esc/B tornano indietro di un passo, i dialoghi con due scelte non si chiudono da soli, il focus
  torna a chi ha aperto il dialogo.
- `tests/stability.test.ts`: una città completa gioca 40 giorni alla velocità massima con eventi, salvando e
  ricaricando ogni 5 giorni: niente NaN, niente valori negativi, niente liste che crescono senza limite.
