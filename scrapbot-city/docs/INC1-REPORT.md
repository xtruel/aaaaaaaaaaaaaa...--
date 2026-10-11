# Scrapbot City 0.7.0-alpha.1 — costruzione modulare, incremento 1: report di consegna

## Consegna

- **Build giocabile**: https://claude.ai/artifact/13KmVPEAsCuY4voPUpU3j5 (versione 8 della pagina; si gioca nel browser). Il link è
  privato: lo vede solo chi ha accesso.
- **Commit**: `2223c56aff1021b04a8c3a4f215ccdb33c70a9af` sul ramo `scrapbot-city-prototype`. La build è stata fatta da questo
  commit: `npx vite build` → `dist/index.html`, un file unico di 1.394.714 byte, sha256
  `822ce98c3efcdcb655d2402dd64db41fb8531a8c4bac5e638fe504ba00afec9f`. È la stessa build pubblicata al link sopra.
- **Versione** nel menu: «Build_0.7.0-alpha.1 · Oct 11 2026».
- **Screenshot**: `docs/inc1/`, tutti dalla build di rilascio consegnata (come sono stati preparati: vedi «Screenshot»).
- **Dettaglio delle modifiche**: `CHANGELOG.md`, sezione 0.7.0-alpha.1. **Specifica**: `docs/MODULAR-INC1.md`.

**Nessuna prova è stata fatta su hardware vero.** «Mouse simulato», «touch CDP» e «Gamepad API simulata» sono input generati da
Playwright in Chromium senza schermo e senza GPU. La durata di 4–6 ore **non** è dichiarata: non c'è ancora stato nessun playtest.

## In breve

| | |
|---|---|
| Implementato | i sei elementi concordati, e nient'altro (tabella sotto) |
| Flusso acquisto → posa → funzionamento → salvataggio → chiusura e riapertura → caricamento → demolizione | superato con mouse simulato (66/66), touch CDP (58/58) e Gamepad API simulata (60/60) |
| Si paga una volta, solo alla conferma; annullare è gratis | superato in tutti i flussi e in circa 1.800 azioni casuali con i tre input: nessuna risorsa creata o persa fuori listino |
| Salvataggi vecchi | 0.6.0, 0.6.1 e 0.5.1 si caricano; il file di prova 0.6 si carica dal menu anche nella build di rilascio |
| Prima città senza comprare nessuno dei sei oggetti | vinta due volte (finale verde al giorno 10 e 11, 3 stelle, 0 oggetti) giocando dall'interfaccia vera |
| Suite esistenti | tutte verdi (unica eccezione: 3 nomi lunghi nella barra a 1024×640, identici nella 0.6.1) |
| Bilanciamento | invariato: nessun numero degli edifici originali è cambiato; senza oggetti la simulazione è identica alla 0.6.1 byte per byte |
| Due quartieri diversi con gli stessi edifici | screenshot 01–04 |

## IMPLEMENTATO

| Elemento | Costo | Effetto | Rimborso |
|---|---|---|---|
| Pavimento industriale | 3 crediti a casella | decorazione; ci si costruisce sopra e riappare dopo una demolizione | 1 credito |
| Recinzione | 4 crediti a casella | decorazione; si raccorda da sola con recinzioni e cancelli (angoli, T, incroci) | 2 crediti |
| Cancello | 12 crediti | decorazione; 2 versi, si allinea alle recinzioni | 6 crediti |
| Lampione | 10 crediti + 2 pezzi | decorazione; 4 direzioni, luce di notte | 5 crediti + 1 pezzo |
| Deposito aggiuntivo (Bot Dock) | 30 crediti + 15 pezzi | deposito del Dock 80 → 180 rottami; silos visibili sul tetto | 15 crediti + 7 pezzi |
| Filtro antismog (Fonderia) | 45 crediti + 20 pezzi | smog della Fonderia +2,1 → +0,8 al giorno, energia −2 → −3, stessa produzione; torre del filtro con ventola, vapore chiaro invece del fumo scuro | 22 crediti + 10 pezzi |

**Regole**
- Si paga una sola volta, alla conferma (clic, tocco o A). L'anteprima e l'annullamento non costano nulla.
- Trascinando col tasto sinistro si posa una fila di pavimenti o recinzioni, anche ad L. Si paga ogni casella posata; le caselle
  non valide vengono saltate gratis.
- Rimborsi a metà prezzo, per difetto: rimuovere e ricomprare non crea mai risorse.
- Un modulo per tipo, solo su un edificio finito. La demolizione di un edificio rimborsa anche i suoi moduli e mostra il totale
  prima della conferma.
