# Questionario sui contenuti (Content Survey) — bozza veritiera

Bozza preparata l'11 ottobre 2026 per **Scrapbot City 0.7.0-beta.1**, da compilare in Steamworks → la tua app →
**Edit Store Page → Content Survey** (obbligatorio prima della revisione). **Non è stato compilato niente**: lo fa il
titolare, che risponde delle risposte.

Fonte delle regole: [Steamworks — Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey),
letta l'11/10/2026. In sintesi:
- tre parti: **General Content** (genera le classificazioni per età dei vari Paesi, mostrate sulla pagina all'uscita),
  **Mature Content** (va dichiarato *tutto* il contenuto per adulti presente nelle build, *anche se non accessibile*),
  **Generative AI Content**;
- IA **pre-generata**: «qualsiasi contenuto che esce col gioco ed è fruito dai giocatori» creato con l'aiuto di
  strumenti di IA durante lo sviluppo; Valve lo valuta in revisione come ogni altro contenuto, anche per la coerenza
  con il materiale promozionale. «I guadagni di efficienza grazie a questi strumenti non sono l'oggetto della sezione»;
- IA **generata dal vivo** (mentre il gioco gira): stesse regole, più la descrizione delle protezioni adottate;
- dopo l'approvazione di build e pagina **alcune risposte si cambiano solo scrivendo al supporto di Steam**: meglio
  rispondere bene la prima volta.

Le domande esatte compaiono nel modulo e possono essere formulate diversamente da qui: per ogni tema trovi **i fatti
del gioco** (verificati nel codice e nei testi del ramo principale, commit `04d782e`) e **la risposta proposta**.

---

## 1. General Content

| Tema | Fatti nel gioco | Risposta proposta |
|---|---|---|
| Violenza | Nessun combattimento, nessun personaggio ferito o ucciso. Gli edifici si demoliscono (sprofondano nella polvere); una città può essere "persa" per lo smog (messaggio e finale "Smog Over", nessuna vittima mostrata). Un evento cita un "satellite morto" (un satellite dismesso). | Nessuna violenza |
| Paura / horror | Nessuno | No |
| Linguaggio | Nessuna parolaccia o insulto nei testi inglesi (controllati); le 7 traduzioni sono fatte con l'IA e non riviste da madrelingua | No *(conferma dopo la revisione delle traduzioni)* |
| Droghe, alcol, tabacco | Nessun riferimento | No |
| Gioco d'azzardo / meccaniche simili | Nessuna: niente scommesse, casse premio, estrazioni a pagamento. Un evento offre di "investire in azioni 2PM" (scelta narrativa con un effetto fisso in crediti) | No |
| Acquisti nel gioco | Nessuno: niente microtransazioni, niente DLC. I "suggerimenti a pagamento" si pagano con crediti del gioco, non con denaro | No |
| Temi | Inquinamento e smog, satira di una multinazionale (2PM Corp), barili "che brillano un po'" da stoccare (evento): toni da cartone animato | Temi ambientali lievi, nessun contenuto sensibile |
| Interazione online / contenuti degli utenti | Nessuna: gioco per giocatore singolo, nessuna chat, nessun contenuto creato da altri, nessuna connessione a internet (il gioco non va mai online; la versione desktop blocca anche il download del dizionario di Electron) | No |
| Dati personali | Il gioco non raccoglie né invia dati; i salvataggi sono file locali (sincronizzati da Steam Cloud se lo attivi) | No |
| Pubblicità nel gioco | Nessuna | No |
| Contenuti generati dagli utenti | Nessuno (niente editor, niente Workshop) | No |

## 2. Mature Content

Nel gioco **non c'è** contenuto per adulti di nessun tipo: niente violenza frequente o sangue, niente nudità o
contenuto sessuale, niente contenuto sessuale solo per adulti, niente altro contenuto maturo. Gli sprite sono generati
da modelli voxel scritti nel codice (`scripts/art/models/`), i testi sono in `src/i18n/`: non ci sono file nascosti o
inutilizzati con altri contenuti.

**Risposta proposta**: nessun contenuto maturo in tutte le categorie.
**Da confermare dal titolare**: che le immagini del negozio (capsule, logo, icone: sezione 1 di
[ASSETS-PROVENANCE.md](ASSETS-PROVENANCE.md)) non contengano nulla di diverso da ciò che si vede.

## 3. Generative AI Content

### 3.1 Che cosa è stato fatto con l'IA (fatti)

| Contenuto che il giocatore vede o sente | Fatto con l'IA? | Come |
|---|---|---|
| Codice del gioco (simulazione, interfaccia, Electron) | **Sì** | scritto con l'assistenza di Claude (Anthropic) in questo progetto, su indicazioni del titolare |
| Grafica del gioco: edifici, personaggi, terreno, scenografia, icone | **Sì** | modelli voxel scritti come codice con l'assistenza dell'IA e trasformati in sprite dalla pipeline del progetto (`npm run art`); nessun generatore di immagini |
| Menu, mappa della regione, interfaccia | **Sì** | disegnati da codice scritto con l'assistenza dell'IA |
| Testi del gioco (eventi, dialoghi, tutorial, interfaccia) | **Sì** | scritti con l'assistenza dell'IA |
| Traduzioni in 7 lingue (IT, DE, FR, ES, PT, PL, NL) | **Sì** | tradotte con l'IA; non ancora riviste da madrelingua |
| Musica (4 brani chiptune) | **Sì** | note scritte con l'assistenza dell'IA in `src/music.ts`, suonate da un sintetizzatore nel gioco |
| Effetti sonori | **Sì** | parametri di sintesi scritti con l'assistenza dell'IA, sintetizzati dal gioco |
| Font | No | font open source di terzi (licenze OFL 1.1 / Apache 2.0) |
| Capsule, logo, icone del negozio e dell'app | **Da dichiarare** | derivano dalle 5 immagini fornite dal titolare: come sono state fatte lo sa solo lui |
| Trailer | No (registrazione) | ripresa del gioco dalla build di rilascio (`scripts/trailer/`), nessuna immagine generata |

**Generato dal vivo**: **niente**. Il gioco non usa nessun modello di IA mentre gira, non va online, non genera
testi, immagini o suoni con l'IA. (La musica è "generata" nel senso che è sintetizzata da note fisse: non è IA.)

### 3.2 Risposte proposte

- **Pre-Generated AI content**: **Sì**.
- **Live-Generated AI content**: **No**.

Testo proposto per la descrizione (inglese; compare sulla pagina del negozio). Le parti tra `[ ]` le completa o le
toglie il titolare:

> Scrapbot City was developed with extensive help from AI tools (Claude, by Anthropic). Content in the game that was
> created with AI assistance during development: the game's code; the pixel-art sprites, which are rendered from
> voxel models written as code with AI assistance; the interface art; all in-game text and its translations; the
> chiptune music, written as notes with AI assistance and synthesized by the game; and the sound effects.
> [The store artwork, logo and icons were made by/with … .] [All of this was directed, reviewed and selected by the
> developer.] No AI is used while you play: the game generates nothing with AI at runtime and never connects to the
> internet.

Versione italiana (se compili la pagina anche in italiano):

> Scrapbot City è stato sviluppato con un ampio aiuto di strumenti di IA (Claude, di Anthropic). Contenuti del gioco
> creati con l'assistenza dell'IA durante lo sviluppo: il codice; gli sprite in pixel art, ricavati da modelli voxel
> scritti come codice con l'aiuto dell'IA; la grafica dell'interfaccia; tutti i testi e le loro traduzioni; la musica
> chiptune, scritta come note con l'aiuto dell'IA e sintetizzata dal gioco; gli effetti sonori. [La grafica del
> negozio, il logo e le icone sono stati realizzati da/con … .] [Tutto è stato diretto, rivisto e scelto dallo
> sviluppatore.] Durante il gioco non si usa nessuna IA: il gioco non genera nulla con l'IA e non si collega mai a
> internet.

Perché dichiarare anche il codice, anche se la sezione dice che l'efficienza non è il suo oggetto: qui il codice
**produce** contenuto che il giocatore vede e sente (sprite, interfaccia, musica, effetti), quindi è più corretto
dirlo. Se Valve ritiene che basti elencare grafica, testi, traduzioni e audio, la frase sul codice si può togliere
senza rendere la dichiarazione incompleta.

---

## 4. Domande a cui deve rispondere il titolare

1. **Le 5 immagini che hai fornito** (icona, logo con sfondo trasparente, poster verticale, key art, banner): chi le ha
   fatte? Con un generatore di immagini (quale)? Hai i diritti d'uso commerciale secondo le condizioni di quel servizio?
   → completa la frase tra `[ ]` e conferma la sezione 6 di [ASSETS-PROVENANCE.md](ASSETS-PROVENANCE.md).
2. **«Diretto, rivisto e scelto dallo sviluppatore»**: è vero per tutto? Se una parte non è stata rivista (per esempio
   le traduzioni, oggi senza revisione madrelingua), riformula la frase o toglila.
3. **Nome dello sviluppatore** da usare nella dichiarazione e in Steamworks (Qwerty3D Games?).
4. **Linguaggio nelle traduzioni**: dopo la revisione madrelingua conferma "nessun linguaggio volgare" in tutte le lingue.
5. **Classificazioni ufficiali esistenti** (PEGI, ESRB, USK…): il gioco ne ha già? Se no, il questionario genera quelle
   dei Paesi che lo prevedono (IARC).
6. Hai usato altri strumenti di IA (per esempio per il mockup del menu in `docs/`, per testi del negozio o per il
   trailer) che vanno aggiunti?
7. Chi compila il modulo deve poter rispondere anche alle domande di Valve in revisione: tieni questa bozza e
   ASSETS-PROVENANCE.md a portata di mano.

## 5. Dopo l'invio

- La revisione di Valve confronta la dichiarazione con il gioco e con la pagina: grafica del negozio e trailer devono
  corrispondere a ciò che c'è nella build (le righe **[pending final build]** di [STORE-COPY.md](STORE-COPY.md) vanno
  chiuse prima).
- Se in futuro aggiungi contenuti fatti con l'IA (nuova grafica, nuovi testi), aggiorna la dichiarazione; dopo
  l'approvazione alcune risposte si cambiano solo tramite il supporto di Steam (serve un riepilogo delle modifiche e
  le istruzioni per far vedere ai tester il contenuto nuovo).
