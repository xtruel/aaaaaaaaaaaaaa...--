# Studio della mappa: misurare prima di ingrandire (brief §6)

Misure sul codice di `inc2-saves` (base 3c90dd8, più il commit dei salvataggi 52f345f), versione 0.7.0-alpha.1. Lo studio non
modifica il codice: nessuna dimensione, nessun numero di gioco, nessuna città salvata. `npm run balance` (seminato 42 e 7) e
`npm run waits` restano identici byte per byte alla base. Schermate e script stanno in
`/tmp/claude-0/-home-user-aaaaaaaaaaaaaa-----/de84899b-e8ac-57f1-a70a-17a0bc3ca245/scratchpad/inc2/saves/map/` (sotto: `map/`).

## 0. In breve

- **La mappa attuale basta.** È 56×36 = 2016 caselle, come nella demo 0.6.0 e 0.6.1 (verificato anche sulle build vecchie).
  Non serve una mappa più grande, quindi questo documento non la propone.
- **Città normali** (autopilota del bilanciamento, 5 città × 2 percorsi più 4 partite libere): quando si piazza la Guglia gli
  edifici coprono il 3,2–6,8% della mappa. Tutto sta a 2–5 caselle dal QG ed è edificabile il 76–87% delle caselle. Dove la
  città sembra piena è perché si costruisce tutto attorno al QG, non perché manchi spazio: in 14 partite nessun tentativo è
  fallito per spazio, tutti per costo. In 13 partite su 14 i rottami (87–356 caselle) occupano più spazio degli edifici
  (65–137).
- **Città avanzata a isolati** (risorse concesse, solo come studio dello spazio). Ha 76 edifici più il QG, 349 pavimenti,
  84 recinzioni e cancelli, 18 lampioni e 9 moduli, divisi in 4 isolati: produzione, abitazioni, piazza/giardino e monumento con
  la Guglia. Restano edificabili 1468 caselle (72,8%). Ci stanno ancora 130 lotti 2×2 con una strada attorno (261 senza strada)
  e 64 lotti 3×3 con strada. Si esauriscono prima i grandi rettangoli liberi: dopo questa città, e solo dopo aver tolto rottami
  e macerie, ci stanno ancora un isolato 19×16 e uno 14×14, oppure cinque isolati 10×10.
- **Interfaccia**: a 1280 px di larghezza copre il 33–40% dello schermo (la barra di costruzione da sola il 21–25%), a
  1920×1080 il 22–24%. Con il pannello del catalogo aperto si arriva al 52–58%.
- **Navigazione e bordi**: tutti gli isolati sono a meno di una schermata dalla vista iniziale (al massimo 3,6 s con le
  frecce a 1280×800). Si raggiungono tutti i bordi e gli angoli, a ogni zoom e con ogni comando (camera-check 13/13 e
  edge-access su 4 risoluzioni). **Nessun intervento su inquadratura, pan o bordi: le misure non mostrano un problema.**
- **Selezione, fuori dal perimetro della mappa**: con clic reali 1520 su 1540 vanno a buon fine. I 20 falliti sono sempre lo
  stesso Giardino, nascosto dietro la Guglia: nessun clic lo seleziona, nemmeno con la ruspa, che pure mostra la Guglia
  trasparente. Inoltre 20 oggetti su 102 (recinzioni e lampioni dietro edifici 2×2 o dietro la Guglia) non si selezionano
  con un clic; la ruspa però li toglie. Al §9 i dettagli e una correzione proposta, da approvare a parte.

## 1. Dimensioni reali, dal codice

| Cosa | Valore | Dove |
|---|---|---|
| Mappa giocabile | `MAP_W` 56 × `MAP_H` 36 = 2016 caselle da `TILE` 16 px | `src/game/defs.ts` |
| Demo vecchie | 56×36 anche nella 0.6.0 (`build-v060`) e nella 0.6.1 (`build-v061-debug`), lette con `window.scrapbot.defs` | `map/oldsize.mjs` |
| QG | 3×3 in (27,17)–(29,19), al centro (`floor(MAP_W/2)-1`, `floor(MAP_H/2)-1`); cortile sgombro nel raggio di 4,5 | `src/game/world.ts` |
| Generazione | prati vicino ai bordi, 13 discariche e 45 rottami sparsi (× `mods.junk`), 22 gruppi di macerie da 1–4 caselle (30 a Rustbay), pozze di melma lontane dal QG, anello di 9 rottami iniziali | `generateMap` |
| Cornice di scenario | `RING` = 6 caselle decorative attorno alla mappa (strade, canali, gru): non edificabile | `src/render/renderer.ts` |
| Telecamera | il centro della zona libera dall'HUD si sposta su tutto il rombo della mappa più 3 caselle di margine | `clampCam` |
| Zoom | interi da 1 a 5. All'avvio 2 se la finestra è alta meno di 900 px, altrimenti 3 | `session.ts` |
| Salvataggi | `deserialize` rifiuta una mappa di dimensioni diverse (`tiles.length !== MAP_W*MAP_H`) | `src/game/state.ts` |

