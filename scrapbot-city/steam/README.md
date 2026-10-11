# Caricare Scrapbot City su Steam (SteamPipe)

Questa cartella contiene tutto quello che serve per mandare la build del gioco a Steam.
La guida completa (account, pagina del negozio, achievement, Steam Cloud, uscita) è in
**[docs/STEAM.md](../docs/STEAM.md)**; qui c'è solo la parte "caricare i file".

| File / cartella | A cosa serve |
|---|---|
| `sdk/app_build.vdf` | script principale: App ID, descrizione della build, ramo beta, elenco dei depot |
| `sdk/depot_build_windows.vdf` | depot Windows: carica `content/windows` (con `Scrapbot City.exe`) |
| `sdk/depot_build_linux.vdf` | depot Linux (anche Steam Deck): carica `content/linux` (con `scrapbot-city`) |
| `upload.sh` | carica da **Linux o macOS** (consigliato) |
| `upload.bat` | carica da **Windows** (vedi l'avviso sul depot Linux più sotto) |
| `prepare-upload.cjs` | controlli prima del caricamento, usato da `upload.sh` e `upload.bat` |
| `achievements.csv` | i 18 achievement da creare in Steamworks (API name, nome, descrizione, nascosto) |
| `achievements_i18n.csv` | gli stessi nomi e descrizioni nelle 8 lingue del gioco |
| `store-assets/` | grafica per la pagina del negozio: vedi [store-assets/README.md](store-assets/README.md) |
| `STORE-COPY.md` | testi della pagina (inglese e italiano), requisiti di sistema da confermare, tag |
| `ASSETS-PROVENANCE.md` | da dove viene ogni immagine, licenze di font e componenti, che cosa deve confermare il titolare |
| `CONTENT-SURVEY-DRAFT.md` | bozza del questionario sui contenuti, con la dichiarazione sull'IA |
| `content/` | la build da caricare, creata da `npm run dist:steam` (non è in git) |
| `output/` | log e cache di steamcmd (non è in git) |
| `steamcmd/` | posto consigliato per steamcmd (non è in git) |

Nessun file contiene password: `steamcmd` le chiede la prima volta e poi ricorda il login su quel computer.

## Passo 1 — Scrivere l'App ID

Quando paghi la quota Steam Direct, Steamworks crea l'app e le dà un numero, l'**App ID**
(lo vedi nella pagina dell'app in Steamworks e nell'indirizzo: `.../apps/landing/1234560`).

Apri `sdk/app_build.vdf` e sostituisci il segnaposto **`0000000`** nella riga `"AppID"`:

```
"AppID" "1234560"
```

## Passo 2 — Creare i depot e scrivere i loro ID

Un **depot** è un pacchetto di file. Ne servono due: uno per Windows e uno per Linux (lo usa anche lo Steam Deck).

1. Steamworks → la tua app → **SteamPipe → Depots**. Di solito Steam ha già creato un depot con numero App ID + 1;
   aggiungine un secondo (di solito App ID + 2).
2. Per ogni depot imposta **Operating System**: il primo **Windows**, il secondo **Linux + SteamOS**;
   *Language*: tutte (il gioco contiene già le 8 lingue); *Architecture*: 64-bit.
3. Premi **Save** e poi pubblica le modifiche (**Publish** → *Prepare for Publishing* → *Publish to Steam*).
4. Scrivi i numeri al posto dei segnaposto, **in due posti ciascuno**:

| Segnaposto | Dove scriverlo |
|---|---|
| `0000001` (Windows) | `sdk/app_build.vdf` (blocco `"Depots"`) **e** `sdk/depot_build_windows.vdf` (riga `"DepotID"`) |
| `0000002` (Linux) | `sdk/app_build.vdf` (blocco `"Depots"`) **e** `sdk/depot_build_linux.vdf` (riga `"DepotID"`) |

Esempio con App ID 1234560:

```
"Depots"
{
	"1234561" "depot_build_windows.vdf"
	"1234562" "depot_build_linux.vdf"
}
```

5. Aggiungi i due depot al pacchetto che i giocatori comprano e al pacchetto **Developer Comp**
   (Steamworks → la tua app → *All Associated Packages, DLC, Demos and Tools*): senza, neanche tu vedi i file.

Gli script di caricamento si rifiutano di partire finché resta un segnaposto o se i numeri dei due file non coincidono.
Per controllare senza caricare niente: `node steam/prepare-upload.cjs --check`.

## Passo 3 — Installare steamcmd (una volta sola)

`steamcmd` è il programma di Valve che carica i file. Mettilo in `steam/steamcmd/` (è escluso da git):

- **Linux**: `mkdir -p steam/steamcmd && cd steam/steamcmd && curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz | tar -xz`
  (su Ubuntu/Debian a 64 bit serve anche `sudo apt install lib32gcc-s1`: steamcmd è un programma a 32 bit).
- **macOS**: come sopra con `steamcmd_osx.tar.gz`.
- **Windows**: scarica <https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip> ed estrai `steamcmd.exe` in `steam\steamcmd\`.

In alternativa va bene uno steamcmd già installato (nel `PATH`) o quello dello Steamworks SDK
(`tools/ContentBuilder/builder_linux/steamcmd.sh`): indicalo con la variabile `STEAMCMD`.
La prima volta steamcmd si aggiorna da solo (qualche minuto).

**Account per i caricamenti.** Per sicurezza Valve consiglia un account Steam dedicato alle build, aggiunto al tuo
gruppo Steamworks con i soli permessi *Edit App Metadata* e *Publish App Changes To Steam* sull'app. Per mettere live
una build di un gioco già uscito l'account deve avere un numero di telefono o l'app Steam Mobile; se cambi email
o telefono dell'account, Valve blocca per 3 giorni la messa live sui giochi già usciti.

## Passo 4 — Preparare la build

```bash
npm run dist:steam
```

Crea `steam/content/windows` e `steam/content/linux` (la build Windows si fa anche da Linux, senza wine).
`steam_appid.txt` (che serve solo per i test locali) non viene mai copiato, e comunque i depot lo escludono.
Ogni build contiene anche `licenses/` (licenze dei font e di steamworks.js). Poi controlla i moduli nativi:
`npm run steam:check` (e su Linux `xvfb-run -a npm run steam:launch-check`), vedi docs/STEAM.md sezione 5.

## Passo 5 — Prova a vuoto, poi caricamento sul ramo beta

```bash
steam/upload.sh <account_build> --preview      # controlla tutto, non carica niente (log in steam/output)
steam/upload.sh <account_build> --beta beta    # carica e mette la build live sul ramo "beta"
```

- Prima di usare `--beta beta` crea il ramo: Steamworks → **SteamPipe → Builds**, crea un nuovo ramo (*branch*)
  di nome `beta` con una **password** (così lo vede solo chi la conosce).
- Senza `--beta` la build viene solo caricata: la trovi in *SteamPipe → Builds* e scegli tu su quale ramo metterla.
- `--desc "testo"` cambia la descrizione della build (di base: versione, commit git, data e ora).
- La prima volta steamcmd chiede la password e il codice **Steam Guard** (email o app); poi ricorda il login.
- Alla fine deve comparire `Successfully finished AppID ... build (BuildID ...)`.

Su Windows: `steam\upload.bat <account_build> --beta beta` (stesse opzioni).

> **Depot Linux caricato da Windows.** Windows non conserva il permesso "eseguibile" dei file Linux: se carichi il
> depot Linux da Windows, su Linux e Steam Deck il gioco potrebbe non partire. Per questo `upload.bat` chiede conferma.
> Meglio caricare con `upload.sh` da Linux, macOS o WSL (Windows Subsystem for Linux). `upload.bat` non è stato
> provato su Windows (solo scritto e controllato); `upload.sh` e i controlli sono stati provati su Linux con uno
> steamcmd finto, e i file `.vdf` con un lettore VDF, ma non con un vero caricamento (serve l'App ID).
> **Per esattezza** (verificato l'11/10/2026 nei log della sessione): l'11/10 alle 00:20, in una cartella di lavoro fuori
> dal repository, è stato avviato anche lo **steamcmd vero** in modalità *preview* (`+login anonymous +run_app_build`
> su una copia dei `.vdf` con un App ID inventato per la prova, mai usato nei file del progetto). La connessione a
> Steam è fallita (`Connecting anonymously to Steam Public... FAILED (No Connection)`): nessun accesso, nessun dato
> inviato, niente caricato. Non va ripetuto: steamcmd si avvia solo con l'App ID vero e con l'account del titolare.

## Passo 6 — Provare e pubblicare

1. Nel client Steam: tasto destro sul gioco → **Proprietà → Beta** → inserisci la password → scegli `beta`.
2. Prova su Windows, su Linux e sullo Steam Deck (elenco delle prove in docs/STEAM.md, sezione 6).
3. Se va tutto bene: Steamworks → **SteamPipe → Builds** → nella riga della build scegli il ramo **default**
   e conferma (Steamworks mostra prima un riepilogo). È l'unico passo che Valve vuole fatto a mano: nessuno
   script può mettere live il ramo `default`.

## Achievement

`achievements.csv` contiene i 18 achievement di oggi (dalla 0.6.0: `src/achievements.ts` e `src/i18n/en.ts`):

- `api_name`: da copiare **identico** in Steamworks (il gioco invia `ACH_` + l'id in maiuscolo, `electron/main.cjs`);
- `display_name`, `description`: testi inglesi;
- `hidden`: `0` per tutti, perché nel gioco (Extra) nomi e descrizioni sono già visibili prima di sbloccarli;
- `set_by`: `Client` (il gioco li sblocca da solo, senza server);
- `game_id`: l'id usato nel codice.

`achievements_i18n.csv` ha nomi e descrizioni nelle 8 lingue (`english`, `italian`, `german`, `french`, `spanish`,
`portuguese`, `polish`, `dutch`: i nomi delle lingue usati da Steamworks) da copiare nei campi di ogni lingua.
Il file è UTF-8 con BOM, così Excel mostra bene accenti e lettere polacche.

**La lista crescerà**: l'aggiornamento dei contenuti (0.7, in lavorazione) aggiungerà nuovi achievement.
Quando arriva, rigenera i CSV, crea in Steamworks solo le righe nuove e non cambiare mai l'API name di un
achievement già pubblicato (chi l'ha sbloccato lo perderebbe).

## Se qualcosa va storto

| Messaggio | Cosa fare |
|---|---|
| `"AppID" is still the placeholder 0000000` | Passo 1 |
| `depot 0000001 ... is still a placeholder` / `"DepotID" is still the placeholder` | Passo 2 (ogni ID va scritto in due file) |
| `"DepotID" is ... but app_build.vdf ... gives this file depot ...` | i numeri nei due file non coincidono: correggi quello sbagliato |
| `steam/content/... does not exist` / `is missing` | `npm run dist:steam` |
| `the game in ... is not the one in dist/index.html` | il gioco è stato ricompilato dopo la build Steam: `npm run dist:steam` |
| `scrapbot-city is not executable` | rifai `npm run dist:steam` su Linux o macOS |
| `--beta default: Steam never lets a script set the default branch live` | normale: il ramo `default` si imposta a mano (passo 6) |
| `steamcmd was not found` | passo 3 |
| `Login Failure: Account Login Denied Failed` | manca il codice Steam Guard: in steamcmd scrivi `set_steam_guard_code <codice dell'email>` e rifai il login (con la password viene chiesto un codice nuovo) |
| `ERROR! Failed 'DepotBuild for depot_build_....vdf' - status = 6` | l'account non ha i permessi sull'app, oppure steamcmd non trova i file: controlla App ID, permessi e che esista `steam/content/<sistema>` |
| `ERROR! Failed to get application info for app ...` | App ID sbagliato, configurazione Steamworks non pubblicata (*Publish*), o l'account non possiede l'app (pacchetto Developer Comp, passo 2) |
| Ramo beta non aggiornato dopo `--beta` | il ramo deve esistere prima del caricamento (passo 5): crealo e metti live la build a mano da *SteamPipe → Builds* |
| Il gioco non si installa: *Invalid content configuration* | nessuna build live su quel ramo, opzioni di avvio sbagliate, o i depot non sono nel pacchetto (passo 2, punto 5) |
| Su Linux/Deck si installa ma non scarica file | il depot Linux non è nel pacchetto (passo 2, punto 5) |

Gli errori di steamcmd elencati qui sono quelli della documentazione Valve
([Uploading to Steam](https://partner.steamgames.com/doc/sdk/uploading), sezione *Troubleshooting*).
