# Scrapbot City su Steam — la guida passo per passo

Il gioco è una pagina HTML impacchettata con **Electron**: stesso codice per browser e desktop, una build per
Windows e una per Linux (che usa anche lo Steam Deck). Questa guida va dall'account Steamworks al pulsante
"Release". Segui i passi **in ordine**; ognuno dice dove cliccare e quale file del progetto usare. I nomi dei menu di
Steamworks sono in inglese, come li vedrai sul sito.

| Per… | Leggi |
|---|---|
| caricare i file (SteamPipe, steamcmd, errori) | [steam/README.md](../steam/README.md) |
| la grafica del negozio | [steam/store-assets/README.md](../steam/store-assets/README.md) |
| provenienza e licenze della grafica, dei font e dell'audio | [steam/ASSETS-PROVENANCE.md](../steam/ASSETS-PROVENANCE.md) |
| i testi della pagina (inglese e italiano), requisiti, tag | [steam/STORE-COPY.md](../steam/STORE-COPY.md) |
| il questionario sui contenuti e la dichiarazione sull'IA | [steam/CONTENT-SURVEY-DRAFT.md](../steam/CONTENT-SURVEY-DRAFT.md) |
| il trailer (registrazione dal gioco, riproducibile) | [scripts/trailer/README.md](../scripts/trailer/README.md) |

**Le regole di questo ramo.** Il lavoro per Steam è nato sul ramo `steam-package`, separato dal ramo del gioco. Il
13/10/2026 la 0.7.0-beta.1 verificata (`c199a4f`, [BETA-REPORT.md](BETA-REPORT.md)) è stata unita al pacchetto Steam
sul ramo `rc-0.7.0`, versione **0.7.0-rc.1**. Le build Steam descritte nella sezione 0 sono ancora quelle costruite
l'11/10 dalla **0.6.0**: vanno rifatte da questo commit (passo 5). Una RC non è un via libera commerciale.
Qui nessuno ha un App ID, un account Steamworks, il client Steam, un PC Windows o uno Steam Deck: **niente è stato
caricato, pubblicato, pagato o configurato su Steam**, e nessuna funzione di Steam è dichiarata funzionante senza una
prova vera. Pubblicare, cambiare prezzi, spendere soldi o mettere una build sul ramo pubblico richiedono la **tua**
approvazione esplicita.

## La lista in breve

- [ ] 1. Account Steamworks, quota Steam Direct, dati fiscali e bancari — *avviala subito: è la parte più lenta*
- [ ] 2. Creare l'app, i depot e il ramo `beta`; scrivere App ID e depot nel progetto (SteamPipe, sezione 2)
- [ ] 3. Pagina del negozio: testi, grafica, trailer, lingue, requisiti, questionario sui contenuti
- [ ] 4. Depot, opzioni di avvio, runtime Linux, componenti da installare
- [ ] 5. Ricostruire le build Steam dalla **0.7.0-rc.1** (ramo `rc-0.7.0`: la 0.7.0-beta.1 verificata unita al
  pacchetto Steam) e rifare i controlli nativi (sezione 5)
- [ ] 6. Caricare sul ramo `beta` e provare su Windows, Linux e Steam Deck (sezione 6)
- [ ] 7. Achievement · 8. Steam Cloud · 9. Controller e revisione Steam Deck
- [ ] 10. Dichiarazione sull'IA (nel questionario) · 11. Prezzo (lo decidi tu)
- [ ] 12. Pagina "Coming Soon" e Steam Next Fest · 13. Uscita (lista di controllo finale)

## 0. Dove siamo — stato onesto (11 ottobre 2026; unione con la 0.7 il 13 ottobre)

Quattro parole, sempre con lo stesso significato:
- **Fatto**: è nel repository (codice, script, file).
- **Generato**: i file sono stati prodotti (build, immagini, video) ma **non** sono stati avviati o provati sul sistema
  a cui sono destinati.
- **Verificato qui**: provato davvero su questa macchina — **Linux x64 (Ubuntu 24.04, glibc 2.39), senza client
  Steam, senza GPU (Xvfb, rendering software)**.
- **Da verificare (titolare)**: si può provare solo con Windows, uno Steam Deck o il client Steam con l'App ID vero.

I test fatti qui usano il **vero** modulo steamworks.js (non un sostituto): dimostrano che si carica e che il gioco
regge l'assenza di Steam. **Non** dimostrano che achievement, overlay, Cloud o tastiera del Deck funzionino con Steam:
quello si vede solo sul ramo beta.

