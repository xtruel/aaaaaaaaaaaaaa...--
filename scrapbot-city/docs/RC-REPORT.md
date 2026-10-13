# Scrapbot City 0.7.0-rc.1 — verifica della release candidate

Verifica indipendente del ramo `rc-0.7.0`, fatta il 13/10/2026 su Linux x64 (4 core, nessuna GPU), **senza client
Steam**, con input **simulati**. Il report della beta da cui viene la RC è [BETA-REPORT.md](BETA-REPORT.md); la guida
per Steam è [STEAM.md](STEAM.md).

**Una release candidate non è un via libera commerciale.** Nessuna persona ha giocato questa versione; niente è stato
provato su Windows, su uno Steam Deck, con un controller, uno schermo touch o un client Steam veri; nessuno ha
ascoltato il suono. Il report non dice niente su durata, divertimento o prezzo. Niente è stato caricato, pubblicato,
pagato o configurato su Steam; nessun login a Steam, steamcmd non è stato avviato.

## In breve

| | |
|---|---|
| Verdetto | **RC confermata** nel perimetro che si può provare qui (Linux, input simulati, senza client Steam): build riproducibili e uguali a quelle dentro le build Steam, numeri del gioco identici alla beta, tutte le prove verdi. Non è un via libera commerciale: restano le voci della lista di controllo del titolare |
| Build | rilascio `d9f5a6d8…`, debug `d468acd1…` (sotto); `app.asar`, exe e binario Linux sotto |
| Prove | `tsc` 0 errori; `vitest` 429/429; `i18n:check` 826 chiavi × 8; numeri identici a `c199a4f`; `npm run e2e` 22/22; L1 96/96 pannelli; `steam:check` e `steam:launch-check` senza FAIL |
| Problemi aperti | nessun critico, alto o medio; 3 bassi (sotto); 2 medi e 1 basso nei documenti, corretti in questa verifica |
| Non verificato | Windows, Steam Deck, client Steam, controller, touch e suono veri, runtime sniper su questa build, persone |

## Consegna

**Commit** (ramo `rc-0.7.0`, non pubblicato su nessun remoto; da `steam-package` `93affe1` + beta `c199a4f`):

| Commit | Cosa | Tocca il gioco? |
|---|---|---|
| `a3fa059` | unione della 0.7.0-beta.1 (`c199a4f`) nel pacchetto Steam | sì: `electron/`, `index.html` (favicon), script e configurazione delle build |
| `3f92d3f` | l'avviso «Non ancora scoperto» subito sopra «Rimuovi» (il problema basso L1 della beta), con test | sì: `src/ui/hud.ts`, `src/style.css` |
| `f50670c` | versione 0.7.0-rc.1 (menu, Crediti, `package.json`, README) | sì: **ultimo cambiamento del codice** |
| `d976dc9` | CHANGELOG 0.7.0-rc.1, `docs/STEAM.md` | no |
| `0d00763` | stato delle build Steam rifatte (`docs/STEAM.md`, `steam/README.md`) | no |
| `d1e45e2` | 7 screenshot del negozio dalla build di rilascio della RC, testi del negozio | no |
| `eea87a4` | questa verifica: correzioni di testo nei documenti (sotto, «Documenti corretti») | no |
| il commit di questo report | `docs/RC-REPORT.md` | no |

**Build web** (un file ciascuna), fatte da due copie pulite (`git archive`) di `d1e45e2`: stessi byte nelle due copie,
nella cache della suite e2e e nella build dell'integratore su `f50670c`. I commit successivi cambiano solo documenti.

| Build | Comando | Byte | sha256 | Aggancio di test |
|---|---|---:|---|---|
| Rilascio | `npx vite build` | 1.923.533 | `d9f5a6d870ef75ddeb4ad47020deb79c2ce7689929a22808bfbafc8ee430110c` | assente |
| Debug | `NODE_ENV=development npx vite build --mode development` | 1.924.608 | `d468acd1a12dda724664d490fe58c16f3449ab76a7ab5f399f3bdc36f28abdd9` | `window.scrapbot` presente |

