# Attese prima della Scrap Spire — misura, non riequilibrio

Versione misurata: 0.6.1 (nessun numero del gioco è stato cambiato per questa misura). Strumento: `npm run waits` (`scripts/wait-analysis.ts`).

## Come è misurato

- Gioca il **pilota automatico** del bilanciamento (`scripts/autopilot.ts`, lo stesso di `npm run balance`) in ognuna delle 5 città della campagna, sul percorso verde e su quello industriale, con una sequenza casuale fissa: ogni esecuzione dà gli stessi numeri.
- I tempi sono in **secondi di simulazione**. 1 giorno di gioco = 60 s. A velocità 1× un secondo reale è un secondo di gioco; a 3× (la velocità più alta) un secondo reale vale 3 s di gioco. Ogni durata è riportata anche in minuti reali a 1× e a 3×.
- **Attesa** = tratto in cui il pilota non piazza nulla. **Attesa consecutiva più lunga** = il tratto più lungo dall'inizio fino alla Guglia.
- **Fase di risparmio** = da quando la città ha 30 abitanti (la Guglia è sbloccata) ma non può ancora pagarla (1200 cr e 350 pezzi), fino a quando la piazza.
- **Cause**: durante la fase di risparmio, secondo per secondo: Riciclatori al lavoro, fermi senza rottami o senza corrente; magazzino dei rottami vuoto o pieno; energia sotto il fabbisogno; pezzi prodotti e pezzi consumati da Fix-It Lab e Fabbriche; quota di tempo in cui mancavano anche i crediti.
- **Alternative**: la città viene copiata all'inizio della fase di risparmio e rigiocata con la stessa fortuna, cambiando una sola mossa. Una mossa è «conveniente» qui se accorcia la fase di almeno 20 s di gioco.

## Limiti di questa misura

- Il pilota non è una persona: costruisce solo ciò che il suo piano prevede e poi aspetta. La quota di tempo «in attesa» (67–87% nei tratti di almeno 30 s) **non è confrontabile** con il dato del 15–20% citato prima, che usava un'altra definizione; descrive le priorità del pilota, non quello che farebbe un giocatore.
- Una sola sequenza casuale per città e percorso. Le differenze sotto i 20–30 s sono nel rumore.
- Nessuno dei sei oggetti modulari è incluso: la misura è sulla 0.6.1.

## Risultati

| Città — percorso | Guglia dopo | Attesa più lunga | Causa principale nella fase di risparmio | Alternative convenienti (stessa città, stesso istante) |
|---|---|---|---|---|
| Scrapbot City — verde | 565 s (9 min a 1×, 3 a 3×) | 215 s (4 min a 1×, 1 a 3×) | 2 Riciclatori sempre al lavoro; mancano i pezzi e, per il 72% del tempo, anche i crediti | +1 Riciclatore: −48 s per 50 cr |
| Rustbay — verde | 422 s (7 / 2 min) | 150 s (3 / 1 min) | 3 Riciclatori sempre al lavoro; crediti mancanti 62% | +1 Riciclatore −28 s; +2 −42 s |
| Neon Heights — verde | 782 s (13 / 4 min) | 577 s (10 / 3 min) | **mancano i crediti** (100% del tempo); magazzino rottami pieno 75%; nessun impianto trasforma i rottami in crediti | +1 Fonderia −250 s per 30 cr (ma inquina); +1 Fix-It Lab −110 s. +1 Riciclatore **peggiora** (+28 s) |
| Greenvale — verde | 848 s (14 / 5 min) | 614 s (10 / 3 min) | un solo Riciclatore, **energia sotto il fabbisogno** il 100% del tempo, magazzino pieno 79% | +1 Riciclatore −252 s; +2 −319 s; +1 Pannello solare −133 s |
| 2PM Company Town — verde | 574 s (10 / 3 min) | 392 s (7 / 2 min) | crediti mancanti 94%, energia sotto il fabbisogno 100%, magazzino pieno 80% | **nessuna** delle mosse provate accorcia di 20 s |
| Scrapbot City — industriale | 595 s (10 / 3 min) | 221 s (4 / 1 min) | Riciclatore **fermo senza rottami** 66% (Fonderie e Bruciatori usano gli stessi rottami); crediti mancanti 100% | +1 Riciclatore −149 s; +1 Fonderia −107 s; +1 Bot Dock −45 s |
| Rustbay — industriale | 639 s (11 / 4 min) | 264 s (4 / 1 min) | Riciclatore al lavoro 95%; **le Fabbriche consumano più pezzi di quanti ne produce** (532 contro 278) | +1 Riciclatore −99 s; +2 −129 s |
| Neon Heights — industriale | 557 s (9 / 3 min) | 285 s (5 / 2 min) | Riciclatore fermo senza rottami 43%; energia sotto il fabbisogno 95%; Fabbriche consumano 352 pezzi su 264 prodotti | +1 Riciclatore −58 s; fermare le Fabbriche −30 s; +1 Bot Dock −23 s |
| Greenvale — industriale | 722 s (12 / 4 min) | 309 s (5 / 2 min) | Riciclatore fermo senza rottami **78%** | +1 Riciclatore −117 s; fermare Fix-It Lab/Fabbriche −72 s |
| 2PM Company Town — industriale | 584 s (10 / 3 min) | 155 s (3 / 1 min) | Riciclatore al lavoro 95%; crediti mancanti 100% | +1 Riciclatore −78 s; +2 −116 s |

