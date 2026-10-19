# App Store: cosa fa Claude con le API (sessione successiva)

Questo file serve alla sessione di Claude che riprende il lavoro con le chiavi del titolare: build con Codemagic,
TestFlight, scheda dell'App Store e invio alla revisione, **tutto via API**, senza clic del titolare tranne quelli
segnati come suoi. La guida per il titolare è [APPSTORE.md](APPSTORE.md).

## Stato al 19 ottobre 2026

- Ramo `scrapbot-city-prototype` (e `appstore`): **1.0.0**, app universale iPhone (orizzontale) + iPad + Mac con chip
  Apple («Designed for iPad»), Capacitor 8 con Swift Package Manager in `ios/`, `codemagic.yaml` alla radice del
  repository (workflow `ios-testflight`, `working_directory: scrapbot-city`).
- Verificato solo su Linux in Chromium (input simulati): `npm run e2e` 27/27, test unitari, numeri del gioco identici
  alla 0.7.0-rc.1. **Mai compilato con Xcode, mai provato su un dispositivo.**
- Pagina di assistenza e informativa privacy: `https://claude.ai/artifact/RtuycNCpGDGdHCDPXLK5jz` (`#privacy`,
  `#support`), contatto scelto dal titolare: truel3000lofi@gmail.com. **Deve essere condivisa pubblicamente** dal
  titolare (menu Condividi): controllalo aprendola senza accesso prima di usarla in App Store Connect.
- Scelte del titolare: **app a pagamento** (prezzo non ancora indicato: chiedilo prima di impostarlo); ID del bundle
  previsto `com.qwerty3d.scrapbotcity` (verificalo, sotto).
- Testi del negozio: `appstore/metadata/en-US` e `appstore/metadata/it`; screenshot: `appstore/screenshots/`.
- Già fatto con le API (19 ottobre): ID del bundle `com.qwerty3d.scrapbotcity` registrato (risorsa `F4TW2966UR`,
  piattaforma UNIVERSAL); certificato iOS Distribution `2FS2G44A9H` (scade il 19 ottobre 2027), la cui chiave privata
  è solo in Codemagic (`CERTIFICATE_PRIVATE_KEY`); app di Codemagic `6ad5d4797c0fa2cb894170c9`; gruppo
  `appstore_credentials` `6ad5d4987550aed810900e47` con 4 variabili segrete (manca `APP_STORE_APPLE_ID`). L'account
  ha già 3 certificati Apple Distribution di altre app: non toccarli.
- Manca il record dell'app in App Store Connect: Apple non permette di crearlo via API (`POST /v1/apps` → 403), lo
  crea il titolare.
