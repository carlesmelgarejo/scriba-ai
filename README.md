# Acta — Transcripció, diarització i actes de reunió amb IA

Web app en **Next.js + TypeScript** per gravar una reunió amb un sol botó (toggle), transcriure l'àudio **identificant els diferents interlocutors** i generar automàticament una **acta estructurada** (participants, resum, punts tractats, acords i tasques). Tot funciona amb **AssemblyAI**: transcripció + diarització i redacció de l'acta amb **LeMUR** (LLM de Claude integrat). Un sol proveïdor i una sola clau.

## Com funciona

1. Tries la **durada màxima** de gravació (60 / 90 / 120 / 180 min).
2. Prems el botó rodó → el navegador captura el micròfon (`MediaRecorder`).
3. Prems de nou (o s'arriba al límit) → l'àudio s'envia a `/api/transcribe`, que el puja a AssemblyAI i el transcriu amb `speaker_labels` (diarització).
4. Els segments per interlocutor s'envien a `/api/acta`, on **LeMUR** redacta l'acta en JSON estructurat.
5. Es mostra l'acta + la transcripció per interlocutors, amb opció d'**exportar a Markdown**.

La clau d'AssemblyAI viu a les **API routes del servidor**, així mai s'exposa al navegador.

## Configuració

```bash
npm install
cp .env.local.example .env.local   # posa-hi la teva ASSEMBLYAI_API_KEY
npm run dev                        # http://localhost:3000
```

### Variables d'entorn

| Variable | Per defecte | Descripció |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | — | **Obligatòria.** Clau d'API d'AssemblyAI. |
| `ASSEMBLYAI_LANGUAGE` | `ca` | Idioma de la transcripció. |
| `ASSEMBLYAI_LEMUR_MODEL` | `anthropic/claude-3-5-sonnet` | Model de LeMUR per l'acta. |
| `AUTH_PASSWORD_HASH` | — | **Obligatòria.** Hash bcrypt de la contrasenya d'accés. |
| `AUTH_SECRET` | — | **Obligatòria.** Secret aleatori per signar la cookie de sessió. |

### Login (només contrasenya)

L'app està protegida per un **middleware** que bloqueja tot l'accés (pàgines i rutes API) si no has iniciat sessió. Només demana **contrasenya**, que **mai es guarda en clar**: al servidor només hi ha el seu *hash* bcrypt. La sessió va en una cookie signada (`httpOnly`, `secure` en producció).

Configura dues variables a `.env.local`:

```bash
# Hash bcrypt en base64 (evita els '$' que Next interpreta als fitxers .env)
node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1],12)).toString('base64'))" 'LA_TEVA_CONTRASENYA'

# Secret aleatori per signar la cookie de sessió
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Enganxa el primer valor a `AUTH_PASSWORD_HASH_B64` i el segon a `AUTH_SECRET`. Per canviar la contrasenya, torna a generar el hash i reinicia l'app. La sessió dura 7 dies; el botó **Sortir** la tanca.

> El hash es guarda en **base64** expressament: el format bcrypt (`$2a$...`) conté `$` que Next expandeix als fitxers `.env` i corromp el valor. Amb base64 no hi ha cap caràcter conflictiu.

### Donar d'alta la clau i controlar la despesa

1. Crea un compte a [assemblyai.com](https://www.assemblyai.com) i entra al **Dashboard**.
2. Copia la teva **API key** a `.env.local` com a `ASSEMBLYAI_API_KEY`.
3. AssemblyAI funciona amb **crèdit de prepagament**: carrega un import fix (p. ex. 10 $) i, quan s'esgota, les crides s'aturen — així no hi ha rebuts per sorpresa. Revisa a *Billing* si vols activar alertes d'ús.
4. Control extra al costat de l'app: el **selector de durada** posa un sostre de minuts per reunió i, per tant, de cost.

Cost orientatiu: **~0,20–0,50 $ per hora** de reunió (transcripció + diarització + LeMUR).

## Estructura

```
src/
  app/
    page.tsx              # orquestra el flux i el límit de durada
    layout.tsx
    globals.css
    api/
      transcribe/route.ts # AssemblyAI: upload + transcripció amb diarització
      acta/route.ts       # LeMUR → acta JSON
  components/
    Recorder.tsx          # botó toggle + timer
    DurationSelector.tsx  # radios de durada màxima
    ActaView.tsx          # acta + participants + export
  hooks/
    useRecorder.ts        # captura de micròfon
  lib/
    assemblyai.ts         # upload, transcripció i LeMUR
    api.ts                # crides fetch des del client
    types.ts              # tipus compartits
    format.ts             # timer, Markdown, descàrrega
```

## Desplegament a un servidor (Node, p. ex. CloudPanel)

L'app està pensada per anar en un **servidor Node de llarga durada** (no serverless). El flux de transcripció és asíncron: `/api/transcribe` puja l'àudio i encua la feina (retorna un id ràpid), i el navegador consulta `/api/transcribe/status` cada pocs segons fins que està llesta. Així cap petició queda oberta durant minuts.

### Build compacte (output standalone + PM2)

Amb `output: "standalone"` (ja configurat a `next.config.mjs`), Next empaqueta només el que cal per executar-se (~30 MB en comptes dels ~370 MB de `node_modules`).

```bash
npm install
npm run build
cp -r .next/static .next/standalone/.next/static
cp .env.local .next/standalone/.env.local
rm -rf node_modules .next/cache        # opcional: allibera espai
pm2 start ecosystem.config.js          # arrenca el server.js empaquetat
pm2 save
```

L'`ecosystem.config.js` ja apunta a `.next/standalone/server.js`, amb `PORT=3000` (ajusta'l a l'App Port de CloudPanel) i `HOSTNAME=0.0.0.0`. Les variables sensibles (claus, hash, secret) es llegeixen del `.env.local` que has copiat dins de `.next/standalone/`.

Punts a configurar:

- **HTTPS obligatori.** Sense connexió segura, els navegadors (i sobretot Safari a l'iPhone) **bloquegen el micròfon**. Posa un certificat (p. ex. Let's Encrypt).
- **nginx com a reverse proxy:** apuja el límit de mida del cos perquè hi càpiga un àudio de 2 h (20–40 MB) i allarga els timeouts:

  ```nginx
  client_max_body_size 100M;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  ```

- Arrenca amb `npm run build && npm run start` (idealment sota `pm2` o un servei systemd).

## Ús des de l'iPhone (Safari)

- Safari grava en `mp4/aac` (no webm); l'app ho detecta i ho gestiona sol.
- Mentre graves, l'app activa un **Wake Lock** per mantenir la pantalla encesa. Tot i així, **no bloquegis el telèfon ni canviïs d'app**: iOS suspèn la pàgina i s'aturaria la gravació. Deixa Safari en primer pla tota la reunió.

## Notes i límits

- La **diarització** retorna etiquetes genèriques (`Interlocutor A`, `B`…). Si algú diu el seu nom durant la reunió, LeMUR intenta mapar-lo al nom real.
- La transcripció s'atura automàticament en arribar a la durada màxima triada.
- El *polling* del client espera fins a 35 min que AssemblyAI acabi (ajustable a `src/lib/api.ts`). En la pràctica, 2 h d'àudio es transcriuen en pocs minuts.
