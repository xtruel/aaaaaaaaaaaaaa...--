# Scrapbot City su Steam — la guida passo per passo

Il gioco è una pagina HTML impacchettata con **Electron**: stesso codice per browser e desktop, una build per
Windows e una per Linux (che usa anche lo Steam Deck). Questa guida va dall'account Steamworks al pulsante
"Release". Non serve esperienza con Steamworks: segui i passi **in ordine**; ognuno dice dove cliccare e quale
file del progetto usare. I nomi dei menu di Steamworks sono in inglese, come li vedrai sul sito.

Per la sola parte "caricare i file" c'è **[steam/README.md](../steam/README.md)**; per la grafica del negozio
**[steam/store-assets/README.md](../steam/store-assets/README.md)**.

## La lista in breve

- [ ] 1. Account Steamworks, quota Steam Direct, dati fiscali e bancari — *avviala subito: è la parte più lenta*
- [ ] 2. Creare l'app e scrivere App ID e depot nel progetto
- [ ] 3. Pagina del negozio (testi, grafica, lingue, requisiti) e questionario sui contenuti
- [ ] 4. Depot, opzioni di avvio, runtime Linux, componenti da installare
- [ ] 5. Build con `npm run dist:steam`
- [ ] 6. Caricamento con `steam/upload.sh`
- [ ] 7. Prova sul ramo `beta` (Windows, Linux, Steam Deck)
- [ ] 8. Achievement
- [ ] 9. Steam Cloud
- [ ] 10. Controller e revisione Steam Deck
- [ ] 11. Dichiarazione dei contenuti fatti con l'IA
- [ ] 12. Prezzo
- [ ] 13. Pagina "Coming Soon" e Steam Next Fest
- [ ] 14. Uscita

## 0. Dove siamo (build 0.6.0, ottobre 2026)

### Cosa c'è già nel progetto

| Cosa | Dove |
|---|---|
| App desktop (finestra 1280×800, F11 schermo intero, uscita, link esterni nel browser) | `electron/main.cjs` |
| Ponte sicuro gioco ↔ desktop (`window.scrapbotDesktop`) | `electron/preload.cjs` |
| **Salvataggi su file** (uno per chiave, scrittura atomica + copia `.bak`), pronti per Steam Cloud | `electron/main.cjs`, `src/storage.ts` |
| **Controller** (Steam Deck, Xbox, PlayStation): menu col D-pad, cursore virtuale in città | `src/gamepad.ts`, `src/session.ts` |
| **8 lingue**: inglese, italiano, tedesco, francese, spagnolo, portoghese, polacco, olandese | `src/i18n/` |
| 18 achievement nel gioco, inviati a Steam tramite `steamworks.js` 0.4.0 (installato) | `src/achievements.ts`, `steam/achievements.csv` |
| Build per Steam (cartelle, non installer), Windows + Linux anche da Linux, senza wine | `npm run dist:steam` → `steam/content/windows`, `steam/content/linux` |
| Icona e dati della versione dentro `Scrapbot City.exe` | `scripts/after-pack.cjs`, icone in `build/` |
| Script SteamPipe (App ID e depot da compilare) e caricamento senza password nei file | `steam/sdk/*.vdf`, `steam/upload.sh`, `steam/upload.bat` |
| Grafica del negozio: 4 capsule, 6 screenshot, 4 immagini della libreria, eventi, icone | `steam/store-assets/` |
| Prova locale dell'app desktop | `npm run desktop` |

### Stato dell'integrazione Steam — onesto

