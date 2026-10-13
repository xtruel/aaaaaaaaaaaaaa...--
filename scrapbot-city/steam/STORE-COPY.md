# Testi per la pagina del negozio — 0.7.0-rc.1

Preparata l'11 ottobre 2026 sul ramo `steam-package` (documenti del ramo principale, commit `04d782e`); **aggiornata il
13 ottobre 2026 per la 0.7.0-rc.1** (ramo `rc-0.7.0`): i segni **[pending final build]** sono stati sciolti usando
**solo** fatti verificati in `docs/BETA-REPORT.md` (0.7.0-beta.1; nel codice del gioco la RC cambia soltanto la
posizione di un avviso nel pannello di un pezzo, il numero di versione e la favicon, vedi `CHANGELOG.md`) e quello che
mostrano gli screenshot nuovi, fatti sulla build di rilascio della RC (`store-assets/screenshots/`, provenienza in
[ASSETS-PROVENANCE.md](ASSETS-PROVENANCE.md), 2.3). **I prezzi non sono qui**: li decide il titolare.
**Una RC non è un via libera commerciale**: questi testi descrivono il gioco, non promettono niente su durata,
divertimento o vendite.

Regole seguite:
- si elencano solo funzioni che **esistono e sono state verificate nella build 0.7.0-rc.1** (tabella in fondo); dove
  una verifica manca la riga lo dice (**[listen before publishing]**) o la funzione è stata lasciata fuori;
- nessuna promessa su durata, divertimento, Steam Deck, Windows o funzioni Steam non provate davvero;
- regole di Steamworks lette l'11/10/2026 su [Store Page Written Description](https://partner.steamgames.com/doc/store/page/description):
  descrizione breve in solo testo, "pochi centinaia di caratteri", niente riferimenti a date che invecchiano; niente
  link, niente immagini che imitano l'interfaccia di Steam, niente pubblicità di altri giochi.
- Steam chiede almeno la pagina in **inglese**; le altre lingue sono facoltative (qui c'è l'italiano; le altre 6 lingue
  del gioco si possono tradurre da questi testi).

---

## 1. English

### Short description (plain text, 216 characters)

> A pixel-art city builder about junk, robots and big choices. Your scrap bots clean up the Scrap Coast while you
> turn its junk into five cities — and decide whether each one grows green, industrial, or chokes in smog.

### About This Game

> **Small robots, big choices.**
>
> The Scrap Coast is buried in junk. Your little scrap bots fly out, collect it and bring it home — and what it becomes
> is up to you. Recycle it into parts, melt it into credits, power the city with solar panels or scrap burners, and
> bring in citizens who pay taxes… and make more trash.
>
> **Build a city that works**
> - 12 buildings, from the Recycler and the Bot Dock to the 2PM Factory and the Scrap Spire monument.
> - Keep energy above demand, or everything slows down.
> - Industry pays fast but makes smog: clean it with Pixel Gardens and Purifiers before it hits 95% — stay above it for
>   30 seconds and the city is lost.
> - Every building's panel shows its real numbers, at full power and right now, and says in words what is slowing it
>   down.
> - **See where the smog comes from**: clouds rise over the polluting buildings, a haze covers the city as the air
>   gets worse, and the smog meter opens a breakdown of every source and every cleaner, per day.
>
> **Green or industry?**
> Every building you keep and every choice you make in story events moves your city along the Green ◀ ▶ Industry
> scale. Finish the Scrap Spire and the ending depends on where you stand: The Garden City, The 2PM Megacity, or
> Different Futures, Same City.
>
> **The Scrap Coast campaign**
> - Five cities on a region map, each with its own rules: a harbour of shipwrecks, neon towers over toxic sludge, the
>   last green valley, a company town owned by 2PM Corp…
> - Three stars to earn in every city; stars unlock the next ones.
> - A cargo blimp moves credits and parts between your cities (it keeps 10%).
> - Story events with USA-9, Miso the cat, K. Kurogane of 2PM Corp and the citizens.
> - Free play: a city with the name and seed you choose. A guided tutorial with USA-9.
>
> **Shape your neighbourhoods** — *Objects & modules*
> - 24 items in the Objects & modules catalog: 6 constructions (industrial floor, fence, gate, concrete base, low
>   wall, corner pillar), 10 decorations (lamp post, bench, planter, neon sign, pergola, Miso's house, scrap
>   sculpture, tree, fountain, statue of USA-9) and 8 machine modules (extra storage, smog filter, magnetic
>   separator, precision sorter, double arm, housing capsule, tracking panels, extended nozzle).
> - 6 are ready from the start. The other 18 are projects to discover by reaching milestones in any city, campaign
>   or free play.
> - Constructions and decorations are for looks only: no effect on the economy, smog or stars. Lamp posts and neon
>   signs light up at night, and decorations can be moved after they are placed.
> - A module changes how one building works, with a trade-off you can read before you buy: one module per building.
>
> **A city that lives**
> - Isometric 2.5D pixel art: bots flying over the roofs, citizens on the sidewalks, Miso the cat, the 2PM blimp.
> - Day and night: windows, screens, furnaces and street lamps light up after dark.
> - Rustbay, Neon Heights, Greenvale and 2PM Company Town each have their own ground, border scenery and light.
> - **[listen before publishing]** Four chiptune tracks.
>
> **Play your way**
> - Mouse and keyboard.
> - 8 languages: English, Italiano, Deutsch, Français, Español, Português, Polski, Nederlands.
> - Automatic saves every in-game day; three manual slots in free play.
> - 18 achievements.

