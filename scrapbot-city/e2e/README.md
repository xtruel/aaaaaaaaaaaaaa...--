# Test end-to-end

La suite gioca Scrapbot City in Chromium headless attraverso l'interfaccia vera: menu, barra, catalogo, pannelli,
mappa. Ogni test è un processo Node con il suo browser; il runner costruisce le build, esegue i test, stampa una
tabella con l'input di ogni riga ed esce con 1 se un test fallisce.

## Come si esegue

```sh
npm run e2e                      # tutto (circa 25 minuti con 2 test alla volta su 4 core)
npm run e2e -- items-pad         # un test per nome
npm run e2e -- 'items-*' saves   # più test; un nome che finisce con * è un prefisso
npm run e2e:list                 # i test, il loro input e cosa coprono
npm run e2e -- --jobs 1          # un test alla volta (macchina carica); default 2
npm run e2e -- --no-rerun        # un test fallito non viene rieseguito da solo
npm run e2e -- --rebuild         # rifà le build anche se ci sono già
node e2e/tests/items.mjs '{"input":"pad"}'   # un test a mano, con la sua configurazione in JSON
```

Serve Node 22 e Playwright, che **non** è una dipendenza del progetto: viene cercato in `PLAYWRIGHT_MODULE` (nome o
cartella del pacchetto), poi con la risoluzione di Node da questo repository, poi in `/opt/node22/lib/node_modules`.
Il browser è quello di Playwright (`PLAYWRIGHT_BROWSERS_PATH`).