| Funzione | Stato | Note |
|---|---|---|
| Achievement nel gioco (18, salvati sul PC) | ✔ funzionano | verificati nelle partite di prova |
| Achievement **su Steam** | ⏳ **manca solo l'App ID** | `steamworks.js` 0.4.0 è installato e incluso nelle build (moduli nativi Windows x64 e Linux x64, `steam_api64.dll`, `libsteam_api.so`). Senza client Steam il gioco scrive `Steam not available` nel log e gira normalmente. Due condizioni, vedi sezioni 4 e 8: su Windows serve il **Visual C++ 2015-2022 (x64)** (da spuntare in Steamworks); su Linux serve glibc 2.34 o più nuova (c'è sullo Steam Deck e sulle distribuzioni recenti) |
| Salvataggi su file (scrittura atomica + `.bak`, ripresa dalla copia se il file è rovinato) | ✔ fatto e testato | `tests/storage.test.ts`, `tests/saves.test.ts` |
| **Steam Cloud** | ⏳ **da configurare in Steamworks** | il gioco scrive già i file nella cartella giusta; resta da attivare Auto-Cloud (sezione 9). Si prova solo con l'app su Steam |
| Overlay di Steam e tastiera a schermo del Deck | ⏳ da provare col client Steam | il codice c'è; si verifica solo col gioco avviato da Steam (sezione 7) |
| Controller / Steam Deck (1280×800) | ✔ testato | D-pad, cursore virtuale, menu, pausa; con `SteamDeck=1` parte a schermo intero |
| Build Linux nel **Steam Linux Runtime 3.0 (sniper)** | ✔ provata, senza client Steam | avviata con i file del runtime di Valve (versione 3.0.20260805) in un contenitore preparato a mano, non dal client Steam: tutte le librerie trovate, menu a 1280×800, sandbox di Chromium attiva come utente normale, salvataggi in `~/.config/Scrapbot City/saves`. Al runtime **4.0** mancano librerie che Electron richiede (vedi sezione 4) |
| Build Windows | ⚠ **mai avviata su Windows** | costruita da Linux e controllata leggendone le risorse (icona, versione, DLL). Va provata sul ramo beta (sezione 7) |
| Script di caricamento | ✔ scritti e provati a vuoto | controlli e comandi provati su Linux con uno steamcmd finto; il vero caricamento richiede App ID e account |
| Grafica del negozio | ✔ pronta | `steam/store-assets/README.md`. Mancano il **trailer** e le **icone degli achievement** |

**Cosa devi fare tu** (nessuno può farlo al posto tuo): account e pagamenti (sezione 1), creare l'app e i depot (2),
compilare la pagina e il questionario (3, 11), le impostazioni di Steamworks (4, 8, 9, 10), caricare e provare
la build (6, 7), prezzo e date (12, 13), premere "Release" (14).

## 1. Account Steamworks e quota

1. Vai su <https://partner.steamgames.com>, crea l'account come **Qwerty3D Games** (azienda o persona fisica)
   e firma l'accordo di distribuzione.
2. Completa **identità**, **questionario fiscale** (la verifica richiede 10–15 giorni lavorativi e può chiedere
   documenti) e **conto bancario** (l'intestatario deve coincidere con il nome dato nella registrazione).
3. Paga la quota **Steam Direct**: 100 USD per gioco, restituiti nel pagamento successivo al superamento di
   1.000 USD di ricavi del gioco.
4. Tra il pagamento della quota e l'uscita del gioco devono passare almeno **21 giorni** (vale per i primi titoli,
   secondo la guida di Steamworks; la pagina pubblicitaria di Steam Direct dice ancora 30: conta 30 per sicurezza).

Fallo subito: verifiche e attese sono la parte più lunga di tutto il percorso.

## 2. Creare l'app e scrivere App ID e depot

1. Dopo il pagamento Steamworks ti dà un "credito app": usalo per creare l'app **Scrapbot City**.
   Steam le assegna un numero, l'**App ID**.
2. Segui **[steam/README.md](../steam/README.md), passi 1 e 2**: scrivi l'App ID in `steam/sdk/app_build.vdf`
   (al posto di `0000000`), crea i due depot (Windows e Linux + SteamOS) e scrivi i loro numeri al posto di
   `0000001` e `0000002`. Aggiungi i depot al pacchetto **Developer Comp** e a quello in vendita.
3. Crea un account Steam dedicato ai caricamenti con i soli permessi *Edit App Metadata* e
   *Publish App Changes To Steam* (consiglio di Valve per la sicurezza).