Notes for whoever pastes it:
- No "**[pending final build]**" marker is left: every line was checked on 0.7.0-rc.1 (table in section 3). If the
  build that goes on sale is not 0.7.0-rc.1, check the table again on that build.
- "**[listen before publishing]**": the four tracks are in the game's code (`src/music.ts`), but no test has ever
  listened to the game (docs/BETA-REPORT.md, "Da provare"). Listen to them in the desktop build, then delete the
  marker; if they do not play, delete the line.
- **Controller and touch are left out on purpose.** They are in the game but were only ever driven by simulated input
  (Chrome DevTools touch, a simulated Gamepad API), never by a real pad, touch screen or Steam Deck. After a real
  test that works (a pad on PC, the Deck, a touch screen), the line can become "Mouse and keyboard, controller or
  touch". Until then leave them out, as here: do not call them "supported" before a real test.
- "18 achievements": true in the game; on Steam they appear only after they are created in Steamworks
  (docs/STEAM.md, section 7) and checked with the Steam client.
- Do **not** add "Steam Deck Verified", "Steam Cloud" or "Full controller support" in the text: Steam shows those
  itself once configured and verified (Deck review by Valve; Cloud and Steam Input set in Steamworks).

---

## 2. Italiano

### Descrizione breve (solo testo, 223 caratteri)

> Un city builder in pixel art fatto di rottami, robot e grandi scelte. I tuoi bot ripuliscono la Scrap Coast mentre
> trasformi la spazzatura in cinque città — e decidi se ognuna cresce verde, industriale o soffoca nello smog.

### Informazioni sul gioco

