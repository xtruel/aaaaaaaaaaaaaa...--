# Changelog

## In lavorazione — incremento 2, gruppo G3: tre costruzioni, tre decorazioni, spostare le decorazioni

- **Tre costruzioni nuove** nella sezione Costruzioni del pannello «Oggetti e moduli»:
  - **Basamento in cemento**: 4 crediti a casella, rimborso 2. Una superficie come il pavimento industriale (lastre di
    cemento con il cordolo, diverse dalle piastre metalliche): ci si costruisce sopra, resta sotto l'edificio e
    riappare quando lo si demolisce; file trascinate col mouse; una superficie per casella («Qui c'è già il
    basamento», «Qui c'è già il pavimento»).
  - **Muro basso**: 2 crediti + 4 rottami a casella, rimborso 1 credito + 2 rottami (i rottami solo fin dove il
    deposito ha spazio in quel momento, come la scultura: «Rimuovi», la ruspa e la riga sotto il pulsante dicono la
    cifra vera e la rimozione paga quella); blocchi di rottami pressati; file trascinate; si raccorda come la recinzione.
  - **Pilastro d'angolo**: 6 crediti, rimborso 3. Muri e recinzioni ci si attaccano da ogni lato (un moncone verso
    ogni vicino); di notte si accende la luce in cima. Non si ruota.
- **Tre decorazioni nuove** nella sezione Decorazioni, oggetti solidi da una casella con le regole delle altre:
  - **Albero**: 8 crediti, rimborso 4; palma, cipresso o acero rosso, scelti dalla casella; diverso dal Giardino Pixel
    e dagli alberi di contorno; nessun effetto su smog o felicità.
  - **Fontana**: 25 crediti + 5 pezzi, rimborso 12 + 2; vasca con il getto d'acqua che gioca (fermo con il movimento
    ridotto).
  - **Statua di USA-9**: 20 crediti + 10 pezzi, rimborso 10 + 5; 4 direzioni; di notte gli occhi si accendono quando
    guarda verso la camera.