Terreno all'inizio (caselle; "edificabili" = terreno o prato senza nulla sopra):

| Città | Rottami | Melma | Macerie | Prato | Terreno | Edificabili | 2×2 affiancati | 3×3 affiancati | Rettangolo libero max |
|---|---|---|---|---|---|---|---|---|---|
| Scrapbot City (home, seme 2026) | 273 | 19 | 40 | 78 | 1597 | 1675 (83,1%) | 363 | 138 | 24×8 |
| Rustbay (7781) | 335 | 6 | 58 | 131 | 1477 | 1608 (79,8%) | 329 | 112 | 7×13 |
| Neon Heights (3141) | 279 | 55 | 37 | 117 | 1519 | 1636 (81,2%) | 347 | 121 | 19×9 |
| Greenvale (5150) | 167 | 8 | 43 | 380 | 1409 | 1789 (88,7%) | 392 | 147 | 13×13 |
| 2PM Company Town (9090) | 365 | 15 | 41 | 96 | 1490 | 1586 (78,7%) | 323 | 121 | 11×11 |
| gioco libero, seme 1234 | 321 | 20 | 48 | 119 | 1499 | 1618 (80,3%) | 340 | 125 | 11×9 |
| gioco libero, seme 777 | 236 | 19 | 26 | 154 | 1572 | 1726 (85,6%) | 369 | 136 | 22×7 |

## 2. Come si conta

- **Ogni casella conta una volta sola**, nella prima categoria che le si applica. Nell'ordine: edificio (QG compreso);
  recinzione, cancello o lampione; rottame; melma; macerie; pavimento scoperto; prato; terreno. Un pavimento sotto un edificio
  conta come edificio e uno sotto una recinzione come recinzione. Viene riportato a parte solo come informazione e la somma fa
  sempre 2016.
- **Edificabile ora**: terreno o prato senza edificio e senza oggetto solido. Il pavimento non impedisce di costruire.
  **Senza rottami**: in più le caselle con rottami, che i bot raccolgono col tempo. **Ripulita**: in più macerie (ruspa, 15 cr
  a casella) e melma (Purificatore).
- **Quanti in più**: lotti messi uno accanto all'altro, da sinistra a destra e dall'alto in basso. È un limite inferiore del
  massimo. **Con strada**: si lascia libera una casella attorno a ogni lotto, come farebbe un giocatore ordinato.
- **Distanza dal QG**: caselle di distacco tra l'ingombro del QG e quello dell'edificio (0 = a contatto).
- Le partite usano la stessa sequenza di `Math.random` (seme 42) di `npm run balance`. Gli edifici finali coincidono riga per
  riga con il riferimento `map/baseline-3c90dd8/balance-s42.txt`: sono proprio le partite del bilanciamento.

## 3. (a) Città normali: quando si piazza la Guglia

| Città | Percorso | Giorno | Pop | Edifici | Caselle di edifici (senza QG) | % mappa | Rottami | Melma | Macerie | Edificabili ora | Distanza max / media dal QG | Ingombro | Liberi vicino al QG | 2×2 in più (affiancati / con strada) | 3×3 in più (affiancati / con strada) | Rettangolo libero max (ora / senza rottami) | Tentativi falliti: costo / spazio |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | verde | 10 | 36 | 28 | 93 | 4,6% | 232 | 19 | 40 | 1623 (80,5%) | 3 / 1,3 | 13×11 | 29 su 121 | 355 / 164 | 133 / 85 | 21×10 / 21×15 | 1595 / 0 |
| home | industria | 9 | 42 | 26 | 97 | 4,8% | 194 | 27 | 40 | 1649 (81,8%) | 3 / 1,3 | 14×12 | 25 su 121 | 351 / 165 | 137 / 87 | 26×8 / 21×15 | 383 / 0 |
| rustbay | verde | 9 | 36 | 25 | 81 | 4,0% | 325 | 6 | 58 | 1537 (76,2%) | 3 / 1,2 | 12×11 | 33 su 121 | 300 / 154 | 94 / 62 | 6×13 / 41×7 | 1368 / 0 |
| rustbay | industria | 10 | 36 | 39 | 137 | 6,8% | 220 | 0 | 58 | 1592 (79,0%) | 4 / 2,0 | 15×13 | 36 su 169 | 319 / 161 | 116 / 74 | 21×7 / 41×7 | 501 / 0 |
| neon | verde | 15 | 30 | 24 | 74 | 3,7% | 278 | 55 | 37 | 1563 (77,5%) | 3 / 1,2 | 10×11 | 37 su 121 | 315 / 155 | 110 / 73 | 15×8 / 31×9 | 1485 / 0 |
| neon | industria | 10 | 48 | 39 | 135 | 6,7% | 160 | 62 | 37 | 1613 (80,0%) | 4 / 1,9 | 14×13 | 32 su 169 | 344 / 167 | 127 / 78 | 29×7 / 31×9 | 430 / 0 |
| greenvale | verde | 9 | 42 | 25 | 78 | 3,9% | 137 | 8 | 43 | 1741 (86,4%) | 5 / 1,2 | 12×12 | 131 su 225 | 382 / 185 | 143 / 85 | 33×5 / 18×27 | 1348 / 0 |
| greenvale | industria | 12 | 36 | 26 | 108 | 5,4% | 87 | 16 | 43 | 1753 (87,0%) | 3 / 1,3 | 13×12 | 11 su 121 | 391 / 182 | 149 / 94 | 36×8 / 18×23 | 705 / 0 |
| company | verde | 10 | 42 | 21 | 65 | 3,2% | 356 | 15 | 41 | 1530 (75,9%) | 2 / 1,0 | 11×9 | 19 su 81 | 303 / 157 | 108 / 68 | 26×5 / 26×12 | 1212 / 0 |
| company | industria | 10 | 42 | 35 | 123 | 6,1% | 260 | 23 | 41 | 1560 (77,4%) | 4 / 1,8 | 14×13 | 48 su 169 | 324 / 160 | 124 / 71 | 22×10 / 29×10 | 506 / 0 |
| libero 1234 | verde | 8 | 36 | 24 | 77 | 3,8% | 288 | 20 | 48 | 1574 (78,1%) | 3 / 1,1 | 12×11 | 39 su 121 | 330 / 157 | 121 / 78 | 8×15 / 30×9 | 1333 / 0 |
| libero 1234 | industria | 11 | 42 | 37 | 133 | 6,6% | 217 | 20 | 48 | 1589 (78,8%) | 4 / 1,9 | 14×15 | 40 su 169 | 332 / 161 | 120 / 76 | 7×21 / 30×9 | 547 / 0 |
| libero 777 | verde | 9 | 36 | 27 | 89 | 4,4% | 200 | 19 | 26 | 1673 (83,0%) | 3 / 1,3 | 13×12 | 31 su 121 | 354 / 164 | 138 / 84 | 22×11 / 33×12 | 1392 / 0 |
| libero 777 | industria | 9 | 54 | 31 | 119 | 5,9% | 129 | 27 | 26 | 1706 (84,6%) | 4 / 1,6 | 15×13 | 51 su 169 | 374 / 176 | 148 / 88 | 10×26 / 33×12 | 474 / 0 |