- Script nel repository (chiave dalle variabili d'ambiente, vedi sotto): `scripts/asc-listing.mjs` (scheda, §4) e
  `scripts/asc-testflight.mjs` (§3), entrambi rieseguibili; `scripts/asc-api.mjs` è il client.

## Le chiavi (variabili d'ambiente della sessione, mai nel repository né nella chat)

| Variabile | Cosa |
|---|---|
| `CODEMAGIC_API_TOKEN` | token dell'API di Codemagic (Settings → Integrations → Codemagic API) |
| `ASC_ISSUER_ID`, `ASC_KEY_ID` | chiave dell'API di App Store Connect (ruolo App Manager o Admin) |
| `ASC_PRIVATE_KEY`, `ASC_PRIVATE_KEY_B64` o `ASC_PRIVATE_KEY_PATH` | il file `.p8` della chiave: in chiaro, in base64 o il percorso |

Se mancano, dillo al titolare in poche righe (impostazioni dell'ambiente → variabili, poi una nuova sessione) e
fermati sulla parte che le richiede.

## 1. App Store Connect: autenticazione e verifica dell'app

- JWT ES256 firmato con il `.p8`: header `{"alg":"ES256","kid":ASC_KEY_ID,"typ":"JWT"}`, payload
  `{"iss":ASC_ISSUER_ID,"iat":ora,"exp":ora+1200,"aud":"appstoreconnect-v1"}`. In Node:
  `crypto.sign('sha256', Buffer.from(header64 + '.' + payload64), { key: pem, dsaEncoding: 'ieee-p1363' })`.
  Base URL `https://api.appstoreconnect.apple.com`.
- `GET /v1/apps?filter[bundleId]=com.qwerty3d.scrapbotcity` → l'`id` dell'app è l'**Apple ID** (numero) che serve a
  Codemagic (`APP_STORE_APPLE_ID`). Se non c'è: `GET /v1/apps` e cerca «Scrapbot City»; se il bundle ID è un altro,
  cambialo ovunque nel progetto (`capacitor.config.ts` `appId`, `PRODUCT_BUNDLE_IDENTIFIER` in
  `ios/App/App.xcodeproj/project.pbxproj`, `BUNDLE_ID` in `codemagic.yaml`) e rifai `npm run ios:sync`. Se l'app non
  esiste in App Store Connect, va creata dal titolare (Le mie app → + → Nuova app, piattaforma iOS, nome «Scrapbot
  City», lingua principale, bundle ID, SKU): verifica nella documentazione di Apple se oggi l'API permette di
  crearla; altrimenti chiedi solo questo al titolare.

## 2. Codemagic: credenziali e build

Base URL `https://api.codemagic.io`, header `x-auth-token: $CODEMAGIC_API_TOKEN`.

1. `GET /apps` → l'app di questo repository (`xtruel/aaaaaaaaaaaaaa...--`). Se manca: `POST /apps` con
   `{"repositoryUrl": "https://github.com/xtruel/aaaaaaaaaaaaaa...--.git"}` (serve l'accesso di Codemagic a GitHub
   del titolare).
2. Il gruppo di variabili **`appstore_credentials`** (vedi l'intestazione di `codemagic.yaml`), tutte segrete:
   `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_IDENTIFIER`, `APP_STORE_CONNECT_PRIVATE_KEY` (il `.p8`
   intero), `CERTIFICATE_PRIVATE_KEY` (una chiave RSA nuova: `openssl genrsa 2048`, in PEM; resta solo in Codemagic,
   serve a creare il certificato Apple Distribution), `APP_STORE_APPLE_ID` (dal passo 1). Le API per variabili e
   segreti sono nello schema v3 (`https://codemagic.io/api/v3/schema`, sezione «Secrets and Environment Vars»):
   leggilo prima di chiamarle. In alternativa `POST /builds` accetta `environment.variables` per una singola build,
   ma il gruppo citato nello YAML deve comunque esistere: verifica come si comporta.
3. `POST /builds` con `{"appId": …, "workflowId": "ios-testflight", "branch": "scrapbot-city-prototype"}` →
   `buildId`. Segui lo stato (`GET /builds/{id}`) e i log dei passi fino alla fine.
4. Errori probabili alla prima build, da correggere nel repository e rilanciare: versione di Xcode (`xcode: latest`
   deve essere 26 o più), risoluzione dei pacchetti Swift (`ios/App/CapApp-SPM/Package.swift` punta a
   `node_modules/@capacitor/*`: `npm ci` e `npx cap sync ios` vanno prima di `xcodebuild`), firma
   (`app-store-connect fetch-signing-files --create`: il limite di Apple è di 3 certificati Apple Distribution per
   account), `agvtool` (il progetto usa Apple Generic), `SceneDelegate.swift` mai compilato. Ogni correzione: un
   commit, push, nuova build.

## 3. TestFlight

- La build caricata compare in `GET /v1/builds?filter[app]={appId}`; aspetta `processingState` = `VALID`. La
  conformità all'esportazione è già dichiarata (`ITSAppUsesNonExemptEncryption` = NO in `Info.plist`).
- `node scripts/asc-testflight.mjs --wait` fa i passi che seguono. Codemagic non chiede la revisione beta di Apple
  (`submit_to_testflight: false`): serve solo per i tester esterni.
- Gruppo interno: `GET /v1/betaGroups?filter[app]={appId}`, oppure creane uno interno; aggiungi la build. Il titolare
  la installa con l'app TestFlight su iPhone/iPad (e sul Mac con chip Apple, abilitando nel gruppo «Test iPhone and
  iPad Apps on Apple Silicon Macs») e prova il gioco: **10 minuti su un dispositivo vero prima dell'invio alla
  revisione** (salvataggio, uscita e rientro nell'app, rotazione su iPad, una partita su iPhone).

## 4. La scheda dell'App Store (via API)

`node scripts/asc-listing.mjs --dry` mostra cosa cambierebbe; senza `--dry` scrive categorie, testi en-US e it con
i due URL, età consigliata, numero di versione, copyright, rilascio manuale e screenshot. Restano fuori: prezzo,
contatto per la revisione, privacy dell'app, dichiarazione sui contenuti di terzi (`contentRightsDeclaration`, da
chiedere al titolare). Le risorse, per correggere lo script o fare a mano (nomi verificati sulla specifica OpenAPI
4.5.1 di Apple):
- `appInfos` → `appInfoLocalizations` per `en-US` e `it`: `name`, `subtitle`, `privacyPolicyUrl`
  (`…RtuycNCpGDGdHCDPXLK5jz#privacy`); categoria principale Giochi, sottocategorie Simulazione e Strategia.
- `appStoreVersions` (piattaforma `IOS`, `versionString` `1.0.0`) → `appStoreVersionLocalizations`: `description`,
  `keywords`, `promotionalText`, `supportUrl` (`…#support`) dai file in `appstore/metadata/<lingua>/`; copyright da
  `appstore/metadata/copyright.txt`.
- Screenshot: `appScreenshotSets` con `screenshotDisplayType` `APP_IPHONE_67` (lo spazio dell'iPhone 6,9": 2868×1320)
  e `APP_IPAD_PRO_3GEN_129` (iPad 13": 2752×2064), poi per ogni file `appScreenshots` (prenotazione, upload delle
  parti, conferma con il checksum MD5). File in `appstore/screenshots/<lingua>/{iphone-6.9,ipad-13}/NN-nome.png`.
  Gli scatti grezzi del 19 ottobre (circa 30 per dispositivo e lingua, da scegliere) erano solo nella cartella
  temporanea della sessione: se non ci sono più, vanno rifatti dalla build di rilascio (vedi `e2e/tests/ios-shell.mjs`).
- `ageRatingDeclarations`: tutto «nessuno / no» (vedi APPSTORE.md, sezione 10): 4+.
- Prezzo: `appPriceSchedules` con il prezzo che **dice il titolare**. Per un'app a pagamento l'accordo «Paid Apps»
  (dati fiscali e bancari) deve essere attivo in App Store Connect → Business: solo il titolare può firmarlo.
- Informazioni per la revisione (`appStoreReviewDetails`): nome, e-mail e telefono di contatto del titolare (chiedi
  il telefono: non c'è nel repository), nessun account demo (il gioco non ne ha), note: «Single-player offline game.
  No account, no network, no in-app purchases.»
- Privacy dell'app («Data Not Collected»): se l'API non la gestisce, è un modulo del titolare in App Store Connect →
  Privacy dell'app → «No, non raccogliamo dati» → Pubblica.
- Mac: l'app per iPad è disponibile sui Mac con chip Apple per impostazione predefinita (Prezzi e disponibilità →
  iPhone and iPad Apps on Apple Silicon Mac): lasciala attiva.

## 5. Invio alla revisione

Solo dopo: build TestFlight provata dal titolare su un dispositivo, prezzo confermato, accordo Paid Apps attivo,
pagina di assistenza pubblica, privacy dell'app compilata. Poi `reviewSubmissions` + `reviewSubmissionItems` con la
`appStoreVersion`. Pubblicazione dopo l'approvazione: manuale (`releaseType` MANUAL) salvo diversa indicazione del
titolare. Riporta al titolare stato e tempi della revisione; un rifiuto si legge in Resolution Center (o via API) e
si corregge con una nuova build.