4. Per provare una build locale fuori dal client Steam (con Steam aperto e il tuo account):
   `npm run steam:appid -- <AppID>` scrive `steam_appid.txt` accanto all'eseguibile in `release/`;
   `npm run steam:appid -- --remove` lo toglie. Senza numero usa 480 (Spacewar, l'app di prova di Valve).
   In alternativa la variabile d'ambiente `STEAM_APP_ID`. Quando è Steam ad avviare il gioco l'App ID arriva da solo,
   e `steam_appid.txt` non finisce mai nei depot.

## 3. Pagina del negozio

Steamworks → la tua app → **Edit Store Page**. Va compilata e inviata in revisione **prima** della build.
La revisione richiede di solito 3–5 giorni lavorativi: inviala almeno 7 giorni prima di quando vuoi la pagina online.

**Grafica** — tutti i file sono pronti in `steam/store-assets/`; la tabella completa (file → campo di Steamworks,
dimensioni, origine) è in **[steam/store-assets/README.md](../steam/store-assets/README.md)**. In breve:

| Sezione di Steamworks | File |
|---|---|
| Store Assets → Header / Small / Main / Vertical Capsule | `header_capsule_920x430.png`, `small_capsule_462x174.png`, `main_capsule_1232x706.png`, `vertical_capsule_748x896.png` |
| Store Assets → Page Background (facoltativo) | `page_background_1438x810.png` |
| Screenshots (almeno 1920×1080, 16:9) | `screenshots/` (6 immagini: menu, mappa della regione, città di giorno e di notte, pannello di un edificio, evento) |
| Library Assets → Capsule / Header / Hero / Logo | `library_capsule_600x900.png`, `library_header_920x430.png`, `library_hero_3840x1240.png`, `library_logo_1280x720.png` |
| Community Assets → App Icon (.jpg) e Shortcut Icon | `community_icon_184x184.jpg`, `shortcut_icon_256x256.png` (o `shortcut_icon.ico`) |
| Event Cover / Event Header (per gli annunci) | `event_cover_800x450.png`, `event_header_1920x622.png` |

Sulle capsule Steam ammette solo artwork, nome del gioco e sottotitolo: per questo gli slogan delle immagini
originali sono stati tolti (spiegazione nel README della grafica). Dopo il caricamento controlla l'anteprima di
Steamworks, soprattutto la posizione del logo sopra l'immagine *Hero*.

**Trailer** (consigliato, oggi manca): 30–60 secondi. Apri con il bot che raccoglie spazzatura, poi la scelta
"pianeta pulito o profitto?", poi le 5 città.

**Testi**
- Breve: *"Small robots, big choices. Turn the junk of the Scrap Coast into five living cities — and decide if they grow green or rich."*
- La descrizione va tradotta a parte in Steamworks per ogni lingua: i testi del gioco in `src/i18n/` possono fare da base.
- Tag consigliati: City Builder, Pixel Graphics, Cozy, Management, Choices Matter, Casual, Strategy, Cute.
- Sviluppatore ed editore: Qwerty3D Games. Data di uscita: "Coming soon" finché non è decisa.

**Lingue da spuntare** (colonna *Interface*; *Full Audio* e *Subtitles* no, non ci sono voci): English, Italian,
German, French, Spanish - Spain, Portuguese - Portugal, Polish, Dutch. Il gioco sceglie da solo la lingua del sistema
al primo avvio; si cambia dal pulsante col globo nel menu o dalle impostazioni.

**Sistemi operativi e requisiti**: spunta **Windows** e **SteamOS + Linux** (non macOS: non c'è una build Mac).
Minimo: Windows 10 64 bit (Electron non supporta più Windows 7 e 8) oppure SteamOS / Linux 64 bit recente;
spazio su disco **350 MB** (le build occupano 278 MB su Windows e 272 MB su Linux). Processore, memoria e scheda video
indicali dopo averlo provato su un PC modesto (è un gioco 2D in pixel art).

**Questionario sui contenuti** (*Content Survey*): obbligatorio prima della revisione. Comprende i contenuti per adulti
(qui nessuno), le classificazioni per età generate dalle risposte e la parte sull'IA (sezione 11).

## 4. Depot, opzioni di avvio, runtime Linux, componenti

Tutto in Steamworks → la tua app → **Installation** (alla fine premi *Publish* per rendere effettive le modifiche).

**Depot**: vedi passo 2 (uno Windows, uno *Linux + SteamOS*, entrambi nel pacchetto Developer Comp e in quello in vendita).

**Cartella di installazione**: `Scrapbot City`.

**Opzioni di avvio** (*Installation → General Installation → Launch Options*):

| # | Executable | Arguments | Operating System | CPU | Launch type |
|---|---|---|---|---|---|
| 1 | `Scrapbot City.exe` | (vuoto) | Windows | 64-bit | Launch (Default) |
| 2 | `scrapbot-city` | (vuoto) | Linux + SteamOS | 64-bit | Launch (Default) |

L'eseguibile si scrive così, senza `./` né cartelle: i file sono nella radice del depot.
**Steam Deck** usa l'opzione 2 (la build Linux nativa): non serve un'opzione a parte.

**Runtime Linux** (*Installation → Linux Runtime*, compare dopo aver creato l'opzione di avvio Linux):
scegli **Steam Linux Runtime 3.0 (sniper)**.
- Provato con i file di sniper, senza client Steam: il gioco parte (menu, schermo intero a 1280×800, salvataggi).
  La prova definitiva è quella sul ramo beta (sezione 7).
- **Non** scegliere *Steam Linux Runtime 4.0*, anche se Valve lo consiglia per i giochi nuovi: non contiene le
  librerie GTK 3 e di accessibilità (`libgtk-3`, `libatk-bridge`, `libatspi`) che Electron 33 richiede per partire
  (controllato sull'elenco dei pacchetti pubblicato da Valve).
- L'impostazione predefinita (1.0 "scout") non è stata provata: meglio non lasciarla.

**Componenti da installare** (*Installation → Redistributables*): spunta **Visual C++ Redistributable 2015-2022
(x64)** (il nome esatto in lista può variare di poco). Il modulo Windows di `steamworks.js` lo richiede
(`VCRUNTIME140.dll`): sui PC che non lo hanno il gioco parte lo stesso, ma gli achievement non arrivano a Steam.

**Sandbox su Linux**: Electron usa la sandbox di Chromium. Nel runtime sniper funziona (provato come utente normale).
Se su qualche sistema il gioco non parte con l'errore *"The SUID sandbox helper binary was found, but is not
configured correctly"* o *"No usable sandbox"*, aggiungi `--no-sandbox` agli *Arguments* dell'opzione Linux.

**Mac**: nessuna build per ora (servirebbero un account Apple Developer, firma e notarizzazione). `npm run dist:mac` esiste
ma non è stato provato.

## 5. Build

```bash
npm run dist:steam
```

Funziona anche su Linux, senza wine: compila il gioco, crea `release/win-unpacked/` e `release/linux-unpacked/`
e li copia in `steam/content/windows` e `steam/content/linux` (la cartella che SteamPipe carica, un depot per sistema).
Ogni cartella viene sostituita per intero, così non resta nessun file vecchio; `steam_appid.txt` non viene mai copiato.
Fai la build su **Linux o macOS** se puoi: Windows non conserva il permesso "eseguibile" dei file Linux.

## 6. Caricamento

Dettagli e risoluzione dei problemi in **[steam/README.md](../steam/README.md)** (passi 3–5). In breve:

1. Installa `steamcmd` una volta (passo 3 del README).
2. Prova a vuoto: `steam/upload.sh <account_build> --preview` — controlla App ID, depot, file e versione, non carica niente.
3. Carica: `steam/upload.sh <account_build> --beta beta` — carica i due depot e mette la build sul ramo `beta`.

La prima volta `steamcmd` chiede password e codice Steam Guard, poi ricorda il login: nessuna password è scritta
nei file. Su Windows c'è `steam\upload.bat` con le stesse opzioni, ma per il depot Linux è meglio caricare da
Linux, macOS o WSL (motivo nel README).

## 7. Prova sul ramo beta

1. Steamworks → **SteamPipe → Builds**: crea il ramo `beta` con una password (prima del caricamento del passo 6).
2. Nel client Steam: tasto destro sul gioco → **Proprietà → Beta**, inserisci la password e scegli `beta`.
3. Prova **su Windows, su Linux e sullo Steam Deck**:
   - il gioco parte dal pulsante "Gioca" (su Windows è la **prima volta in assoluto**: l'exe è costruito da Linux);
   - Steam Deck: parte a schermo intero, tutto si usa col controller, il campo del nome città apre la tastiera di Steam;
   - **Shift+Tab** apre l'overlay di Steam;
   - finisci il tutorial: deve comparire la notifica di Steam di *Bootcamp Graduate* (achievement collegati);
   - salva su PC, apri sul Deck: la città deve esserci (Steam Cloud, sezione 9);
   - "Quit" chiude il gioco e Steam lo vede chiuso.
4. Per tester esterni e stampa: chiavi Steam (Steamworks → *Request Steam Product Keys*) oppure la password del ramo beta.
5. Quando tutto va: **SteamPipe → Builds** → metti la build sul ramo **default** a mano (nessuno script può farlo:
   è una regola di Valve). La build sul ramo default è quella che Valve controlla nella revisione (sezione 14).

## 8. Achievement

Steamworks → la tua app → **Stats & Achievements → Achievements**. Crea i 18 achievement copiando
**[steam/achievements.csv](../steam/achievements.csv)**:

| Campo di Steamworks | Colonna del CSV |
|---|---|
| API Name | `api_name` — **identico**, es. `ACH_SPIRE` (il gioco invia `ACH_` + l'id in maiuscolo) |
| Display Name / Description | `display_name` / `description` (inglese) |
| Hidden | `hidden`: `0` per tutti (nel gioco nomi e descrizioni sono già visibili nella schermata Extra) |
| Set By | `set_by`: **Client** |

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
| ACH_HINT | Ask the Expert | Chiedere un suggerimento a USA-9 |
| ACH_SPIRE | Reach for the Sky | Finire una Scrap Spire |
| ACH_GREEN | Garden City | Finale Verde |
| ACH_INDUSTRIAL | Megacity | Finale Industriale |
| ACH_BALANCED | Both Ways | Finale Bilanciato |
| ACH_SMOG | Learned the Hard Way | Perdere una città per lo smog |
| ACH_CLEANHANDS | Clean Hands | Spire senza mai costruire industria |
| ACH_ROADTRIP | Road Trip | Sbloccare la seconda città |
| ACH_COAST | Coast to Coast | Spire in tutte e 5 le città |
| ACH_SUPERSTAR | Superstar | Tutte le 15 stelle |

- **Traduzioni**: nomi e descrizioni nelle altre 7 lingue sono in
  **[steam/achievements_i18n.csv](../steam/achievements_i18n.csv)** (presi da `src/i18n/`): copiali nei campi di ogni lingua.
- **Icone** (oggi mancano): per ogni achievement un'icona a colori (sbloccato) e una in grigio (bloccato), quadrate;
  Steam le mostra a 64×64. Si possono ricavare dalle icone pixel del gioco ingrandite senza sfumature. Usa la dimensione
  e il formato che chiede il modulo di Steamworks.
- Dopo le modifiche premi **Publish**: gli achievement non pubblicati non arrivano ai giocatori.
- **Nuovi achievement**: l'aggiornamento dei contenuti (0.7, in lavorazione) ne aggiungerà altri. Si creano in più,
  con nuovi API name; non cambiare mai l'API name di uno già pubblicato (chi l'ha sbloccato lo perderebbe).
- Il gioco reinvia a Steam tutti gli achievement sbloccati a ogni avvio: chi li ha sbloccati offline o prima
  dell'uscita su Steam li ritrova.
- **Linux**: il modulo Linux di `steamworks.js` richiede glibc 2.34 o più nuova. Il runtime sniper ha la 2.31, ma Steam
  usa quella del sistema quando è più nuova: provato con glibc 2.39 il modulo si carica. Sullo Steam Deck e sulle
  distribuzioni recenti va; su sistemi più vecchi (es. Ubuntu 20.04, Debian 11) il gioco funziona ma senza
  achievement di Steam. Da confermare nel test del passo 7 sul Deck.

## 9. Steam Cloud (salvataggi sincronizzati)

La versione desktop salva tutto in file `.sav` nella cartella dell'utente (percorso fissato in `electron/main.cjs`:
cartella dei dati delle app + `Scrapbot City/saves`):

| Sistema | Cartella | Verificato |
|---|---|---|
| Windows | `%APPDATA%\Scrapbot City\saves` (`C:\Users\<nome>\AppData\Roaming\...`) | dal codice (`app.getPath('appData')`) |
| Linux / Steam Deck | `~/.config/Scrapbot City/saves` | sì, avviando la build Linux (anche con i file del runtime sniper) |
| macOS (nessuna build) | `~/Library/Application Support/Scrapbot City/saves` | — |

I file sono circa 25 al massimo (impostazioni, campagna, achievement, finali, 4 slot di gioco libero e 5 città della
campagna, ognuno con un file di dati e uno di descrizione), di pochi KB ciascuno (una città grande ~11 KB).

Steamworks → la tua app → **Application → Steam Cloud**:

1. **Byte quota per user**: `10000000` (10 MB); **Number of files allowed per user**: `100`.
2. Attiva **Auto-Cloud** e aggiungi una **Root Path**:
   - Root: **WinAppDataRoaming**
   - Subdirectory: `Scrapbot City/saves`
   - Pattern: `*.sav`
   - OS: **[All OSes]** (obbligatorio quando si usano i Root Override)
   - Recursive: **no**
3. Aggiungi un **Root Override** per Linux (Steam Deck compreso):
   - Original Root: WinAppDataRoaming — OS: **Linux** — New Root: **LinuxHome**
   - Add/Replace Path: `.config/Scrapbot City/saves` — **Replace Path**: sì
4. Premi *Save* e poi *Publish*.

Così un salvataggio fatto su Windows si ritrova sul Deck e viceversa. Le copie `.sav.bak` e i file temporanei restano
solo sul computer (il pattern `*.sav` non li prende): servono se un file si rovina. La scelta "finestra o schermo intero"
del Deck sta in `steam-deck.json`, fuori da `saves/`, quindi non passa al PC.

**Prova prima dell'uscita**: spunta *"Enable cloud support for developers only"* (solo gli account con la licenza
Developer Comp usano il Cloud), poi nel client Steam apri la console (`steam://open/console` nel browser) e scrivi
`testappcloudpaths <AppID>` per vedere quali file Steam trova. Prima dell'uscita togli la spunta e pubblica.
Il pulsante **"Open the saves folder"** nelle impostazioni del gioco apre la cartella (utile anche per l'assistenza).
Nota: su Linux, se un giocatore ha cambiato `XDG_CONFIG_HOME`, i salvataggi finiscono lì e il Cloud non li vede (raro).

## 10. Controller e revisione Steam Deck

**Steam Input** (Steamworks → la tua app → **Application → Steam Input**): supporto controller **completo**
(*Full*) e configurazione predefinita **Gamepad** per tutti i tipi di controller. Il gioco legge il controller
come un pad standard (non usa le API di Steam Input). Sulla pagina del negozio comparirà "Supporto completo del controller".

Comandi in città: stick sinistro = cursore, stick destro = mappa, A = costruisci/seleziona, B = annulla,
LB/RB = edificio precedente/successivo, LT/RT = zoom, X = ruspa, Y = suggerimento, Start = menu,
D-pad = una casella alla volta, View = pausa, L3 = velocità, R3 = torna all'HQ.

**Revisione Steam Deck**: si può chiedere anche prima dell'uscita, dalla pagina dell'app → *Technical Tools* →
**Steam Hardware Compatibility Review** (il link non è ancora disponibile per tutti; Valve può anche testare il gioco
da sola). Puoi indicare il ramo da provare (es. `beta`); se non lo indichi Valve prova il ramo default. Serve prima
aver superato la normale revisione della build. Valve prova prima la build Linux; se va male prova quella Windows con Proton e tiene il risultato migliore.
I risultati arrivano di solito entro una settimana; hai poi circa una settimana per guardarli prima che vengano pubblicati.

Cosa controlla Valve per **"Verified"** e lo stato attuale:

| Requisito | Stato |
|---|---|
| Tutto il gioco usabile col controller, senza mouse, con la configurazione predefinita | ✔ menu, dialoghi, regione e città (cursore virtuale) |
| Glifi dei pulsanti del controller nei testi | ✔ A, B, X, Y, LB/RB, LT/RT, Start, View, L3, R3 |
| Risoluzione 1280×800 (o 1280×720) | ✔ finestra di partenza 1280×800 |
| Testi leggibili: minimo 9 px di altezza a 1280×800 (12 consigliati) | ✔ verificato sugli screenshot, da ricontrollare nelle lingue lunghe (DE, PL) |
| Tastiera a schermo per i campi di testo | ✔ con steamworks.js (`showFloatingGamepadTextInput`), altrimenti Steam + X — da provare (sezione 7) |
| Almeno 30 fps a 800p | da misurare sul Deck (gioco 2D, atteso senza problemi) |
| Nessun launcher, nessun avviso "hardware non supportato" | ✔ |
| Schermo intero sul Deck | ✔ con `SteamDeck=1` (lo imposta Steam) parte a schermo intero; se il giocatore lo toglie (F11 o impostazioni) la scelta resta su quel dispositivo |

## 11. Dichiarazione dei contenuti fatti con l'IA

Nel **Content Survey** (sezione 3) c'è una parte sull'IA generativa. Valve chiede di dichiarare i contenuti che i
giocatori vedono o sentono creati con l'aiuto dell'IA, distinguendo:

- **Pre-generati** (fatti durante lo sviluppo): qui sì. Testi, traduzioni, grafica e musica del gioco sono stati creati
  con l'aiuto dell'IA, e così il mockup del menu; gli sprite sono modelli voxel generati da codice scritto con l'aiuto
  dell'IA. Se anche le 5 immagini usate per la grafica del negozio sono generate con l'IA, dichiaralo.
- **Generati dal vivo** (mentre si gioca): nessuno; il gioco non usa IA quando gira.

Descrivi con onestà cosa e come: Valve valuta questi contenuti con le stesse regole degli altri, e la descrizione
compare sulla pagina del negozio. Alcune risposte, dopo l'approvazione, si cambiano solo scrivendo al supporto.

## 12. Prezzo (consiglio)

- Con i contenuti di oggi (campagna di 1,5–3 ore, 10 eventi) il prezzo onesto è **4,99–6,99 €**: sotto le 2 ore
  di gioco molti chiedono il rimborso, e Steam lo concede entro 14 giorni.
- Un city builder pixel indie di 6–10 ore regge **9,99–12,99 €**: è il traguardo dopo i contenuti della 0.7 (sezione 15).
- Per gli altri Paesi usa i prezzi regionali che Steamworks propone partendo dal prezzo in dollari.
- Sconto di lancio del 10–15%. Anche il prezzo passa dalla revisione di Valve.

## 13. Pagina "Coming Soon" e Steam Next Fest

**Apri la pagina "Coming Soon" il prima possibile**: le wishlist raccolte nei mesi prima dell'uscita sono ciò che pesa
di più sulle vendite. Serve solo la pagina approvata (sezione 3), non la build. La pagina deve restare "Coming Soon"
almeno **2 settimane** prima dell'uscita.

**Steam Next Fest** (una settimana di demo gratuite, tre volte l'anno: febbraio, giugno, ottobre):
- si partecipa **una volta sola** per gioco, con una **demo giocabile da tutti** e la pagina del gioco pubblica;
  il gioco non deve uscire prima della fine del Fest;
- la demo è un'app separata collegata al gioco (gratuita, senza un'altra quota); va preparata una build demo
  (oggi non c'è): l'idea è **tutorial + la prima città**, un pezzo già chiuso del gioco;
- **prossime edizioni**: **febbraio 2027** (22 febbraio – 1 marzo; iscrizione entro il **10 gennaio 2027**; demo e
  pagina in revisione entro il 25 gennaio per essere nell'anteprima stampa dell'11 febbraio, tutto entro l'8 febbraio)
  e **giugno 2027** (date su Steamworks → *Upcoming Events*). Quella di ottobre 2026 è troppo vicina.
- **Consiglio**: febbraio 2027 solo se a fine gennaio la 0.7 e la demo sono pronte e provate; altrimenti giugno 2027.
  Esci con il gioco completo poche settimane dopo il Fest, quando le wishlist sono fresche.

## 14. Uscita

Prima di poter uscire servono:
- pagina del negozio approvata e "Coming Soon" da almeno 2 settimane;
- build sul ramo **default** approvata da Valve (*Game Build checklist*: deve contenere ciò che la pagina promette;
  si può continuare ad aggiornarla durante la revisione);
- almeno 21 giorni dal pagamento della quota;
- prezzo approvato; questionario sui contenuti completo.

Il gioco **non esce da solo**: quando tutto è approvato, nella pagina dell'app compare il pulsante verde
**Release App**. Si apre un riepilogo; poi *Publish Now*, conferma e *Release Now*.

## 15. Cosa manca prima di vendere (onestamente)

Fatto nella 0.5–0.6: salvataggi su file con Steam Cloud, controller e Steam Deck, 8 lingue, 4 brani di musica,
città isometrica, build Windows e Linux, grafica del negozio, script di caricamento.

1. **Più contenuti** (è il punto più importante; la 0.7 è in lavorazione): oggi ci sono solo 10 eventi narrativi,
   che si ripetono in tutte e 5 le città, e una città si completa in 12–20 minuti. Per un gioco a pagamento servono
   almeno 30–40 eventi, edifici o miglioramenti per la seconda metà della partita e una modalità "infinita" con obiettivi.
2. **Trailer** e **icone degli achievement** (sezioni 3 e 8).
3. **Musica di un compositore**: i 4 brani sono chiptune scritti come note in `src/music.ts` e suonati dal codice.
   Vanno bene per demo e playtest; per il lancio conviene un compositore (anche solo per riscriverli meglio).
4. **Passata grafica**: dalla 0.6 la città è isometrica e gli sprite sono modelli voxel generati dal codice
   (`scripts/art/`, `npm run art`). Un artista pixel può sostituire qualsiasi fotogramma mettendo un PNG con lo stesso
   nome in `art/overrides/` (vedi README).
5. **Playtest** con 10–20 persone che non conoscono il gioco: vedi **[PLAYTEST.md](PLAYTEST.md)**.
6. **Revisione delle traduzioni** da madrelingua (soprattutto eventi e finali) durante il playtest.
7. **Verifica legale** di nomi e marchi ("2PM", "Scrapbot City") prima di registrare la pagina.
8. **Prima prova su Windows** e sul Deck (sezione 7): oggi nessuna delle due è stata fatta con il client Steam.

Lingue da valutare dopo: portoghese brasiliano, giapponese, cinese semplificato e coreano (i city builder vendono
molto in Asia; servono font CJK, oggi c'è solo il katakana del logo).

## 16. Idee per allungare la vita del gioco (aggiornamenti dopo l'uscita)

- Albero tecnologico dei bot (velocità, capacità, droni da pulizia).
- Sesta e settima città come aggiornamento gratuito: fa tornare i giocatori e Steam lo mostra a chi ha il gioco in wishlist.
- Modalità infinita con classifica (Steam Leaderboards) e sfide settimanali con seed fisso.
- Editor di mappe e Steam Workshop.
