# Playtest di Scrapbot City — come farlo e cosa guardare

Il playtest serve a una cosa sola: vedere **dove si bloccano persone che non conoscono il gioco**.
Chi l'ha sviluppato non lo vede più: sa già dove cliccare.

## 1. Chi invitare

- **10–20 persone** in tutto, a gruppi di 5: dopo ogni gruppo si corregge e si riprova.
- Almeno metà **non** gioca abitualmente ai city builder: se capiscono loro, capiscono tutti.
- Qualcuno per lingua: le traduzioni (IT, DE, FR, ES, PT, PL, NL) vanno lette da madrelingua,
  soprattutto i testi lunghi (eventi, finali) e i nomi sui pulsanti degli edifici.
- Almeno 2 persone con **Steam Deck** o un controller, senza tastiera.

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
3. Registra lo schermo (OBS, o la registrazione di Steam) e prendi nota dei **minuti** in cui succede qualcosa.
4. 30–45 minuti di gioco, poi 5 minuti di domande.

## 4. Cosa osservare (e dove guardare nel codice)

| Momento | Domanda | Se va male |
|---|---|---|
| Menu | Trovano "New game" e la lingua? | `src/ui/menu.ts` |
| Tutorial passo 2–4 | Capiscono che i bot raccolgono da soli? | testi `tut.*` in `src/i18n/` |
| Primo Recycler | Lo piazzano vicino ai rottami? Capiscono i pezzi? | `tut.recycler.*`, hint in `src/game/hints.ts` |
| Energia | Si accorgono che manca corrente? | avviso in `src/game/sim.ts`, chip energia nell'HUD |
| Smog | Capiscono la barra e il pericolo sopra il 95%? | `hud.smog*`, `msg.storm` |
| Scelte degli eventi | Leggono il testo o cliccano a caso? | `ev.*`, lunghezza dei testi |
| Suggerimenti | Li usano? Capiscono che dopo i 3 gratis costano? | `hint.*`, prezzo in `src/game/hints.ts` |
| Regione | Capiscono le stelle e la banca regionale? | `region.*`, `trade.*` |
| Controller | Riescono a costruire senza mouse? Il cursore è comodo? | `src/gamepad.ts`, `padFrame` in `src/session.ts` |

Segna ogni momento con: **bloccato** (chiede aiuto o resta fermo più di 30 secondi), **confuso**, **ok**, **divertito**.

## 5. Le 6 domande finali

1. Con parole tue: di cosa parla il gioco?
2. Qual è stato il momento più bello? E il più noioso?
3. C'è stato un momento in cui non sapevi cosa fare?
4. Verde o industria: cosa hai scelto e perché?
5. Lo compreresti? A quale prezzo ti sembrerebbe giusto?
6. Lo consiglieresti a un amico? A chi?

## 6. Numeri da annotare

- Minuti per finire il tutorial (obiettivo: meno di 10).
- Quante persone saltano il tutorial e poi si bloccano.
- Minuti per la prima Scrap Spire nella prima città (obiettivo: 40–60).
- Quante città perse per lo smog (qualcuna va bene: insegna; tante vuol dire che l'avviso non si vede).
- Quanti suggerimenti usati e quanti pagati.

Il pilota automatico `npm run balance` fa lo stesso controllo dei tempi su tutte le città in pochi secondi:
usalo dopo ogni modifica ai numeri in `src/game/defs.ts`, e il playtest per tutto quello che un programma non sente.

## 7. Checklist prima di ogni build di prova

- [ ] `npm run typecheck`, `npm run i18n:check`, `npm run balance` senza errori.
- [ ] Partita nuova in ogni lingua: menu, tutorial fino in fondo, un evento, impostazioni.
- [ ] Steam Deck o controller: menu → campagna → costruire → pausa → salvataggio, senza toccare il mouse.
- [ ] Chiudere e riaprire il gioco: la città e la lingua devono tornare uguali.
- [ ] Finestra piccola (1280×720) e grande (2560×1440): niente testi tagliati.
