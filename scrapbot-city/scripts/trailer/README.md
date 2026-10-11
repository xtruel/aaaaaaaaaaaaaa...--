# Trailer di gameplay (e screenshot) dalla build di rilascio

Una pipeline riproducibile che filma il gioco vero e ne fa un trailer di 30–60 secondi per Steam, più le schermate
senza perdita degli stessi momenti (candidate per gli screenshot del negozio).

```bash
scripts/trailer/run.sh <checkout del gioco> <cartella di uscita>
# esempio, sulla build finale:  scripts/trailer/run.sh . /tmp/scrapbot-trailer
```

Risultato in `<cartella di uscita>`: `trailer.mp4` (+ `.contact.jpg` un fotogramma ogni 2 s, `.thumbnail.jpg` un
fotogramma 1920×1080 usabile come miniatura personalizzata, `.json` i dati), `rec/stills/*.png` (schermate),
`rec/debug/*.png`, `rec/scenes.json`. **Tienila fuori da git**: i fotogrammi occupano 1–2 GB.

## 1. Cosa fa, e perché non è "finto"

| Passo | File | Cosa succede |
|---|---|---|
| 1. build | `run.sh` | `npx vite build` del checkout indicato in una cartella di uscita: lo stesso `index.html` unico che va nelle build Steam, **senza** gli agganci di debug (esistono solo in sviluppo). Con `--build <index.html>` si filma un file già pronto (per esempio quello dentro la build Steam) |
| 2. salvataggi | `saves.mjs` + `make-saves.mjs` | il **pilota automatico del gioco** (`scripts/autopilot.ts`, lo stesso di `npm run balance`) gioca le 5 città della campagna con la **simulazione del gioco** e le sue regole (costruisce solo dove `placeCheck` lo permette, paga quello che la città ha). Di ogni città si salva un momento a metà partita, prima della Guglia (così nessun finale interrompe le riprese); il profilo della campagna tiene le stelle che quelle partite hanno davvero guadagnato. Nessuna risorsa aggiunta, nessuno stato ritoccato |
| 3. riprese | `record.mjs` | Chromium guidato da Playwright apre la build con quei salvataggi nello storage del browser (come un giocatore che ha già giocato la campagna) e da lì **usa solo l'interfaccia**: clic, trascinamenti e tasti. Cattura i fotogrammi della pagina con i loro tempi (screencast di Playwright, JPEG qualità 95) solo nei momenti da tenere |
| 4. montaggio | `assemble.mjs` | ffmpeg: ogni momento a 30 fps, tagli netti, 0,5 s di dissolvenza dal nero all'inizio e al nero alla fine; 1920×1080, H.264, traccia audio AAC muta, `.mp4`. Se supera `--max 60` secondi accorcia la coda delle inquadrature "di attesa" (mai quelle con un'azione) |

