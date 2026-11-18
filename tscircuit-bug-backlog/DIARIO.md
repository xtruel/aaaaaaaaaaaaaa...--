# Diario contributi tscircuit

Registro di tutto il lavoro di correzione bug su tscircuit: PR aperte, stato, decisioni, prossimi passi.
Aggiornato via via. Ultimo aggiornamento: **18 novembre 2026**.

---

## 1. Come funziona il pagamento

- tscircuit sponsorizza ogni mese chi contribuisce, in base alle **PR accettate (merged)** su qualsiasi repo dell'organizzazione.
- Un'AI assegna a ogni PR da 1 a 3 stelle. Si calcola un punteggio per settimana (mercoledì–martedì) e il pagamento si basa sulla **mediana** delle settimane del mese.
- Importi tipici (ottobre 2026, file pubblico `tscircuit/contribution-tracker/sponsorships/2026-10.csv`): 30 $, 75 $, 250 $ (la maggior parte), 750 $, 1100 $, 2000 $ (i più costanti).
- Le PR chiuse senza merge **non contano**.
- Il pagamento passa da **Open Collective** (collettivo *tscircuit Contributors*), con bonifico in USD, valuta "Outside of the US" e SWIFT/BIC della tua banca.
  - Profilo: https://opencollective.com/xtruel
  - I dati bancari vanno inseriti **solo** nei moduli privati di Open Collective, quando arriva l'invito a compilare l'"expense". Mai su GitHub o su Discord.

## 2. Regole importanti scoperte

- **Stale bot.** Su **circuit-to-svg**, **core** e **schematic-symbols** un bot segna come inattiva una PR dopo **2 giorni senza attività** e la **chiude 1 giorno dopo**. Su footprinter, circuit-json-to-kicad ed easyeda-converter il bot non c'è.
- I maintainer **non revisionano le PR di chi non conoscono**. I contributori pagati lavorano nel Discord: https://tscircuit.com/join
- Ogni PR deve dichiarare l'aiuto dell'AI. Lo facciamo già.
- Il repo contiene già molte PR generate con l'AI: per questo contano qualità, test e presenza su Discord.

## 3. Stato delle PR (al 18/11/2026)

| Repo | PR | Bug | Stato |
|---|---|---|---|
| circuit-to-svg | #933 | testo delle note fuori dall'inquadratura | ❌ chiusa dal bot il 18/11, nessuna revisione |
| circuit-to-svg | #934 | etichette debug invisibili | ❌ chiusa dal bot il 18/11 |
| circuit-to-svg | #937 | rotazione gradi/radianti nello schema | ❌ chiusa dal bot il 18/11 |
| circuit-to-svg | #938 | asole (cutout path) | ❌ chiusa dal bot il 18/11 |
| footprinter | #1013 | pin VSON specchiati | 🟢 aperta, nessuna revisione |
| footprinter | #1014 | pin SOT-89-5 sbagliati | 🟢 aperta |
| footprinter | #1015 | passo SOT-23-8 | 🟢 aperta |
| footprinter | #1016 | passo DPAK/D2PAK a 5 piedini | 🟢 aperta |
| circuit-json-to-kicad | #915 | maschera sui fori passanti | 🟢 aperta, revisori: MustafaMulla29, ShiboSoftwareDev |
| circuit-json-to-kicad | #918 | rettangoli di serigrafia della scheda | 🟢 aperta |
| schematic-symbols | #519 | diodo a valanga con polarità invertita | 🟡 aperta, **a rischio stale bot** |
| easyeda-converter | #657 | dimensione dei testi EasyEDA | 🟢 aperta |
| contribution-tracker | #405 | registrazione profilo Open Collective | 🟢 aperta |

**Accettate: 0. Pagamenti: 0.**

## 4. Branch pronti sui fork (PR non ancora aperte)