| Cosa | Stato | Dettagli |
|---|---|---|
| Gioco 0.7 unito al pacchetto Steam (ramo `rc-0.7.0`, 0.7.0-rc.1) | **Fatto** e **verificato qui** nel browser | 24 elementi del catalogo, `projects.sav`; controlli statici, test, numeri identici alla 0.7.0-beta.1 e `npm run e2e` (Chromium headless, input simulato) sul codice unito: CHANGELOG, 0.7.0-rc.1 |
| Salvataggi su file nell'app desktop (`electron/file-store.cjs`) | **Fatto** e **verificato qui** (test) | scrittura atomica, copia `.bak`, file rovinato copiato a parte (`.damaged-<n>`) prima di usare la `.bak`, `storage:getDamaged` per i progetti; `tests/desktop-store.test.ts`, `tests/storage.test.ts`. Su Windows solo dal codice |
| Build Linux per Steam (`steam/content/linux`, 90 file, 271,0 MiB) | **Generato** e **verificato qui** | costruita l'11/10 dalla 0.6.0 (`npm run dist:steam`); avviata senza client Steam: menu in <1 s, una città gira, salvataggi in `~/.config/Scrapbot City/saves`, "Quit" chiude con codice 0, nessun errore nella pagina (`npm run steam:launch-check`) |
| Build Windows per Steam (`steam/content/windows`, 90 file, 277,6 MiB) | **Generato** | costruita da Linux; l'exe è Electron 33.4.11 con icona e dati di versione; **mai avviata su Windows** |
| steamworks.js 0.4.0 contro Electron 33.4.11 | **Verificato qui** (Linux) · **controllo statico** (Windows) | sezione 5 |
| Comportamento senza Steam | **Verificato qui** (Linux) | `Steam not available: Failed to load module '…/steamclient.so'` nel log, il gioco continua; tastiera del Deck: il gioco riceve "no" e usa i suoi campi; achievement: chiamata ignorata |
| Achievement su Steam | **Da verificare** | servono App ID, i 18 achievement creati in Steamworks (sezione 7) e il client Steam |
| Overlay di Steam (Shift+Tab) | **Da verificare** | il codice c'è (`electronEnableSteamOverlay`); si vede solo avviando da Steam |
| Steam Cloud | **Da configurare** e **da verificare** | il gioco scrive i file nella cartella giusta (verificato qui su Linux; su Windows solo dal codice); configurazione in sezione 8 |
| Steam Deck | **Da verificare** | nessun Deck qui; `SteamDeck=1` (schermo intero) provato in passato solo impostando la variabile a mano; la tastiera a schermo arriva solo da steamworks.js con Steam aperto su un Deck vero: **mai provata** |
| Controller | **Verificato solo con Gamepad API simulata** in Chromium (sessioni precedenti) | da provare con un controller vero e con Steam Input |
| Build nel runtime Linux "sniper" | **Verificato** in passato **senza** client Steam (contenitore preparato a mano) | la prova vera è dal client Steam |
| Script SteamPipe (`steam/sdk/*.vdf`, `upload.sh`, `upload.bat`) | **Fatto** | `node steam/prepare-upload.cjs --check` oggi rifiuta di partire per i segnaposto (verificato l'11/10); provati in passato con uno steamcmd finto; l'11/10 alle 00:20 è stato avviato anche lo steamcmd vero in *preview* con `+login anonymous` e un App ID inventato, fuori dal repository: connessione fallita, niente inviato (dettagli in [steam/README.md](../steam/README.md), passo 5); `upload.bat` mai provato su Windows |
| Grafica del negozio | **Generato** | dimensioni tutte conformi alle regole attuali; screenshot del menu tolto dal set; screenshot da rifare sulla build finale; tre dubbi sul logo da decidere (ASSETS-PROVENANCE §5) |
| Testi del negozio, requisiti, tag | **Bozza** | STORE-COPY.md (righe **[pending final build]** da controllare) |
| Questionario sui contenuti | **Bozza** | CONTENT-SURVEY-DRAFT.md |
| Trailer | **Fatto** (pipeline) · **Generato** (video di prova) | provato da capo a fondo l'11/10 sulla build del ramo principale (`04d782e`, 0.7.0-alpha.1): video di prova di 54 s, 1920×1080, 30 fps, H.264 9,8 Mbit/s, audio muto, più 11 schermate; fuori da git. Va rifatto sulla build finale |
| Licenze di terzi nelle build | **Fatto** | cartella `licenses/` nelle due build (font OFL/Apache, steamworks.js MIT); in revisione (11/10) aggiunto l'avviso di copyright di Permanent Marker (Font Diner, Inc.), che il file LICENSE del pacchetto non ha, e ricostruite le build (`app.asar` identico) |

**Cosa devi fare tu** (nessuno può farlo al posto tuo): account e pagamenti (1), creare app, depot e ramo beta (2),
pagina, grafica, trailer e questionario (3, 10), impostazioni di Steamworks (4, 7, 8, 9), caricare e provare (6),
prezzo e date (11, 12), premere "Release" (13).

## 1. Account Steamworks e quota

1. Vai su <https://partner.steamgames.com>, crea l'account come **Qwerty3D Games** (azienda o persona fisica)
   e firma l'accordo di distribuzione.
2. Completa **identità**, **questionario fiscale** (la verifica può richiedere settimane e documenti) e **conto
   bancario** (l'intestatario deve coincidere con il nome dato nella registrazione).
3. Paga la quota **Steam Direct**: 100 USD per gioco, non rimborsabili ma recuperati nel pagamento successivo a quando
   il gioco supera 1.000 USD di ricavi lordi rettificati. **È una spesa: la fai tu.**
4. Tra il pagamento della quota e l'uscita devono passare **30 giorni** (vale per i primi titoli).
   (Letto l'11/10/2026 su [Steam Direct](https://partner.steamgames.com/steamdirect).)

## 2. SteamPipe passo per passo: App ID, depot, rami, caricamento

### 2.1 Cosa creare in Steamworks

| Cosa | Dove | Note |
|---|---|---|
| **L'app** "Scrapbot City" | dopo il pagamento, con il credito app | Steam le assegna un numero: l'**App ID** (lo vedi anche nell'indirizzo, `…/apps/landing/<AppID>`) |
| **Depot Windows** | la tua app → **SteamPipe → Depots** | di solito App ID + 1; *Operating System*: **Windows**; *Architecture*: 64-bit; lingue: tutte (le 8 lingue sono dentro il gioco) |
| **Depot Linux** | stessa pagina, *Add new depot* | di solito App ID + 2; *Operating System*: **Linux + SteamOS** (lo usa anche lo Steam Deck) |
| Depot nei **pacchetti** | la tua app → *All Associated Packages, DLC, Demos and Tools* | aggiungi i due depot al pacchetto **Developer Comp** (senza, neanche tu scarichi i file) e a quello in vendita |
| **Ramo `beta`** con password | **SteamPipe → Builds** → crea un ramo | va creato **prima** del caricamento; chi conosce la password lo sceglie in Steam → Proprietà → Beta |
| **Account per i caricamenti** | il tuo gruppo Steamworks | consiglio di Valve: un account dedicato con i soli permessi *Edit App Metadata* e *Publish App Changes To Steam*; per mettere live una build di un gioco **già uscito** l'account deve avere un telefono o l'app Steam Mobile, e dopo un cambio di email/telefono Valve blocca la messa live per 3 giorni |

Dopo ogni modifica alle impostazioni: **Publish** (*Prepare for Publishing* → *Publish to Steam*).
(Regole lette l'11/10/2026 su [Uploading to Steam](https://partner.steamgames.com/doc/sdk/uploading).)

### 2.2 Dove scrivere i numeri nel progetto

| Segnaposto | Cosa è | File da modificare |
|---|---|---|
| `0000000` | App ID | `steam/sdk/app_build.vdf`, riga `"AppID"` |
| `0000001` | depot Windows | `steam/sdk/app_build.vdf` (blocco `"Depots"`) **e** `steam/sdk/depot_build_windows.vdf` (riga `"DepotID"`) |
| `0000002` | depot Linux | `steam/sdk/app_build.vdf` (blocco `"Depots"`) **e** `steam/sdk/depot_build_linux.vdf` (riga `"DepotID"`) |

Esempio con App ID 1234560 (numeri **inventati**, solo per mostrare la forma: usa i tuoi):

```
"AppID" "1234560"
"Depots"
{
	"1234561" "depot_build_windows.vdf"
	"1234562" "depot_build_linux.vdf"
}
```

Controllo senza caricare niente: `node steam/prepare-upload.cjs --check`. Si rifiuta di partire finché resta un
segnaposto o se i numeri dei due file non coincidono (verificato l'11/10/2026: oggi elenca i 5 segnaposto).

### 2.3 steamcmd (una volta sola)

Istruzioni in [steam/README.md](../steam/README.md), passo 3 (`steam/steamcmd/`, escluso da git). La prima volta
chiede password e codice **Steam Guard**, poi ricorda il login: nessuna password è scritta nei file.

### 2.4 Costruire le build da caricare

```bash
npm run dist:steam
```

Dal commit della **0.7.0-rc.1** sul ramo `rc-0.7.0` (la 0.7.0-beta.1 verificata unita al pacchetto Steam), o da quello
della versione che deciderai di vendere, dopo averlo verificato. Crea `release/win-unpacked/` e
`release/linux-unpacked/` (anche da Linux, senza wine) e li copia in `steam/content/windows` e `steam/content/linux`.
`steam_appid.txt` non viene mai copiato. Fai la build su **Linux o macOS**: Windows non conserva il permesso
"eseguibile" dei file Linux.

### 2.5 Prova a vuoto, poi il ramo beta

```bash
steam/upload.sh <account_build> --preview      # legge tutto e scrive i log in steam/output, non carica niente
steam/upload.sh <account_build> --beta beta    # carica i due depot e mette la build live SOLO sul ramo "beta"
```

Su Windows c'è `steam\upload.bat` con le stesse opzioni (mai provato su Windows; per il depot Linux carica da Linux,
macOS o WSL). Alla fine deve comparire `Successfully finished AppID … build (BuildID …)`.

### 2.6 Il ramo `default` (quello dei giocatori): mai da script

- Gli script **non possono** mettere una build sul ramo `default`: Valve non lo permette (`SetLive` non accetta
  `default`) e `upload.sh` si rifiuta anche se glielo chiedi.
- Si fa **a mano** in **SteamPipe → Builds**, scegliendo il ramo `default` nella riga della build, **solo** dopo le
  prove della sezione 6 e **solo con la tua decisione esplicita**. Prima dell'uscita la build sul `default` è quella
  che Valve controlla in revisione; dopo l'uscita è quella che ricevono i giocatori.

### 2.7 Provare una build fuori dal client Steam

Con Steam aperto e il tuo account: `npm run steam:appid -- <AppID>` scrive `steam_appid.txt` accanto agli eseguibili
in `release/`; `npm run steam:appid -- --remove` lo toglie (senza numero usa 480, l'app di prova di Valve). In
alternativa la variabile `STEAM_APP_ID`. Quando è Steam ad avviare il gioco l'App ID arriva da solo.

## 3. Pagina del negozio

Steamworks → la tua app → **Edit Store Page**. Va compilata e inviata in revisione **prima** della build; la revisione
richiede alcuni giorni lavorativi.

- **Testi** (breve e lungo, inglese e italiano), requisiti di sistema da confermare, tag proposti:
  [steam/STORE-COPY.md](../steam/STORE-COPY.md). Le righe **[pending final build]** si tolgono o si confermano sulla
  build finale: la pagina non deve promettere niente che il gioco non abbia.
- **Grafica**: [steam/store-assets/README.md](../steam/store-assets/README.md) (file → campo di Steamworks). Regole
  ricontrollate l'11/10/2026 sulle pagine attuali di Steamworks: tutte le dimensioni sono quelle in vigore; sulle
  capsule solo artwork, nome del gioco ed eventuale sottotitolo ufficiale (slogan tolti); hero senza testo; logo
  separato su sfondo trasparente. Restano **tre decisioni tue** (targa "2PM" e katakana nel logo, insegne nelle
  illustrazioni) e gli **screenshot da rifare sulla build finale**: dettagli in
  [steam/ASSETS-PROVENANCE.md](../steam/ASSETS-PROVENANCE.md), sezione 5.
- **Trailer**: [scripts/trailer/README.md](../scripts/trailer/README.md). Steam lo vuole fino a 1920×1080, 30 o 60 fps,
  H.264 + AAC in .mp4, 5.000+ kbit/s; consiglia che il primo trailer sia soprattutto gameplay con l'interfaccia
  visibile. La pipeline produce esattamente questo dalla build di rilascio, senza testi né immagini aggiunte; manca
  l'audio (sezione 4 del README del trailer).
- **Lingue** (solo colonna *Interface*: niente *Full Audio* né *Subtitles*, il gioco non ha voci): English, Italian,
  German, French, Spanish - Spain, Portuguese - Portugal, Polish, Dutch.
- **Sistemi operativi**: **Windows** e **SteamOS + Linux**; non macOS (nessuna build Mac).
- **Questionario sui contenuti** (obbligatorio): [steam/CONTENT-SURVEY-DRAFT.md](../steam/CONTENT-SURVEY-DRAFT.md).

## 4. Depot, opzioni di avvio, runtime Linux, componenti

Tutto in Steamworks → la tua app → **Installation** (alla fine *Publish*).

**Cartella di installazione**: `Scrapbot City`.

**Opzioni di avvio** (*Installation → General Installation → Launch Options*):

| # | Executable | Arguments | Operating System | CPU | Launch type |
|---|---|---|---|---|---|
| 1 | `Scrapbot City.exe` | (vuoto) | Windows | 64-bit | Launch (Default) |
| 2 | `scrapbot-city` | (vuoto) | Linux + SteamOS | 64-bit | Launch (Default) |

L'eseguibile si scrive così, senza `./` né cartelle: i file sono nella radice del depot. Lo Steam Deck usa l'opzione 2.

**Runtime Linux** (*Installation → Linux Runtime*): **Steam Linux Runtime 3.0 (sniper)**. Provato in passato con i
file di sniper senza client Steam (il gioco parte); **non** scegliere il 4.0: mancano le librerie GTK 3 e di
accessibilità che Electron 33 richiede (`libgtk-3.so.0`, `libatk-bridge-2.0.so.0`, `libatspi.so.0` sono tra le
librerie dell'eseguibile e non sono nell'elenco dei pacchetti del 4.0 scaricato da Valve: controllo sui file, non
un avvio). La prova definitiva è quella sul ramo beta.
**glibc dentro sniper**: sniper porta glibc 2.31, ma il modulo Linux di steamworks.js chiede la 2.34; Steam usa la
glibc del sistema quando è più nuova (provato in passato con 2.39: il modulo si carica). Quindi su sistemi con glibc
< 2.34 il gioco parte ma **senza** funzioni di Steam; sullo Steam Deck (SteamOS recente) non dovrebbe succedere, ma
va visto nella prova sul ramo beta.

**Componenti da installare** (*Installation → Redistributables*): spunta **Visual C++ Redistributable 2015-2022
(x64)** (il nome in lista può variare di poco). Il modulo Windows di steamworks.js importa `VCRUNTIME140.dll`, che
Electron non contiene (controllato l'11/10 con `npm run steam:check`): senza, su un PC che non lo ha già, il gioco
parte lo stesso ma senza funzioni di Steam.

**Sandbox su Linux**: Electron usa la sandbox di Chromium (provata in passato nel runtime sniper come utente normale).
Se su qualche sistema il gioco non parte con *"The SUID sandbox helper binary was found, but is not configured
correctly"* o *"No usable sandbox"*, aggiungi `--no-sandbox` agli *Arguments* dell'opzione 2. (I controlli automatici
di questo progetto usano `--no-sandbox` solo perché girano come root, cosa che Chromium non permette con la sandbox.)

## 5. Moduli nativi: steamworks.js ed Electron

Controllo dell'11/10/2026, rifacibile in ogni momento:

```bash
npm run steam:check                                   # controlli statici + carica il modulo dentro Electron
xvfb-run -a npm run steam:launch-check -- --out /tmp/launch-check   # avvia la build Linux senza Steam (serve Playwright)
```

| Voce | Risultato |
|---|---|
| Electron installato | 33.4.11 = Node 20.18.3, **N-API 9**, NODE_MODULE_VERSION 130, Chromium 130 |
| steamworks.js | 0.4.0 (licenza MIT), l'ultima pubblicata su npm; binari precompilati con napi-rs per Windows x64, Linux x64, macOS |
| Compatibilità ABI | i moduli usano **N-API** (ABI stabile tra versioni di Node): non dipendono da NODE_MODULE_VERSION. La funzione più recente che usano è di **N-API 6**; Electron 33 offre N-API 9 → compatibili. Per questo `npmRebuild: false` è corretto |
| Linux: `steamworksjs.linux-x64-gnu.node` (sha256 `3d242b59…`) | x86-64; trova `libsteam_api.so` accanto a sé (RUNPATH `$ORIGIN`); richiede **glibc 2.34** o più nuova (`libsteam_api.so` solo 2.14). Su sistemi più vecchi il modulo non si carica e il gioco gira senza Steam |
| Linux: caricamento dentro Electron 33.4.11 | **verificato qui**, sia da `node_modules` sia dalla build impacchettata: il modulo si carica; `init()` senza App ID e con 480 lancia `Failed to load module '…/steamclient.so'` (nessun client Steam) e il processo continua |
| Linux: build impacchettata avviata | **verificato qui**: modulo e `libsteam_api.so` mappati nel processo principale (`/proc/<pid>/maps`), log `Steam not available: …`, menu, città, salvataggi, Quit con codice 0; memoria con una città aperta circa 730 MB in 6 processi (rendering software: indicativo) |
| Windows: `steamworksjs.win32-x64-msvc.node` (sha256 `1042713f…`) | x86-64; importa `steam_api64.dll` e `VCRUNTIME140.dll` (+ CRT universale di Windows 10); cerca le funzioni N-API nell'eseguibile a runtime. **Controllo statico**: `Scrapbot City.exe` (Electron 33.4.11) esporta 145 funzioni `napi_*`, comprese tutte le 57 che il modulo chiama |
| Windows: caricamento | **da verificare (titolare)**: qui non c'è Windows |
| Build impacchettate | contengono gli stessi binari di `node_modules` (hash identici); la `.lib` (serve solo per compilare) non è inclusa |

**Se aggiorni Electron o steamworks.js**: rifai `npm run steam:check` (deve restare senza FAIL) e la prova sul ramo
beta. steamworks.js non pubblica una tabella di versioni di Electron supportate; i suoi autori lo provano con una loro
app Electron (nel `package.json` di steamworks.js 0.4.0: electron 24). La compatibilità qui è dedotta da N-API, non
garantita da loro.

## 6. Prova sul ramo beta (con Steam vero)

1. Ramo `beta` creato (2.1) e build caricata con `--beta beta` (2.5).
2. Nel client Steam: tasto destro sul gioco → **Proprietà → Beta** → password → `beta`.
3. Prova **su Windows, su Linux e sullo Steam Deck**, e annota il risultato di ogni riga:
   - il gioco parte dal pulsante "Gioca" (su Windows è la **prima volta in assoluto**: l'exe è costruito da Linux);
   - `Scrapbot City.exe` → Proprietà → Dettagli: versione e nome giusti;
   - **Shift+Tab** apre l'overlay di Steam;
   - finisci il tutorial: compare la notifica di Steam di *Bootcamp Graduate* (achievement collegati);
   - salva su PC, apri sul Deck: la città c'è (Steam Cloud, sezione 8), e viceversa;
   - Steam Deck: parte a schermo intero, tutto si usa col controller, il campo del nome città apre la tastiera di Steam;
   - "Quit" chiude il gioco e Steam lo vede chiuso;
   - `npm run steam:check` dice di provare il caricamento su Windows: è questa prova.
4. Per tester esterni: chiavi Steam o la password del ramo beta.
5. Solo quando tutto va, e se lo decidi tu: build sul ramo **default** a mano (2.6).

## 7. Achievement

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

- **Traduzioni**: [steam/achievements_i18n.csv](../steam/achievements_i18n.csv) (8 lingue, prese da `src/i18n/`).
- **Icone** (mancano): per ogni achievement un'icona a colori e una in grigio, nel formato che chiede il modulo.
- Dopo le modifiche **Publish**. Non cambiare mai l'API name di un achievement già pubblicato.
- La 0.7 non aggiunge achievement: sono i 18 di `src/achievements.ts`, con nomi e descrizioni invariati nelle 8 lingue
  (controllato sulla 0.7.0-rc.1). Se una versione futura ne aggiunge, rigenera i CSV.
- Il gioco reinvia a Steam gli achievement sbloccati a ogni avvio. Su Linux servono glibc ≥ 2.34 (sezione 5).

## 8. Steam Cloud (salvataggi sincronizzati)

### 8.1 Dove e come salva il gioco

La versione desktop salva ogni dato in un file `.sav` nella cartella `saves` dei dati dell'app (percorso fissato in
`electron/main.cjs`: `app.getPath('appData')` + `Scrapbot City/saves`; i file li scrive `electron/file-store.cjs`). Il
nome del file è la chiave del dato con i caratteri diversi da lettere, cifre e `-` sostituiti da `_`, più `.sav`. Ogni
scrittura è atomica (file temporaneo `.tmp`, poi rinomina) e la versione precedente buona resta come `.sav.bak`. Se un
file è rovinato e il gioco legge al suo posto la `.sav.bak`, prima ne copia il testo com'è in `<file>.sav.damaged-<n>`
(mai sovrascritto né cancellato).

| Sistema | Cartella | Come lo sappiamo |
|---|---|---|
| Windows | `%APPDATA%\Scrapbot City\saves` (`C:\Users\<nome>\AppData\Roaming\Scrapbot City\saves`) | dal codice (`appData` = Roaming su Windows); **da verificare** |
| Linux / Steam Deck | `~/.config/Scrapbot City/saves` (o `$XDG_CONFIG_HOME/Scrapbot City/saves`) | **verificato qui** l'11/10 con la build Linux |

### 8.2 Che cosa si sincronizza (build 0.7.0-rc.1, salvataggi uguali alla 0.7.0-beta.1)

| File | Contenuto |
|---|---|
| `settings.sav` | impostazioni: lingua, volumi, filtro CRT, movimento ridotto, scorrimento ai bordi, schermo intero |
| `campaign.sav` | profilo della campagna: stelle, banca regionale, Guglie e finali delle 5 città |
| `achievements.sav`, `endings.sav` | achievement e finali visti |
| `tutorial-done.sav`, `last.sav`, `migrated.sav` | tutorial visto, ultima partita per "Continua", migrazione dalla 0.4 |
| `projects.sav` | progetti scoperti del catalogo: quali dei 18 elementi dell'incremento 2 il giocatore ha sbloccato e, per ogni traguardo, il massimo raggiunto in una città (`docs/MODULAR-INC2.md` §4). Cresce soltanto: chi li ha scoperti su un computer li ritrova sull'altro |
| `save_auto.sav`, `save_1.sav` … `save_3.sav` + `meta_*.sav` | gioco libero: salvataggio automatico e 3 slot manuali (città + riepilogo) |
| `save_city-home.sav` … `save_city-company.sav` + `meta_city-*.sav` | le 5 città della campagna |
| `backup_save_<slot>_v<N>.sav`, `backup_meta_<slot>_v<N>.sav` | copia di sicurezza di un salvataggio scritto da una versione precedente (formato v2 della 0.6/0.7.0-alpha.1, o v0 se rovinato), fatta **una volta** prima di sovrascriverlo con il formato v3; mai cancellata (`src/storage.ts`). Se quel nome è già preso da un'altra città, la copia ha in più un'impronta del testo (`backup_save_<slot>_v<N>_<impronta>.sav`) |
| `backup_projects_v<N>.sav` | copia di un `projects.sav` illeggibile (v0) o di un'altra versione, fatta prima di riscriverlo; i progetti che si possono leggere restano scoperti; mai cancellata (`src/profile.ts`) |
| `campaign-damaged.sav` | solo se un profilo della campagna rovinato è stato messo da parte |

Per riaprire una copia di sicurezza, a gioco chiuso, copiala (non rinominarla, così la copia resta) sopra
`save_<slot>.sav`, e `backup_meta_<slot>_v2.sav` sopra `meta_<slot>.sav`.

**Non** si sincronizzano: `*.sav.bak`, `*.sav.tmp` e `*.sav.damaged-<n>` (il pattern `*.sav` non li prende: restano sul
PC per riparare un file rovinato) e `steam-deck.json` (fuori da `saves/`: la scelta "finestra o schermo intero" del Deck
resta sul Deck).

**Quanti file e quanto spazio.** Chiavi fisse: 9. Slot: 9 (4 gioco libero + 5 campagna) × 2 file = 18. Copie di
sicurezza: di solito una per slot (v2) × 2 = 18; al massimo 3 versioni vecchie × 18 = 54. Totale: circa 45 file di
solito, **81** nel caso peggiore previsto, più le rare copie con impronta e `backup_projects_v<N>.sav` (la quota di 200
file della sezione 8.3 lascia margine). Dimensioni misurate l'11/10 sulla build del ramo principale: una città della
campagna a metà partita 10–13 KB (+ 80 byte di riepilogo), profilo della campagna 0,5 KB, impostazioni 0,1 KB. Anche con
città grandi (stimate fino a 50 KB) e tutte le copie si resta sotto **2 MB**.

### 8.3 Configurazione in Steamworks

Steamworks → la tua app → **Application → Steam Cloud** (regole lette l'11/10/2026 su
[Steam Cloud](https://partner.steamgames.com/doc/features/cloud)):

1. **Byte quota per user**: `10000000` (10 MB, cinque volte il massimo stimato). **Number of files allowed per user**:
   `200` (più del doppio degli 81 possibili). *Save*, poi *Publish*: solo dopo si sbloccano le opzioni Auto-Cloud.
2. **Auto-Cloud → Root Paths**, una riga:

   | Root | Subdirectory | Pattern | OS | Recursive |
   |---|---|---|---|---|
   | `WinAppDataRoaming` | `Scrapbot City/saves` | `*.sav` | **[All OSes]** (obbligatorio con i Root Override) | No |

3. **Root Overrides**, una riga per Linux (Steam Deck compreso):

   | Original Root | OS | New Root | Add/Replace Path | Replace Path |
   |---|---|---|---|---|
   | `WinAppDataRoaming` | Linux | `LinuxHome` | `.config/Scrapbot City/saves` | **sì** |

   Niente override per macOS (nessuna build Mac).
4. *Save* e *Publish*. Le modifiche arrivano ai client entro una decina di minuti (o riavviando Steam).

Così un salvataggio fatto su Windows si ritrova sul Deck o su Linux e viceversa (stessi nomi di file).

**Da sapere**:
- Valve sconsiglia di sincronizzare impostazioni legate alla macchina: in `settings.sav` c'è anche "schermo intero"
  (sul Deck la scelta è separata, `steam-deck.json`). Se dà fastidio passando tra PC diversi, si può spostare quella
  voce fuori da `saves/` in un aggiornamento.
- Su Linux, chi ha cambiato `XDG_CONFIG_HOME` salva altrove e il Cloud non vede i file (raro).
- Sul Deck Steam sincronizza anche quando la console va in sospensione (*Dynamic Cloud Sync*): il gioco salva a ogni
  nuovo giorno, alla chiusura e quando la finestra viene nascosta; se la sospensione non nasconde la finestra, l'ultimo
  giorno di gioco potrebbe non essere nel Cloud. **Da provare sul Deck.**

### 8.4 Prova prima dell'uscita (con il client Steam)

1. Spunta *"Enable cloud support for developers only"* (vale per i giochi già usciti; prima dell'uscita il Cloud lo
   usano comunque solo gli account con la licenza).
2. Nel client Steam apri `steam://open/console`, scrivi `testappcloudpaths <AppID>` e `set_spew_level 4 4`.
3. Avvia il gioco da Steam, salva, chiudi: nella console devono comparire i caricamenti dei `.sav` (non dei `.bak`).
4. Su un altro PC (o sul Deck): avvia, controlla che la città ci sia. Prova Windows → Linux/Deck e il contrario.
5. Problemi: `%Steam%\logs\cloud_log.txt`. Fine prova: `testappcloudpaths 0`, `set_spew_level 0 0`.
6. Prima dell'uscita togli la spunta del punto 1 e pubblica.

Il pulsante **"Open the saves folder"** nelle impostazioni del gioco apre la cartella (utile per l'assistenza).

## 9. Controller e revisione Steam Deck

**Steam Input** (Steamworks → **Application → Steam Input**): supporto controller **completo** e configurazione
predefinita **Gamepad** — da dichiarare solo dopo averlo provato con un controller vero dal client Steam. Il gioco
legge il controller come un pad standard (non usa le API di Steam Input).

Comandi in città: stick sinistro = cursore, stick destro = mappa, A = costruisci/seleziona, B = annulla,
LB/RB = edificio precedente/successivo, LT/RT = zoom, X = ruspa, Y = suggerimento (con un oggetto ruotabile in mano lo
ruota), Start = menu, D-pad = una casella alla volta, View = pausa, L3 = velocità, R3 = torna all'HQ.

**Revisione Steam Deck**: dalla pagina dell'app → *Technical Tools* → **Steam Hardware Compatibility Review** (dopo la
normale revisione della build). Valve prova la build Linux; se va male prova quella Windows con Proton. **Nessun
requisito è stato provato su uno Steam Deck vero né con un controller vero.** Requisiti e stato: tutto usabile col
controller (fatto, provato solo con Gamepad API simulata), glifi dei pulsanti nei testi (fatto), 1280×800 (finestra di
partenza 1280×800), testi leggibili a 800p (da ricontrollare in tedesco e polacco e sullo schermo del Deck), tastiera a
schermo per i campi di testo (solo tramite steamworks.js, con Steam aperto su uno Steam Deck vero: codice fatto, **mai
provata**; senza Steam il gioco usa i suoi campi e resta la tastiera di sistema con Steam + X), 30 fps a 800p (**da
misurare sul Deck**), nessun launcher (fatto), schermo intero sul Deck (fatto, provato solo con la variabile
`SteamDeck=1`). **Non scrivere "Steam Deck Verified" da nessuna parte**: il badge lo assegna Valve.

## 10. Dichiarazione dei contenuti fatti con l'IA

Fa parte del questionario sui contenuti: bozza completa, con le domande a cui devi rispondere, in
**[steam/CONTENT-SURVEY-DRAFT.md](../steam/CONTENT-SURVEY-DRAFT.md)**. In breve: contenuti **pre-generati** con l'aiuto
dell'IA sì (codice, grafica generata da codice, testi, traduzioni, musica ed effetti sintetizzati); **generati dal
vivo** no. Fatti da Claude anche: le lavorazioni delle tue immagini (ritagli, slogan tolti, icone piccole), i testi
del negozio, trailer e screenshot (riprese del gioco montate da script). L'origine delle 5 immagini la dichiari tu.

## 11. Prezzo

**Lo decidi tu**; nessuno script o documento di questo progetto lo imposta. Il candidato di cui si è parlato è
**7,99 €** come prezzo base. Fatti utili alla decisione: Steam rimborsa su richiesta entro 14 giorni dall'acquisto e
con meno di 2 ore di gioco; la durata della campagna 0.7 **non è ancora stata misurata con persone** (serve il playtest:
[PLAYTEST.md](PLAYTEST.md)); i prezzi degli altri Paesi Steamworks li propone dal prezzo base; anche il prezzo passa
dalla revisione di Valve.

## 12. Pagina "Coming Soon" e Steam Next Fest

**Apri la pagina "Coming Soon" il prima possibile**: le wishlist raccolte prima dell'uscita sono ciò che pesa di più
sulle vendite. Serve solo la pagina approvata (sezione 3), non la build; deve restare "Coming Soon", visibile a
tutti, per **almeno due settimane** prima dell'uscita (letto l'11/10/2026 su
[Steam Direct](https://partner.steamgames.com/steamdirect); ricontrollalo in Steamworks).

**Steam Next Fest** (una settimana di demo gratuite, tre volte l'anno): si partecipa una volta sola per gioco, con una
demo giocabile da tutti; la demo è un'app separata collegata al gioco (gratuita); oggi non c'è una build demo (idea:
tutorial + prima città). Date e scadenze delle prossime edizioni: Steamworks → *Upcoming Events* (le date annotate in
passato per febbraio 2027 vanno **ricontrollate** lì).

## 13. Uscita — lista di controllo finale

Prima di premere "Release", ogni riga deve essere vera:

- [ ] La versione da vendere è **verificata** e contiene il pacchetto Steam (la 0.7.0-rc.1, ramo `rc-0.7.0`, unisce la
      0.7.0-beta.1 verificata e `steam-package`; una RC non è un via libera commerciale).
- [ ] `npm run build`, `npm test` verdi sul commit; `npm run dist:steam` rifatto da quel commit.
- [ ] `npm run steam:check` senza FAIL; `npm run steam:launch-check` senza FAIL sulla build Linux.
- [ ] App ID e depot scritti in `steam/sdk/*.vdf`; `node steam/prepare-upload.cjs --check` senza problemi.
- [ ] Caricata con `--preview`, poi con `--beta beta`.
- [ ] Prove della sezione 6 fatte **su Windows, Linux e Steam Deck**, con esito annotato.
- [ ] Achievement creati e pubblicati; uno sbloccato dal client Steam.
- [ ] Steam Cloud configurato e provato nei due sensi (8.4); "developers only" tolto.
- [ ] Visual C++ 2015-2022 (x64) spuntato nei Redistributables; runtime Linux "sniper".
- [ ] Pagina del negozio: testi senza righe **[pending final build]** non verificate; requisiti confermati; tag.
- [ ] Grafica: decisioni sul logo prese; screenshot rifatti sulla build finale (almeno 5, solo gameplay); trailer
      rifatto sulla build finale, con l'audio deciso da te.
- [ ] ASSETS-PROVENANCE.md §6 confermato per iscritto; questionario sui contenuti compilato, con la sezione IA.
- [ ] Verifica legale dei nomi ("Scrapbot City", "2PM", personaggi).
- [ ] Prezzo deciso e approvato da te; data decisa da te.
- [ ] Pagina "Coming Soon" pubblicata da almeno il periodo minimo; revisione di pagina e build superata; 30 giorni
      passati dal pagamento della quota.
- [ ] **Tu** metti la build sul ramo `default` (a mano) e **tu** premi **Release App** → *Publish Now* → *Release Now*.

## 14. Cosa manca (onestamente)

1. **Le build Steam rifatte dalla 0.7.0-rc.1** (oggi sono della 0.6.0) e i controlli nativi rifatti su quelle
   (sezione 5). La 0.7.0-beta.1 (catalogo da 24 elementi, sblocchi, temi delle città) è verificata nel browser
   ([BETA-REPORT.md](BETA-REPORT.md)) e unita qui.
2. **Prove con Steam vero**: Windows, Steam Deck, achievement, overlay, Cloud, tastiera del Deck, controller.
3. **Screenshot e trailer della build finale** (le pipeline sono pronte); **audio del trailer**; **icone degli
   achievement**.
4. **Playtest** con 10–20 persone che non conoscono il gioco ([PLAYTEST.md](PLAYTEST.md)): serve anche per qualsiasi
   frase sulla durata.
5. **Revisione madrelingua** delle traduzioni.
6. **Verifica legale** di nomi e marchi.
7. **Decisioni del titolare** su logo (targa "2PM", katakana), origine delle immagini del negozio, prezzo, date.

Lingue da valutare dopo: portoghese brasiliano, giapponese, cinese semplificato e coreano (servono font CJK; oggi c'è
solo il katakana del logo).

## 15. Idee per dopo l'uscita

- Albero tecnologico dei bot (velocità, capacità, droni da pulizia).
- Sesta e settima città come aggiornamento gratuito.
- Modalità infinita con classifica (Steam Leaderboards) e sfide settimanali con seed fisso.
- Editor di mappe e Steam Workshop.
