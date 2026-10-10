# Scrapbot City su Steam — guida pratica

Il gioco è una pagina HTML impacchettata con **Electron**: niente Godot, stesso codice per browser e desktop.
Questa guida va dal repository alla pagina Steam pubblicata.

## 1. Cosa c'è già nel progetto

| Cosa | Dove |
|---|---|
| App desktop (finestra, F11 fullscreen, uscita, link esterni) | `electron/main.cjs` |
| Ponte sicuro gioco ↔ desktop (`window.scrapbotDesktop`) | `electron/preload.cjs` |
| **Salvataggi su file** (uno per città, scrittura atomica + copia `.bak`), pronti per Steam Cloud | `electron/main.cjs`, `src/storage.ts` |
| **Controller** (Steam Deck, Xbox, PlayStation): menu col D-pad, cursore virtuale in città | `src/gamepad.ts`, `src/session.ts` |
| **8 lingue**: inglese, italiano, tedesco, francese, spagnolo, portoghese, polacco, olandese | `src/i18n/` |
| 18 achievement già nel gioco, inviati a Steam se disponibile | `src/achievements.ts` |
| Build per Steam (cartella, non installer) | `npm run dist:win` / `dist:linux` / `dist:mac` → `release/` |
| Prova locale dell'app desktop | `npm run desktop` |

Testato: l'app si apre a 1280×800 (la risoluzione dello **Steam Deck**), il menu funziona, "Quit" chiude l'app,
il pacchetto Linux generato da `electron-builder` si avvia, i salvataggi finiscono nella cartella `saves`
e la lingua scelta resta dopo il riavvio.

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
Nomi e descrizioni tradotti nelle altre 7 lingue sono già pronti in `src/i18n/<lingua>.ts` (chiavi `ach.*`):
copiali nella localizzazione degli achievement in Steamworks.

## 4. Steam Cloud (salvataggi sincronizzati)

La versione desktop salva tutto in file `.sav` dentro la cartella dell'utente, sempre con lo stesso nome:

| Sistema | Cartella |
|---|---|
| Windows | `%APPDATA%\Scrapbot City\saves` |
| Linux / Steam Deck | `~/.config/Scrapbot City/saves` |
| macOS | `~/Library/Application Support/Scrapbot City/saves` |

In Steamworks → *Application* → *Steam Cloud* attiva **Auto-Cloud** con:

- Quota: 10 MB per utente, 200 file (una città salvata pesa poche decine di KB).
- Root path: **WinAppDataRoaming**, sottocartella `Scrapbot City/saves`, pattern `*.sav`, ricorsivo: no.
- Root override per **Linux**: root `LinuxHome`, sottocartella `.config/Scrapbot City/saves`.
- Root override per **macOS**: root `MacAppSupport`, sottocartella `Scrapbot City/saves`.