Le build si fanno da questo checkout con il Vite del progetto, in `.cache/e2e/<commit>/`:
`debug/` (`NODE_ENV=development vite build --mode development`, con l'aggancio `window.scrapbot`) e `release/`
(`vite build`, senza aggancio). Un checkout con modifiche ai file del gioco usa `<commit>-dirty-<hash>` e ricostruisce
ogni volta. `E2E_DEBUG_DIR` / `E2E_RELEASE_DIR` puntano la suite a build fatte altrove.

Risultati in `.cache/e2e/<commit>/runs/<data>/`: per ogni test `log.txt` (una riga PASS/FAIL per controllo),
`result.json` e `shots/` (le immagini); in cima `summary.txt` con la tabella.

## Cosa copre ogni test

| test | input | cosa verifica |
|---|---|---|
| `release-smoke` | mouse | build release: niente aggancio né source map né risorse di rete, font incorporati; tutti i dialoghi del menu, lingua italiana e ritorno, una città, il menu di pausa, il catalogo; 120 tasti non cambiano le risorse; nessuna richiesta esterna, nessun errore; solo chiavi di salvataggio del prodotto |
| `items-mouse` / `-touch` / `-pad` | uno per riga | i 24 oggetti: prezzo visibile prima di comprare, presa dal catalogo, rotazione in mano, posa con una pressione (pagata una volta, lo strumento resta), strumento messo via (gratis; la sua riga del catalogo resta in vista), selezione con il pannello giusto, rotazione dal pannello, spostamento delle 10 decorazioni (uno annullato, una destinazione rifiutata), salvataggio, ricarica della pagina, Carica, rimozione con rimborso mostrato = pagato, i moduli installati e tolti dal pannello dell'edificio; registro delle risorse che si chiude |
| `comfort-*` | uno per riga | le regole di comodità sui 24 oggetti: prezzo prima dell'acquisto, una panoramica con lo strumento in mano non compra, una pressione = un addebito, doppia pressione a cavallo di due caselle = un pezzo, doppia pressione su un edificio = un modulo, pannello smog aperto: la pressione lo chiude soltanto, annullare è gratis; evento della storia risposto con doppia pressione, × dello smog premuto due volte, doppia pressione su una riga del catalogo |
| `discovery-*` | uno per riga | profilo nuovo: schede e filtri del catalogo con i conteggi, i quattro stati delle righe, una riga da scoprire rifiutata con l'obiettivo; Miso accarezzato tre volte → avviso "Nuovo progetto" lontano dalla pressione → Apri → catalogo sulla riga, niente comprato → acquisto; progetto e trofeo insieme (10 abitanti, preparato): una pressione mirata su Apri raggiunge Apri; salvataggio, ricarica, Carica: progetti dal profilo, nessun avviso ripetuto |
| `module-slots` | mouse | lo slot del Riciclatore nei cinque stati (Non ora, Da scoprire con obiettivo e avanzamento, Installabile, Installato, Slot occupato) sulla città 0.6 di `tests/fixtures` |
| `saves` | mouse | slot e autosalvataggio, Continua, Carica, il carico dei bot conservato, gli avvisi di perdita di magazzino uguali a quanto succede, doppio clic su Demolisci = un rimborso, i salvataggi 0.6 e 0.7.0-alpha.1 di `tests/fixtures` (copia di sicurezza prima di sovrascrivere), il tutorial sopra un vecchio autosalvataggio, la build release |
| `double-press-*` | uno per riga | doppie pressioni a 120 e 450 ms su Rimuovi, Demolisci, la conferma di rimozione, Installa dopo una rimozione, Sposta e Fatto di una decorazione |
| `covered-*` | uno per riga | una recinzione dietro un edificio: la prima pressione seleziona l'edificio disegnato, la seconda raggiunge la recinzione, la ruspa la toglie |
| `left-mouse` | mouse | il tasto sinistro non sposta mai la mappa, in ogni stato; destro e centrale sì |
| `fit` | nessuno (misure nel DOM) | barra, catalogo e pannelli in 8 lingue a 1024x640, 1280x720, 1280x800, 1920x1080: niente tagliato o fuori dalla finestra, ogni riga raggiungibile e leggibile |
| `campaign-home` | mouse | la prima città della campagna giocata fino alla fine con soli edifici (zero oggetti del catalogo, zero moduli), con eventi della storia e tempeste |
| `cities` | mouse | le cinque città aperte dalla build release, immagini di giorno e di notte |

## Cosa sono gli input (e cosa non sono)

Tutti gli input sono **simulati** in Chromium headless su Linux: il mouse e la tastiera di Playwright, eventi touch
CDP (`Input.dispatchTouchEvent`), un gamepad finto dietro `navigator.getGamepads()` che il gioco legge come uno vero.
**Nessuno è hardware reale.** Un PASS qui non certifica Steam Deck, Windows, un controller o uno schermo touch veri,
e una partita giocata da uno script non misura il divertimento né il tempo di un giocatore.

L'aggancio `window.scrapbot` della build debug serve a **leggere** la città e a **preparare** una scena (denaro,
edifici finiti messi con le regole del gioco, eventi rimandati, l'inquadratura); ogni preparazione è scritta nel log.
Ogni pressione passa dall'input del test. La suite non usa mai risorse infinite.

## Tempi e attese

Le attese sono sullo stato del gioco o sul DOM (controllato a ogni fotogramma), non su pause fisse; l'interfaccia del
gioco si aggiorna ogni 0,1 s e i test la aspettano. L'unico ritmo fisso è quello fra due pressioni volute (700 ms):
le protezioni contro la doppia pressione del gioco valgono 600 ms. Un test che fallisce mentre altri girano viene
rieseguito **da solo**: nella tabella appare `FLAKY` se da solo passa, `FAIL (also alone)` se fallisce di nuovo.

Tempo misurato sul commit 97248dd (4 core, altri agenti con i loro browser attivi): 23,6 minuti con `--jobs 2`, in
due esecuzioni complete. Sulla 0.7.0-beta.1 (cec158d): 21,3 e 21,2 minuti in due esecuzioni complete, 22/22 tutte e
due le volte, nessun test rieseguito. Con `--jobs 1` non è stato misurato: la somma dei tempi dei singoli test è circa
41 minuti. I test più lunghi sono `items-pad` (5,3 min), `items-touch` (4,5), `comfort-pad` (4,4), `campaign-home`
(4).

## Fallimenti noti

Nessuno sulla 0.7.0-beta.1. Su 97248dd il test `fit` falliva a 1024x640 in spagnolo, portoghese e polacco (i nomi
"Incineradora" e "Naprawialnia" uscivano dal loro pulsante nella barra): la rifinitura G5 li fa stare nella scheda e
`fit` passa. La prima esecuzione sulla build G5 ha trovato un difetto vero introdotto dalla rifinitura (la riga
dell'oggetto appena messo via usciva dalla lista del catalogo): corretto, e `items-*` ora lo controlla.

Ritirato, non nella suite: `label-sweep-1024-de` dei vecchi script (la scritta sulla mappa dell'effetto del filtro
antismog in tedesco, circa 715 px a zoom 5, accanto al catalogo largo 400 px su una finestra di 1024x640). Il gioco
promette dalla 0.7.0-alpha.1 che le scritte sulla mappa restano fuori dai pannelli "quando nella finestra c'è posto"
e che a zoom alto su una finestra piccola una scritta lunga può restarci sotto (CHANGELOG): lo script chiedeva una cosa
che il gioco non promette. Andare a capo su due righe sarebbe una decisione di prodotto, non un difetto.