"Liberi vicino al QG": caselle edificabili nel quadrato che arriva fino all'edificio più lontano. Edifici e Pop sono contati
nel momento in cui la Guglia viene piazzata.

**Mancanza di spazio o scelta di ammassare?** È una scelta. L'autopilota cerca il posto a spirale partendo dal QG, e
`play.mjs`, che gioca dall'interfaccia, fa lo stesso (i Dock partono dal mucchio di rottami più vicino). Così attorno al QG
resta libero solo il 9–58% delle caselle (per esempio 25 su 121 nella home industriale), mentre nel resto della mappa ne
restano 1500–1750 edificabili. Nessun tentativo fallisce perché non
c'è posto, nemmeno nel raggio di 21 caselle che l'autopilota esplora. A fine partita, con la Guglia completata, gli edifici
salgono a 83–189 caselle, ancora entro 3–5 caselle dal QG (ingombro fino a 17×15). Lo spazio "occupato" è soprattutto rottame
in attesa dei bot, non edifici.

Mappe testuali di ogni partita: `map/out/a/<città>-<percorso>-spire.txt` (alla Guglia) e `-end.txt` (fine).

## 4. (b) Città avanzata organizzata in isolati

**Avvertenza.** Per costruirla le risorse sono state **concesse**: crediti riportati ad almeno 100.000 e parti ad almeno
10.000 ogni secondo di gioco. È uno **studio dello spazio**: non dice nulla su bilanciamento, durata o difficoltà.

Mappa della prima città della campagna (Scrapbot City, seme 2026). Tutto è costruito con le regole del gioco:
`placeBuilding`, `placePiece`, `installModule`, `bulldozeRubble` (9 macerie tolte), `demolish` (un Giardino regalato da un
evento era finito su un lotto previsto e il giocatore lo demolisce). La simulazione costruisce, i bot raccolgono e la
popolazione cresce. Dopo la Guglia (giorno 5) si fa ciò che fa «Continua a costruire» (`outcome = null`) e si prosegue fino al
giorno 17. Resta in sospeso un solo pavimento, in (7,21), dove c'è un rottame che i bot non hanno ancora raggiunto.