> **Piccoli robot, grandi scelte.**
>
> La Scrap Coast è sommersa dalla spazzatura. I tuoi piccoli bot volano a raccoglierla e la portano a casa: che cosa
> diventa lo decidi tu. Riciclala in pezzi, fondila in crediti, alimenta la città con Campi Solari o Inceneritori e fai
> arrivare cittadini che pagano le tasse… e producono altra spazzatura.
>
> **Costruisci una città che funziona**
> - 12 edifici, dal Riciclatore e l'Hangar Bot alla Fabbrica 2PM e al monumento, la Guglia di Rottami.
> - Tieni l'energia sopra il consumo, o tutto rallenta.
> - L'industria rende in fretta ma fa smog: puliscilo con Giardini Pixel e Purificatori prima che arrivi al 95% — se ci
>   resta per 30 secondi la città è persa.
> - Il pannello di ogni edificio mostra i suoi numeri veri, a piena energia e in quel momento, e dice a parole che cosa
>   lo rallenta.
> - **Guarda da dove viene lo smog**: nuvole sopra gli edifici che inquinano, una foschia che copre la città quando
>   l'aria peggiora, e il misuratore dello smog apre il dettaglio di ogni fonte e di ogni pulizia, al giorno.
>
> **Verde o industria?**
> Ogni edificio che tieni e ogni scelta negli eventi della storia sposta la città sulla barra Green ◀ ▶ Industry.
> Completa la Guglia di Rottami: il finale dipende da dove sei arrivato — La Città Giardino, La Megalopoli 2PM o
> Futuri diversi, stessa città.
>
> **La campagna della Scrap Coast**
> - Cinque città sulla mappa della regione, ognuna con regole proprie: un porto di relitti, torri al neon sopra la
>   melma tossica, l'ultima valle verde, la città aziendale della 2PM Corp…
> - Tre stelle da guadagnare in ogni città; le stelle sbloccano le successive.
> - Un dirigibile cargo sposta crediti e pezzi tra le tue città (trattenendo il 10%).
> - Eventi con USA-9, il gatto Miso, K. Kurogane della 2PM Corp e i cittadini.
> - Gioco libero: una città con il nome e il seme che scegli. Un tutorial guidato da USA-9.
>
> **Dai forma ai quartieri** — *Oggetti e moduli*
> - 24 elementi nel catalogo «Oggetti e moduli»: 6 costruzioni (pavimento industriale, recinzione, cancello, basamento
>   in cemento, muro basso, pilastro d'angolo), 10 decorazioni (lampione, panchina, fioriera, insegna al neon, pergola,
>   casetta di Miso, scultura di rottami, albero, fontana, statua di USA-9) e 8 moduli macchina (deposito aggiuntivo,
>   filtro antismog, separatore magnetico, selezionatore di precisione, braccio doppio, capsula abitativa, pannelli
>   orientabili, ugello esteso).
> - 6 sono pronti da subito. Gli altri 18 sono progetti da scoprire raggiungendo traguardi in qualsiasi città, in
>   campagna o nel gioco libero.
> - Costruzioni e decorazioni servono solo all'aspetto: nessun effetto su economia, smog o stelle. Lampioni e insegne
>   al neon si accendono di notte, e le decorazioni si possono spostare dopo averle posate.
> - Un modulo cambia il funzionamento di un edificio, con un compromesso che leggi prima di comprarlo: un modulo per
>   edificio.
>
> **Una città viva**
> - Pixel art isometrica 2.5D: bot che volano sopra i tetti, cittadini sui marciapiedi, il gatto Miso, il dirigibile
>   della 2PM.
> - Giorno e notte: finestre, schermi, fornaci e lampioni si accendono col buio.
> - Rustbay, Neon Heights, Greenvale e 2PM Company Town hanno ognuna il suo terreno, la sua scenografia di contorno e
>   la sua luce.
> - **[listen before publishing]** Quattro brani chiptune.
>
> **Gioca come preferisci**
> - Mouse e tastiera.
> - 8 lingue: English, Italiano, Deutsch, Français, Español, Português, Polski, Nederlands.
> - Salvataggi automatici a ogni giorno di gioco; tre slot manuali nel gioco libero.
> - 18 achievement.

Nomi di edifici, città, finali e oggetti: quelli della traduzione italiana del gioco (`src/i18n/it.ts` della
0.7.0-rc.1, ricontrollati il 13/10/2026). Il segno **[listen before publishing]** e la scelta su controller e touch
valgono come nella versione inglese (note sotto la sezione 1).

---

## 3. Controllato sulla 0.7.0-rc.1 (13/10/2026)

Fonti: `docs/BETA-REPORT.md` (verifiche sulla 0.7.0-beta.1 `f5a741c`; la RC ha gli stessi numeri del gioco e la stessa
suite e2e, 22/22 sul commit `f50670c`) e gli screenshot della RC in `store-assets/screenshots/`.