| Fork | Branch | Bug | Repo con stale bot? |
|---|---|---|---|
| xtruel/circuit-json-to-kicad | fix/library-footprint-rotated-pads | libreria KiCad con componenti ruotati | no → **si può aprire ora** |
| xtruel/core | fix/coppertext-bottom-layer | testo in rame non va sul retro | sì → aspettare Discord |
| xtruel/core | fix/battery-voltage | tensione della batteria persa | sì |
| xtruel/core | fix/pinheader-right-angle | prop rightAngle ignorata | sì |
| xtruel/core | fix/pinheader-hole-diameter-without-pitch | pinheader senza piazzole | sì |
| xtruel/circuit-to-svg | fix/sch-table-edge-anchors | ancore delle tabelle | sì |
| xtruel/circuit-to-svg | fix/sch-color-overrides | colori personalizzati ignorati | sì |
| xtruel/circuit-to-svg | fix/pcb-fab-note-dimension-overlay | quote sotto i fori | sì |
| xtruel/circuit-to-svg | fix/pcb-inner-layer-trace-soldermask-color | piste interne "undefined" | sì |
| xtruel/schematic-symbols | fix/mosfet-depletion-vert-size | MOSFET verticale | sì |
| xtruel/schematic-symbols | fix/battery-vertical-size | batteria verticale | sì |
| xtruel/easyeda-converter | fix/arc-radius-scale-like-svg | tacca pin 1 piatta | no |
| xtruel/easyeda-converter | fix/footprint-tsx-silkscreen-stroke-width | spessore linee serigrafia (PR grande, ~45 snapshot) | no |

Le PR chiuse dal bot (#933, #934, #937, #938) si possono **riaprire** con il pulsante "Reopen pull request". Conviene farlo solo dopo che un maintainer ha risposto su Discord, altrimenti vengono richiuse dopo 3 giorni.

Copia di sicurezza delle correzioni: cartelle `core/`, `schematic-symbols/` ed `easyeda-converter/` qui accanto.

## 5. Piano attuale

1. ⏸️ **Niente nuove PR** su core, circuit-to-svg e schematic-symbols finché non c'è un contatto su Discord.
2. 💬 **Entrare nel Discord** (https://tscircuit.com/join) e scrivere il messaggio della sezione 6.
3. ✅ Aprire la PR **KiCad libreria ruotata**: il repo non ha lo stale bot.
4. Quando un maintainer risponde: riaprire #934 e #933, poi riprendere il calendario con 3–5 PR a settimana.
5. Rispondere entro un giorno a ogni commento dei revisori, per non far scattare il bot.

## 6. Messaggio per Discord (da incollare)

> Hi! I'm new here (GitHub: xtruel). I've been fixing verified bugs across tscircuit repos, each with a regression test that fails on main and passes with the fix (AI-assisted, disclosed in each PR). Could someone take a look at these? The pin-numbering ones produce unusable boards today:
> • footprinter #1013 – VSON pins mirrored (pin 1 bottom-left)
> • footprinter #1014 – SOT-89-5 tab numbered as pin 3 instead of 2
> • circuit-json-to-kicad #915 – tented plated holes exported with mask openings
> A few circuit-to-svg PRs (#933, #934) were auto-closed as stale before review; happy to reopen them if they're welcome. Also: am I eligible for the contributor sponsorship as a new contributor? Thanks!

## 7. Registro

- **13/11:** trovato e corretto il primo bug (#933). Creato il profilo Open Collective. Aperte #933, #934, #915, #1013, #1014, #405.
- **13/11:** 7 ricerche di bug, 24 bug verificati con test. Branch caricati sui fork.
- **14/11:** aperte in anticipo #937, #938, #1015, #1016, #918, #519, #657.
- **16–17/11:** lo stale bot segna come inattive le PR su circuit-to-svg.
- **18/11:** #933, #934, #937, #938 chiuse dal bot senza revisione. Scoperta la regola dello stale bot. Piano cambiato: prima il contatto su Discord.