Scene, nell'ordine: menu; mappa della Scrap Coast con le 5 città selezionate una per una; le **5 città** (zoom 2,
velocità 2, la camera si sposta trascinando col tasto destro); **costruzione** di un Giardino Pixel e il cantiere che
sale; **decorazioni** (una fila di recinzioni trascinata e due lampioni dal pannello «Oggetti e moduli»); **notte**
(il tempo scorre fino a sera, luci accese); **modulo** (clic su una Fonderia, «Installa» sul filtro antismog);
**smog** (nuvole sopra l'industria e il pannello «da dove viene e dove va»); di nuovo il menu. Se durante una scena
compare un **evento della storia** (fa parte del gioco), quella ripresa si butta e si rifà; il primo evento della
sessione diventa una scena a sé (la carta dell'evento, il puntatore che sceglie la prima opzione).

Non ci sono: testi aggiunti, loghi sovrapposti, rallentamenti o accelerazioni del video, immagini non del gioco,
promesse. Le scritte che si vedono sono quelle del gioco (interfaccia, menu con i suoi slogan dipinti, notifiche).

Che cosa **non** è come per un giocatore, da sapere:
- le città sono state giocate dal pilota automatico, non da una persona (le scelte degli eventi seguono il suo piano
  verde o industriale);
- il profilo ha già tutti gli achievement, perché le notifiche non coprano le scene;
- impostazioni: inglese, suoni a zero (le riprese sono mute comunque), **filtro CRT spento** (le sue righe, compresse
  nel video, fanno moiré): è un'opzione del gioco;
- il browser è Chromium senza GPU (rendering software): il gioco gira a 20–40 fotogrammi al secondo invece dei 60 di un
  PC normale; il video è comunque a 30 fps (i fotogrammi mancanti sono ripetuti). Su un PC con GPU, o registrando con
  OBS l'app desktop, viene più fluido.

## 2. Requisiti

Node 20+, le dipendenze del gioco (`npm install`: vite ed esbuild), **Playwright con Chromium** (`npm i -D playwright`
e `npx playwright install chromium`, oppure un Playwright installato globalmente: gli script lo cercano anche lì),
**ffmpeg** e **ffprobe** con libx264. Nessuno schermo necessario.

## 3. Rifarlo sulla build finale (0.7.0-beta.1)

1. Dal commit verificato della build finale (con questa cartella `scripts/trailer/` presente, dopo l'unione dei rami):
   `scripts/trailer/run.sh . /tmp/scrapbot-trailer`. Oppure, prima dell'unione, da questo ramo:
   `scripts/trailer/run.sh <percorso del checkout della build finale> /tmp/scrapbot-trailer`.
2. Leggi l'uscita di `record`: deve dire `page errors: none` e non deve avvisare `scenes not captured`.
3. Guarda **tutto** `trailer.mp4` e il foglio `.contact.jpg`. Se una scena non ti piace, rilancia: le partite del pilota
   automatico e gli eventi cambiano un po' a ogni giro.
4. Scegli gli screenshot tra `rec/stills/` (servono almeno 5, solo gameplay; le dimensioni 1920×1080 sono già giuste).
5. Aggiungi l'audio (sezione 4) e carica il trailer in Steamworks → *Store Page → Trailers* (lo fai tu).

Se la build finale cambia l'interfaccia, gli script si appoggiano a questi elementi del DOM: `#menu [data-act]`,
`[data-mode="campaign"]`, `[data-city]`, `[data-play]`, `.hud-top`, `[data-toolbar]`, `[data-tool="garden"]`,
`[data-speed]`, `[data-menu]`, `[data-catalog-panel]`, `[data-item="fence"|"lamp"]`, `[data-inspector]`,
`[data-install="smelterFilter"]`, `[data-smog-meter]`, `[data-smog-panel]`, `#modal-root`, i tasti `O`, `H`, `+`/`-`,
`Esc`, i pulsanti in inglese "Region map" e "Main menu". Il passo 2 usa `src/game/{cities,defs,sim,state,actions,
pieces}.ts` e `scripts/autopilot.ts`. Le nuove funzioni della 0.7.0-beta.1 (altri moduli e decorazioni, sblocchi,
temi delle città) compaiono da sole se sono nella build; per **mostrarle apposta** (per esempio una panchina o una
fontana) si aggiunge una scena in `record.mjs` sul modello di "decorate".

## 4. Audio

Le riprese sono mute (Playwright non registra il suono). Steam consiglia un trailer che funzioni anche senza audio,
ma una colonna sonora aiuta. Strade possibili (sceglie il titolare):
- registrare la musica del gioco dall'app desktop (OBS o un registratore di sistema: la musica è sintetizzata dal gioco,
  quindi è già "del gioco") e montarla sotto il video con ffmpeg, per esempio
  `ffmpeg -i trailer.mp4 -i musica.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest trailer-audio.mp4`;
- un brano di un compositore, se ci sarà.

## 5. Prova fatta l'11 ottobre 2026

Sul ramo principale del gioco (`scrapbot-city-prototype` @ `04d782e`, "Build_0.7.0-alpha.1"), copiato in una cartella
di lavoro e costruito con `npx vite build`, da capo a fondo con `run.sh`: le 5 città, costruzione, decorazioni, notte,
modulo, pannello dello smog (in alcuni giri è comparso anche un evento della storia, ripreso come scena a sé); nessun
errore nella pagina. Video di prova dell'ultimo giro: 54,2 s, 1920×1080, 30 fps, H.264 9,8 Mbit/s, audio AAC muto,
più 11 schermate in `rec/stills/` — **non è nel repository** (è nello scratchpad della sessione) e mostra la
0.7.0-alpha.1, **non** la build finale. Durata di un giro su questa macchina (4 core, senza GPU): ~2 minuti di riprese,
~3 minuti di codifica.
