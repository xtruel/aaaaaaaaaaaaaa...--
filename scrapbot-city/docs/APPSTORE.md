# Scrapbot City sull'App Store — cosa fare

Stato al 19 ottobre 2026, ramo `appstore`. Il gioco è lo stesso file unico della versione web (`npm run build`) dentro
una shell iOS Capacitor 8 (`capacitor.config.ts`, `ios/`, Swift Package Manager). **Qui non c'è un Mac: niente è stato
compilato, avviato o caricato per iOS.** Cosa è stato provato e cosa no: sezione 15.

## 0. Cosa c'è già nel repository

| Cosa | Dove |
|---|---|
| Progetto Xcode, Info.plist, icona, schermata di avvio, manifesto privacy | `ios/App/` (`App.xcodeproj`, `App/Info.plist`, `App/PrivacyInfo.xcprivacy`) |
| Codice del gioco per l'app (inerte sul web e sul desktop) | `src/platform/native.ts`, `src/platform/mirror.ts`, blocco `html.ios-app` in fondo a `src/style.css` |
| Build per l'app: `npm run ios:sync` (tsc, vite build, `cap sync ios`) | `package.json` |
| Icona e immagini di avvio rifatte dalle immagini del gioco: `npm run ios:assets` | `scripts/ios-assets.mjs` |
| CI Codemagic, workflow `ios-testflight` | `codemagic.yaml` nella **radice del repository** (lavora in `scrapbot-city/`) |
| Testi del negozio (en-US, it) | `appstore/metadata/` |
| Informativa privacy (Markdown e HTML da pubblicare) | `docs/privacy-policy.md`, `docs/privacy-policy.html` |

- **Dispositivi**: app universale, iPhone + iPad (`TARGETED_DEVICE_FAMILY = "1,2"`). iPhone solo in orizzontale, iPad in
  tutti gli orientamenti. **Solo iPad**, con un comando (cambia le due righe Debug e Release):
  `sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 2;/' ios/App/App.xcodeproj/project.pbxproj`
  (oppure in Xcode: target App › General › Supported Destinations, togli iPhone). Il layout compatto per iPhone è in
  lavorazione in un altro ramo: se non è pronto, pubblica prima solo iPad.
