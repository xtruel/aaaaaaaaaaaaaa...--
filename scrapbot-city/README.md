# Scrapbot City — build 0.4

City builder in pixel art: piccoli robot raccolgono spazzatura, tu decidi cosa diventa.
**Recycle × Build × Expand × Survive.** Un pianeta pulito o un profitto più grande?

![Mockup del menu principale](docs/mockup-main-menu.png)

## Avvio

```bash
cd scrapbot-city
npm install
npm run dev          # gioco nel browser: http://localhost:3001
npm run build        # dist/index.html: un unico file con codice, CSS e font
npm run balance      # partite automatiche su tutte le città per controllare il bilanciamento
npm run desktop      # app desktop (Electron)
npm run dist:win     # build per Steam in release/ (anche dist:linux, dist:mac)
```

Per pubblicare su Steam segui **[docs/STEAM.md](docs/STEAM.md)**: account, achievement, upload, pagina del negozio, prezzo.

## Modalità di gioco

- **Campagna "The Scrap Coast"**: 5 città sulla mappa della regione, ognuna con regole proprie e 3 stelle da guadagnare.
  Le stelle sbloccano le città successive. Una **banca regionale** (il dirigibile cargo) sposta crediti e pezzi tra le città,
  trattenendo il 10%.
  | Città | Regole | Si sblocca con |
  |---|---|---|
  | Scrapbot City | equilibrata | subito |
  | Rustbay | spazzatura ×1,6, tempeste di spazzatura ×2 | 1 ★ |
  | Neon Heights | melma tossica ×3, partenza ricca, più eventi | 3 ★ |
  | Greenvale | poca spazzatura, molta erba, industria cara | 5 ★ |
  | 2PM Company Town | industria economica, l'aria si pulisce lentamente | 8 ★ |

  Quando tutte e 5 le Guglie sono completate arriva il finale della regione.
- **Free play**: una città con nome e seed a scelta. Prima di sostituire la città salvata il gioco chiede conferma.
- **Tutorial**: USA-9 guida passo passo, evidenzia i pulsanti e aspetta che tu esegua ogni azione.

## Cosa c'è nel gioco

- **Suggerimenti** (lampadina o tasto `Q`): USA-9 legge la città e consiglia cosa costruire, spiegando il perché.
  I primi 3 per città sono gratis e uno nuovo torna ogni 5 giorni. Poi si pagano in crediti, e il prezzo sale a ogni acquisto.
- **18 achievement**, salvati localmente e inviati a Steam nella versione desktop.
- **Eventi narrativi** con USA-9, Miso, K. Kurogane (2PM Corp), i cittadini e la Pixel Planet Initiative.
- **Finali**: Garden City, 2PM Megacity, Different Futures, Smog Over. Dopo la Guglia si può continuare a costruire
  per prendere le stelle mancanti; se la città soffoca si riparte dall'ultimo salvataggio automatico.
- **Salvataggi** automatici a ogni nuovo giorno, alla chiusura e quando la finestra viene nascosta. In free play ci sono anche 3 slot manuali.
- **Interfaccia**: chip colorate, guadagno al minuto di crediti e pezzi, pausa automatica quando la finestra è nascosta,
  pixel art nitida anche con lo schermo scalato al 125–150%.

## Loop di gioco

1. I **bot** volano sui cumuli e portano i rottami all'HQ o a un Bot Dock.
2. Il **Recycler** trasforma i rottami in pezzi; Smelter, Fix-It Lab e 2PM Factory producono crediti.
3. I **Bot Pods** portano cittadini: pagano le tasse e producono nuova spazzatura.
4. L'**energia** va tenuta sopra il consumo, altrimenti tutto rallenta.
5. Lo **smog** sale con l'industria e scende con giardini e purificatori. Sopra il 95% per 30 secondi la città è persa.
6. Con 30 cittadini si costruisce la **Scrap Spire**. Il finale dipende dall'indicatore Green ◀ ▶ Industry,
   che si muove con gli edifici in piedi e con le scelte degli eventi.

## Comandi

Le scorciatoie usano la posizione fisica dei tasti, quindi funzionano anche su tastiere AZERTY e simili.

| Azione | Tasti |
|---|---|
| Muovere la camera | WASD, frecce, trascinare |
| Zoom | rotella, pinch su trackpad e touch, `+` / `-` |
| Scegliere un edificio | `1`–`0`, `M` per la Scrap Spire |
| Ruspa (macerie) | `X` |
| Suggerimento | `Q` |
| Annullare | clic destro, `Esc` |
| Pausa / velocità | `Space` / `Tab` |
| Tornare all'HQ | `H` |
| Schermo intero (desktop) | `F11` |

## Struttura

```
src/
  main.ts              schermate: menu, regione, partita, tutorial, free play
  session.ts           partita in corso: loop, input, camera, dialoghi, finali
  campaign.ts          stelle, sblocchi, banca regionale, finale della regione
  achievements.ts      achievement locali e ponte verso Steam
  storage.ts           impostazioni e slot di salvataggio
  audio.ts             effetti e musica chiptune sintetizzati
  game/                logica pura, senza DOM (testabile in Node)
    defs.ts            edifici, costi, energia, smog, modificatori delle città
    cities.ts          le 5 città della campagna e i loro obiettivi a stelle
    hints.ts           i consigli di USA-9
    sim.ts             simulazione a passo fisso
    state.ts           stato e salvataggi (versione 2, legge anche la 1)
    actions.ts, story.ts, world.ts
  render/              pixel art procedurale, mappa della regione
  ui/                  menu, HUD, tutorial, regione, finestre di dialogo
electron/              app desktop per Steam
scripts/balance.ts     pilota automatico per il bilanciamento
docs/STEAM.md          guida alla pubblicazione su Steam
```

## Ancora da fare

- Salvataggi su file per Steam Cloud, supporto controller (Steam Deck), musica originale, localizzazione.
- Font giapponese incluso nel gioco per la scritta スクラップボットシティ: ora usa i font di sistema, che su Linux e Steam Deck possono mancare.
- Dettagli in [docs/STEAM.md](docs/STEAM.md), sezione 7.