- **Raccordi**: recinzioni e muri si raccordano con recinzioni, muri, pilastri e con i cancelli **allineati** (un
  cancello lungo x con i vicini a est e a ovest, lungo y con quelli a nord e a sud). Una recinzione o un muro da soli
  seguono la loro rotazione e si ruotano; raccordati seguono i vicini. **Recinzioni già posate**: cambiano aspetto solo
  dove ora un muro o un pilastro le raccorda, e dove stanno contro il fianco di un cancello: lì prima la recinzione
  entrava nel fianco del cancello (il limite noto dell'incremento 1), ora sta da sola nel verso della sua rotazione e
  si può ruotare. Le altre recinzioni e tutti i cancelli restano come prima. Nel catalogo la recinzione dice «Si
  raccorda con recinzioni, muri, pilastri e cancelli».
- **Spostare le decorazioni già comprate** (lampione, panchina, fioriera, insegna, pergola, casetta di Miso, scultura,
  albero, fontana, statua): nel loro pannello «Sposta», poi la casella, con la stessa anteprima e le stesse regole di
  posa. Gratis: nessun pagamento, nessun rimborso, nessun contatore (gli oggetti posati restano quelli); rotazione e
  aspetto (fiori, simbolo, albero) vanno con l'oggetto, anche dopo il salvataggio. Esc, il tasto destro, `B` o «Fatto»
  lo lasciano dov'era; una casella non valida è rifiutata con il motivo e lo spostamento continua; un clic sull'oggetto
  stesso lo lascia lì. Durante lo spostamento `R`, `Shift`+rotella e `Y` ruotano l'oggetto (con `Y` mai un consiglio).
  Costruzioni (pavimenti, basamenti, recinzioni, muri, pilastri, cancelli), moduli ed edifici non si spostano. Il
  secondo colpo di un doppio clic su «Sposta» non preme «Fatto» che prende il suo posto, e viceversa.
- **Si clicca quello che si vede**: muri e pilastri come le recinzioni (un clic sopra raggiunge l'edificio dietro);
  albero, fontana e statua prendono il clic sui propri pixel come le altre decorazioni.
- **Nessun effetto su economia, felicità, smog, allineamento, stelle o achievement**: città del pilota automatico con
  decine di muri, pilastri, basamenti, alberi, fontane e statue, alcune spostate durante la partita, giocano byte per
  byte come le stesse città senza.
- **Salvataggi**: codici in coda, 10 muro, 11 pilastro, 12 albero, 13 fontana, 14 statua; il basamento è la superficie
  2, nel nuovo campo facoltativo `surfaces` (`[casella, codice]`; `floors` resta per il pavimento); l'aspetto di una
  decorazione spostata su una casella che gliene darebbe un altro va nel nuovo campo facoltativo `varieties`
  (`[casella, codice, aspetto]`). I due campi si scrivono solo quando servono: una città senza basamenti né decorazioni
  spostate si salva come prima. I salvataggi vecchi si caricano come prima; una versione precedente che apre un
  salvataggio nuovo ignora i campi e i codici che non conosce (quei pezzi mancano, il resto c'è).

## In lavorazione — incremento 2, integrazione di G2 (G0 + G1 + temi + G2)

- **Una sola regola per il doppio clic in tutto il gioco** (`src/ui/presses.ts`): un doppio clic, un doppio tocco o
  `A` premuto due volte durano fino a 500 ms (il doppio clic di Windows), letti con 100 ms di margine (600 ms: il gioco
  vede una pressione un po' dopo), con il secondo colpo entro 10 px (mouse e controller) o 24 px (dito). La usano la
  mappa con uno strumento in mano, il catalogo, i pulsanti costosi del pannello dell'edificio, il secondo clic che
  raggiunge l'edificio nascosto (da 500 ms) e ora anche i pulsanti delle finestre. Corretto: quando il primo colpo,
  con un edificio in mano e solo i pezzi mancanti, apre l'offerta di 2PM («compra i pezzi mancanti e costruisci»), il
  secondo colpo non compra più (prima `A` `A` a 450–550 ms, o un secondo clic o tocco che cadeva sul pulsante
  dell'offerta, comprava i pezzi e costruiva; anche nella 0.7.0-alpha.1). Un tasto o `A` non preme un pulsante di una
  finestra nei suoi primi 600 ms (prima 400 ms); una pressione a sé, dopo, risponde come prima.
- **Tocchi veloci su caselle vicine**: a zoom 1 due caselle vicine distano 17,9 px, meno dei 24 px di un dito, e il
  secondo tocco era preso per un doppio tocco e rifiutato in silenzio; ogni tocco rifiutato allungava l'attesa, così
  sei tocchi a 300 o 450 ms ne compravano 1 su 6. Ora un tocco rifiutato lo dice («Troppo presto dopo la pressione di
  prima: premi di nuovo se era voluto», in tutte le lingue, come gli altri rifiuti) e non allunga l'attesa, che si
  conta dall'ultima pressione accettata: gli stessi sei tocchi ne comprano 3 su 6 (uno sì e uno no), da 650 ms 6 su 6,
  a zoom 2 sempre 6 su 6; un doppio tocco continua a non comprare mai due volte. Con la ruspa un doppio clic
  sull'edificio già selezionato non dà il messaggio (non cambia niente). Un tocco sulla mappa che chiude il pannello
  dello smog non conta come «la stessa casella»: il secondo tocco di quel doppio tocco non compra.
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
- **Pannello dell'edificio più compatto**: le colonne dei numeri stanno 6 px l'una dall'altra (come nelle schede dei
  moduli) e i pulsanti delle schede usano il corpo della scheda; in inglese «Sludge radius (tiles)», «Sludge tile every
  (s)» (prima «One sludge tile every (s)») e «Remove (+25 credits + 15 parts)» stanno su una riga a 1280×800 e a
  1024×640; nelle altre lingue le etichette lunghe vanno ancora a capo tra le parole, ma meno (righe in più: da 142 a
  102 su 48 pannelli misurati), nessuna più di prima, nessun testo che esce dal pannello.

## In lavorazione — incremento 2, gruppo G2: le sei decorazioni del brief

- **Sei decorazioni nuove** nel pannello «Oggetti e moduli», in una sezione **Decorazioni** insieme al lampione (tra
  Costruzioni e Moduli macchina); ogni voce mostra icona, nome, costo (anche in rottami), effetto, «1 per casella» e,
  se non si può comprare, cosa manca. Oggetti solidi da una casella come il lampione: su terreno o erba, anche sopra il
  pavimento, mai su edifici, spazzatura, melma, macerie o un altro oggetto (con il motivo in parole: «C'è una
  panchina: rimuovila prima»); la spazzatura non ci cade mai sopra, i cittadini ci girano attorno, i bot ci volano sopra.
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
- Si ruotano come il lampione (`R`, `Shift`+rotella, il pulsante «⟳ Ruota», `Y` sul controller), prima di posarle o dal
  loro pannello; l'anteprima mostra già direzione e aspetto (fiori, simbolo) che avranno. Il pannello di una decorazione
  selezionata dice «Decorazioni», «Decorazione: nessun effetto sull'economia», «Ruota» se ruota e «Rimuovi (+rimborso)»
  (i pulsanti prima della descrizione, così su una finestra bassa restano in vista).
- **Si clicca quello che si vede**: un lampione o una decorazione davanti a un edificio prende il clic sui propri pixel
  (selezione, ruspa, evidenziazione); prima metà di un'insegna davanti al Quartier Generale selezionava l'edificio.
  Recinzioni e cancelli restano «trasparenti» al clic come nell'incremento 1.
- **Le luci notturne restano dietro gli edifici**: un'insegna, un lampione, un cancello o una scultura nascosti dietro
  un edificio non brillano più attraverso di esso (prima, di notte, un cuore al neon dietro il Quartier Generale
  compariva sul suo tetto); le luci in vista e quelle davanti agli edifici restano come prima, e un cortile pieno di
  lampioni costa da disegnare quanto prima.
- **Nessun effetto su economia, felicità, smog, allineamento, stelle o achievement**: una città con decine di
  decorazioni gioca byte per byte come la stessa città senza (test con il pilota automatico). Salvataggi: codici 4
  panchina … 9 scultura, in coda a recinzione 1, cancello 2, lampione 3; i salvataggi vecchi si caricano come prima.
- **Comodità di costruzione** (brief §3), per tutti i pezzi del catalogo, con mouse, touch e controller: il costo è in
  vista prima di comprare, annullare è gratis, una posa paga una volta, dopo la posa lo strumento resta in mano.
  Corretto: il secondo tocco o clic di un doppio tocco/clic (o `A` `A`) non compra più niente sulla mappa, né a cavallo
  tra due caselle (prima comprava due pezzi), né dietro una finestra o il pannello dello smog appena chiusi con quel
  doppio tocco (prima comprava un pezzo); con la ruspa un doppio clic su una recinzione non toglie anche il pavimento
  sotto; sulla stessa casella il secondo tocco viene rifiutato con il motivo, come prima; un tocco sulla mappa che
  chiude il pannello dello smog lo chiude e basta; un doppio tocco su una voce del catalogo o su «Fatto» non prende
  più un'altra voce quando la lista si sposta sotto il dito. Conta come doppio tocco un secondo tocco fino a mezzo
  secondo dopo il primo (il doppio clic di Windows, come la protezione del pannello degli edifici, più il ritardo di un
  fotogramma) e vicino: 10 px col mouse e il controller, 24 px col dito, perché i due tocchi di un dito non cadono mai
  nello stesso punto (prima 350 ms e 10 px per tutti: un doppio tocco lento o un dito spostato di 12 px comprava
  ancora due pezzi). Un tocco su un'altra casella, o dopo un attimo, funziona come prima.
- Nessun numero degli edifici originali è cambiato: `npm run balance` (con la stessa sequenza casuale) e `npm run
  waits` danno le stesse uscite byte per byte.

## In lavorazione — incremento 2, integrazione (G0 + G1 + temi): correzioni dalla verifica di G1

- **Doppio clic, doppio tocco, A premuto due volte**: fino a 500 ms tra le due pressioni (il tempo di doppio clic
  predefinito di Windows) la seconda non conferma mai una demolizione o la rimozione di un modulo comparse dove era la
  prima, e non ricompra un modulo appena tolto (prima la soglia era 350 ms: una rimozione seguita da «Installa» dopo
  352–450 ms ricomprava il modulo a prezzo pieno contro metà rimborso). Questi pulsanti ignorano una pressione per 600 ms
  dopo la precedente: 500 ms più un margine, perché il gioco vede una pressione un po' dopo che è avvenuta (il
  controller si legge una volta per fotogramma) e due pressioni a 500 ms arrivavano anche a 515 ms (confermate). Una
  pressione a sé sulla conferma, dopo, funziona come prima. Il secondo clic che raggiunge l'edificio nascosto dietro un
  altro conta da 500 ms. «Installa» ignora le pressioni solo sull'edificio a cui si è appena tolto il modulo: quello di
  un altro edificio, aperto subito dopo, funziona.
- **Pannello dell'edificio**: la riga del deposito ha di nuovo la sua unità («180 rottami», non «180»); nelle schede
  dei moduli «Pezzi usati / min» e «Rottami usati / min» restano su una riga anche con la barra di scorrimento (colonne
  un po' più strette, barra sottile come negli altri pannelli; nelle lingue più lunghe le etichette vanno a capo tra
  le parole, mai dentro una parola). La descrizione di un edificio dice i suoi numeri veri: il Purificatore con
  l'ugello «nel raggio di 8 caselle», la Capsule Bot con la capsula 9 alloggi, il Campo Solare coi pannelli +7, il
  Riciclatore col selezionatore 3 pezzi, il Bot Dock col deposito aggiuntivo +180; senza modulo, e nella barra degli
  strumenti, le parole di sempre.
- **Ruspa ed edificio nascosto**: il Giardino Pixel scelto con la ruspa attraverso la Guglia resta visibile (la Guglia
  trasparente) anche quando il puntatore va sul suo pannello per demolirlo; prima la Guglia tornava piena appena il
  puntatore lasciava la mappa. Sulla mappa la ruspa mostra come prima la casella sotto il puntatore.
- **USA-9, «Prima l'energia»**: l'energia che avanza è quella che mostra la barra in alto (prodotta meno consumata);
  se gli edifici in costruzione ne useranno una parte, il consiglio lo dice a parte («ora te ne avanza 3, ma gli
  edifici in costruzione ne useranno altri 2») invece di dare un numero che contraddice la barra. La decisione resta la
  stessa di G1 (conta anche ciò che si sta costruendo).
- **L'anello del Purificatore si legge**: invece di 72 puntini da un pixel quasi invisibili, un anello tratteggiato
  (trattini di due pixel con un bordino scuro sotto) e una velatura leggerissima sul terreno raggiunto, al raggio vero
  (5 caselle, 8 con l'ugello), anche per il fantasma quando lo si piazza; disegnato sul terreno, sotto edifici, bot e
  rottami, quindi non copre la mappa. Con il movimento ridotto i trattini stanno fermi.
- **Crediti**: Permanent Marker è indicato con la sua licenza vera, Apache 2.0; gli altri cinque font restano SIL
  Open Font License (prima la riga li dava tutti sotto OFL).

## In lavorazione — incremento 2: le città della campagna nei loro temi

- **Rustbay, Neon Heights, Greenvale e 2PM Company Town** si disegnano con i loro temi (ruggine, neon, verde,
  aziendale): terreno, strade, acqua e bordi della mappa, scenario attorno alla mappa con i pezzi tipici della città
  (i più alti solo dietro), e la loro luce: un colore del giorno cotto nel terreno e un velo notturno del loro colore.
  Di notte le finestre dello scenario dietro la mappa si accendono senza trasparire attraverso gli edifici davanti.
  Scrapbot City, il gioco libero e il tutorial restano come prima. Lo smog di notte prende il buio della città.
- Solo grafica: nessun numero cambia, niente nel salvataggio (il tema viene dalla città della campagna).

## In lavorazione — incremento 2, gruppo G1: sei moduli ed economia leggibile

- **Sei moduli nuovi**, nella sezione «Moduli macchina» del catalogo (con la loro icona) e nel pannello dell'edificio.
  Ogni edificio ha **un solo slot**: i due moduli del Riciclatore sono alternativi («Slot occupato da Separatore
  magnetico: rimuovilo prima», anche sulla mappa con lo strumento del catalogo). Si installano solo su un edificio
  completato; rimborso a metà alla rimozione e alla demolizione, mostrato prima. Nessun numero degli edifici cambia.
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
- **Il pannello di ogni edificio legge la simulazione**: per ogni valore la colonna «A piena energia» (con il modulo) e
  la colonna «Ora» (con l'energia disponibile, gli straordinari, la pausa): energia, smog, ingressi e uscite di un
  ciclo, durata del ciclo, quanto produce e consuma al minuto, alloggi, deposito, raggio e ritmo della bonifica. Un
  edificio fermo per i materiali o per la riserva di pezzi segna «in attesa» e 0 al minuto. Durante gli straordinari
  una nota dice quanti secondi restano (si sommano ai moduli solo finché durano).
- **La causa dello stato, a parole e con un'icona** (non solo col colore): funziona normalmente; in pausa (l'hai
  fermato tu); fermo: energia insufficiente; rallentato: poca energia (al N%); mancano materiali (quali); in attesa:
  pezzi tenuti da parte per costruire (quanti); in costruzione (secondi rimasti); senza carburante.
- **Lo slot nel pannello**: per ogni modulo lo stato (installato · slot occupato · installabile · non ora, col motivo),
  costo e rimborso, prima → dopo a piena energia e, se installato, il valore di ora. «Installa» avvisa se lascerebbe la
  città senza energia sufficiente; «Rimuovi» e «Demolisci» dicono cosa si perde: rottami oltre il deposito che resta,
  cittadini oltre gli alloggi che restano, energia che non basta più. Una rimozione confermata con un doppio clic (o
  doppio tocco, o A premuto due volte) non ricompra più il modulo: il secondo clic finiva su «Installa», comparso al
  posto della conferma, e costava il prezzo pieno contro metà rimborso (anche nell'incremento 1, col deposito del Dock).
- **«+N in attesa»** accanto al contatore dei rottami quando i bot ne hanno portati più di quanti ne stanno nel
  deposito; il suggerimento al passaggio del mouse spiega che entrano da soli appena c'è posto.
- **Consigli di USA-9** sul collo di bottiglia reale: con il deposito pieno e pochi crediti propone un convertitore
  (Lab Riparatutto o Fonderia, secondo il percorso) e non più un Bot Dock; un nuovo Riciclatore solo se c'è energia e
  ci sono rottami da lavorare, altrimenti «prima l'energia» o «niente rottami da riciclare» (l'energia conta gli
  edifici in costruzione: i consumi, i Campi Solari e i Bruciatori quando c'è rottame da bruciare).
- **Fumo, vapore e animazioni seguono lo stato reale**: il fumo segue lo smog che l'edificio emette davvero (meno con
  poca energia, ×1,5 con gli straordinari, niente da fermo); il camino della Fabbrica tiene il suo fumo e lo scarico del
  braccio doppio aggiunge il fumo in più del modulo; l'ugello spruzza una nebbiolina mentre il Purificatore lavora; le
  gocce del Purificatore non salgono più quando è in pausa. Con il movimento ridotto niente particelle.
- **Edifici nascosti selezionabili** (studio della mappa §9): con la ruspa il clic va all'edificio che la ruspa mostra
  attraverso quello trasparente (il Giardino Pixel dietro la Guglia); senza ruspa un secondo clic nello stesso punto sul
  sopra-selezionato passa a ciò che nasconde (l'edificio o la recinzione, il cancello, il lampione su quella casella) e
  un terzo torna indietro; un doppio clic non conta. L'edificio davanti diventa trasparente finché la selezione dura.
  Con la ruspa una sola regola decide cosa prende il clic e cosa si illumina (`dozeTarget`): prima le macerie o la
  recinzione, il cancello, il lampione su quella casella (G0), poi l'edificio che sta su quella casella dietro quello
  disegnato, poi quello disegnato.
- Il pannello di un altro edificio si apre dall'inizio, non più dove era scorso quello di prima.
- `npm run waits` ha una riga per modulo e tre configurazioni confrontabili (verde rigoroso, industriale, ibrida);
  `npm run balance` con seme fisso e le righe già esistenti di `npm run waits` sono identiche a prima.
- Salvataggi compatibili: i moduli nuovi stanno in `buildings[i].modules`; un salvataggio danneggiato con due moduli
  sullo stesso edificio tiene solo il primo che ci sta.

## In lavorazione — incremento 2, gruppo G0: smog leggibile

- **Lo smog si vede sulla mappa.** Sopra ogni edificio che inquina in quel momento (Fonderia, Inceneritore, Fabbrica
  2PM) si forma una nuvola che il vento porta via in una scia: tanto più grande e densa quanto più smog emette
  l'edificio adesso (con l'energia che ha, con gli straordinari, con il filtro); un edificio in pausa, senza
  combustibile o senza materiale non fa nuvola. La Fonderia col filtro fa una scia piccola accanto al suo vapore chiaro.
  Sulla melma tossica strisciano fumi verdastri. Sopra il 10% la città si vela: polvere chiara verso il 20%, foschia
  scura e spenta oltre il 50%, cielo coperto di nuvole basse oltre l'80%; sotto il 10% l'aria è limpida. Di notte le
  nuvole prendono la luce della città e la foschia diventa un bagliore torbido. Con il movimento ridotto le nuvole
  restano ferme. Il fumo dei camini e il vapore del filtro restano come prima.
- **Da dove viene e dove va.** Un clic o un tocco sul misuratore dello smog (o il cursore del controller e `A`) apre un
  pannello con le fonti per tipo di edificio e la melma, la pulizia (Purificatori, Giardini Pixel) e il ricambio
  d'aria naturale, ciascuno al giorno, il totale al giorno, la soglia del 95% e, quando parte, il conto alla rovescia
  dei 30 secondi; segnala anche gli straordinari e l'energia che manca. I numeri sono quelli della simulazione: le parti
  sommano esattamente al ritmo con cui lo smog cambia. Si chiude con `Esc`, `B`, la × o un clic fuori. Misuratore,
  freccia e allarme restano come prima. In 8 lingue; i nomi lunghi vanno a capo invece di essere tagliati. Su una
  finestra molto bassa (1024×640) il pannello aperto prende il posto dell'allarme, di cui ripete il conto alla
  rovescia, così le liste restano visibili; mentre è aperto, i trofei compaiono in basso invece di coprirlo.
- **Le scritte sulla mappa** (perché un edificio o un pezzo non va lì, l'effetto di un modulo) si
  disegnano sopra lo smog e il buio, come i numeri che salgono dagli edifici: restano leggibili anche nella foschia
  più fitta e di notte.
- **Corretto**: una fila di pavimenti o recinzioni trascinata col tasto sinistro e rilasciata sopra un pannello o la
  barra degli strumenti non posa e non paga nulla (prima posava e faceva pagare caselle nascoste sotto il pannello);
  finché il puntatore è sopra un pannello la fila non si vede. Lo stesso per un edificio: premuto sulla mappa e
  rilasciato sulla barra non viene costruito. Rilasciare sulla mappa funziona come prima.
- **Corretto**: con la ruspa, quando il clic toglierebbe un oggetto nascosto dietro un edificio, si illumina
  quell'oggetto (con la sua casella), non l'edificio. In generale la ruspa evidenzia sempre ciò su cui agirà il clic.
- Nessun numero del gioco è cambiato: `npm run balance` (con la stessa sequenza casuale) e `npm run waits` danno le
  stesse uscite byte per byte; salvataggi invariati.

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
