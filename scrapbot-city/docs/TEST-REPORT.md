# Scrapbot City 0.6.0 — rapporto di test della release candidate

Data: 10 ottobre 2026. Build provate:

| Build | Dove | Cosa è |
|---|---|---|
| **Release** | `scrapbot-city/dist/index.html` (1,29 MB, un solo file) | `npm run build`; è quella che va su Steam (Electron) e nel browser |
| Debug | creata con `NODE_ENV=development npx vite build --mode development --outDir <cartella>` | uguale, più `window.scrapbot` per gli script di test |
| Desktop | `npm run dist:linux` → `release/linux-unpacked/` | Electron 33 con la build di release dentro `app.asar` |

Tutti i numeri qui sotto vengono dall'ultima esecuzione completa, sulle build generate dal codice finale
(release delle 19:32 UTC, versione 0.6.0 in menu, crediti e `package.json`).

## 1. Riepilogo

| Area | Risultato |
|---|---|
| Test automatici (vitest, 11 file) | **50 / 50** |
| Rendering isometrico: casella sotto il mouse, clic sugli edifici, piazzamento, tastiera, rotella, D-pad, H/Home, demolizione | **23 / 23** |
| Touch (trascinamento, pinch, tap, costruzione col dito) | **9 / 9** |
| Progressione completa dall'interfaccia: Nuova partita → costruzione col mouse → produzione → salvataggio → caricamento → riavvio pagina | **9 / 9** |
| Decorazioni e scenografia: mai d'intralcio a costruzione e clic | **7 / 7** |
| Casi limite (smog, retry, ispettore, pausa produzione, demolizione, macerie, banca, finale) | **12 / 12** |
| Salvataggi della 0.5.1 caricati dalla 0.6 | **8 / 8** |
| Tutorial (7 passi) col mouse | completato in 17,5 s, achievement sbloccato, nessun problema |
| Tutorial e menu col solo controller | completati, 22 pressioni, nessun problema |
| Regressioni dei salvataggi (ogni bug trovato dagli audit) | **74 / 74** |
| Igiene della build di release (niente trucchi, niente gancio di test, sorgente aggiornato) | **36 / 36** |
| Exploit della banca regionale (crediti infiniti) | **5 / 5** (chiuso) |
| Campagna completa: 5 città, percorso verde e industriale, sconfitta per smog, finale regionale | **109 / 109** |
| App desktop Electron (avvio, fullscreen, tasti, controller, salvataggi su file, pacchetto Linux, Steam con modulo finto) | **70 superati, 1 fallito, 3 non eseguibili** (vedi §5) |
| Prestazioni | 60 fps a 1280×800, 59–60 fps a 2560×1440 con 121 edifici e 35 bot a velocità massima |
| Stabilità a lungo termine | 40 giorni di gioco (test) e 15 giorni nel browser: nessuna crescita di memoria o oggetti |

L'unico controllo fallito è l'integrazione **reale** con Steam (achievement e Cloud): è **in sospeso**,
perché servono l'App ID e il modulo `steamworks.js`, che non sono ancora nel progetto (vedi §5).

## 2. Test automatici (`npm test`)