## Che cosa se ne ricava (dato annotato, nessun riequilibrio)

1. In tutte e 10 le partite l'attesa più lunga è la stessa: **il risparmio per la Guglia**. A 3× dura da 1 a 3 minuti reali; a 1× da 3 a 10 minuti.
2. La causa non è sempre la stessa. Nel verde di Neon Heights e Company Town mancano i **crediti**, non i pezzi: un Riciclatore in più non serve o peggiora. Nell'industriale il Riciclatore resta spesso **senza rottami** perché Fonderie e Bruciatori li usano prima. A Greenvale verde manca **energia**.
3. Nella maggior parte dei casi esiste una mossa conveniente con gli edifici di oggi (quasi sempre un Riciclatore da 50 cr). Che il pilota non la faccia è una scelta del pilota; se un giocatore non la vede, è un problema di **leggibilità**, non di durata. Il playtest lo dirà.
4. Company Town verde è l'unico caso in cui nessuna delle mosse provate aiuta: va guardato nel playtest prima di toccare numeri.
5. I sei oggetti modulari non sono pensati per riempire queste attese. In particolare il deposito del Bot Dock (+100 rottami) **non** accorcerebbe le attese dove il magazzino è pieno ma mancano i crediti (Neon, Greenvale, Company verde): lì il limite è un altro. Sarà rimisurato dopo l'incremento 1.

Domanda da fare al tester nei momenti di attesa: **«Che cosa volevi fare in quel momento, e cosa te lo impediva?»** (vedi `docs/PLAYTEST.md`).

## Uscita completa dello strumento

### Attesa prima della Guglia (pilota automatico, sequenza casuale fissa; nessun numero del gioco cambiato)
Tempi in secondi di simulazione; 1 giorno = 60 s; a velocità 3 un secondo reale vale 3 s di gioco.