```
   01234567890123456789012345678901234567890123456789012345
 0 j"..jjjj.j..jffffffffffffff..........#..................
 1 """jjjjjjj...fPP.PP.PP.PP.f.........##..OO.OO.OO.OO.....
 2 """j.jjjjj..jfPP"PP"PP.PP.f.............OO.OO.OO.OO.....
 3 """"jjjjj.jjjf."l"""".lj..f......===================....
 4 ""j.j.j.jj#jjfPP"gg"PP.PP.f......=DD=DD=RR=RR=SS=SS=....
 5 """....j#jjjjfPP"gg"PP"PP.f......=DD=DD=RR=RR=SS=SS=....
 6 "j""...jjjjjjf."""j"".""..f......===l=====l=====l===....
 7 """"....jjjjjfPP#PP"gg"PP.f......=DD=DD=RR=SS=XX=XX=....
 8 .""....jjjjjjfPP.PP"gg"PP.f......=DD=DD=RR=SS=XX=XX=#...
 9 .......jjjjjjf#.l.""""l"..f......===================....
10 ........jjjj.fPP.PP"PP"PP.f......=DD=DD=BB=FFFOO=OO=....
11 .....j..#.jj.fPP.PP.PP.PP.f......=DD=DD=BB=FFFOO=OO=....
12 ..........j..f............f......===l=====l=====l===....
13 ..j..........fffffffffGffff......=OO=OO=OO=FFFOO=OO=....
14 .........j.......................=OO=OO=OO=FFFOO=OO=....
15 .................................===================....
16 ........................................................
17 ...........................QQQ..........................
18 """""""""j..UU...#.........QQQ..........................
19 fffffffff"".UU.#...""""""""QQQ""........................
20 fg==g==gf"".....#.."""""""""""""........................
21 f=l===ljf""........""g=g=g=g=g"".UU.....................
22 f==ZZZ==f".........""========="".UU................#....
23 fg=ZZZ=gG".........""g=l===l=g""...UU..............##...
24 f==ZZZ==f".........""g=l===l=g""..#UU................jj.
25 f=l===l=f".........""=========""..#.................jj..
26 fg=jg==gf".........""g=g=g=g=g""...................jjj..
27 fffffffff"..j......""""""""""""#.#..................jjj.
28 """""""""".jjj.....""""""""""""#.#......#...............
29 .......j...jjj.......##.............#........#.........j
30 ....j......jjjj.....................~......#j.....jjj..j
31 ...........jjjjj.....................~##...#....j.j.jjjj
32 ........j..jjjjjj.................~.~...#.j........jjjjj
33 ...........jjjjjjjj................~~..............jjjjj
34 ...........jjjjjjjj.j.....................j.........jjjj
35 j......j..j.jjjjjj.....................j...j......jjjjjj
```

Legenda: Q QG · D Bot Dock · R Riciclatore · S Fonderia · X Lab Riparatutto · B Inceneritore · F Fabbrica 2PM ·
O Campo Solare · P Capsule Bot · g Giardino Pixel · U Purificatore · Z Guglia · = pavimento scoperto · f recinzione ·
G cancello · l lampione · j rottami · ~ melma · # macerie · " prato · . terreno.

Contenuto: 6 Bot Dock (tutti con deposito aggiuntivo), 3 Riciclatori, 3 Fonderie (tutte con filtro antismog), 2 Lab
Riparatutto, 1 Inceneritore, 2 Fabbriche 2PM, 11 Campi Solari, 14 Capsule Bot, 30 Giardini, 3 Purificatori, la Guglia e il QG.
Popolazione 84, smog 0%.

**Occupazione** (somma 2016):

| Edifici (QG compreso) | di cui con pavimento sotto | Recinzioni, cancelli, lampioni | Pavimento scoperto | Rottami | Melma | Macerie | Prato | Terreno | Edificabili ora |
|---|---|---|---|---|---|---|---|---|---|
| 232 (11,5%) | 131 (contati solo come edifici) | 102 (5,1%) | 203 (10,1%) | 177 (8,8%) | 6 | 31 | 157 | 1108 | **1468 (72,8%)** |