**Build Steam** in `steam/content/` (fuori da git; fatte dall'integratore con `npm run dist:steam` da `d976dc9`,
ricontrollate qui; uguali a `release/` con `diff -r`):

| | `steam/content/windows` | `steam/content/linux` |
|---|---|---|
| File, byte | 90 file, 291.690.217 | 90 file, 284.814.470 |
| Eseguibile | `Scrapbot City.exe` `34313e51ed22a8c37c11f8ff15395bb3125ab6b2aea818a4168cf99a89cf38dc`: FileVersion e ProductVersion «0.7.0-rc.1» (numerica 0.7.0.0), icona a 7 misure (16–256) | `scrapbot-city` `ee99780b5878638df40bf577cfcdbc3c157b0b3581ada099a13db446f1af84d8` (permessi 755; è l'eseguibile di Electron 33.4.11 invariato) |
| `resources/app.asar` | `afd4d74e1c3baa5274d3041c3b4a16f54fbf1890d6453c6d446327331405ad31` | `1f1c7347cbc6c268ca200893dce6a8191427a98496b055a55fd72013033a9b5d` |
| `dist/index.html` dentro `app.asar` | `d9f5a6d8…` = la build di rilascio pulita qui sopra | idem |
| resto di `app.asar` | `electron/*.cjs` e `icon.png` uguali al commit; `package.json` 0.7.0-rc.1 | idem |
| `licenses/` | `THIRD-PARTY-NOTICES.txt`, i 6 font, steamworks.js | uguale |
| `steam_appid.txt` | assente | assente |

Le due `app.asar` differiscono solo per i binari di steamworks.js accanto (la build Linux non ha `steam_api64.dll`).

## Cosa cambia dalla beta

Nel codice che finisce nella build, rispetto a `c199a4f` (5 file, 17 righe aggiunte e 7 tolte):
- `src/ui/hud.ts`, `src/style.css`: nel pannello di un pezzo di un progetto non ancora scoperto l'avviso «Non ancora
  scoperto: una volta rimosso, non potrai ricomprarlo finché non lo scopri.» sta subito sopra «Rimuovi» (prima stava
  sotto e a 1024×640 in tedesco, francese e portoghese non si vedeva);
- `src/ui/menu.ts`, `src/ui/dialogs.ts`: «0.7.0-rc.1» nel menu e nei Crediti;
- `index.html`: la favicon 64×64.

Fuori dalla build web: il pacchetto Steam (`electron/main.cjs` con steamworks.js 0.4.0, icone, `scripts/`, `steam/`,
`docs/STEAM.md`). `src/game/` (numeri, simulazione, salvataggi) e `src/storage.ts` sono invariati. Nessuna dipendenza
nuova oltre a steamworks.js e resedit, già sul ramo `steam-package`.

## Verificato qui, e come

Tutto su Linux, sotto Xvfb dove serve una finestra, **senza client Steam**; mouse, tastiera, tocchi e controller sono
**simulati** (Playwright, eventi touch CDP, Gamepad API finta in Chromium headless).

| Controllo | Come | Esito |
|---|---|---|
| Build riproducibili | due copie pulite di `d1e45e2` + la suite e2e (terza costruzione) | stessi byte tre volte; rilascio = quella dell'integratore e quella dentro le build Steam |
| Aggancio di test | ricerca nel file | presente solo nella build di debug |
| `tsc --noEmit` | copia pulita | 0 errori |
| `vitest` | copia pulita | **429/429** in 47 file (428 nella beta + il test dell'avviso) |
| `i18n:check` | copia pulita | 826 chiavi × 8 lingue, segnaposto e tag uguali all'inglese |
| Numeri del gioco | `nums.sh` su copie pulite di `c199a4f` e `d1e45e2` | `balance` semi 42, 7, 1, 99 identici byte per byte; `waits` semi 5, 42, 3 e senza seme identici (314 righe ciascuno) |
| `npm run e2e` | una volta, copia pulita (le sue build: gli stessi sha256), 2 test alla volta; per qualche minuto in parallelo con il controllo L1 | **22/22** in 22,1 minuti, nessun test rieseguito; `fit` 200/200 (i 168 controlli della beta + 32 dell'avviso); 84 immagini della suite guardate |
| L1 a 1024×640 in 8 lingue | script mio, sotto | **96/96 pannelli** giusti; vedi sotto |
| Build Steam = commit | estrazione di `app.asar`, sha256, `diff -r release/ steam/content/`, risorse dell'exe lette con resedit | vedi «Consegna» |
| `npm run steam:check` | rifatto qui | nessun FAIL; Windows solo con controlli statici (145 `napi_*` esportate, nessuna mancante); `init()` senza App ID e con 480 fallisce pulito, il processo continua; NOTE: Visual C++ 2015-2022 (x64) da spuntare, caricamento su Windows da provare |
| `npm run steam:launch-check` | rifatto qui sull'eseguibile di `steam/content/linux`, Xvfb, senza App ID e con 480 | nessun FAIL: steamworks.js e `libsteam_api.so` caricati, «Steam not available: Failed to load module '…/steamclient.so'», menu in 591 e 556 ms con «Build_0.7.0-rc.1», una città di gioco libero gira, tastiera «no», achievement ignorato, salvataggi nella cartella di prova, «Quit» con codice 0; memoria circa 764 MB in 6 processi (indicativa); `steam/content/` invariata dopo la prova; 4 immagini guardate |
| `node steam/prepare-upload.cjs --check` | solo lettura dei file, niente rete | rifiuta di partire con i 5 segnaposto (App ID e due depot), nessun altro problema |
| Achievement | `steam/achievements.csv` contro `src/achievements.ts` | gli stessi 18 id (`ACH_<ID>`) |
| Screenshot del negozio | guardati tutti e 7 a piena risoluzione, più il foglio di controllo | 1920×1080, hash uguali a `steam/ASSETS-PROVENANCE.md` 2.3, contenuto come descritto (stelle 13/15 contate sulla mappa: 3+3+3+2+2) |
| Documenti | ricerca di «testato», «✔», «Verified», «Steam Deck», «ore», «hours», «garant», prezzi in tutti i `.md`, poi lettura dei documenti per Steam | corretti 7 file, solo testo (sotto) |

### L1: l'avviso sopra «Rimuovi» a 1024×640

Script del verificatore (non la suite e2e), build di debug, finestra 1024×640, **mouse simulato**. In una città di
gioco libero inglese i 12 pezzi dei progetti che un profilo nuovo non ha scoperto sono scritti sulla mappa con
l'aggancio (come li ha una città portata da un altro profilo); la città è salvata dal menu di pausa. Poi, per ogni
lingua: profilo nuovo senza progetti, «Carica partita» → slot 1, ogni pezzo cliccato sulla mappa, pannello misurato e
fotografato (96 immagini, tutte guardate).

- In 96 pannelli su 96 l'avviso è nella lingua giusta, in vista all'apertura, subito sopra «Rimuovi», né tagliato né
  coperto.
- In **34 su 96** «Rimuovi» è sotto il bordo del pannello all'apertura: panchina, insegna, pergola, casetta di Miso,
  scultura e statua in italiano, tedesco, francese, portoghese e polacco; insegna, scultura e statua in olandese; la
  scultura in spagnolo (in inglese nessuno). Esattamente l'elenco del CHANGELOG. Una tacca della rotella sul pannello
  lo porta in vista, con l'avviso ancora in vista.
- La statua rimossa con un clic su «Rimuovi» in tutte le 8 lingue: +10 crediti e +5 pezzi come scritto sul pulsante,
  il pezzo sparisce, nel catalogo la statua è «Da scoprire» (non acquistabile).
- Nessun errore nella pagina.

## NON verificato

- **Windows**: `Scrapbot City.exe` non è mai stato avviato; salvataggi in `%APPDATA%\Scrapbot City\saves`, scala dello
  schermo al 100/125/150%, Visual C++ runtime: solo dal codice e da controlli statici.
- **Steam Deck**: niente; schermo intero solo con la variabile `SteamDeck=1` impostata a mano in passato; tastiera a
  schermo mai provata.
- **Client Steam**: achievement, overlay, Steam Cloud, tastiera del Deck, ramo beta. Nessun App ID esiste.
- **Steam Linux Runtime 3.0 (sniper)**: provato solo sulla 0.6.0, non su questa build.
- **Controller, touch, mouse e tastiera veri**: tutti gli input delle prove sono simulati.
- **Suono**: nessuna prova ha ascoltato il gioco (la riga dei brani in `STORE-COPY.md` resta «[listen before
  publishing]»).
- `steam/upload.bat` (mai provato su Windows), `upload.sh` con uno steamcmd vero e un App ID vero.
- **Trailer della RC**: non esiste (la pipeline non è stata rieseguita, scelta del titolare).
- **Persone**: nessun playtest, nessuna revisione madrelingua; durata, divertimento e disponibilità a pagare non sono
  misurati.
- La partita nell'app Linux impacchettata (pavimenti, pilastro, salvataggio, riavvio) l'ha fatta l'integratore; qui è
  stato rifatto solo `steam:launch-check`.

## Problemi residui, per gravità

**Critici**: nessuno. **Alti**: nessuno.

**Medi** (documenti, corretti in questa verifica, solo testo)
- `steam/STORE-COPY.md` proponeva, in alternativa, di scrivere sulla pagina «Controller and touch: supported, not yet
  tested on real hardware»: dichiarava supportato ciò che non è provato. Tolta l'alternativa.
- `docs/PLAYTEST.md` (playtest automatico 0.5.1) diceva «Le 5 città della campagna durano quindi 1,5–3 ore» per «un
  giocatore deciso», ricavato da script. Ora dice che sono tempi di script e che non danno una durata in ore.

**Bassi**
- *Il prezzo della correzione L1* (aperto, scelta dell'integratore): a 1024×640, in 34 pannelli su 96, «Rimuovi» chiede
  di scorrere. In italiano, polacco, spagnolo e olandese la scritta del pulsante si legge e manca solo il bordo
  inferiore; in tedesco e portoghese se ne vede mezza riga, non leggibile; in **francese** solo 3–4 pixel del bordo,
  senza barra di scorrimento visibile in Chromium headless: chi vuole rimuovere una panchina in francese su una
  finestra così piccola potrebbe non trovare il pulsante. Una tacca di rotella basta; il test e2e `fit` controlla,
  portando il pulsante in vista come fa il fuoco del controller, che l'avviso venga con lui. Da guardare nel playtest
  (finestre piccole, francese).
- *Binari in più nei depot*: `app.asar.unpacked` contiene i moduli di steamworks.js per macOS in tutte e due le build
  (e quello Linux nella build Windows, quello Windows nella Linux): circa 6 MB inutili per build; innocui.
- *Documenti non aggiornati dopo le build e gli screenshot* (corretto, solo testo): il CHANGELOG della RC diceva ancora
  che le build Steam erano quelle della 0.6.0 e non rifatte; `docs/STEAM.md` diceva gli screenshot «da rifare» e
  `STORE-COPY.md` «con righe [pending final build]»; `docs/PLAYTEST.md` indicava la beta come versione da provare;
  `docs/TEST-REPORT.md` (0.6.0) chiamava «Steam Deck» una misura a 1280×800 nel browser; il README del trailer
  chiamava «build finale» la beta.
- *Scena «decorate» del trailer* (da controllare quando si rifà il trailer): dalla beta il catalogo ha le schede;
  `record.mjs` potrebbe scartare la ripresa dei lampioni (`STORE-COPY.md`, sezione 7, letto nel codice, non provato).

**Già noti dalla beta, invariati**: scritte lunghe sulla mappa a zoom alto su finestre piccole; l'ugello esteso non si
scopre nelle città con poca melma; regola dei 600 ms per le doppie pressioni ([BETA-REPORT.md](BETA-REPORT.md),
«Limiti noti»).

## Documenti corretti (solo testo)

`steam/STORE-COPY.md`, `docs/PLAYTEST.md`, `docs/STEAM.md`, `CHANGELOG.md`, `docs/TEST-REPORT.md`,
`scripts/trailer/README.md`, `README.md`: i punti elencati sopra, la memoria misurata (circa 740–765 MB invece di 730)
e il rimando a questo report. Nessun numero del gioco toccato, nessuna funzione nuova dichiarata; nessuna riga
«verificato» aggiunta senza una prova.

## Lista di controllo del titolare: dalla RC a una release

Le cose che solo tu puoi fare. I dettagli e i clic sono in [STEAM.md](STEAM.md) (le sezioni sono indicate) e in
[steam/README.md](../steam/README.md).

**1. Account e soldi** (STEAM.md §1) — *spese e firme tue*
- [ ] Account Steamworks su <https://partner.steamgames.com> come Qwerty3D Games; accordo di distribuzione firmato.
- [ ] Identità, questionario fiscale (può richiedere settimane), conto bancario intestato come nella registrazione.
- [ ] Quota Steam Direct (100 USD per gioco, letto l'11/10/2026: ricontrollalo). Dal pagamento all'uscita servono
      almeno 30 giorni.

**2. App ID, depot, ramo beta** (STEAM.md §2) — *nessun numero è inventato qui: li dà Steamworks*
- [ ] Crea l'app: Steamworks le dà l'**App ID**. Crea due depot in *SteamPipe → Depots*: Windows (*Operating System*
      Windows, 64-bit) e Linux (*Linux + SteamOS*), lingue tutte; aggiungili al pacchetto **Developer Comp** e a quello
      in vendita; *Publish*.
- [ ] Crea in *SteamPipe → Builds* il ramo **`beta`** con una password, **prima** del caricamento.
- [ ] Scrivi i numeri a mano nei file VDF: `0000000` → App ID in `steam/sdk/app_build.vdf` (riga `"AppID"`);
      `0000001` → depot Windows in `app_build.vdf` (blocco `"Depots"`) **e** in `steam/sdk/depot_build_windows.vdf`;
      `0000002` → depot Linux in `app_build.vdf` **e** in `steam/sdk/depot_build_linux.vdf`.
- [ ] `node steam/prepare-upload.cjs --check` deve dire che è tutto pronto (oggi elenca i 5 segnaposto).
- [ ] Solo per provare una build avviata fuori dal client Steam (con Steam aperto e il tuo account):
      `npm run steam:appid -- <AppID>` scrive `steam_appid.txt` in `release/`; poi `npm run steam:appid -- --remove`.
      Non serve per caricare: `steam/content/` non lo contiene mai.

**3. Build e caricamento** (STEAM.md §2.4–2.6, steam/README.md passi 3–5)
- [ ] Decidi il commit da vendere. Se non è questa RC: `npm test`, `npm run e2e`, confronto dei numeri, poi
      `npm run dist:steam`, `npm run steam:check`, `xvfb-run -a npm run steam:launch-check` da quel commit, su Linux.
- [ ] Installa steamcmd in `steam/steamcmd/` (passo 3); account dedicato alle build con i soli permessi *Edit App
      Metadata* e *Publish App Changes To Steam*.
- [ ] Prima la prova a vuoto: `steam/upload.sh <account_build> --preview` (non carica niente, log in `steam/output`).
- [ ] Poi `steam/upload.sh <account_build> --beta beta`; alla fine deve comparire `Successfully finished AppID …
      build (BuildID …)`. Il depot Linux va caricato da Linux, macOS o WSL.
- [ ] Il ramo `default` (quello dei giocatori) **solo a mano**, in *SteamPipe → Builds*, solo dopo le prove del punto 7
      e solo se lo decidi tu.

**4. Installazione in Steamworks** (STEAM.md §4)
- [ ] Cartella di installazione `Scrapbot City`. Opzioni di avvio: `Scrapbot City.exe`, Windows, 64-bit; `scrapbot-city`,
      Linux + SteamOS, 64-bit (senza `./`).
- [ ] *Redistributables*: **Visual C++ Redistributable 2015-2022 (x64)** (senza, su un PC che non l'ha, il gioco parte
      ma senza funzioni di Steam).
- [ ] *Linux Runtime*: **Steam Linux Runtime 3.0 (sniper)**, non il 4.0. Se su Linux compare un errore della sandbox,
      `--no-sandbox` negli *Arguments* dell'opzione Linux.

**5. Steam Cloud** (STEAM.md §8.3–8.4), valori esatti
- [ ] *Byte quota per user* `10000000`; *Number of files allowed per user* `200`; *Save*, *Publish*.
- [ ] *Auto-Cloud → Root Paths*: Root `WinAppDataRoaming`, Subdirectory `Scrapbot City/saves`, Pattern `*.sav`, OS
      **[All OSes]**, Recursive **No**.
- [ ] *Root Overrides*: Original Root `WinAppDataRoaming`, OS Linux, New Root `LinuxHome`, Add/Replace Path
      `.config/Scrapbot City/saves`, Replace Path **sì**. Nessun override per macOS. *Save*, *Publish*.
- [ ] Prova nei due sensi (Windows → Linux/Deck e il contrario) con `testappcloudpaths <AppID>` e
      `set_spew_level 4 4` nella console di Steam: si caricano i `.sav`, non i `.bak`, `.tmp` o `.damaged-<n>`. Prima
      dell'uscita togli «Enable cloud support for developers only».

**6. Achievement** (STEAM.md §7)
- [ ] Crea i 18 achievement da `steam/achievements.csv`: API name **identico** (`ACH_<ID>`), *Hidden* 0, *Set By*
      Client; traduzioni da `steam/achievements_i18n.csv`; *Publish*. Mai cambiare un API name pubblicato.
- [ ] Icone: per ogni achievement una a colori e una in grigio (non esistono ancora).

**7. Prove su hardware vero, dal ramo beta** (STEAM.md §6, §9)
- [ ] **Windows 10 e Windows 11**, scala dello schermo al **100%, 125% e 150%**: parte dal pulsante «Gioca» (prima volta
      in assoluto per l'exe), Proprietà → Dettagli con nome e versione, Shift+Tab apre l'overlay, il tutorial finito
      sblocca *Bootcamp Graduate*, salvataggi in `%APPDATA%\Scrapbot City\saves`, chiusura e riapertura, «Quit».
- [ ] **Steam Deck**: parte a schermo intero, tutto col solo controller, il campo del nome città apre la tastiera di
      Steam, testi leggibili a 1280×800 (tedesco e polacco), 30 fps a 800p, sospensione e ripresa, Cloud col PC.
- [ ] **Un controller vero** su PC (Xbox e PlayStation) con Steam Input; dichiara il supporto in Steamworks solo dopo.
- [ ] **Uno schermo touch vero** (dito su oggetti piccoli, zoom 1).
- [ ] **Suono** con cuffie e altoparlanti; poi togli o conferma «[listen before publishing]» in `STORE-COPY.md`.
- [ ] Revisione Steam Deck di Valve (*Steam Hardware Compatibility Review*) dopo la revisione della build. Non scrivere
      mai «Steam Deck Verified»: lo assegna Valve.

**8. Persone**
- [ ] Playtest con **10–20 persone** secondo [PLAYTEST.md](PLAYTEST.md) (metà non giocano ai city builder, almeno 2
      col Deck o un controller, almeno 2 su touch), con lo sha256 della build data. Anche una finestra piccola in
      francese (problema basso L1). Nessuna frase su ore di gioco, divertimento o prezzo da questi numeri.
- [ ] Revisione **madrelingua** delle 7 traduzioni (it, de, fr, es, pt, pl, nl), poi la risposta sul linguaggio nel
      questionario sui contenuti.

**9. Decisioni sulla grafica e sulla provenienza** (steam/ASSETS-PROVENANCE.md §5–6)
- [ ] Targa **«2PM»** e titolo in **katakana** nel logo e nelle capsule: parte del logo ufficiale o da togliere.
- [ ] Insegne «2PM» e «SCRAP» dentro le illustrazioni e negli screenshot.
- [ ] Origine e diritti delle **5 immagini** che hai fornito (`1.webp`–`5.webp`: chi, con quale strumento, quali
      diritti d'uso commerciale) e di `docs/mockup-main-menu.png`, per iscritto.
- [ ] Gli screenshot della RC vanno bene come sono stati preparati (città del pilota automatico, profilo dei progetti
      scritto da uno script, quartieri costruiti da uno script dall'interfaccia).
- [ ] Il **trailer**: rigeneralo con `scripts/trailer/run.sh` sulla build da vendere, guardalo tutto (scena «decorate»),
      aggiungi l'audio, caricalo tu.

**10. Pagina del negozio**
- [ ] Testi da `steam/STORE-COPY.md` (inglese e italiano), lingue solo *Interface*, sistemi Windows e SteamOS + Linux.
- [ ] **Requisiti di sistema**: Windows 10 64-bit; SteamOS o Linux 64-bit; processore, memoria e scheda video **da
      misurare** su hardware vero (qui solo rendering software: circa 740–765 MB in 6 processi con una città aperta);
      400 MB su disco; la nota su glibc 2.34.
- [ ] **Dichiarazione sui contenuti fatti con l'IA** nel questionario: bozza in `steam/CONTENT-SURVEY-DRAFT.md`
      (pre-generati sì: codice, grafica generata da codice, testi, traduzioni, musica ed effetti sintetizzati; generati
      dal vivo no; l'origine delle 5 immagini la dichiari tu).
- [ ] **Verifica legale dei nomi**: «Scrapbot City», «2PM», «USA-9», «Miso», «K. Kurogane», facce e loghi nelle
      immagini.

**11. Prezzo e date** — *solo tue*
- [ ] **Prezzo**: nessun file lo imposta (si è parlato di 7,99 € come candidato, niente di più). Passa dalla revisione
      di Valve.
- [ ] Pagina «Coming Soon» pubblica per almeno due settimane prima dell'uscita (ricontrolla in Steamworks); data
      d'uscita; Steam Next Fest se vuoi (serve una demo, oggi non c'è).
- [ ] Revisione di pagina e build superata, 30 giorni dalla quota passati.
- [ ] **Tu** metti la build sul ramo `default` e **tu** premi *Release*.

## Come rifare le verifiche

```sh
mkdir /tmp/rc && git archive <commit>:scrapbot-city | tar -x -C /tmp/rc   # dalla radice del repository
cd /tmp/rc && ln -s <checkout>/scrapbot-city/node_modules node_modules    # dipendenze già installate
npx vite build --outDir rel --emptyOutDir
NODE_ENV=development npx vite build --mode development --outDir dbg --emptyOutDir
sha256sum rel/index.html dbg/index.html
npx tsc --noEmit && npx vitest run && npm run i18n:check
npm run e2e                                    # in un checkout git (la suite legge il commit)
npm run steam:check                            # nel checkout con release/ e steam/content/
xvfb-run -a npm run steam:launch-check -- --exe steam/content/linux/scrapbot-city --out /tmp/launch
```

Il confronto dei numeri con un'altra versione è descritto in [BETA-REPORT.md](BETA-REPORT.md), «Test riproducibili».