- Simulazione e interfaccia usano gli stessi numeri: quello che il pannello mostra «prima → dopo» è quello che succede.
- Pavimenti e oggetti non cambiano le regole degli edifici, dei bot (volano sopra) e della spazzatura. Gli oggetti solidi stanno
  in uno strato separato dall'occupazione degli edifici. I cittadini girano attorno agli oggetti.
- Salvataggi: stesso formato (versione 2) con campi nuovi facoltativi, quindi i salvataggi vecchi si caricano invariati.

**Interfaccia e comandi**
- Pulsante «Oggetti e moduli» (tasto `O`) nella colonna Strumenti; la barra non si allarga. Pannello laterale con «Costruzioni» e
  «Moduli macchina»: icona, nome, costo, effetto, limite e, se non disponibile, il motivo.
- Anteprima verde o rossa sulla mappa, con il motivo scritto («C'è una recinzione: rimuovila prima», «Già installato»…) o, per i
  moduli, l'effetto («Storage 80 -> 180»).
- Rotazione: `R`, `Shift+R`, `Shift` + rotellina; `Y` sul controller quando l'oggetto in mano si può ruotare; «⟳ Ruota» sul touch.
  Cancello e lampione già posati si ruotano dal loro pannello.
- Annullare: `Esc`, clic destro, `B`, «Fatto». Il tasto sinistro del mouse continua a non spostare mai la mappa.
- Pannello del Dock e della Fonderia: sezione «Moduli» con prima → dopo, «0/1» o «1/1», Installa (disattivato col motivo) e
  Rimuovi col rimborso e con l'avviso se si perdono rottami.
- Pannello di un oggetto selezionato: nome, «Decorazione: nessun effetto sull'economia», Ruota, Rimuovi.
- La ruspa toglie oggetti e pavimenti liberi col rimborso, anche un oggetto nascosto dietro un edificio.
- Tutti i testi in 8 lingue; i prezzi usano il singolare per 1 («1 credito», in polacco «1 część»).

**Correzioni fatte durante la verifica** (oltre al lavoro dei pacchetti, ognuno già revisionato):
- la conferma di «Demolisci» e di «Rimuovi modulo» ignora i clic nei primi 350 ms: prima un doppio clic demoliva senza far vedere
  la conferma (succedeva già nella 0.6.1);
- le scritte sulla mappa evitano la barra in alto, la barra degli strumenti, il pannello laterale aperto e la carta dell'obiettivo;
- la sagoma di un edificio colora di rosso la casella occupata da una recinzione, un cancello o un lampione;
- un oggetto nascosto del tutto dietro un edificio si toglie con la ruspa (prima 5–6 su 106 erano irraggiungibili in una prova
  densa).

## VERIFICATO

Tutto sulla build finale (`2223c56`), salvo dove indicato. Accanto a ogni prova: l'input usato.

**Flusso completo**, 1280×800, tappe:
1. Dock e Fonderia dalla barra, anteprime annullate;
2. 6 pavimenti, un recinto di 13 recinzioni con 4 angoli e un cancello;
3. 2 lampioni ruotati in mano, un lampione già posato ruotato dal suo pannello;
4. deposito del Dock, filtro della Fonderia, funzionamento;
5. salvataggio dal menu di pausa, chiusura della scheda, apertura di una nuova, «Carica partita»;
6. demolizione del Dock col deposito.

| Input | Esito |
|---|---|
| Mouse simulato (con tastiera) | 66/66 |
| Touch CDP | 58/58 |
| Gamepad API simulata (anche salvataggio e caricamento dai menu solo col controller) | 60/60 |

Con ciascuno dei tre: annullamenti gratis; ogni acquisto pagato una volta al prezzo del listino; rotazione; deposito della città
230 → 330 con i rottami saliti oltre il vecchio limite; smog della Fonderia 0,0350 → 0,0140 al secondo misurato nella
simulazione; energia +1; dopo chiusura e riapertura tornano tutti gli oggetti con la loro rotazione e i due moduli; la
demolizione del Dock paga esattamente quello che la conferma mostra (+35 crediti + 12 pezzi), avvisa dei rottami persi e non lascia
moduli orfani.

**Prove «da giocatore ostile»** (verifica indipendente, build debug dello stesso commit): 450 azioni casuali col mouse simulato,
220 col touch CDP (in italiano), 140 con la Gamepad API simulata (in polacco, 1024×640), più circa 1.000 sulle build precedenti.
Clic e doppi clic ovunque, file trascinate su caselle occupate, Esc e tasto destro a metà trascinamento, ruspa, tutti i pulsanti
dei pannelli con ritardi a caso, demolizioni, salvataggio e riapertura a metà, tempeste, soldi a zero. Dopo ogni azione: ogni
variazione di crediti e pezzi spiegata dal listino, nessun modulo doppio o orfano, deposito coerente, nessun oggetto su edifici o
spazzatura. **Nessuna violazione.** 27 conferme di demolizione lette e confrontate con il rimborso pagato: tutte uguali.

**Edifici e oggetti raggiungibili** (mouse simulato, zoom 1–5): 10 tipi di edificio circondati da 106 oggetti; ogni edificio si
seleziona e si apre col clic (11/11); 106 oggetti su 106 si tolgono con un clic della ruspa, col rimborso esatto.

**Salvataggi vecchi** (mouse simulato): città salvate dalla 0.6.0, dalla 0.6.1 e da una build intermedia, aperte con «Continua»:
11/11 ciascuna. File di prova 0.6 caricato da «Carica partita»: build di debug 10/10, **build di rilascio 7/7**. Salvataggio
0.5.1: 8/8.

**Prima città senza nessuno dei sei oggetti**: uno script gioca la prima città della campagna cliccando l'interfaccia vera (mouse
simulato) con i soli edifici originali. Due partite: finale verde al giorno 10 (circa 9,5 minuti di gioco a velocità 1) e al
giorno 11; 3 stelle; 0 oggetti e 0 moduli comprati; nessun problema. Lo script legge lo stato dall'aggancio di test, quindi gira
sulla build di debug dello stesso commit; sulla build di rilascio una prova solo dallo schermo (menu, prima città, un edificio, una
recinzione, un'anteprima annullata) passa 10/10.

**Suite già esistenti**, rieseguite sulla nuova build:

| Suite | Input | Esito |
|---|---|---|
| test unitari (vitest) | — | 117/117 |
| tipi e traduzioni (640 chiavi × 8 lingue) | — | superati |
| iso-check (disegno, clic, controller) | mouse simulato, Gamepad API simulata | 23/23 |
| touch-check | touch CDP | 9/9 |
| progression | simulazione | 9/9 |
| decor-check | mouse simulato | 7/7 |
| camera (il sinistro non sposta la mappa, gli angoli si raggiungono) a 1280×800, 660×1000, 1920×1080 | mouse simulato, touch CDP, tastiera | 13/13 ciascuna |
| edge scroll | mouse simulato | 12/12 |
| tutorial in inglese, tedesco, polacco, francese | mouse simulato | finito ×4 |
| partita solo col controller | Gamepad API simulata | finita |
| salvataggi | mouse simulato | 74/74 |
| build di rilascio (nessun trucco di debug dentro) | — | 36/36 |
| campagna, tutte le città e i finali | simulazione, mouse simulato | 109/109 |
| barra e pannelli in 8 lingue × 3 dimensioni | mouse simulato | 21/24: i 3 casi sono Scrap Burner (es, pt) e Fix-It Lab (pl) a 1024×640, identici nella 0.6.1; i pannelli nuovi 16/16 |

**Bilanciamento**: `src/game/defs.ts` identico alla 0.6.1; `npm run waits` e `npm run balance` (stessa sequenza casuale) danno
uscite identiche byte per byte alla 0.6.1.

## NUMERI

**Flusso completo col mouse simulato** (il denaro di partenza è impostato con l'aggancio di test per poter comprare tutto; edifici e
acquisti passano dall'interfaccia vera). Touch e controller hanno le stesse variazioni a ogni passo.

| Passo | Crediti | Δ | Pezzi | Δ | Deposito | Oggetti | Pavimenti |
|---|---:|---:|---:|---:|---:|---:|---:|
| partenza | 1000 | | 200 | | 150 | 0 | 0 |
| Bot Dock | 960 | −40 | 190 | −10 | 150 | 0 | 0 |
| Fonderia | 930 | −30 | 190 | 0 | 150 | 0 | 0 |
| cantieri finiti, Fonderia al lavoro | 940,5 | +10,5 | 190 | 0 | 230 | 0 | 0 |
| anteprime e annullamenti | 940,5 | 0 | 190 | 0 | 230 | 0 | 0 |
| 6 pavimenti (2 file trascinate) | 922,5 | −18 | 190 | 0 | 230 | 0 | 6 |
| 13 recinzioni | 870,5 | −52 | 190 | 0 | 230 | 13 | 6 |
| cancello | 858,5 | −12 | 190 | 0 | 230 | 14 | 6 |
| 2 lampioni | 838,5 | −20 | 186 | −4 | 230 | 16 | 6 |
| deposito del Dock | 808,5 | −30 | 171 | −15 | 330 | 16 | 6 |
| secondo deposito (rifiutato) | 808,5 | 0 | 171 | 0 | 330 | 16 | 6 |
| filtro della Fonderia | 763,5 | −45 | 151 | −20 | 330 | 16 | 6 |
| funzionamento, i bot riempiono il deposito più grande | 819,7 | +56,2 | 151 | 0 | 330 | 16 | 6 |
| salvato, chiuso, riaperto, caricato | 820,0 | | 151 | | 330 | 16 | 6 |
| Dock demolito col deposito | 855,0 | +35 | 163 | +12 | 150 | 16 | 6 |

**Rimborsi pagati, misurati**: recinzione 2; cancello 6; lampione 5 + 1 pezzo; pavimento 1; deposito 15 + 7; filtro 22 + 10;
demolizione del Dock col deposito 35 + 12; della Fonderia col filtro 37 + 10.

**Prestazioni** (tempo medio di disegno di un fotogramma, città di 120 edifici, Chromium senza GPU, due giri):

| Scena | 0.6.1 | 0.7.0-alpha.1 senza oggetti | 0.7.0-alpha.1 con 400 pavimenti, 365 oggetti, 24 moduli |
|---|---|---|---|
| zoom 1, giorno | 2,08 / 2,14 ms | 2,02 / 1,93 ms | 4,09 / 4,13 ms |
| zoom 1, notte | 2,34 / 2,24 ms | 2,24 / 2,28 ms | 4,11 / 4,37 ms |
| zoom 3, giorno | 1,37 / 1,34 ms | 1,36 / 1,34 ms | 1,80 / 1,64 ms |

58–60 fotogrammi al secondo in tutti i casi. Senza oggetti il disegno è identico al pixel in tutte le viste confrontate
(giorno e notte, zoom 1 e 3, selezione, anteprime, ruspa, movimento ridotto); cambia solo la posizione delle scritte che
finirebbero sotto le barre o i pannelli.

## Attese (misura sulla 0.6.1, nessun riequilibrio)

Dettaglio in `docs/WAITS.md` (si rigenera con `npm run waits`). Tempi in secondi di simulazione; 1 giorno = 60 s; a velocità 3 un
secondo reale vale 3 s di gioco.
- **Attesa consecutiva più lunga**: in tutte e 10 le partite (5 città × 2 percorsi) è il risparmio per la Guglia, da 150 a 614 s,
  cioè 3–10 minuti a 1× e 1–3 minuti a 3×.
- **Causa**: non è sempre la stessa. Nel verde di Neon Heights e Company Town mancano i crediti; nell'industriale il Riciclatore
  resta spesso senza rottami (66–78% del tempo, i rottami vanno a Fonderie e Bruciatori); a Greenvale verde manca energia.
- **Alternative convenienti**: quasi sempre un Riciclatore in più (50 crediti, da −28 a −252 s); a Neon verde una Fonderia (−250 s,
  inquina); a Company Town verde nessuna delle mosse provate aiuta.
- Le misure vengono da un pilota automatico, non da persone. I sei oggetti non sono stati pensati per riempire queste attese; il
  deposito del Dock non le accorcerebbe dove mancano i crediti.

## LIMITI NOTI

- **Finestre piccole**: a 1280×720 e 1024×640 il catalogo scorre (a 1024×640, con un oggetto in mano, si vede circa una voce e
  mezza); la sezione «Moduli» del pannello dell'edificio parte sotto il bordo. Si scorre con rotellina, dito o stick destro.
- **Scritte sulla mappa** a zoom alto su finestre piccole (1024×640 a zoom 5; 800×600 e 660×1000 da zoom 3): la scritta lunga del
  filtro non trova spazio libero e finisce sotto il pannello o la carta dell'obiettivo.
- **Fila trascinata fin sopra un pannello**: se si rilascia il tasto sopra il pannello aperto o la barra, la fila arriva fino alla
  casella nascosta sotto quel punto, e quelle caselle si pagano. Esc o tasto destro prima di rilasciare annullano gratis.
- **Ruspa dietro un edificio**: con la ruspa in mano, un clic sulla parte alta di un edificio che ha dietro un oggetto toglie
  l'oggetto invece di selezionare l'edificio (l'edificio è disegnato trasparente, ma resta evidenziato, come già nella 0.6.1 con
  le macerie). Senza ruspa il clic seleziona sempre l'edificio.
- **Conferme di «Demolisci» e «Rimuovi»**: ignorano i clic nei primi 350 ms; chi conferma molto in fretta deve cliccare di nuovo.
- **Grafica**: i cartelli di pericolo stanno solo alle estremità delle file di recinzione; una recinzione che arriva ad angolo
  retto sul fianco di un cancello si ferma al bordo della casella; i silos del deposito sono piccoli allo zoom normale.
- **Già nella 0.6.1**: a 1024×640 il fumetto del tutorial può coprire un pannello; ai bordi degli sprite il clic può cadere un
  pixel d'arte più in là; tre nomi lunghi escono dalla carta della barra a 1024×640; sotto i 640 px di larghezza carta
  dell'obiettivo e pannello si sovrappongono.
- **Gli script di verifica** sono nella cartella di lavoro di questa sessione, non nel repository.

## DA PROVARE

Cose che solo hardware vero o persone vere possono confermare:
- **Steam Deck e controller veri** (sensazione dello stick, cursore, leggibilità sullo schermo piccolo, prestazioni sulla sua GPU).
- **Schermi touch veri** (precisione del dito su oggetti piccoli come lampioni e recinzioni).
- **Build Windows/Electron**: la suite Electron non è stata eseguita per questo incremento; il pacchetto Steam è su un ramo separato
  (`steam-package`) e va rifatto da questa versione.
- **Suono**: tutte le prove girano a volume zero.
- **Con giocatori veri**: si trova il pulsante «Oggetti e moduli» senza aiuto? Si capisce il motivo di un'anteprima rossa? Allo zoom
  normale si riconoscono i silos e la torre del filtro? La ruspa che toglie un oggetto dietro un edificio è comoda o sorprende?
- **La domanda decisiva del playtest** (`docs/PLAYTEST.md`): «Dopo aver capito come funziona, ti viene spontaneamente voglia di
  costruire ancora qualcosa?». E nei momenti di attesa: «Che cosa volevi fare in quel momento, e cosa te lo impediva?».
- **Durata**: la durata di 4–6 ore **non è dichiarata**. L'unico tempo misurato è quello di uno script che gioca bene (prima città
  in circa 9,5 minuti di gioco a velocità 1), e non dice quanto giocherà una persona.

**Non in questo incremento** (passo successivo, come concordato): gli altri 18 oggetti, i nuovi eventi, la modalità infinita.

## Screenshot

Tutti in `docs/inc1/`, dalla **build di rilascio consegnata**:

| File | Cosa mostra |
|---|---|
| `01-two-districts-day.png`, `02-two-districts-night.png` | i due quartieri con gli stessi edifici: a sinistra cortile industriale recintato con pavimenti, lampioni, cancello, Fonderie col filtro e Dock col deposito; al centro gli stessi edifici senza oggetti |
| `03-district-A-yard-day.png`, `04-district-B-open-day.png` | i due quartieri da vicino |
| `05-dock-with-storage-day.png`, `14-docks-with-and-without-storage-day.png` | Dock col deposito, e confronto con e senza |
| `06-smelter-with-filter-day.png`, `07-smelter-with-filter-night.png`, `13-smelters-with-and-without-filter-day.png` | Fonderia col filtro di giorno e di notte, e confronto con e senza |
| `08-catalog-panel.png` | il pannello «Oggetti e moduli» |
| `09-…-1280x800.png`, `10-…-1024x640.png` | l'effetto del filtro scritto sulla mappa accanto al pannello aperto |
| `11-panel-smelter-filter-installed.png`, `12-panel-dock-storage-not-installed.png` | la sezione «Moduli» nel pannello dell'edificio, con prima → dopo |
| `release-smoke-fence-preview.png`, `release-smoke-after.png`, `fixture-06-release.png` | fatti solo dall'interfaccia della build di rilascio: anteprima di una recinzione, dopo l'acquisto, il salvataggio 0.6 caricato dal menu |

**Come sono state preparate le scene 01–14**: la città è costruita con le regole del gioco sulla build di debug dello stesso commit
(edifici, oggetti e moduli comprati come nel gioco; denaro e rottami impostati a mano per la messa in scena; eventi e tempeste
spenti), salvata, copiata in un profilo nuovo della build di rilascio e aperta con «Continua» dal menu. Inquadratura, apertura del
catalogo e clic sugli edifici sono input veri sulla build di rilascio. Il gioco è in inglese negli screenshot.