| File | Cosa verifica |
|---|---|
| `tests/iso.test.ts` | proiezione isometrica e ritorno, casella giusta per ogni pixel a ogni zoom, ordinamento per profondità (3×3 accanto a 1×1, bot sopra un tetto, 300 oggetti) |
| `tests/art.test.ts` | l'atlante ha tutti i fotogrammi di ogni edificio; ogni passo dell'animazione cambia ≥ 0,4% dei pixel; "spento" è diverso da "al lavoro"; i cantieri crescono; bot, terreno e lampioni (anche l'alone notturno) |
| `tests/timing.test.ts` | stessa produzione a 1×, 2× e 3× e a 144/60/30/10/4 fps; nessun tempo perso con frame lenti; l'Inceneritore non perde corrente tra due carichi |
| `tests/stability.test.ts` | una città completa gioca 40 giorni alla velocità massima con eventi, salvando e ricaricando ogni 5 giorni: niente NaN o valori negativi, occupazione delle caselle coerente, nessuna lista che cresce senza limite; una città lasciata a sé per 25 giorni |
| `tests/saves.test.ts`, `tests/storage.test.ts` | niente autosalvataggio durante lo smog; salvataggi danneggiati o di versioni più nuove mai sostituiti; file del desktop accettati solo se validi |
| `tests/economy.test.ts` | banca e riavvio della città, scambi bloccati nello smog, barra del percorso al limite, magazzino dopo una demolizione, bot dei Dock, offerta dei propulsori |
| `tests/modal.test.ts` | Esc/B tornano indietro di un passo; i dialoghi con due scelte non si chiudono da soli; il focus torna a chi ha aperto il dialogo |
| `tests/objectives.test.ts`, `tests/tutorial.test.ts` | evidenziazione del prossimo passo; tutorial: scheda obiettivo, strumento rilasciato dopo ogni costruzione, testi per controller |
| `tests/smoke.test.ts` | una partita parte e la simulazione gira |

## 3. Verifiche nel browser (Playwright, interfaccia reale)

Gli script sono in `scratchpad/` della sessione di sviluppo; ognuno stampa una riga PASS/FAIL per controllo.

**Isometrico e input** (`iso-check.mjs`, `touch-check.mjs`)
- Casella sotto il mouse: centro e angoli di ogni casella a zoom 1–5, 891 punti, tutti giusti.
- Clic sul tetto dell'HQ disegnato sopra un'altra casella → si apre l'HQ; un edificio coperto da un altro → si prende quello davanti.
- Piazzamento col mouse sulla casella sotto il cursore a zoom 1, 2, 3, 4.
- Tastiera (WASD, +/−), rotella che zooma attorno al cursore, D-pad lungo gli assi della griglia, A che costruisce.
- H (e Home) riportano la camera sull'HQ; bulldozer → Demolisci → conferma → l'edificio sparisce e crolla sullo schermo.
- Touch: un dito sposta la mappa esattamente col dito, pinch zooma in e out, il tap apre l'edificio, il tap con uno strumento costruisce, il trascinamento con uno strumento sposta senza costruire.

**Progressione completa** (`progression.mjs`): Nuova partita → Partita libera con nome e seme → Invio →
Riciclatore e Bot Pods dalla barra con il mouse → velocità massima finché i bot raccolgono, il Riciclatore produce
pezzi e arrivano cittadini → Pausa › Salva › Slot 1 → si continua a giocare → Pausa › Carica › Slot 1 → stessa città
(stessi edifici, obiettivi e percorso; tempo e risorse entro un passo di simulazione) → ricarica della pagina →
Continua riapre la città. Nessun errore.

**Decorazioni** (`decor-check.mjs`): 138 elementi di scenografia di 25 tipi attorno alla mappa, **0 dentro la mappa**;
8 stili di terreno decorativo presenti, e su ognuno un Giardino si costruisce cliccando (24/24); cliccare la scenografia
non seleziona mai un edificio per errore; un bot in volo davanti all'HQ non ne blocca il clic.

**Tempi di produzione a 1×, 2× e massima velocità**: `tests/timing.test.ts` (stessi eventi di produzione, allo stesso
tempo di gioco, a ogni velocità e frequenza dei fotogrammi) e la campagna: a velocità 3 ogni città fa 120 s di gioco in
40,7–41,3 s reali (2,91–2,95×, pause per gli eventi comprese).

## 4. Salvataggi

- **Regressioni** (`verify-saves/regress.mjs`, 74/74, su build di debug e di release):
  - **fine tutorial con una città salvata:** "Tieni la mia città" la conserva; Esc, alt-tab o la chiusura della finestra mentre la domanda è aperta non la sovrascrivono più;
  - **salvataggio della campagna non caricabile:** mostra "Impossibile caricare" e non viene sostituito;
  - **smog:** durante il conto alla rovescia nessun salvataggio automatico (cambio giorno, finestra nascosta, banca), e "Carica l'ultimo salvataggio" dà una città vincibile;
  - **slot manuale:** una città caricata da uno slot continua a salvarsi lì;
  - **eventi e HUD:** un evento in sospeso viene salvato e l'HUD dopo il caricamento è corretto;
  - gli altri casi degli audit.

  Gli stessi controlli **falliscono sulla 0.5.1**: la prova che catturano davvero i bug originali.
- **Compatibilità**: le città salvate con la 0.5.1 si caricano nella 0.6 senza perdite (8/8).
- **Desktop**: salvataggi su file con scrittura atomica e copia `.bak`; un file rovinato non sovrascrive mai il backup buono;
  salvataggio e "Continua" funzionano anche dal pacchetto Linux generato da electron-builder.

## 5. App desktop, Steam e controller

`verify-electron/electron.mjs` (Electron 33.4, Xvfb, profili separati): **70 superati**.
- **Avvio**: finestra in ~0,5 s, menu pronto in ~0,85 s, nessun errore; ponte desktop presente e nessun gancio di test.
- **Fullscreen**:
  - Impostazioni › Schermo intero acceso e spento;
  - F11 dentro e fuori, anche con le impostazioni aperte;
  - Esc nel menu non esce dal fullscreen;
  - al riavvio parte come era stato lasciato.
- **Tasti**: 1–0 e M per gli strumenti, X bulldozer, Esc pausa, Spazio pausa/riprendi, Tab velocità, Q consiglio, +/− zoom, WASD/frecce, H.
- **Controller**: menu col D-pad, cursore virtuale, RB/LB per gli strumenti, A costruisce, B annulla, Start pausa, stick destro, L3/R3.
- **Salvataggi su file**: slot manuale e automatico separati e mantenuti tra un avvio e l'altro, chiusura che salva, "Continua" dopo il riavvio.
- **Pacchetto**: `electron-builder --linux dir` include la build provata; l'eseguibile si avvia, gioca, salva e riprende.
- **Steam con un modulo finto**:
  - l'overlay è attivato prima dell'avvio dell'app;
  - l'App ID viene preso da Steam;
  - gli achievement salvati vengono rimandati;
  - un nuovo achievement arriva a `achievement.activate(ACH_<ID>)`;
  - la tastiera a schermo di Steam Deck viene chiesta con i parametri giusti.

**Stato di Steam (verificato, non ancora integrato):**

| Funzione | Stato |
|---|---|
| Achievement su Steam | **IN SOSPESO**: il codice di collegamento funziona (provato con un modulo finto), ma `steamworks.js` non è installato e non c'è ancora un App ID. Il controllo "steamworks.js installato" è l'unico fallito |
| Steam Cloud | **IN SOSPESO**: i file `.sav` sono nella cartella prevista; va attivato Auto-Cloud in Steamworks e provato con il client Steam |
| Overlay e tastiera di Steam Deck | **IN SOSPESO**: dipendono da `steamworks.js` |

Non eseguibili qui: achievement reali, sincronizzazione Cloud tra due computer (serve il client Steam).
Il controllo del tasto Home risulta "non eseguito" per un controllo statico ormai superato nello script; lo stesso log registra che Home riporta la vista sull'HQ (0,0% di differenza).
Passi per completare Steam: `docs/STEAM.md` §3 e §4.

## 6. Campagna (percorso verde, industriale, finali, regioni)

`verify-release/campaign.mjs all` (109/109, interfaccia reale; per brevità le risorse prima della Guglia e la popolazione vengono impostate, tutto il resto usa le regole del gioco):
- Campagna nuova: solo la prima città aperta; il pannello di una città chiusa dice quante stelle mancano.
- **Percorso verde**: Pods, Giardini, Solare e Guglia → finale "The Garden City", sblocco di Rustbay, ritorno alla mappa regionale con le stelle, città finita che continua senza rimostrare il finale, Rustbay che parte da zero con la sua introduzione.
- **Percorso industriale** (Company Town, industria a 0,6×): finale "The 2PM Megacity", terza stella, "Continua a costruire qui" con la città che gira e si salva.
- **Sconfitta per smog**: allarme sopra il 95%, dopo 30 s finale "Smog Over" con "Carica l'ultimo salvataggio", "Ricomincia" e "Mappa"; la sconfitta non registra nulla nella campagna.
- **Finale regionale** dopo la quinta Guglia ("The Green Coast"), mostrato una sola volta.
- Tutte e 5 le città: introduzione, regole proprie, salvataggio e ritorno alla mappa dal menu di pausa.

**Partite complete giocate da uno script come un giocatore** (`play.mjs`: solo clic sulla barra, sulla mappa e sui
dialoghi, velocità 3, nessuna risorsa regalata), sulla build finale:

| Città | Stile di gioco | Esito |
|---|---|---|
| Scrapbot City | costruttore (verde) | finale verde al giorno 12, 2 stelle, Neon Heights sbloccata |
| Rustbay | costruttore | finale verde al giorno 9 (rigiocata: giorno 9) |
| Neon Heights | costruttore | finale verde al giorno 11 (rigiocate: giorni 10 e 11) |
| Greenvale | costruttore | finale verde al giorno 9, stelle "finale verde" e "smog mai sopra il 30%" |
| 2PM Company Town | magnate (industria) | finale industriale al giorno 11; continuando solo con l'industria, sconfitta per smog al giorno 13 |

Nessun errore della pagina. Lo script ha segnalato 2 clic che non hanno costruito su circa 150 costruzioni:
in un caso al momento del clic si era aperto un evento narrativo (il clic finisce sul dialogo, come deve), nell'altro
una tempesta aveva appena fatto cadere spazzatura su quella casella (il gioco rifiuta, come deve).

## 7. Build di release: niente trucchi né risorse infinite

`verify-release/release.mjs` (36/36) e `bank-exploit.mjs` (5/5):
- nessun codice "cheat", "god mode", "unlimited", "infinite credits" né nel sorgente né in `dist`;
- il gancio di test `window.scrapbot` è eliminato dalla build (e assente durante il gioco);
- 158 tasti premuti (lettere, numeri, tastierino, F1–F12, simboli, con e senza Shift) non cambiano mai le risorse;
- nel `localStorage` solo chiavi del prodotto;
- Electron: niente DevTools, niente URL di sviluppo, niente debug remoto;
- `dist` è più recente di ogni file sorgente e contiene tutte le 593 frasi inglesi attuali;
- la banca regionale non stampa più crediti con "Invia + Ricomincia questa città" (provato 3 volte di fila sulla release).

## 8. Prestazioni

Chromium headless **senza GPU** (rasterizzazione software, il caso peggiore), città da 121 edifici, 35 bot, 63 abitanti, velocità 3:

| Risoluzione | Zoom normale | Vista d'insieme (zoom 1) | Fotogramma peggiore |
|---|---|---|---|
| 1280×800 (la misura dello schermo dello Steam Deck; nessuno Steam Deck provato) | 60 fps | 60 fps | 17 ms |
| 2560×1440 | 60 fps | 59 fps | 33 ms |

Tempo di disegno di un fotogramma (`render()`): mediana 1,8 ms, 90° percentile 2,4 ms (zoom 1: 2,2 / 2,7 ms).
Prima delle correzioni dell'audit di stabilità era 4,4 ms. La qualità adattiva resta "alta" su schermi a 30, 40 e 60 Hz
e scende solo quando i fotogrammi sono davvero lenti.

**Stabilità sulla build finale** (15 giorni di gioco a velocità 3 in 5 minuti reali, città da 121 edifici,
138 elementi di scenografia, 84 lampioni):

| Minuto | Giorni di gioco | Intervallo frame mediana / 95° perc. | Disegno mediana | Memoria | Listener | Errori |
|---|---|---|---|---|---|---|
| 0 | 0 | 16,7 / 33,4 ms | 2,1 ms | 9,3 MB | 28 | 0 |
| 1 | 3 | 16,7 / 16,8 ms | 1,7 ms | 9,6 MB | 28 | 0 |
| 3 | 8,8 | 16,7 / 16,7 ms | 1,5 ms | 9,7 MB | 28 | 0 |
| 5 | 15 | 16,7 / 16,7 ms | 1,6 ms | 9,7 MB | 28 | 0 |

I nodi del DOM restano 389–400, un solo callback di animazione per frame, la qualità resta "alta" e i testi fluttuanti
restano entro il tetto di 48. L'audit di stabilità aveva già provato, senza errori e senza crescita di memoria:
15 ingressi/uscite da città, 15 caricamenti, 240 cambi di zoom, 60 passaggi giorno/notte, 15 cicli di demolizione e ricostruzione.

**Copertura dell'HUD**: a 1280×800, 1280×720 e 1920×1080, a ogni zoom da 1 a 5, nessuna casella resta sempre sotto la
barra in alto o la barra degli strumenti (prima, a zoom 1 su 1280×800, 119 caselle non si potevano mai liberare).

## 9. Limiti noti

1. **Steam**: achievement, Cloud, overlay e tastiera di Steam Deck sono **in sospeso** finché non si installano `steamworks.js` e l'App ID (§5).
2. Provato solo su Linux (browser e pacchetto Electron). Windows e macOS non sono stati provati; nemmeno un vero Steam Deck o un controller fisico (il controller è simulato con la Gamepad API).
3. Le prestazioni sono misurate senza GPU; su hardware reale dovrebbero essere migliori, ma non è stato verificato.
4. La grafica è generata da modelli voxel scritti in codice (`npm run art`); ogni fotogramma si può sostituire a mano con un PNG in `art/overrides/`. Su Steam va compilata la dichiarazione dei contenuti generati con l'IA (`docs/STEAM.md`).
5. Le traduzioni dei testi nuovi (tutorial, avvisi) sono fatte con l'IA: servono revisioni madrelingua. 0–13 frasi per lingua restano uguali all'inglese (nomi, marchi e parole uguali nelle due lingue).
6. Il suggerimento nel menu di pausa nomina ancora i tasti della tastiera anche con il controller.
7. Sotto i 1024 px di larghezza la barra degli strumenti scorre di lato.
8. Contenuti: 10 eventi narrativi in tutto; una città dura 9–16 giorni di gioco (circa 10–20 minuti a 1×) nelle partite degli script, la campagna 1,5–3 ore per gli script: non è una durata misurata con persone.
9. Due file di anteprima lasciati da un agente nella radice del container di sviluppo (`/fixlab.png`, `/preview.mjs`): fuori dal repository, innocui, da cancellare a mano.

## 10. Come ripetere i test

```bash
cd scrapbot-city
npm install
npm test                 # 50 test automatici
npm run art              # rigenera l'atlante dai modelli voxel (deterministico)
npm run build            # build di release in dist/index.html
npm run dist:linux       # app desktop in release/
```

Gli script Playwright citati sopra stanno nella cartella di lavoro della sessione di sviluppo (non nel repository):
ognuno prende il percorso della build e stampa una riga PASS/FAIL per controllo.