#### Scrapbot City — percorso verde
Guglia piazzata dopo 565 s (9.4 giorni; 9 min a 1×, 3 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 6, in tutto 451 s (7.5 giorni; 8 min a 1×, 3 min a 3×) (80% del tempo).
Attesa consecutiva più lunga: 215 s (3.6 giorni; 4 min a 1×, 1 min a 3×), dal secondo 350, cioè il risparmio per la Guglia.
Fase di risparmio (da 366 s, 237 cr e 48 pezzi): 199 s (3.3 giorni; 3 min a 1×, 1 min a 3×).
Cause: Riciclatori (2) al lavoro 100% del tempo, fermi senza rottami 0%, senza corrente 0%; magazzino rottami vuoto 0%, pieno 0%; energia insufficiente 0%; pezzi prodotti 398, consumati da Fix-It Lab/Fabbriche 96; mancavano anche i crediti per 72% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 199 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 151 s | -48 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 158 s | -41 s |
| +1 Bot Dock subito (più bot, più rottami) | 40 cr, 10 pezzi | 221 s | +22 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 40 cr e 35 pezzi | 219 s | +20 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 30 cr, 0 pezzi | 183 s | -16 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 243 s | +44 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | 1 in pausa, meno crediti in entrata | 546 s | +347 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 199 s | 0 s |

#### Rustbay — percorso verde
Guglia piazzata dopo 422 s (7.0 giorni; 7 min a 1×, 2 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 4, in tutto 298 s (5.0 giorni; 5 min a 1×, 2 min a 3×) (71% del tempo).
Attesa consecutiva più lunga: 150 s (2.5 giorni; 3 min a 1×, 1 min a 3×), dal secondo 272, cioè il risparmio per la Guglia.
Fase di risparmio (da 276 s, 181 cr e 13 pezzi): 146 s (2.4 giorni; 2 min a 1×, 1 min a 3×).
Cause: Riciclatori (3) al lavoro 100% del tempo, fermi senza rottami 0%, senza corrente 0%; magazzino rottami vuoto 0%, pieno 23%; energia insufficiente 0%; pezzi prodotti 438, consumati da Fix-It Lab/Fabbriche 120; mancavano anche i crediti per 62% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 146 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 118 s | -28 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 104 s | -42 s |
| +1 Bot Dock subito (più bot, più rottami) | 40 cr, 10 pezzi | 168 s | +22 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 40 cr e 35 pezzi | 158 s | +12 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 30 cr, 0 pezzi | 134 s | -12 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 172 s | +26 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | 2 in pausa, meno crediti in entrata | 427 s | +281 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 140 s | -6 s |

#### Neon Heights — percorso verde
Guglia piazzata dopo 782 s (13.0 giorni; 13 min a 1×, 4 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 1, in tutto 577 s (9.6 giorni; 10 min a 1×, 3 min a 3×) (74% del tempo).
Attesa consecutiva più lunga: 577 s (9.6 giorni; 10 min a 1×, 3 min a 3×), dal secondo 205, cioè il risparmio per la Guglia.
Fase di risparmio (da 209 s, 128 cr e 7 pezzi): 573 s (9.6 giorni; 10 min a 1×, 3 min a 3×).
Cause: Riciclatori (1) al lavoro 100% del tempo, fermi senza rottami 0%, senza corrente 0%; magazzino rottami vuoto 0%, pieno 75%; energia insufficiente 0%; pezzi prodotti 574, consumati da Fix-It Lab/Fabbriche 0; mancavano anche i crediti per 100% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 573 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 601 s | +28 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 630 s | +57 s |
| +1 Bot Dock subito (più bot, più rottami) | non costruibile | 573 s | 0 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 40 cr e 35 pezzi | 596 s | +23 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 30 cr, 0 pezzi | 323 s | -250 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 463 s | -110 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | nessuno da fermare | 573 s | 0 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 573 s | 0 s |

#### Greenvale — percorso verde
Guglia piazzata dopo 848 s (14.1 giorni; 14 min a 1×, 5 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 4, in tutto 736 s (12.3 giorni; 12 min a 1×, 4 min a 3×) (87% del tempo).
Attesa consecutiva più lunga: 614 s (10.2 giorni; 10 min a 1×, 3 min a 3×), dal secondo 234, cioè il risparmio per la Guglia.
Fase di risparmio (da 244 s, 202 cr e 8 pezzi): 604 s (10.1 giorni; 10 min a 1×, 3 min a 3×).
Cause: Riciclatori (1) al lavoro 100% del tempo, fermi senza rottami 0%, senza corrente 0%; magazzino rottami vuoto 0%, pieno 79%; energia insufficiente 100%; pezzi prodotti 416, consumati da Fix-It Lab/Fabbriche 88; mancavano anche i crediti per 35% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 604 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 352 s | -252 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 285 s | -319 s |
| +1 Bot Dock subito (più bot, più rottami) | non costruibile | 604 s | 0 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 40 cr e 35 pezzi | 471 s | -133 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 45 cr, 0 pezzi | 613 s | +9 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 746 s | +142 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | 1 in pausa, meno crediti in entrata | 563 s | -41 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 553 s | -51 s |

#### 2PM Company Town — percorso verde
Guglia piazzata dopo 574 s (9.6 giorni; 10 min a 1×, 3 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 1, in tutto 392 s (6.5 giorni; 7 min a 1×, 2 min a 3×) (68% del tempo).
Attesa consecutiva più lunga: 392 s (6.5 giorni; 7 min a 1×, 2 min a 3×), dal secondo 182, cioè il risparmio per la Guglia.
Fase di risparmio (da 191 s, 261 cr e 8 pezzi): 383 s (6.4 giorni; 6 min a 1×, 2 min a 3×).
Cause: Riciclatori (1) al lavoro 100% del tempo, fermi senza rottami 0%, senza corrente 0%; magazzino rottami vuoto 0%, pieno 80%; energia insufficiente 100%; pezzi prodotti 352, consumati da Fix-It Lab/Fabbriche 0; mancavano anche i crediti per 94% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 383 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 384 s | +1 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 405 s | +22 s |
| +1 Bot Dock subito (più bot, più rottami) | non costruibile | 383 s | 0 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 40 cr e 35 pezzi | 382 s | -1 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 18 cr, 0 pezzi | 446 s | +63 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 556 s | +173 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | nessuno da fermare | 383 s | 0 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 383 s | 0 s |

#### Scrapbot City — percorso industriale
Guglia piazzata dopo 595 s (9.9 giorni; 10 min a 1×, 3 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 3, in tutto 418 s (7.0 giorni; 7 min a 1×, 2 min a 3×) (70% del tempo).
Attesa consecutiva più lunga: 221 s (3.7 giorni; 4 min a 1×, 1 min a 3×), dal secondo 218, cioè il risparmio per la Guglia.
Fase di risparmio (da 232 s, 881 cr e 35 pezzi): 363 s (6.1 giorni; 6 min a 1×, 2 min a 3×).
Cause: Riciclatori (1) al lavoro 34% del tempo, fermi senza rottami 66%, senza corrente 0%; magazzino rottami vuoto 65%, pieno 0%; energia insufficiente 10%; pezzi prodotti 274, consumati da Fix-It Lab/Fabbriche 0; mancavano anche i crediti per 100% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 363 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 214 s | -149 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 166 s | -197 s |
| +1 Bot Dock subito (più bot, più rottami) | 40 cr, 10 pezzi | 318 s | -45 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 30 cr e 5 pezzi | 363 s | 0 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 30 cr, 0 pezzi | 256 s | -107 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 500 s | +137 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | nessuno da fermare | 363 s | 0 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 363 s | 0 s |

#### Rustbay — percorso industriale
Guglia piazzata dopo 639 s (10.6 giorni; 11 min a 1×, 4 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 3, in tutto 428 s (7.1 giorni; 7 min a 1×, 2 min a 3×) (67% del tempo).
Attesa consecutiva più lunga: 264 s (4.4 giorni; 4 min a 1×, 1 min a 3×), dal secondo 375, cioè il risparmio per la Guglia.
Fase di risparmio (da 250 s, 883 cr e 35 pezzi): 345 s (5.8 giorni; 6 min a 1×, 2 min a 3×).
Cause: Riciclatori (1) al lavoro 95% del tempo, fermi senza rottami 5%, senza corrente 0%; magazzino rottami vuoto 5%, pieno 0%; energia insufficiente 24%; pezzi prodotti 278, consumati da Fix-It Lab/Fabbriche 532; mancavano anche i crediti per 100% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 345 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 246 s | -99 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 216 s | -129 s |
| +1 Bot Dock subito (più bot, più rottami) | 40 cr, 10 pezzi | 394 s | +49 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 30 cr e 5 pezzi | 374 s | +29 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 30 cr, 0 pezzi | 351 s | +6 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 467 s | +122 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | 3 in pausa, meno crediti in entrata | 343 s | -2 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 345 s | 0 s |

#### Neon Heights — percorso industriale
Guglia piazzata dopo 557 s (9.3 giorni; 9 min a 1×, 3 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 4, in tutto 385 s (6.4 giorni; 6 min a 1×, 2 min a 3×) (69% del tempo).
Attesa consecutiva più lunga: 285 s (4.8 giorni; 5 min a 1×, 2 min a 3×), dal secondo 272, cioè il risparmio per la Guglia.
Fase di risparmio (da 228 s, 1310 cr e 45 pezzi): 332 s (5.5 giorni; 6 min a 1×, 2 min a 3×).
Cause: Riciclatori (1) al lavoro 57% del tempo, fermi senza rottami 43%, senza corrente 0%; magazzino rottami vuoto 43%, pieno 0%; energia insufficiente 95%; pezzi prodotti 264, consumati da Fix-It Lab/Fabbriche 352; mancavano anche i crediti per 99% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 332 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 274 s | -58 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 245 s | -87 s |
| +1 Bot Dock subito (più bot, più rottami) | 40 cr, 10 pezzi | 309 s | -23 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 30 cr e 5 pezzi | 356 s | +24 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 30 cr, 0 pezzi | 340 s | +8 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 451 s | +119 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | 2 in pausa, meno crediti in entrata | 302 s | -30 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 332 s | 0 s |

#### Greenvale — percorso industriale
Guglia piazzata dopo 722 s (12.0 giorni; 12 min a 1×, 4 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 4, in tutto 560 s (9.3 giorni; 9 min a 1×, 3 min a 3×) (78% del tempo).
Attesa consecutiva più lunga: 309 s (5.1 giorni; 5 min a 1×, 2 min a 3×), dal secondo 413, cioè il risparmio per la Guglia.
Fase di risparmio (da 267 s, 920 cr e 8 pezzi): 455 s (7.6 giorni; 8 min a 1×, 3 min a 3×).
Cause: Riciclatori (1) al lavoro 22% del tempo, fermi senza rottami 78%, senza corrente 0%; magazzino rottami vuoto 78%, pieno 0%; energia insufficiente 22%; pezzi prodotti 276, consumati da Fix-It Lab/Fabbriche 270; mancavano anche i crediti per 100% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 455 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 338 s | -117 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 313 s | -142 s |
| +1 Bot Dock subito (più bot, più rottami) | non costruibile | 455 s | 0 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 30 cr e 5 pezzi | 458 s | +3 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 45 cr, 0 pezzi | 442 s | -13 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 572 s | +117 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | 1 in pausa, meno crediti in entrata | 383 s | -72 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 455 s | 0 s |

#### 2PM Company Town — percorso industriale
Guglia piazzata dopo 584 s (9.7 giorni; 10 min a 1×, 3 min a 3×).
Tratti di almeno 30 s senza piazzare nulla: 5, in tutto 434 s (7.2 giorni; 7 min a 1×, 2 min a 3×) (74% del tempo).
Attesa consecutiva più lunga: 155 s (2.6 giorni; 3 min a 1×, 1 min a 3×), dal secondo 278, cioè il risparmio per la Guglia.
Fase di risparmio (da 242 s, 937 cr e 18 pezzi): 342 s (5.7 giorni; 6 min a 1×, 2 min a 3×).
Cause: Riciclatori (1) al lavoro 95% del tempo, fermi senza rottami 5%, senza corrente 0%; magazzino rottami vuoto 4%, pieno 3%; energia insufficiente 28%; pezzi prodotti 318, consumati da Fix-It Lab/Fabbriche 206; mancavano anche i crediti per 100% del tempo.
| Mossa all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| aspettare (il pilota automatico) | — | 342 s | — |
| +1 Riciclatore subito | 50 cr, 0 pezzi | 264 s | -78 s |
| +2 Riciclatori subito | 2 costruiti, 100 cr, 0 pezzi | 226 s | -116 s |
| +1 Bot Dock subito (più bot, più rottami) | 40 cr, 10 pezzi | 338 s | -4 s |
| +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | 30 cr e 5 pezzi | 368 s | +26 s |
| +1 Fonderia subito (rottami in più → crediti, inquina) | 18 cr, 0 pezzi | 358 s | +16 s |
| +1 Fix-It Lab appena possibile (pezzi → crediti) | quando bastano 50 cr e 70 pezzi | 459 s | +117 s |
| fermare Fix-It Lab e Fabbriche (non consumano pezzi) | 1 in pausa, meno crediti in entrata | 327 s | -15 s |
| comprare pezzi da 2PM con i crediti in più | secondo necessità | 342 s | 0 s |

## 0.7: moduli e configurazioni

Versione misurata: 0.7.0-alpha.1 con gli otto moduli macchina (i due dell'incremento 1 e i sei dell'incremento 2,
`docs/MODULAR-INC2.md` §2). **Solo misura: nessun numero del gioco è stato cambiato.** Stesso strumento (`npm run waits`),
stesse città, stessa sequenza casuale: tutte le righe della 0.6.1 riportate sopra escono identiche, carattere per
carattere; le righe nuove sono aggiunte in coda a ogni tabella e in una sezione finale dell'uscita.

### Come è misurato (in più rispetto a sopra)

- **Moduli**: all'inizio della fase di risparmio (la stessa copia della città da cui partono le altre mosse) il modulo
  viene installato su ogni edificio compatibile già completato, pagandolo con le risorse della città, nell'ordine in cui
  la città li ha costruiti; poi il pilota gioca come sempre. «3 su 6» vuol dire che le risorse bastavano per 3 edifici
  su 6. «Non installabile» quando la città non ha quell'edificio completato o non può pagarne nemmeno uno: allora la
  partita è quella di «aspettare» e la riga lo dice soltanto.
- **Configurazioni comparabili** (definite anche nell'uscita dello strumento), con la stessa misura per tutte: secondi
  dall'inizio della fase di risparmio alla Guglia piazzata; «conveniente» = almeno 20 s prima di aspettare.
  - **Verde rigoroso**: città del percorso verde del pilota (Campo Solare, Giardini, Fix-It Lab, Purificatori più gli
    edifici neutri: Riciclatori, Bot Dock, Capsule Bot) con mosse solo verdi o neutre: nessuna Fonderia, Bruciatore o
    Fabbrica, nessun pezzo importato da 2PM; moduli solo su edifici verdi o neutri.
  - **Industriale**: città del percorso industriale del pilota (Fonderie, Bruciatori, Fabbriche, pezzi importati, più
    gli edifici neutri) con mosse industriali o neutre.
  - **Ibrido**: una città di un percorso con una mossa dell'altro (verde + Fonderia o pezzi importati; industriale +
    Fix-It Lab o Pannelli orientabili su un Campo Solare costruito dal pilota).
  - La «centrale» è del percorso della città (Campo Solare nel verde, Bruciatore nell'industriale); comprare pezzi da 2PM
    è una mossa industriale (ogni pacco sposta la città verso l'industria).

### Risultati: i moduli, città per città

Tempo della fase di risparmio rispetto ad aspettare (meno = Guglia prima; — = non installabile in quella città):

| Modulo | Scrapbot verde | Rustbay verde | Neon verde | Greenvale verde | Company verde | Scrapbot ind. | Rustbay ind. | Neon ind. | Greenvale ind. | Company ind. |
|---|---|---|---|---|---|---|---|---|---|---|
| Deposito aggiuntivo (Bot Dock) | +26 s | — | — | — | — | +19 s | +26 s | +35 s | — | +13 s |
| Filtro antismog (Fonderia) | — | — | — | — | — | **−76 s** | +2 s | +43 s | — | — |
| Separatore magnetico (Riciclatore) | **−35 s** | — | — | — | — | **−21 s** | **−27 s** | −8 s | — | +20 s |
| Selezionatore di precisione (Riciclatore) | +20 s | — | — | — | — | −16 s | +74 s | −11 s | — | +25 s |
| Braccio doppio (Fabbrica 2PM) | — | — | — | — | — | — | +78 s | +45 s | — | — |
| Capsula abitativa (Capsule Bot) | +23 s | — | — | — | — | +33 s | +76 s | +46 s | — | +71 s |
| Pannelli orientabili (Campo Solare) | +22 s | — | — | — | — | — | — | +42 s | — | — |
| Ugello esteso (Purificatore) | +17 s | — | — | — | — | — | — | — | — | — |

### Risultati: le configurazioni

| Città | Verde rigoroso: migliore mossa | Industriale: migliore mossa | Ibrido: migliore mossa |
|---|---|---|---|
| Scrapbot City | +1 Riciclatore −48 s (separatore magnetico −35 s) | +2 Riciclatori −197 s (filtro −76 s, separatore −21 s) | verde + Fonderia −16 s |
| Rustbay | +2 Riciclatori −42 s | +2 Riciclatori −129 s (separatore −27 s) | verde + Fonderia −12 s |
| Neon Heights | +1 Fix-It Lab −110 s | +2 Riciclatori −87 s | **verde + Fonderia −250 s** |
| Greenvale | +2 Riciclatori −319 s | +2 Riciclatori −142 s | verde + pezzi importati −51 s |
| 2PM Company Town | nessuna mossa conveniente (migliore −1 s) | +2 Riciclatori −116 s | nessuna conveniente |

Nelle città industriali le prove ibride (un Fix-It Lab; i pannelli orientabili a Neon Heights) peggiorano sempre, da
+42 a +137 s.

### Che cosa se ne ricava (misura, nessun ritocco)

1. **Nessun modulo domina**: nessuno accorcia l'attesa in tutte le città in cui si può installare, e nessuno batte la
   mossa migliore che esisteva già (quasi sempre un Riciclatore in più, 50 crediti).
2. **Moduli che in questa misura non aiutano mai**: Deposito aggiuntivo (0 città su 5, peggiora in 3), Selezionatore di
   precisione (0 su 5, peggiora in 3), Braccio doppio (0 su 2, peggiora in 2), Capsula abitativa (0 su 5, peggiora in
   5), Pannelli orientabili (0 su 2, peggiora in 2), Ugello esteso (0 su 1). Costano pezzi proprio quando mancano i pezzi
   della Guglia, e il loro guadagno (alloggi, energia, raggio, crediti al secondo consumando più pezzi) non è quello che
   manca in quel momento. Il braccio doppio, in particolare, consuma pezzi più in fretta: nella fase di risparmio è il
   contrario di ciò che serve.
3. **Il separatore magnetico è l'unico che aiuta più volte** (−35, −21, −27 s in 3 città su 5), perché aumenta i pezzi
   al secondo quando i Riciclatori hanno rottami; a 2PM Company Town industriale peggiora (+20 s, al limite del rumore)
   con l'energia già sotto il fabbisogno per il 28% del tempo. Il selezionatore aiuta un poco solo dove i Riciclatori
   restano senza rottami (Scrapbot e Neon industriali, −16 e −11 s: sotto la soglia).
4. **Il filtro antismog** accorcia di 76 s Scrapbot City industriale e allunga di 43 s Neon Heights industriale. Il
   filtro non cambia la produzione; la spiegazione più probabile (non verificata qui) è il pilota, che nel risparmio
   mette in pausa Fonderie e Bruciatori sopra il 60% di smog: con meno smog restano accese più a lungo, oppure no.
5. **Nelle città verdi i moduli quasi non si possono comprare all'inizio del risparmio**: in 4 città verdi su 5 nessun
   modulo è installabile (7–13 pezzi in cassa contro i 15–40 pezzi di un modulo; lo stesso a Greenvale industriale, 8
   pezzi). Non è un difetto da correggere qui:
   i moduli si comprano prima, quando la città ha pezzi; questa misura guarda solo il risparmio per la Guglia.
6. Le conclusioni della 0.6.1 restano: la mossa che conviene dipende da che cosa manca (pezzi, crediti, rottami,
   energia), e i consigli di USA-9 ora la seguono (niente deposito quando mancano crediti, niente Riciclatore senza
   energia e rottami: `src/game/hints.ts`).

Limiti: una sola sequenza casuale per città e percorso (sotto i 20–30 s è rumore); il pilota non è una persona e compra
i moduli nel momento peggiore per la Guglia; si misura solo la fase di risparmio, non a che cosa servono i moduli nel
resto della partita (spazio risparmiato con la capsula, sludge lontana con l'ugello, energia senza nuovi edifici con i
pannelli). Eventuali ritocchi economici si propongono a parte, con dati prima/dopo.

### Uscita dello strumento: le righe nuove

#### Scrapbot City — percorso verde
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | 3×, 90 cr, 45 pezzi | 225 s | +26 s |
| modulo Filtro antismog su ogni Fonderia (0.7) | non installabile (nessuna Fonderia completata) | — | — |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | 2×, 80 cr, 30 pezzi | 164 s | -35 s |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | 2×, 80 cr, 30 pezzi | 219 s | +20 s |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | non installabile (nessuna Fabbrica 2PM completata) | — | — |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | 3 su 6, 105 cr, 45 pezzi | 222 s | +23 s |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | 1 su 4, 60 cr, 40 pezzi | 221 s | +22 s |
| modulo Ugello esteso su ogni Purificatore (0.7) | 1×, 50 cr, 30 pezzi | 216 s | +17 s |

#### Rustbay — percorso verde
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Filtro antismog su ogni Fonderia (0.7) | non installabile (nessuna Fonderia completata) | — | — |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | non installabile (nessuna Fabbrica 2PM completata) | — | — |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (nessun Purificatore completato) | — | — |

#### Neon Heights — percorso verde
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Filtro antismog su ogni Fonderia (0.7) | non installabile (nessuna Fonderia completata) | — | — |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | non installabile (nessuna Fabbrica 2PM completata) | — | — |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (risorse insufficienti) | — | — |

#### Greenvale — percorso verde
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Filtro antismog su ogni Fonderia (0.7) | non installabile (nessuna Fonderia completata) | — | — |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | non installabile (nessuna Fabbrica 2PM completata) | — | — |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (risorse insufficienti) | — | — |

#### 2PM Company Town — percorso verde
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Filtro antismog su ogni Fonderia (0.7) | non installabile (nessuna Fonderia completata) | — | — |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | non installabile (nessuna Fabbrica 2PM completata) | — | — |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (nessun Purificatore completato) | — | — |

#### Scrapbot City — percorso industriale
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | 2 su 6, 60 cr, 30 pezzi | 382 s | +19 s |
| modulo Filtro antismog su ogni Fonderia (0.7) | 1 su 3, 45 cr, 20 pezzi | 287 s | -76 s |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | 1×, 40 cr, 15 pezzi | 342 s | -21 s |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | 1×, 40 cr, 15 pezzi | 347 s | -16 s |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | non installabile (nessuna Fabbrica 2PM completata) | — | — |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | 2 su 7, 70 cr, 30 pezzi | 396 s | +33 s |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | non installabile (nessun Campo Solare completato) | — | — |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (nessun Purificatore completato) | — | — |

#### Rustbay — percorso industriale
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | 2 su 6, 60 cr, 30 pezzi | 371 s | +26 s |
| modulo Filtro antismog su ogni Fonderia (0.7) | 1 su 3, 45 cr, 20 pezzi | 347 s | +2 s |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | 1×, 40 cr, 15 pezzi | 318 s | -27 s |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | 1×, 40 cr, 15 pezzi | 419 s | +74 s |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | 1 su 3, 90 cr, 30 pezzi | 423 s | +78 s |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | 2 su 8, 70 cr, 30 pezzi | 421 s | +76 s |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | non installabile (nessun Campo Solare completato) | — | — |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (nessun Purificatore completato) | — | — |

#### Neon Heights — percorso industriale
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | 3 su 6, 90 cr, 45 pezzi | 367 s | +35 s |
| modulo Filtro antismog su ogni Fonderia (0.7) | 2 su 3, 90 cr, 40 pezzi | 375 s | +43 s |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | 1×, 40 cr, 15 pezzi | 324 s | -8 s |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | 1×, 40 cr, 15 pezzi | 321 s | -11 s |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | 1 su 2, 90 cr, 30 pezzi | 377 s | +45 s |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | 3 su 7, 105 cr, 45 pezzi | 378 s | +46 s |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | 1 su 2, 60 cr, 40 pezzi | 374 s | +42 s |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (nessun Purificatore completato) | — | — |

#### Greenvale — percorso industriale
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Filtro antismog su ogni Fonderia (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (nessun Purificatore completato) | — | — |

#### 2PM Company Town — percorso industriale
| Modulo installato all'inizio del risparmio | Costo | Guglia piazzata dopo | Rispetto ad aspettare |
|---|---|---|---|
| modulo Deposito aggiuntivo su ogni Bot Dock (0.7) | 1 su 6, 30 cr, 15 pezzi | 355 s | +13 s |
| modulo Filtro antismog su ogni Fonderia (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Separatore magnetico su ogni Riciclatore (0.7) | 1×, 40 cr, 15 pezzi | 362 s | +20 s |
| modulo Selezionatore di precisione su ogni Riciclatore (0.7) | 1×, 40 cr, 15 pezzi | 367 s | +25 s |
| modulo Braccio doppio su ogni Fabbrica 2PM (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Capsula abitativa su ogni Capsule Bot (0.7) | 1 su 8, 35 cr, 15 pezzi | 413 s | +71 s |
| modulo Pannelli orientabili su ogni Campo Solare (0.7) | non installabile (risorse insufficienti) | — | — |
| modulo Ugello esteso su ogni Purificatore (0.7) | non installabile (nessun Purificatore completato) | — | — |

Definizioni comparabili, uguali per tutte le città:
- **Misura**: secondi dall'inizio della fase di risparmio alla Guglia piazzata, sulla stessa copia della città e con la stessa sequenza casuale; una mossa è «conveniente» se arriva almeno 20 s prima di aspettare (sotto i 20–30 s è rumore).
- **Verde rigoroso**: città del percorso verde del pilota (Campo Solare, Giardini, Fix-It Lab, Purificatori, più gli edifici neutri: Riciclatori, Bot Dock, Capsule Bot) con mosse solo verdi o neutre: nessuna Fonderia, Bruciatore o Fabbrica, nessun pezzo importato da 2PM; moduli solo su edifici verdi o neutri.
- **Industriale**: città del percorso industriale del pilota (Fonderie, Bruciatori, Fabbriche, pezzi importati da 2PM, più gli edifici neutri) con mosse industriali o neutre.
- **Ibrido**: una città di un percorso con una mossa dell'altro (verde + Fonderia o pezzi importati; industriale + Fix-It Lab).
- **Moduli**: installati all'inizio della fase di risparmio su ogni edificio compatibile già completato, pagandoli con le risorse della città; «non installabile» quando la città non ha quell'edificio completato o non può pagarlo (la partita resta quella di «aspettare»).

#### verde rigoroso
| Città — percorso | Mosse provate | Migliore mossa | Rispetto ad aspettare | Mosse convenienti (≥ 20 s) |
|---|---|---|---|---|
| Scrapbot City — verde | 12 | +1 Riciclatore subito | -48 s | +1 Riciclatore subito -48 s; +2 Riciclatori subito -41 s; Separatore magnetico -35 s |
| Rustbay — verde | 6 | +2 Riciclatori subito | -42 s | +1 Riciclatore subito -28 s; +2 Riciclatori subito -42 s |
| Neon Heights — verde | 6 | +1 Fix-It Lab appena possibile (pezzi → crediti) | -110 s | +1 Fix-It Lab appena possibile (pezzi → crediti) -110 s |
| Greenvale — verde | 6 | +2 Riciclatori subito | -319 s | +1 Riciclatore subito -252 s; +2 Riciclatori subito -319 s; +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) -133 s; fermare Fix-It Lab e Fabbriche (non consumano pezzi) -41 s |
| 2PM Company Town — verde | 6 | +1 centrale appena possibile (Pannello solare nel verde, Bruciatore nell'industriale) | -1 s | nessuna |

#### industriale
| Città — percorso | Mosse provate | Migliore mossa | Rispetto ad aspettare | Mosse convenienti (≥ 20 s) |
|---|---|---|---|---|
| Scrapbot City — industriale | 12 | +2 Riciclatori subito | -197 s | +1 Riciclatore subito -149 s; +2 Riciclatori subito -197 s; +1 Bot Dock subito (più bot, più rottami) -45 s; +1 Fonderia subito (rottami in più → crediti, inquina) -107 s; Filtro antismog -76 s; Separatore magnetico -21 s |
| Rustbay — industriale | 13 | +2 Riciclatori subito | -129 s | +1 Riciclatore subito -99 s; +2 Riciclatori subito -129 s; Separatore magnetico -27 s |
| Neon Heights — industriale | 13 | +2 Riciclatori subito | -87 s | +1 Riciclatore subito -58 s; +2 Riciclatori subito -87 s; +1 Bot Dock subito (più bot, più rottami) -23 s; fermare Fix-It Lab e Fabbriche (non consumano pezzi) -30 s |
| Greenvale — industriale | 7 | +2 Riciclatori subito | -142 s | +1 Riciclatore subito -117 s; +2 Riciclatori subito -142 s; fermare Fix-It Lab e Fabbriche (non consumano pezzi) -72 s |
| 2PM Company Town — industriale | 11 | +2 Riciclatori subito | -116 s | +1 Riciclatore subito -78 s; +2 Riciclatori subito -116 s |

#### ibrido
| Città — percorso | Mosse provate | Migliore mossa | Rispetto ad aspettare | Mosse convenienti (≥ 20 s) |
|---|---|---|---|---|
| Scrapbot City — verde | 2 | +1 Fonderia subito (rottami in più → crediti, inquina) | -16 s | nessuna |
| Rustbay — verde | 2 | +1 Fonderia subito (rottami in più → crediti, inquina) | -12 s | nessuna |
| Neon Heights — verde | 2 | +1 Fonderia subito (rottami in più → crediti, inquina) | -250 s | +1 Fonderia subito (rottami in più → crediti, inquina) -250 s |
| Greenvale — verde | 2 | comprare pezzi da 2PM con i crediti in più | -51 s | comprare pezzi da 2PM con i crediti in più -51 s |
| 2PM Company Town — verde | 2 | comprare pezzi da 2PM con i crediti in più | 0 s | nessuna |
| Scrapbot City — industriale | 1 | +1 Fix-It Lab appena possibile (pezzi → crediti) | +137 s | nessuna |
| Rustbay — industriale | 1 | +1 Fix-It Lab appena possibile (pezzi → crediti) | +122 s | nessuna |
| Neon Heights — industriale | 2 | modulo Pannelli orientabili | +42 s | nessuna |
| Greenvale — industriale | 1 | +1 Fix-It Lab appena possibile (pezzi → crediti) | +117 s | nessuna |
| 2PM Company Town — industriale | 1 | +1 Fix-It Lab appena possibile (pezzi → crediti) | +117 s | nessuna |

#### Moduli, città per città (rispetto ad aspettare; — = non installabile)
| Modulo | Scrapbot City verde | Rustbay verde | Neon Heights verde | Greenvale verde | 2PM Company Town verde | Scrapbot City industriale | Rustbay industriale | Neon Heights industriale | Greenvale industriale | 2PM Company Town industriale | Aiuta (≥ 20 s) / peggiora (≥ 20 s) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Deposito aggiuntivo (Bot Dock) | +26 s | — | — | — | — | +19 s | +26 s | +35 s | — | +13 s | 0 / 3 su 5 installabili |
| Filtro antismog (Fonderia) | — | — | — | — | — | -76 s | +2 s | +43 s | — | — | 1 / 1 su 3 installabili |
| Separatore magnetico (Riciclatore) | -35 s | — | — | — | — | -21 s | -27 s | -8 s | — | +20 s | 3 / 1 su 5 installabili |
| Selezionatore di precisione (Riciclatore) | +20 s | — | — | — | — | -16 s | +74 s | -11 s | — | +25 s | 0 / 3 su 5 installabili |
| Braccio doppio (Fabbrica 2PM) | — | — | — | — | — | — | +78 s | +45 s | — | — | 0 / 2 su 2 installabili |
| Capsula abitativa (Capsule Bot) | +23 s | — | — | — | — | +33 s | +76 s | +46 s | — | +71 s | 0 / 5 su 5 installabili |
| Pannelli orientabili (Campo Solare) | +22 s | — | — | — | — | — | — | +42 s | — | — | 0 / 2 su 2 installabili |
| Ugello esteso (Purificatore) | +17 s | — | — | — | — | — | — | — | — | — | 0 / 0 su 1 installabili |

