# Scrapbot City su Steam — guida pratica

Il gioco è una pagina HTML impacchettata con **Electron**: niente Godot, stesso codice per browser e desktop.
Questa guida va dal repository alla pagina Steam pubblicata.

## 1. Cosa c'è già nel progetto

| Cosa | Dove |
|---|---|
| App desktop (finestra, F11 fullscreen, uscita, link esterni) | `electron/main.cjs` |
| Ponte sicuro gioco ↔ desktop (`window.scrapbotDesktop`) | `electron/preload.cjs` |
| 18 achievement già nel gioco, inviati a Steam se disponibile | `src/achievements.ts` |
| Build per Steam (cartella, non installer) | `npm run dist:win` / `dist:linux` / `dist:mac` → `release/` |
| Prova locale dell'app desktop | `npm run desktop` |

Testato: l'app si apre a 1280×800 (la risoluzione dello **Steam Deck**), il menu funziona, "Quit" chiude l'app,
il pacchetto Linux generato da `electron-builder` si avvia.

## 2. Account e app su Steamworks

1. Crea l'account Steamworks come sviluppatore (Qwerty3D Games) e completa dati fiscali e bancari.
2. Paga la quota **Steam Direct** per un'app (100 USD, recuperabile dopo i primi ricavi).
3. Annota l'**App ID** che Steam ti assegna.
4. Nella cartella del gioco crea `steam_appid.txt` con dentro solo l'App ID (serve per i test fuori dal client Steam).

## 3. Collegare gli achievement

```bash
npm install steamworks.js
```

`electron/main.cjs` lo carica da solo se presente. Gli achievement vanno creati in Steamworks con questi **API name**:

| API name | Nome | Condizione |
|---|---|---|
| ACH_TUTORIAL | Bootcamp Graduate | Finire il tutorial |
| ACH_RECYCLER | Junk to Jewels | Primo Recycler |
| ACH_CITIZENS | Neighbours | Primo cittadino |
| ACH_POP50 | Busy Streets | 50 cittadini in una città |
| ACH_POP100 | Metropixel | 100 cittadini in una città |
| ACH_RICH | Credit Score | 10.000 crediti guadagnati in una città |
| ACH_CLEAN | Sludge Buster | 25 caselle di melma pulite |
| ACH_MISO | Cat Person | Accarezzare Miso 10 volte |
| ACH_HINT | Ask the Expert | Chiedere un suggerimento |
| ACH_SPIRE | Reach for the Sky | Finire una Scrap Spire |
| ACH_GREEN | Garden City | Finale Verde |
| ACH_INDUSTRIAL | Megacity | Finale Industriale |
| ACH_BALANCED | Both Ways | Finale Bilanciato |
| ACH_SMOG | Learned the Hard Way | Perdere una città per lo smog |
| ACH_CLEANHANDS | Clean Hands | Spire senza mai costruire industria |
| ACH_ROADTRIP | Road Trip | Sbloccare la seconda città |
| ACH_COAST | Coast to Coast | Spire in tutte e 5 le città |
| ACH_SUPERSTAR | Superstar | Tutte le 15 stelle |

Le icone degli achievement (64×64, a colori e in grigio) si possono ricavare dalle icone pixel del gioco ingrandite.

## 4. Caricare la build (SteamPipe)

1. `npm run dist:win` (da Windows, oppure su CI) → `release/win-unpacked/`.
2. Crea un **depot** per sistema operativo in Steamworks (Windows obbligatorio, Linux consigliato per Steam Deck).
3. Carica con `steamcmd` e un file `app_build_<APPID>.vdf` che punta alla cartella `release/win-unpacked`.
4. Opzioni di avvio: eseguibile `Scrapbot City.exe` (Windows), `scrapbot-city` (Linux).
5. Prova la build dal ramo `beta` prima di renderla pubblica.

## 5. Pagina del negozio (da preparare presto)

Apri la pagina **"Coming Soon" il prima possibile**: le wishlist raccolte nei mesi prima del lancio sono il fattore che pesa di più sulle vendite.

Materiali richiesti:

- Capsule: header 920×430, small 462×174, main 1232×706, vertical 748×896.
- Library: capsule 600×900, hero 3840×1240, logo 1280×720 (il logo del mockup va benissimo).
- Almeno 5 screenshot 1920×1080: menu, mappa della costa, città verde, città industriale, evento con Kurogane.
- Trailer di 30–60 secondi: apri con il bot che raccoglie spazzatura, poi la scelta "pianeta pulito o profitto?", poi le 5 città.
- Testo breve: *"Small robots, big choices. Turn the junk of the Scrap Coast into five living cities — and decide if they grow green or rich."*

Tag consigliati: City Builder, Pixel Graphics, Cozy, Management, Choices Matter, Casual, Strategy, Cute.

## 6. Prezzo e lancio (consiglio)

- Prezzo indicativo per un city builder pixel indie di 6–10 ore: **9,99–12,99 €**, con sconto lancio del 10–15%.
- Usa il **tutorial + Scrapbot City** come **demo gratuita** per lo Steam Next Fest: è già un pezzo chiuso del gioco.
- Lingue: inglese subito, poi italiano; dopo, tedesco, francese, spagnolo, portoghese brasiliano, giapponese e cinese semplificato (i city builder vendono molto in Germania e in Asia).

## 7. Cosa manca prima di vendere (onestamente)

1. **Salvataggi su file** invece che in Local Storage, così funziona **Steam Cloud** in modo affidabile (via IPC in `electron/main.cjs`).
2. **Supporto controller** per il badge "Steam Deck Verified".
3. **Musica originale** di un compositore (ora è chiptune generata dal codice) e qualche effetto in più.
4. **Passata grafica**: gli sprite sono disegnati dal codice; un artista pixel può sostituirli tenendo le stesse misure (caselle 16 px).
5. **Playtest** con 10–20 persone che non conoscono il gioco: guarda dove si bloccano nel tutorial.
6. **Localizzazione**: i testi sono già raccolti in `src/game/story.ts`, `src/game/cities.ts`, `src/game/hints.ts` e `src/ui/`.
7. Verifica legale di nomi e marchi ("2PM", "Scrapbot City") prima di registrare la pagina.

## 8. Idee per allungare la vita del gioco (aggiornamenti post-lancio)

- Albero tecnologico dei bot (velocità, capacità, droni da pulizia).
- Sesta e settima città come aggiornamento gratuito: fa tornare i giocatori e Steam lo mostra a chi ha il gioco in wishlist.
- Modalità infinita con classifica (Steam Leaderboards) e sfide settimanali con seed fisso.
- Editor di mappe e Steam Workshop.