| Riga del testo | Dove si verifica | Stato |
|---|---|---|
| 24 elementi: 6 costruzioni, 10 decorazioni, 8 moduli | catalogo «Objects & modules» | **verificato**: BETA-REPORT, «Le 24 voci del catalogo»; test e2e `items-mouse/-touch/-pad` (prezzo, posa, rotazione, spostamento, salvataggio, rimozione dei 24); screenshot 03 (schede e conteggi) |
| 6 da subito, 18 progetti da scoprire in qualsiasi città | catalogo: stato «To discover» con traguardo e progresso; notifica «New project» | **verificato**: BETA-REPORT (tabella dei progetti, test `discovery-*`); screenshot 03 («To discover · Clean up 10 sludge tiles · 0 / 10 in this city»); preparando gli screenshot la città ha scoperto da sé il pilastro d'angolo al 20° pezzo posato |
| Costruzioni e decorazioni solo estetiche; lampioni e insegne accesi di notte | — | **verificato**: BETA-REPORT («nessun effetto su economia, felicità, smog, allineamento, stelle o achievement»); screenshot 02 (notte) |
| Le decorazioni si spostano | pannello di una decorazione: «Move» | **verificato** nei test e2e `items-*` (BETA-REPORT: «Solo le 10 decorazioni si spostano»); non mostrato negli screenshot |
| Un modulo per edificio, compromesso visibile prima di comprare | catalogo, scheda Modules; pannello dell'edificio | **verificato**: BETA-REPORT («Moduli: valori nominali, effettivi e compromessi»); screenshot 03 (righe «Trade-off») e 04 (filtro antismog installato: +2,1 → +0,8 smog al giorno, energia −2 → −3) |
| Pannello con i numeri veri (a piena energia / ora) e la causa a parole | pannello di un edificio | **verificato**: BETA-REPORT («Economia leggibile (G1)»); screenshot 04 |
| Temi di Rustbay, Neon Heights, Greenvale, 2PM Company Town | le quattro città dopo la prima | **verificato**: test e2e `cities` (le cinque città di giorno e di notte, build di rilascio); screenshot 04 (Neon Heights), 05 (2PM Company Town), 06 (Greenvale) |
| Smog leggibile (nuvole, foschia, pannello) | misuratore dello smog | **verificato**: BETA-REPORT («Smog leggibile (G0)»); screenshot 05 |
| 12 edifici, 5 città, 3 finali + smog, 10 eventi, 18 achievement, 8 lingue | — | presenti, ricontrollati l'11/10 nel codice; la 0.7 non li cambia (BETA-REPORT: «nessun numero degli edifici originali cambiato»); i 18 achievement sono gli stessi (steam/README.md, «Achievement») |
| 4 brani chiptune (**[listen before publishing]**) | l'app desktop, con l'audio | nel codice (`src/music.ts`); **nessuna prova ha mai ascoltato il gioco** (BETA-REPORT, «Da provare») |
| Mouse e tastiera | — | provato con mouse e tastiera **simulati** (Playwright) nel browser e nell'app desktop su Linux sotto Xvfb: suite e2e, partite fino alla Guglia, preparazione degli screenshot; mai su Windows né su Steam Deck, e nessuna persona ha ancora giocato (playtest da fare, `docs/PLAYTEST.md`) |
| Controller e touch | — | **tolti dal testo**: provati solo con input simulati (Gamepad API simulata, tocchi CDP), mai con hardware vero |

Se una riga non vale più per la build in vendita, **togli la frase**, non lasciarla con una promessa.

---

## 4. Requisiti di sistema (da confermare)

Valori **non misurati su hardware vero**: vanno confermati provando la build sul ramo beta (docs/STEAM.md, sezione 6).

