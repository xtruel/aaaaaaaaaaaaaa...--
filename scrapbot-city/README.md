# Scrapbot City — prototipo giocabile (build 0.3)

City builder in pixel art: piccoli robot raccolgono spazzatura, tu decidi cosa diventa.
**Recycle × Build × Expand × Survive.** Un pianeta pulito o un profitto più grande?

![Mockup del menu principale](docs/mockup-main-menu.png)

## Avvio

```bash
cd scrapbot-city
npm install
npm run dev        # http://localhost:3001
npm run build      # dist/index.html: un unico file con codice, CSS e font
npm run balance    # partite automatiche Verde e Industriale per controllare il bilanciamento
```

Il build è un solo file HTML, offline (i font sono inclusi). Si può caricare su itch.io
oppure avvolgere con Electron o Tauri per Steam.

## Cosa c'è

- **Menu principale** ricostruito dal mockup: logo graffiti, menu con evidenziazione lime,
  card dei percorsi, skyline pixel animata con il dirigibile 2PM, USA-9 e Miso sul cumulo di rottami.
  Navigazione da tastiera (frecce, Invio).
- **New Game / Continue / Load Game**: nome città e seed della mappa, salvataggio automatico
  a ogni nuovo giorno e alla chiusura della scheda, 3 slot manuali.
- **Settings**: volume effetti e musica, scanline CRT, scorrimento ai bordi, movimento ridotto.
- **Extras**: galleria dei 4 finali sbloccati, guida e comandi. **Credits**, **Quit**.
- **Gioco**: mappa 56×36 generata dal seed (discariche, macerie, melma tossica, vecchia rete stradale),
  ciclo giorno/notte con luci, smog visibile, bot che raccolgono da soli, gatto Miso che gira per la città.

## Loop di gioco

1. I **bot** volano sui cumuli di spazzatura e portano i rottami all'HQ o a un Bot Dock.
2. I rottami diventano **pezzi** (Recycler) o **crediti** (Smelter). Pezzi e crediti servono per costruire.
3. I **Bot Pods** portano cittadini: pagano le tasse e producono nuova spazzatura, che i bot raccolgono di nuovo.
4. L'**energia** non basta mai: se manca, tutte le macchine rallentano.
5. Lo **smog** sale con l'industria e scende con parchi e purificatori. Sopra il 95% per 30 secondi la città è persa.
6. Con 30 cittadini si costruisce la **Scrap Spire**. Il finale dipende dal percorso scelto.

### I due percorsi

Ogni edificio e ogni scelta narrativa sposta l'indicatore **Green ◀ ▶ Industrial**.

| Verde | Neutro | Industriale |
|---|---|---|
| Solar Array, Pixel Garden, Fix-It Lab, Purifier | HQ, Bot Dock, Recycler, Bot Pods, Scrap Spire | Smelter, Scrap Burner, 2PM Factory |
| aria pulita, cittadini felici, soldi lenti | | soldi veloci, energia economica, smog |

Il pulsante **+** accanto ai pezzi li importa dalla 2PM pagando in crediti. È la leva industriale:
costa più di quanto una fabbrica guadagni per pezzo, quindi non genera soldi infiniti.
Ogni edificio di produzione si può mettere in **pausa** dal pannello di dettaglio, per non consumare i pezzi che servono a costruire.

### Eventi narrativi

Arrivano ogni 1–2 giorni, con personaggi e una scelta Verde o Industriale:
USA-9 (il bot coniglio), Miso (il gatto), K. Kurogane della 2PM Corp, il consiglio dei cittadini
e la Pixel Planet Initiative. Ogni tanto arriva anche una tempesta di spazzatura.

### Finali

- **The Garden City**: indicatore ≥ 35 verso Green.
- **The 2PM Megacity**: indicatore ≥ 35 verso Industrial.
- **Different Futures, Same City**: nel mezzo.
- **Smog Over**: la città soffoca.

Dalle partite automatiche (`npm run balance`) la via Verde arriva al finale in 14–25 giorni,
quella Industriale in 10–17, se si gestisce lo smog. Un giorno dura un minuto a velocità 1×.

## Comandi

| Azione | Tasti |
|---|---|
| Muovere la camera | WASD, frecce, trascinare |
| Zoom | rotella, `+` / `_` |
| Scegliere un edificio | `1`–`0`, `-` (oppure clic sulla barra) |
| Ruspa (macerie) | `X` |
| Annullare | clic destro, `Esc` |
| Pausa / velocità | `Space` / `Tab` |
| Tornare all'HQ | `H` |
| Menu di pausa | `Esc` |

Su touch: tocca per costruire o selezionare, trascina per spostarti.

## Struttura

```
src/
  main.ts            avvio, schermate, nuova partita
  session.ts         partita in corso: loop, input, camera, dialoghi
  audio.ts           effetti e musica chiptune sintetizzati (WebAudio)
  storage.ts         impostazioni, slot di salvataggio, finali sbloccati
  game/              logica pura, senza DOM (si può testare in Node)
    defs.ts          costanti ed edifici: costi, energia, smog, produzione
    state.ts         stato della partita, serializzazione dei salvataggi
    world.ts         generazione della mappa da seed
    sim.ts           simulazione a passo fisso: economia, smog, cittadini, bot
    actions.ts       costruire, demolire, importare, generare spazzatura
    story.ts         personaggi, eventi, obiettivi, finali
  render/            pixel art procedurale (nessun asset esterno)
  ui/                menu, HUD, finestre di dialogo
scripts/balance.ts   pilota automatico per il bilanciamento
```

I numeri di gioco (costi, produzione, smog) stanno tutti in `src/game/defs.ts` e `src/game/sim.ts`.
Dopo ogni modifica, `npm run balance` mostra subito se i percorsi restano giocabili.

## Prossimi passi verso Steam

- Sostituire gli sprite procedurali con asset Aseprite mantenendo le stesse dimensioni (tile 16 px).
- Packaging desktop con Electron o Tauri, salvataggi su file, Steamworks (achievement per i 4 finali).
- Localizzazione italiano e inglese (testi già centralizzati in `story.ts` e `defs.ts`).
- Strade e collegamenti tra edifici, minimappa, albero tecnologico per i bot.
- Più eventi e personaggi della 2PM, tutorial guidato con USA-9.
