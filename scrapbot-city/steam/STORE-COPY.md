# Testi per la pagina del negozio — bozza per la 0.7.0-beta.1

Preparata l'11 ottobre 2026 sul ramo `steam-package`, leggendo **solo** i documenti del ramo principale del gioco
(`scrapbot-city-prototype`, commit `04d782e`): `README.md`, `CHANGELOG.md`, `docs/MODULAR-INC1.md`,
`docs/MODULAR-INC2.md`, `docs/INC1-REPORT.md`. **I prezzi non sono qui**: li decide il titolare.

Regole seguite:
- si elencano solo funzioni che **esistono e funzionano nel ramo principale oggi**; quelle ancora in lavorazione sono
  marcate **[pending final build]** e vanno controllate sulla build finale prima di pubblicare (tabella in fondo);
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
> - Industrial floors, fences, gates and lamp posts that light the street at night (decorations only: no effect on
>   the economy).
> - Machine modules: extra storage for the Bot Dock, a smog filter for the Smelter.
> - **[pending final build]** 18 more items, for 24 in total: 3 more constructions (concrete base, low wall, corner
>   pillar), 9 more decorations (bench, planter, neon sign, pergola, Miso's house, scrap sculpture, tree, fountain,
>   USA-9 statue) and 6 more modules (magnetic separator, precision sorter, double arm, habitat capsule, tracking
>   panels, extended nozzle).
> - **[pending final build]** New items are unlocked as projects by reaching milestones in any city, campaign or
>   free play.
> - **[pending final build]** Decorations can be moved after they are placed.
>
> **A city that lives**
> - Isometric 2.5D pixel art: bots flying over the roofs, citizens on the sidewalks, Miso the cat, the 2PM blimp.
> - Day and night: windows, screens, furnaces and street lamps light up after dark.
> - **[pending final build]** Each campaign city has its own ground, border scenery and light.
> - Four chiptune tracks.
>
> **Play your way**
> - Mouse and keyboard, touch, or a controller (menus with the D-pad, a virtual cursor in the city).
> - 8 languages: English, Italiano, Deutsch, Français, Español, Português, Polski, Nederlands.
> - Automatic saves every in-game day; three manual slots in free play.
> - 18 achievements.

Notes for whoever pastes it:
- "**[pending final build]**": delete the line if the item is not in the build that goes on sale, or delete the marker
  once it is checked (table in section 3).
- "18 achievements": true in the game; on Steam they appear only after they are created in Steamworks
  (docs/STEAM.md, section 8) and checked with the Steam client.
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
> - Pavimenti industriali, recinzioni, cancelli e lampioni che di notte illuminano la strada (solo decorazione: nessun
>   effetto sull'economia).
> - Moduli per le macchine: deposito aggiuntivo per l'Hangar Bot, filtro antismog per la Fonderia.
> - **[pending final build]** Altri 18 elementi, 24 in tutto: 3 costruzioni (basamento, muro basso, pilastro d'angolo),
>   9 decorazioni (panchina, fioriera, insegna al neon, pergola, casetta di Miso, scultura di rottami, albero, fontana,
>   statua di USA-9) e 6 moduli (separatore magnetico, selezionatore di precisione, braccio doppio, capsula abitativa,
>   pannelli orientabili, ugello esteso).
> - **[pending final build]** I nuovi elementi si sbloccano come progetti raggiungendo traguardi in qualsiasi città,
>   in campagna o nel gioco libero.
> - **[pending final build]** Le decorazioni si possono spostare dopo averle posate.
>
> **Una città viva**
> - Pixel art isometrica 2.5D: bot che volano sopra i tetti, cittadini sui marciapiedi, il gatto Miso, il dirigibile
>   della 2PM.
> - Giorno e notte: finestre, schermi, fornaci e lampioni si accendono col buio.
> - **[pending final build]** Ogni città della campagna ha il suo terreno, la sua scenografia di contorno e la sua luce.
> - Quattro brani chiptune.
>
> **Gioca come preferisci**
> - Mouse e tastiera, touch o controller (menu col D-pad, cursore virtuale in città).
> - 8 lingue: English, Italiano, Deutsch, Français, Español, Português, Polski, Nederlands.
> - Salvataggi automatici a ogni giorno di gioco; tre slot manuali nel gioco libero.
> - 18 achievement.

Nomi di edifici, città e finali: quelli della traduzione italiana del gioco (`src/i18n/it.ts` del ramo principale);
ricontrollali sulla build finale prima di pubblicare.

---

## 3. Da controllare sulla build finale prima di pubblicare

| Riga | Dove si verifica | Stato l'11/10/2026 |
|---|---|---|
| 24 elementi nel catalogo (18 nuovi) | catalogo «Oggetti e moduli» della build finale | nel ramo principale ce ne sono 6; i 6 moduli e le 6 decorazioni sono in rami di lavoro (`inc2-g1`, `inc2-g2`, `inc2-int2`), le 3 costruzioni e le 3 decorazioni in più non ancora |
| Sblocchi a traguardi (progetti) | catalogo: stati «Da scoprire», notifica «Nuovo progetto» | specificati in `docs/MODULAR-INC2.md` §4, non ancora nel codice del ramo principale |
| Spostare le decorazioni | pannello di una decorazione: «Sposta» | specificato (§3c), non ancora nel ramo principale |
| Temi delle città | le quattro città della campagna dopo la prima | nel ramo `inc2-cities` / `inc2-int2`, non nel principale |
| 12 edifici, 5 città, 3 finali + smog, 10 eventi, 18 achievement, 8 lingue, 4 brani, controller | già nel ramo principale | presenti (`README.md`, `CHANGELOG.md`) |
| Smog leggibile (nuvole, foschia, pannello) | già nel ramo principale | presente (`CHANGELOG.md`, G0) |

Se una riga «pending» non entra nella build in vendita, **togli la frase**, non lasciarla con una promessa.

---

## 4. Requisiti di sistema (da confermare)

Valori **non misurati su hardware vero**: vanno confermati provando la build sul ramo beta (docs/STEAM.md, sezione 7).

| Campo Steamworks | Minimo (proposta) | Da dove viene |
|---|---|---|
| OS (Windows) | Windows 10 64-bit | Electron 33 non supporta più Windows 7/8/8.1 |
| OS (SteamOS + Linux) | SteamOS o Linux 64-bit (Steam Linux Runtime 3.0 "sniper") | la build Linux è avviata qui su Ubuntu 24.04 (glibc 2.39), senza client Steam |
| Processore | *da misurare* | nessun PC "modesto" provato |
| Memoria | *da misurare* (proposta prudente: 4 GB RAM) | qui, con una città aperta e rendering software, l'app (6 processi) occupava circa 730 MB (docs/STEAM.md §5) |
| Scheda video | *da misurare* (grafica 2D, accelerazione consigliata) | qui solo rendering software, senza GPU |
| Spazio su disco | 400 MB | build di oggi: Windows 277,5 MiB, Linux 271,0 MiB (con margine per gli aggiornamenti) |
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
- **Supporto controller**: da dichiarare in *Basic Info* solo dopo la prova con il client Steam (docs/STEAM.md §10).
- **Dichiarazione sull'IA**: è nel questionario, non nei testi: bozza in [CONTENT-SURVEY-DRAFT.md](CONTENT-SURVEY-DRAFT.md).
- **Prezzo**: lo decide il titolare (candidato in discussione: 7,99 EUR). Questo file non lo imposta.