| Campo Steamworks | Minimo (proposta) | Da dove viene |
|---|---|---|
| OS (Windows) | Windows 10 64-bit | Electron 33 non supporta più Windows 7/8/8.1 |
| OS (SteamOS + Linux) | SteamOS o Linux 64-bit (Steam Linux Runtime 3.0 "sniper") | la build Linux è avviata qui su Ubuntu 24.04 (glibc 2.39), senza client Steam |
| Processore | *da misurare* | nessun PC "modesto" provato |
| Memoria | *da misurare* (proposta prudente: 4 GB RAM) | qui, con una città aperta e rendering software, l'app (6 processi) occupava circa 740–765 MB (13/10, docs/STEAM.md §5) |
| Scheda video | *da misurare* (grafica 2D, accelerazione consigliata) | qui solo rendering software, senza GPU |
| Spazio su disco | 400 MB | build della 0.7.0-rc.1 (13/10/2026, [README.md](README.md), passo 4): Windows 278,2 MiB, Linux 271,6 MiB (con margine per gli aggiornamenti) |
| Note | "Steam achievements need the Steam client. On Linux, Steam features need glibc 2.34 or newer." | `npm run steam:check` |

Mac: nessuna build. Non spuntare macOS.

---

## 5. Tag (proposta)

Steam consente fino a 20 tag; i primi contano di più. Proposta in ordine:

1. City Builder
2. Pixel Graphics
3. Isometric
4. Management
5. Resource Management
6. Simulation
7. Strategy
8. Building
9. Choices Matter
10. Multiple Endings
11. Robots
12. Cute
13. Colorful
14. Casual
15. Singleplayer
16. Cats

Da valutare dal titolare: **Cozy** (il gioco ha una sconfitta per smog: potrebbe non corrispondere alle attese di chi
cerca giochi rilassanti), **Relaxing** (stesso motivo), **Short** (solo dopo un playtest con persone: nessuna durata
è stata misurata). Non usare tag su funzioni non provate (es. "Steam Deck" non è un tag, ma non citarlo nei testi).

---

## 6. Altri campi della pagina

- **Sviluppatore / editore**: Qwerty3D Games (da confermare dal titolare: nome legale usato in Steamworks).
- **Data di uscita**: "Coming soon" finché non è decisa (niente date nei testi).
- **Lingue** (solo *Interface*; niente *Full Audio* e *Subtitles*: il gioco non ha voci): English, Italian, German,
  French, Spanish - Spain, Portuguese - Portugal, Polish, Dutch.
- **Supporto controller**: da dichiarare in *Basic Info* solo dopo la prova con il client Steam (docs/STEAM.md §9).
- **Dichiarazione sull'IA**: è nel questionario, non nei testi: bozza in [CONTENT-SURVEY-DRAFT.md](CONTENT-SURVEY-DRAFT.md).
- **Prezzo**: lo decide il titolare (candidato in discussione: 7,99 EUR). Questo file non lo imposta.

---

## 7. Trailer

**Il trailer va rigenerato con `scripts/trailer/run.sh` sulla build finale, prima di caricarlo**
(`scripts/trailer/run.sh . /tmp/scrapbot-trailer` dal commit di quella build; istruzioni in
[scripts/trailer/README.md](../scripts/trailer/README.md)). La pipeline è stata provata da capo a fondo l'11/10/2026
sulla 0.7.0-alpha.1 (`04d782e`); **per la 0.7.0-rc.1 non è stata rieseguita** (scelta del titolare: chiudere in
fretta), quindi oggi non c'è un trailer della RC. Il video di prova dell'alpha non va caricato.

Da sapere prima di lanciarla (letto nel codice il 13/10/2026, **non provato**): dalla 0.7.0-beta.1 il catalogo mostra
una scheda alla volta (Construction / Decorations / Modules), mentre la scena «decorate» di
`scripts/trailer/record.mjs` clicca la recinzione e poi il lampione senza cambiare scheda. È probabile che la ripresa
dei lampioni venga scartata (avviso `take decorate not kept` nell'uscita di `record`): controlla l'uscita e il video,
come chiede il README del trailer (§3, passo 2). Il caricamento in Steamworks (*Store Page → Trailers*) lo fa il
titolare.