Le copie `.sav.bak` restano solo sul computer (il pattern `*.sav` non le prende): servono se un file si rovina.
Il pulsante **"Open the saves folder"** nelle impostazioni apre la cartella (utile per l'assistenza ai giocatori).
Chi aveva già giocato con la 0.4 desktop non perde niente: al primo avvio i vecchi dati vengono copiati nei file.

## 5. Steam Deck e controller

Per il badge **Steam Deck Verified** Valve controlla queste cose; lo stato attuale:

| Requisito | Stato |
|---|---|
| Tutto il gioco usabile col controller, senza mouse | ✔ menu, dialoghi, regione e città (cursore virtuale) |
| Glifi dei pulsanti del controller nei testi | ✔ A, B, X, Y, LB/RB, LT/RT, Start, View, L3, R3 |
| Risoluzione 1280×800 o 16:10 | ✔ finestra di partenza 1280×800 |
| Testi leggibili (minimo 9 px a 1280×800) | ✔ verificato sugli screenshot, da ricontrollare nelle lingue lunghe (DE, PL) |
| Tastiera a schermo per i campi di testo | ✔ con steamworks.js (`showFloatingGamepadTextInput`), altrimenti Steam + X |
| Nessun launcher esterno | ✔ |

Configurazione in Steamworks → *Steam Input*: imposta il supporto controller a **"Supporto completo"**
e usa il layout predefinito **"Gamepad"** (il gioco legge il controller come un pad standard).

Comandi in città: stick sinistro = cursore, stick destro = mappa, A = costruisci/seleziona, B = annulla,
LB/RB = edificio precedente/successivo, LT/RT = zoom, X = ruspa, Y = suggerimento, Start = menu,
D-pad = una casella alla volta, View = pausa, L3 = velocità, R3 = torna all'HQ.

## 6. Caricare la build (SteamPipe)

1. `npm run dist:win` (da Windows, oppure su CI) → `release/win-unpacked/`.
2. Crea un **depot** per sistema operativo in Steamworks (Windows obbligatorio, Linux consigliato per Steam Deck).
3. Carica con `steamcmd` e un file `app_build_<APPID>.vdf` che punta alla cartella `release/win-unpacked`.
4. Opzioni di avvio: eseguibile `Scrapbot City.exe` (Windows), `scrapbot-city` (Linux).
5. Prova la build dal ramo `beta` prima di renderla pubblica.

## 7. Pagina del negozio (da preparare presto)

Apri la pagina **"Coming Soon" il prima possibile**: le wishlist raccolte nei mesi prima del lancio sono il fattore che pesa di più sulle vendite.

Materiali richiesti:

- Capsule: header 920×430, small 462×174, main 1232×706, vertical 748×896.
- Library: capsule 600×900, hero 3840×1240, logo 1280×720 (il logo del mockup va benissimo).
- Almeno 5 screenshot 1920×1080: menu, mappa della costa, città verde, città industriale, evento con Kurogane.
- Trailer di 30–60 secondi: apri con il bot che raccoglie spazzatura, poi la scelta "pianeta pulito o profitto?", poi le 5 città.
- Testo breve: *"Small robots, big choices. Turn the junk of the Scrap Coast into five living cities — and decide if they grow green or rich."*

Tag consigliati: City Builder, Pixel Graphics, Cozy, Management, Choices Matter, Casual, Strategy, Cute.

**Lingue da spuntare** (colonna *Interfaccia*; *Audio* e *Sottotitoli* no, non ci sono voci): English, Italian, German,
French, Spanish - Spain, Portuguese - Portugal, Polish, Dutch. La descrizione del negozio va tradotta a parte
in Steamworks: i testi del gioco in `src/i18n/` possono fare da base. Il gioco sceglie da solo la lingua del sistema
al primo avvio; si cambia dal pulsante col globo nel menu o dalle impostazioni.

## 8. Prezzo e lancio (consiglio)

- Prezzo indicativo per un city builder pixel indie di 6–10 ore: **9,99–12,99 €**, con sconto lancio del 10–15%.
- Usa il **tutorial + Scrapbot City** come **demo gratuita** per lo Steam Next Fest: è già un pezzo chiuso del gioco.
- Lingue: le 8 europee sono già nel gioco. Le prossime da valutare: portoghese brasiliano, giapponese,
  cinese semplificato e coreano (i city builder vendono molto in Asia; servono font CJK, oggi c'è solo il katakana del logo).

## 9. Cosa manca prima di vendere (onestamente)

Fatto nella 0.5: salvataggi su file con Steam Cloud, controller e Steam Deck, 8 lingue, 4 brani di musica
(menu, città di giorno, città di notte, mappa della regione), font giapponese per il logo.

1. **Musica di un compositore**: i 4 brani sono chiptune scritti come note in `src/music.ts` e suonati dal codice.
   Vanno bene per demo e playtest; per il lancio conviene un compositore (anche solo per riscriverli meglio).
2. **Passata grafica**: gli sprite sono disegnati dal codice; un artista pixel può sostituirli tenendo le stesse misure (caselle 16 px).
3. **Playtest** con 10–20 persone che non conoscono il gioco: vedi **[PLAYTEST.md](PLAYTEST.md)**.
4. **Revisione delle traduzioni** da madrelingua (soprattutto eventi e finali) durante il playtest.
5. Verifica legale di nomi e marchi ("2PM", "Scrapbot City") prima di registrare la pagina.

## 10. Idee per allungare la vita del gioco (aggiornamenti post-lancio)

- Albero tecnologico dei bot (velocità, capacità, droni da pulizia).
- Sesta e settima città come aggiornamento gratuito: fa tornare i giocatori e Steam lo mostra a chi ha il gioco in wishlist.
- Modalità infinita con classifica (Steam Leaderboards) e sfide settimanali con seed fisso.
- Editor di mappe e Steam Workshop.