- **Mac**: nessuna build separata. L'app per iPad gira sui Mac con chip Apple come «Designed for iPad» (sezione 13).
- **Versione** 1.0.0, build 1 (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`). Ogni caricamento vuole un numero di
  build nuovo (Codemagic lo fa da solo, sezione 6).
- **Salvataggi**: iOS può cancellare i dati del web view (localStorage). L'app tiene una copia di ogni chiave in
  `Library/saves` (un file per chiave, scritto con file temporaneo e rinomina) e all'avvio, prima che il gioco legga,
  rimette ciò che manca; non cancella mai niente (le copie sostituite vanno in `Library/saves/aside`).
- **Finestra minima** (iPad in finestra, Mac): 744×660 punti, misurata in Chromium: a 744 di larghezza tutto sta
  dentro da 640 di altezza in su (en, de, fr, pl), con la barra delle costruzioni che scorre di lato sotto i 1024; +20
  per l'indicatore Home. A schermo intero iPadOS dà comunque le misure dell'iPad.

## 1. Apple Developer Program

- **99 USD l'anno** (o l'equivalente locale), da rinnovare. Iscrizione dall'app Apple Developer o da
  developer.apple.com/programs/enroll, con un Apple Account con autenticazione a due fattori.
- **Individuale**: sul negozio come venditore compare il tuo nome e cognome. Basta un documento d'identità.
- **Organizzazione** (es. «Qwerty3D Games» come società): serve un'entità legale e il numero **D-U-N-S** (gratuito, da
  Dun & Bradstreet; possono servire giorni o settimane), un sito web e il potere di firmare per la società.
- Dopo l'approvazione: App Store Connect › **Business** (Accordi, imposte e banche). Per un'app gratuita basta
  l'accordo standard; per un'app a pagamento servono il Paid Apps Agreement, i dati fiscali e il conto bancario.
  Nell'UE (Digital Services Act) App Store Connect chiede se sei un «trader»: se lo sei, indirizzo, telefono ed e-mail
  compaiono sulla pagina del negozio europea (verificalo lì: non controllato qui).

## 2. Il bundle ID

developer.apple.com › Certificates, Identifiers & Profiles › Identifiers › **+** › App IDs › App: descrizione
«Scrapbot City», Bundle ID **Explicit** `com.qwerty3d.scrapbotcity`. Nessuna capability (niente iCloud, push, Game
Center, acquisti in-app). È lo stesso di `capacitor.config.ts` e del progetto Xcode e non si cambia dopo il primo
caricamento.

## 3. La scheda dell'app in App Store Connect

appstoreconnect.apple.com › App › **+** › Nuova app: piattaforma iOS, nome «Scrapbot City» (deve essere libero su
tutto il negozio), lingua principale (English (U.S.) o Italiano), bundle ID `com.qwerty3d.scrapbotcity`, SKU a scelta
(es. `SCRAPBOTCITY1`, interno). Poi in Informazioni sull'app annota l'**Apple ID** (un numero): serve a Codemagic
(`APP_STORE_APPLE_ID`). Categoria: Giochi › Simulazione (la secondaria la scegli tu).

## 4. La chiave API di App Store Connect

Utenti e accessi › Integrazioni › App Store Connect API › Chiavi del team › **Genera** (la prima volta il titolare
dell'account deve chiedere l'accesso all'API). Nome «Codemagic», accesso **App Manager**. Scarica il file `.p8`
(**si scarica una volta sola**) e annota **Key ID** e **Issuer ID**. Non metterli mai nel repository.

## 5. Strada A — un tuo Mac con Xcode 26

Serve Xcode 26 o più recente (dal 28 aprile 2026 App Store Connect accetta solo build fatte con Xcode 26 e l'SDK di
iOS 26) e Node 22.

```sh
cd scrapbot-city
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
npm run ios:sync
open ios/App/App.xcodeproj
```

In Xcode: progetto App › target **App** › Signing & Capabilities › **Team**: il tuo (lascia «Automatically manage
signing»). Prova su un simulatore (iPad Pro 13", un iPhone) o su un dispositivo col cavo. Per caricare: destinazione
**Any iOS Device (arm64)** › Product › **Archive** › nell'Organizer **Distribute App** › App Store Connect ›
**Upload**. Per ogni nuovo caricamento alza il numero di build (target App › General › Build, oppure
`cd ios/App && agvtool new-version -all 2`).

## 6. Strada B — Codemagic (senza Mac)

1. Account su codemagic.io, collega GitHub e aggiungi questo repository. Codemagic legge `codemagic.yaml` dalla radice
   del repository; il workflow lavora in `scrapbot-city/`. Piano e minuti macOS inclusi: controllali su codemagic.io
   (non verificato qui).
2. **Gruppo di variabili `appstore_credentials`** (tutte segrete): `APP_STORE_CONNECT_ISSUER_ID`,
   `APP_STORE_CONNECT_KEY_IDENTIFIER`, `APP_STORE_CONNECT_PRIVATE_KEY` (il contenuto del `.p8`),
   `CERTIFICATE_PRIVATE_KEY` (una chiave RSA 2048 in PEM per il certificato di distribuzione:
   `ssh-keygen -t rsa -b 2048 -m PEM -f ios_distribution_private_key -q -N ""`), `APP_STORE_APPLE_ID`. **I valori li
   imposta Claude tramite l'API di Codemagic in una sessione successiva**: in quella sessione gli dai il `.p8`, Key ID,
   Issuer ID, l'Apple ID dell'app e un token dell'API di Codemagic (impostazioni di Codemagic › Integrations ›
   Codemagic API). Nessun segreto va mai nel repository.
3. **Certificato e profilo**: non devi fare niente. Il workflow, con la chiave API, prende o crea il certificato «Apple
   Distribution» fatto con `CERTIFICATE_PRIVATE_KEY` e il profilo App Store del bundle ID (`app-store-connect
   fetch-signing-files … --create`). Se l'account ha già il numero massimo di certificati di distribuzione, revocane
   uno che non usi.
4. **Avvio**: Codemagic › l'app › Start new build › workflow **iOS TestFlight** (`ios-testflight`), ramo `appstore`
   (o quello dove finirà), oppure tramite l'API.
5. Cosa fa: Xcode più recente (si ferma se è sotto la 26), Node 22, `npm ci`, `npm test`, `npm run ios:sync`, firma,
   numero di build = l'ultimo su TestFlight + 1 (alla prima build: il numero di build di Codemagic) con `agvtool`,
   `xcode-project build-ipa` sul progetto SPM, poi carica su App Store Connect e lo manda a TestFlight. **Non lo
   manda mai in revisione per il negozio.** Artefatti: l'IPA, i log di xcodebuild, i dSYM.

## 7. TestFlight

- Dopo l'elaborazione in App Store Connect (di solito pochi minuti, a volte di più) la build compare in TestFlight.
- **Test interni**: fino a 100 persone del tuo team di App Store Connect, senza revisione.
- **Test esterni**: fino a 10.000 persone per e-mail o link pubblico; la prima build di ogni versione passa la Beta App
  Review. Compila le Informazioni sul test (descrizione, e-mail per i commenti).
- **Mac**: nel gruppo di test attiva «Test iPhone and iPad Apps on Apple Silicon Macs»; i tester la installano con
  TestFlight sul Mac.
- Le build di TestFlight scadono dopo 90 giorni. Cosa provare per primo: la lista della sezione 15.

## 8. Screenshot

Richiesti (pagina di Apple letta il 19/10/2026): **iPad 13"** 2752×2064 o 2732×2048 in orizzontale (2064×2752 o
2048×2732 in verticale) e **iPhone «Dynamic Island, schermo medio»** 2556×1179 o 2622×1206 in orizzontale; da 1 a 10
per misura, PNG o JPEG senza trasparenza; le misure più piccole App Store Connect le ricava da queste. Falli dal
simulatore di Xcode (iPad Pro 13-inch, iPhone 16 Pro o 17 Pro; ⌘S salva lo screenshot alla misura giusta) o da un
dispositivo. Il test `npm run e2e -- ios-shell` salva immagini a 1376×1032 con DPR 2, cioè 2752×2064: sono il gioco
vero con l'aspetto dell'app ma disegnato da Chromium, buone come bozza. Quelli per iPhone: dopo il layout compatto.

## 9. URL dell'informativa privacy e URL di supporto

- `docs/privacy-policy.html` è un file unico, senza risorse esterne, in inglese e italiano. Prima di pubblicarlo
  sostituisci `[CONTACT EMAIL]` (due volte; anche nel `.md`).
- Pubblicalo dove vuoi: GitHub Pages (su un repository privato serve un piano a pagamento; altrimenti un piccolo
  repository pubblico con il file come `index.html`), oppure qualsiasi hosting statico.
- **URL di supporto** (obbligatorio): una pagina con il modo di contattarti (anche una pagina semplice con l'e-mail).

## 10. Classificazione per età

Nel questionario rispondi **Nessuno / No** a tutto: violenza (anche cartoni/fantasy), temi per adulti (volgarità,
paura, alcol/tabacco/droghe), medicina e benessere, sessualità e nudità, attività basate sul caso (gioco d'azzardo,
anche simulato, concorsi, loot box), capacità (accesso web libero, contenuti generati dagli utenti, social, chat,
pubblicità), controlli nell'app. Il nome della città scritto dal giocatore resta sul dispositivo. Risultato atteso:
**4+**.

## 11. Privacy dell'app («App Privacy»)

App Store Connect › Privacy dell'app › **«No, non raccogliamo dati da questa app»** (Data Not Collected). Il gioco non
ha account, pubblicità, analisi né rete. Il manifesto `ios/App/App/PrivacyInfo.xcprivacy` dice lo stesso (nessun
tracciamento, nessun dato raccolto) e dichiara l'unica API «con motivo» usata: le date dei file nella cartella
dell'app (C617.1), lette dal plugin Filesystem per la copia dei salvataggi.

## 12. Conformità all'esportazione (crittografia)

Già risposto nell'Info.plist (`ITSAppUsesNonExemptEncryption` = NO): l'app non usa crittografia propria e non va in
rete. App Store Connect non chiede niente a ogni build; se lo chiede, rispondi che l'app non usa crittografia.

## 13. Prezzo e disponibilità

- **Prezzo**: decidi tu (gratis o a pagamento; per il pagamento vedi sezione 1). Paesi e regioni: tutti o una scelta.
- **Mac**: Prezzo e disponibilità › «iPhone and iPad Apps on Apple Silicon Mac»: lascia l'app disponibile se la prova
  su Mac (TestFlight, sezione 7) va bene, altrimenti togli la spunta. Nessuna build per Mac da fare.

## 14. Note per la revisione

Da incollare (in inglese) in App Review Information, con il tuo contatto:

> Scrapbot City is a single-player city builder that works offline. No account or sign-in, no in-app purchases, no
> ads, no data collection. To try it: New Game › Free play › Start opens a city at once (drag with one finger to move
> the map, pinch to zoom, tap a building in the bar and then the map to build). New Game › Tutorial is a guided
> start. In the campaign (New Game › Campaign) further cities unlock with stars earned in the previous ones.

## 15. Cosa NON è verificato

- **Niente su iOS**: nessuna build di Xcode, nessun simulatore, nessun iPhone, iPad o Mac, nessuna esecuzione di
  Codemagic, nessun caricamento, nessun TestFlight. `SceneDelegate.swift` non è mai stato compilato; il progetto Xcode
  è stato controllato solo con un parser (mod-pbxproj), i plist con `plistlib`.
- **Provato qui, solo in Chromium headless su Linux**, con un `window.Capacitor` finto (test e2e `ios-shell`, CDP
  touch, DPR 2, 1024×768, 1133×744, 1180×820, 1376×1032, safe area emulate; poi 852×393): niente Esci, modalità touch
  dalla prima schermata, niente «Schermo intero», interfaccia dentro la safe area, zoom a due dita, la pausa
  dell'app salva, la copia dei salvataggi rimette la città dopo lo storage svuotato. Test unitari della copia dei
  salvataggi su un Filesystem finto. La build web ed Electron resta com'era (suite e2e, numeri del bilanciamento).
- **Da provare su un dispositivo vero**: che iOS consegni gli eventi pause/resume in tempo e che le ultime scritture
  finiscano in background (WebKit può sospendere il web view: c'è un'attività in background di 10 s, non misurata);
  la cancellazione reale dei dati del web view e il ripristino; i valori veri delle safe area (notch, Dynamic Island,
  indicatore Home, finestre di iPadOS 26) e la dimensione minima della finestra; barra di stato, schermata di avvio,
  icona con la maschera di iOS; niente menu del tocco prolungato e niente rimbalzo; l'audio quando l'app torna
  dal background; trackpad e mouse su iPad (`UIApplicationSupportsIndirectInputEvents`), tastiera, controller;
  prestazioni sugli iPad e iPhone più vecchi; «Designed for iPad» sul Mac; l'elenco delle lingue sulla pagina del
  negozio (l'app ha una cartella `.lproj` per ognuna delle 8 lingue, con il solo nome sotto l'icona, e le dichiara in
  `CFBundleLocalizations`; il portoghese è `pt-PT`, come i testi del gioco); il layout compatto per iPhone (altro
  ramo).
- I passi di App Store Connect e di Codemagic seguono le pagine di Apple e di Codemagic lette il 19/10/2026: possono
  cambiare.