I rottami sono 177 (273 all'inizio): tempeste e spazzatura delle 14 Capsule Bot continuano a riempire le caselle libere, e
occupano più spazio degli oggetti posati.

**Per isolato:**

| Isolato | Rettangolo | Caselle | Edifici | Caselle di edifici | Oggetti solidi | Pavimento scoperto | Rottami | Macerie e melma | Libere |
|---|---|---|---|---|---|---|---|---|---|
| produzione | (33,0)–(51,15), 19×16 | 304 | 28 | 116 | 6 | 141 | 0 | 3 | 38 |
| abitazioni | (13,0)–(26,13), 14×14 | 196 | 22 | 64 | 56 | 0 | 2 | 2 | 72 |
| piazza/giardino | (20,20)–(37,27), 18×8 | 144 | 16 | 22 | 4 | 36 | 0 | 4 | 78 |
| monumento | (0,19)–(8,27), 9×9 | 81 | 9 | 17 | 36 | 26 | 2 | 0 | 0 |

C'è un terzo Purificatore in (12,18), tra le abitazioni e il monumento. La città occupa un ingombro di 50×26 caselle; il
monumento è l'isolato più lontano, a 25 caselle dal QG (in media 11,3).

**Spazio libero e aree contigue:**

| | Edificabili | Area contigua max | Rettangolo libero max | Quadrato max | Posizioni 2×2 | 2×2 affiancati / con strada | 3×2 affiancati / con strada | 3×3 affiancati / con strada |
|---|---|---|---|---|---|---|---|---|
| ora | 1468 | 1352 | 14×13 | 13 | 921 | 261 / 130 | 160 / 93 | 97 / 64 |
| senza rottami | 1645 | 1538 | 34×6 | 13 | 1164 | 315 / 149 | 205 / 112 | 127 / 80 |
| ripulita | 1682 | 1573 | 56×8 | 19 | 1267 | 331 / 157 | 216 / 116 | 141 / 84 |

**Quanti edifici in più ci stanno, per tipo** (ora / con strada; ripulita / con strada):

| Tipo | Ingombro | Ora | Ora, con strada | Ripulita | Ripulita, con strada |
|---|---|---|---|---|---|
| Bot Dock, Riciclatore, Fonderia, Campo Solare, Inceneritore, Capsule Bot, Lab Riparatutto, Purificatore | 2×2 | 261 | 130 | 331 | 157 |
| Fabbrica 2PM | 3×2 | 160 | 93 | 216 | 116 |
| Giardino Pixel | 1×1 | 1468 | 424 | 1682 | 465 |
| (Guglia: una sola per città) lotti 3×3 | 3×3 | 97 | 64 | 141 | 84 |

**Isolati interi in più** (rettangoli liberi non sovrapposti, in entrambi i versi):

| Dimensione | Inizio partita, ora | Inizio, senza rottami | Inizio, ripulita | Città a isolati, ora | Città a isolati, senza rottami | Città a isolati, ripulita |
|---|---|---|---|---|---|---|
| 19×16 (come la produzione) | 0 | 0 | 5 | 0 | 0 | 1 |
| 14×14 (come le abitazioni) | 0 | 2 | 7 | 0 | 0 | 1 |
| 18×8 (come la piazza) | 1 | 5 | 12 | 0 | 2 | 4 |
| 10×10 | 3 | 7 | 14 | 1 | 3 | 5 |
| 9×9 (come il monumento) | 4 | 10 | 22 | 1 | 3 | 9 |

Si esauriscono prima i grandi rettangoli puliti. Già a inizio partita le macerie sparse e i rottami li spezzano: nella mappa
di casa non c'è un rettangolo libero 14×14 finché i bot non raccolgono e la ruspa non toglie le macerie. Dopo la città a
isolati, e dopo aver ripulito, ci stanno ancora un isolato grande e uno medio, oppure cinque isolati 10×10. Il numero di
edifici non è un limite: con 130 lotti 2×2 con strada in più si può ancora più che raddoppiare la città.

Schermate (1280×800 e 1920×1080, italiano): `map/shots/overview-z1-1920x1080-it.png` (tutta la città a zoom 1),
`overview-z1-1280x800-it.png`, `block-produzione-*.png`, `block-abitazioni-*.png`, `block-piazzagiardino-*.png`,
`block-monumento-*.png`, `block-qg-*.png`. Salvataggio della città: `map/out/b/blocks-save.json`.

## 5. (c) Ingombro dell'interfaccia

Città a isolati, telecamera sul QG, zoom iniziale. La percentuale è la parte dello schermo coperta dall'unione dei pannelli,
campionata ogni 2 px. "Caselle visibili" sono le caselle della mappa con il centro sullo schermo e non sotto l'HUD.
Per questa misura crediti e parti della città sono riportati a cifre da partita (2.500 e 400): le risorse concesse per
costruirla (136.792 crediti e 10.000 parti, mostrati «136.9k» e «10.0k») allargano la barra in alto e a 1280 px la mandano
su due righe, cosa che con cifre normali non succede (vedi sotto).

| Finestra | Lingua | Zoom | Margine alto / basso (px) | Altezza libera | HUD di base (barra in alto · obiettivi · costruzione) | + scheda edificio | + catalogo | Caselle visibili (base / scheda / catalogo) |
|---|---|---|---|---|---|---|---|---|
| 1024×768 | it | 2 | 139 / 174 | 455 | **38,3%** (8,7 · 8,5 · 20,9) | 49,2% | 57,8% | 484 / 396 / 333 |
| 1024×768 | en | 2 | 139 / 174 | 455 | 37,2% (8,6 · 7,6 · 20,9) | 47,5% | 56,7% | 489 / 406 / 338 |
| 1280×720 | it | 2 | 74 / 193 | 453 | **39,7%** (7,5 · 7,2 · 25,2) | 49,0% | 56,6% | 551 / 449 / 386 |
| 1280×720 | en | 2 | 74 / 180 | 466 | 37,1% (7,3 · 6,5 · 23,5) | 45,9% | 54,5% | 581 / 478 / 405 |
| 1280×800 | it | 2 | 74 / 193 | 533 | **35,7%** (6,7 · 6,5 · 22,6) | 44,1% | 53,8% | 624 / 547 / 456 |
| 1280×800 | en | 2 | 74 / 180 | 546 | 33,4% (6,6 · 5,9 · 21,2) | 41,3% | 51,9% | 649 / 576 / 476 |
| 1920×1080 | it | 3 | 74 / 193 | 813 | **23,8%** (3,8 · 3,3 · 16,9) | 28,0% | 33,3% | 669 / 640 / 602 |
| 1920×1080 | en | 3 | 74 / 180 | 826 | 22,3% (3,7 · 2,9 · 15,8) | 26,2% | 31,5% | 672 / 665 / 623 |

- La barra di costruzione è il pannello più grande: 21–25% fino a 1280 px, 16–17% a 1920. In italiano è più alta di 13 px,
  perché nomi come «Giardino Pixel» vanno su due righe.
- La barra in alto va su due righe a 1024 px, in italiano e in inglese: il margine alto passa da 74 a 139 px. A 1280 px
  resta su una riga in entrambe le lingue con le cifre di una partita (le partite del bilanciamento arrivano al massimo a
  circa 1.500 crediti e 460 parti; provati anche 25.000 crediti con 10.000 parti). In italiano va su due righe solo da
  100.000 crediti in su (con almeno 1.000 parti) o da 100.000 parti, in inglese solo dal milione di crediti, come nella
  città costruita con le risorse concesse. La prima versione di questo studio aveva misurato l'italiano a 1280 px con
  quelle cifre e ne aveva dedotto 65 px di altezza in meno «in italiano»: era un effetto delle risorse concesse, non
  della lingua.
- La scheda degli obiettivi (in campagna «Obiettivi stella») resta in alto a sinistra e copre il 3–9%. A 1280×800, zoom 1,
  nasconde l'isolato del monumento nella vista d'insieme (8 edifici su 9 in italiano, 6 su 9 in inglese:
  `overview-z1-1280x800-it.png`).
- Lo spazio visibile è comunque ampio: 480–670 caselle libere alla vista iniziale, cioè un quarto o un terzo della mappa.

Schermate con i pannelli evidenziati in rosso: `map/shots/hud-base-<finestra>-<lingua>.png`, `hud-inspector-…`,
`hud-catalog-…`.

## 6. (d) Selezione e navigazione

### Selezione degli edifici con clic reali

Per ognuno dei 77 edifici, a ogni zoom da 1 a 5 e su ogni risoluzione: la telecamera si centra sull'edificio, si cerca il
pixel visibile più vicino al centro che il gioco attribuisce a quell'edificio e che non sia sotto l'HUD, poi si fa un clic
vero con Playwright e si controlla l'edificio selezionato.

| Finestra | Zoom 1 | Zoom 2 | Zoom 3 | Zoom 4 | Zoom 5 |
|---|---|---|---|---|---|
| 1024×768 | 76/77 | 76/77 | 76/77 | 76/77 | 76/77 |
| 1280×720 | 76/77 | 76/77 | 76/77 | 76/77 | 76/77 |
| 1280×800 | 76/77 | 76/77 | 76/77 | 76/77 | 76/77 |
| 1920×1080 | 76/77 | 76/77 | 76/77 | 76/77 | 76/77 |

L'unico che fallisce è sempre il **Giardino in (1,20)**: è sulla diagonale dietro la Guglia e non ha nessun pixel cliccabile
(§9.1).

Area cliccabile a 1280×800, come lato del quadrato equivalente in px CSS (minimo / mediana):

| Tipo | Zoom 1 | Zoom 2 | Zoom 3 | Zoom 5 |
|---|---|---|---|---|
| Giardino Pixel | 0 (quello nascosto) / 25 | 0 / 49 | 0 / 75 | 0 / 123 |
| Campo Solare | 33 / 40 | 67 / 80 | 100 / 120 | 167 / 201 |
| Riciclatore | 41 / 45 | 82 / 90 | 124 / 135 | 206 / 225 |
| Bot Dock | 42 / 46 | 84 / 92 | 126 / 138 | 210 / 230 |
| Capsule Bot | 47 / 50 | 94 / 101 | 141 / 151 | 235 / 251 |
| Fabbrica 2PM | 52 / 56 | 104 / 113 | 156 / 169 | 259 / 282 |
| QG | 72 | 144 | 215 | 359 |
| Guglia | 86 | 173 | 259 | 431 |

**Chi può nascondere chi.** Su un'area sgombra, ogni tipo di edificio viene messo davanti e un Giardino (1×1) o una Capsule Bot
(2×2) prova tutte le posizioni dietro di esso, fino a 4 caselle (script `map/occlusion.mjs`):

| Davanti | Giardino nascosto | Capsule Bot nascoste | Area minima che resta visibile (pixel d'arte, zoom 2) |
|---|---|---|---|
| Guglia | **4 posizioni su 40** (diagonale −1,−1 … −4,−4) | 0 su 27 | Giardino 27, Capsule 415 |
| Fabbrica, Lab, Purificatore, Fonderia, Inceneritore, Riciclatore, Dock, Capsule, Solare, Giardino | 0 | 0 | Giardino ≥ 39, Capsule ≥ 1491 |

Solo la Guglia nasconde del tutto un edificio, e solo un 1×1 su quella diagonale. Gli altri lasciano sempre almeno 39 pixel
d'arte (circa 12×12 px a zoom 2): piccoli, ma si cliccano.

**Recinzioni, cancelli e lampioni** (`map/piece-click.mjs`, 1280×800): ne vengono selezionati con un clic 82 su 102, sia a
zoom 2 sia a zoom 4. I 20 che restano sono tutti dietro un edificio:
- 11 recinzioni sui lati nord e ovest delle abitazioni, dietro le Capsule Bot;
- 3 lampioni negli incroci a nord-ovest delle Capsule;
- 3 lampioni della produzione (42,6; 48,6; 42,12), dietro Fonderia, Lab e Fabbrica;
- 2 recinzioni e un lampione del monumento, dietro la Guglia.

La ruspa li toglie comunque: un clic sulla casella del lampione (22,3), nascosto, lo rimuove, come prevede `session.click`.
Non si possono però né ruotare né spostare (§9.2).

### Navigazione: quanto si sposta la telecamera

Dalla vista iniziale (QG al centro della zona libera) fino a portare al centro ciascun isolato. Distanza in px CSS, tempo
con le frecce (`PAN_SPEED` 260 px/s per asse, in diagonale tutti e due gli assi) e schermate (lo spostamento diviso per la
larghezza, o per l'altezza libera). Tra parentesi gli edifici dell'isolato già visibili e fuori dall'HUD senza muoversi.
Misure in italiano, con crediti e parti a cifre da partita come al §5.

| Finestra · zoom | Produzione (28) | Abitazioni (22) | Piazza (16) | Monumento (9) |
|---|---|---|---|---|
| 1280×800 · 2 (iniziale) | 786 px · 3,0 s · 0,61 (6 visibili) | 334 px · 1,2 s · 0,60 (8) | 187 px · 0,6 s · 0,18 (15) | 977 px · 3,6 s · 0,72 (0) |
| 1280×800 · 1 | 393 px · 1,5 s (28) | 167 px · 0,6 s (22) | 93 px (16) | 488 px · 1,8 s (0: sotto la scheda obiettivi) |
| 1280×800 · 5 | 1965 px · 7,5 s · 1,53 | 835 px · 3,1 s · 1,50 | 466 px · 1,5 s · 0,45 | 2441 px · 8,9 s · 1,81 |
| 1920×1080 · 3 (iniziale) | 1179 px · 4,5 s · 0,61 (6) | 501 px · 1,8 s · 0,59 (8) | 280 px · 0,9 s · 0,18 (16) | 1465 px · 5,4 s · 0,72 (0) |
| 1920×1080 · 1 | tutta visibile | tutta visibile | tutta visibile | tutta visibile |
| 1024×768 · 2 (iniziale) | 786 px · 3,0 s · 0,77 (3) | 334 px · 1,2 s · 0,70 (8) | 187 px · 0,6 s · 0,21 (16) | 977 px · 3,6 s · 0,91 (0) |

Allo zoom iniziale ogni isolato è a meno di una schermata. Anche a zoom 5 servono al massimo 2,3 schermate o 9 s di frecce.
Il tasto H (o Home) riporta al QG. A 1920×1080, zoom 1, si vede tutta la città; a 1280×800, zoom 1, tutta tranne il
monumento, quasi tutto coperto dalla scheda obiettivi.

### Bordi

- `map/camera-check.mjs` dà 13/13 su 1024×768, 1280×720, 1280×800 e 1920×1080. Tutti e 4 gli angoli della mappa arrivano al
  centro dello schermo a ogni zoom da 1 a 5. Le frecce spostano la mappa finché ogni bordo arriva al centro. Il tasto sinistro
  non trascina la mappa, mentre destro, centrale e un dito la spostano esattamente quanto il trascinamento.
- `map/edge-access.mjs` dà PASS su tutte e 4 le risoluzioni:
  - lo scorrimento ai bordi (opzione attiva), con il puntatore a 1 px dal bordo, sposta la mappa nella direzione giusta da
    tutti gli 8 punti (4 lati e 4 angoli);
  - tenuto sul bordo ovest, sposta la mappa finché il bordo ovest della mappa arriva al centro;
  - dopo essere arrivati con le frecce verso ciascun angolo, un clic vero con il Giardino costruisce sulla casella libera più
    vicina all'angolo: (1,0), (55,0), (51,31), (0,35).
- Un dettaglio senza conseguenze: sotto i pannelli della barra in alto la fascia che fa scorrere è di 10 px invece di 14,
  perché lì il puntatore è sopra l'HUD. A 1 px dal bordo, dove si ferma il mouse a schermo intero, funziona ovunque.

Schermate: `map/shots/edge-<angolo>-<finestra>.png`, `start-<finestra>-<lingua>.png`.

## 7. Interventi su inquadratura, pan e bordi

**Nessuno.** Le misure non mostrano un problema concreto:
- **inquadratura iniziale**: QG al centro della zona libera dall'HUD, a zoom 2 o 3. A inizio partita la città è lì. In una
  città grande l'isolato più lontano è a 0,6–0,9 schermate;
- **pan**: tastiera, trascinamento (tasto destro o centrale), dito e scorrimento ai bordi raggiungono ogni angolo a ogni zoom;
- **accessibilità dei bordi**: si costruisce e si seleziona anche sulle caselle d'angolo;
- **vista d'insieme**: a zoom 1 si vede quasi tutta la città già a 1280×800. Uno zoom frazionario sotto 1 sfocherebbe la
  pixel art, che il renderer disegna a pixel interi. Non serve.

Nessun file del gioco è stato toccato, quindi non c'è un prima/dopo.

## 8. Conclusione: la mappa attuale basta

Non è emerso nessun limite concreto di spazio, quindi **non si propone una mappa più grande**. Le ragioni:
1. Una città normale arriva alla Guglia usando meno del 7% della mappa e lascia oltre tre quarti delle caselle edificabili.
   Nessun tentativo di costruzione è fallito per spazio.
2. Una città avanzata, con circa il doppio degli edifici di una normale (76 contro 21–39 alla Guglia e 27–52 a fine partita)
   e tutti i 6 oggetti dell'incremento 1, lascia il 73% della mappa edificabile e posto per altri 130 lotti 2×2 con strada.
3. Le città restano vicine al QG per scelta, non per mancanza di posto.
4. I 18 elementi nuovi dell'incremento 2 sono tutti 1×1 (`docs/MODULAR-INC2.md` §3 e §3b), e la «mappa più grande» è già
   fuori dal perimetro (§ iniziale).
5. A finire per primi sono i grandi rettangoli puliti: dopo la città a isolati, uno da 19×16 e uno da 14×14, oppure cinque da
   10×10, e solo dopo aver tolto macerie e rottami. Nessun obiettivo del gioco richiede isolati così grandi o così tanti, e se
   un giocatore volesse farlo la soluzione sta nel gioco: ripulire le macerie con la ruspa.

**Se un giorno si riapre la questione** (questa non è una proposta). Varrebbe solo per nuove partite libere: le città salvate
e la campagna restano 56×36. Il salvataggio dovrebbe registrare le dimensioni e tutti i salvataggi esistenti dovrebbero
continuare a caricarsi come 56×36, perché oggi `deserialize` rifiuta mappe di altre dimensioni. Andrebbero rivisti anche i
punti che usano `MAP_W`/`MAP_H` come costanti: cache del terreno e array del renderer, generazione, telecamera, scenario.
Prima di approvare servirebbero misure di prestazioni su Steam Deck.

## 9. Problemi trovati (selezione; fuori dal perimetro di questo studio)

Non riguardano le dimensioni della mappa e non li ho corretti: la selezione passa da `pickBuilding` e `session.click`,
cioè renderer e sessione. Vanno approvati a parte.

1. **Un 1×1 sulla diagonale dietro la Guglia non si seleziona con nessun clic.** Riproduzione: Giardino in (1,20), Guglia in
   (3,22); succede in ogni posizione da (−1,−1) a (−4,−4) rispetto all'angolo nord della Guglia. Con la ruspa in mano la
   Guglia viene disegnata trasparente e il Giardino si vede (`map/shots/bulldozer-hover-garden.png`), ma il clic seleziona
   la Guglia, per cui il Giardino non si può nemmeno demolire. Correzione minima proposta: con la ruspa, se la casella sotto
   il puntatore appartiene a un altro edificio, selezionare quello. È l'edificio che la ruspa mostra attraverso quello
   trasparente, e la ruspa fa già così con macerie e oggetti solidi.
2. **Oggetti solidi dietro un edificio non si selezionano** (20 su 102 nella città a isolati). La ruspa li toglie, ma non si
   possono ruotare, e con l'incremento 2 non si potranno spostare: «Sposta» (§3c di MODULAR-INC2) parte dal pannello
   dell'oggetto. Proposta: un secondo clic nello stesso punto passa a ciò che c'è dietro, cioè all'oggetto sulla casella sotto
   il puntatore.
3. **Barra in alto su due righe.** A 1024 px succede in tutte e due le lingue e toglie 65 px di altezza libera (§5). A
   1280 px non succede con le cifre di una partita: solo da 100.000 crediti (in italiano) o da un milione (in inglese).
   Non è un problema della lingua e non serve una decisione per la mappa; se un giorno servisse, riguarda `hud.ts` e
   `style.css`, dove sta lavorando chi si occupa dell'HUD.

## 10. Riproducibilità

Tutto sta in `map/`. Gli script TypeScript si impacchettano con `esbuild … --alias:@w=<worktree>` e girano con
`inc2/core/seeded.mjs 42`:
- `src/space.ts`: conteggi, maschere, impacchettamento, rettangoli e componenti;
- `src/autopilot-probe.ts`: copia di `scripts/autopilot.ts` che registra perché fallisce un tentativo, senza usare
  `Math.random`;
- `src/runA.ts`: §3; risultati in `out/a/runA.json`;
- `src/runB.ts`: §4; risultati in `out/b/blocks.json` e `blocks-save.json`;
- `src/blockfit.ts`: isolati interi in più.

Gli script Playwright usano la build di debug `map/build-debug`:
- `ui.mjs <build> <LxA> <lingua> all`: §5 e §6 (`out/ui-*.json`);
- `camera-check.mjs`, `edge-access.mjs`, `occlusion.mjs`, `piece-click.mjs`, `bulldoze-hidden.mjs`, `oldsize.mjs`.

Numeri di gioco invariati: `map/nums.sh` sulla base 3c90dd8 e sul worktree dà file identici (`map/baseline-3c90dd8`).
