# ScribaAI — AI meeting transcription, diarization and minutes

A **Next.js + TypeScript** web app to record a meeting with a single toggle button, transcribe the audio **identifying the different speakers**, and automatically generate **structured minutes** (participants, summary, discussion points, agreements and tasks). Everything runs on **AssemblyAI**: transcription + diarization, and drafting of the minutes with **LeMUR** (built-in Claude LLM). One provider, one key.

> [!IMPORTANT]
> **This web app is currently in a testing phase.** Features, behaviour, configuration and output formats may change, and errors or unexpected results may still occur. It is not yet recommended for critical or production use.

## How it works

1. Pick the **maximum recording length** (60 / 90 / 120 / 180 min).
2. Press the round button → the browser captures the microphone (`MediaRecorder`).
3. Press again (or reach the limit) → the audio is sent to `/api/transcribe`, which uploads it to AssemblyAI and transcribes it with `speaker_labels` (diarization).
4. The per-speaker segments are sent to `/api/acta`, where **LeMUR** drafts the minutes as structured JSON.
5. The minutes and the per-speaker transcript are displayed, with an option to **export to Markdown**.

The AssemblyAI key lives in the **server-side API routes**, so it's never exposed to the browser.

## Setup

```bash
npm install
cp .env.local.example .env.local   # add your ASSEMBLYAI_API_KEY
npm run dev                        # http://localhost:3000
```

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | — | **Required.** AssemblyAI API key. |
| `ASSEMBLYAI_LANGUAGE` | `ca` | Transcription language. |
| `ASSEMBLYAI_LEMUR_MODEL` | `anthropic/claude-3-5-sonnet` | LeMUR model used for the minutes. |
| `AUTH_PASSWORD_HASH_B64` | — | **Required.** Base64-encoded bcrypt hash of the access password. |
| `AUTH_SECRET` | — | **Required.** Random secret used to sign the session cookie. |

### Login (password only)

The app is protected by a **middleware** that blocks all access (pages and API routes) if you're not logged in. It only asks for a **password**, which is **never stored in plain text**: the server only holds its bcrypt *hash*. The session is kept in a signed cookie (`httpOnly`, `secure` in production).

Configure two variables in `.env.local`:

```bash
# bcrypt hash in base64 (avoids the '$' that Next expands in .env files)
node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1],12)).toString('base64'))" 'YOUR_PASSWORD'

# Random secret to sign the session cookie
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the first value into `AUTH_PASSWORD_HASH_B64` and the second into `AUTH_SECRET`. To change the password, regenerate the hash and restart the app. The session lasts 7 days; the **Log out** button ends it.

> The hash is stored in **base64** on purpose: the bcrypt format (`$2a$...`) contains `$` characters that Next expands inside `.env` files, corrupting the value. Base64 has no conflicting characters.

### Getting the key and controlling costs

1. Create an account at [assemblyai.com](https://www.assemblyai.com) and open the **Dashboard**.
2. Copy your **API key** into `.env.local` as `ASSEMBLYAI_API_KEY`.
3. AssemblyAI works on **prepaid credit**: load a fixed amount (e.g. $10) and, when it runs out, calls stop — so there are no surprise bills. Check *Billing* if you want to enable usage alerts.
4. Extra control on the app side: the **duration selector** caps the minutes per meeting and therefore the cost.

Rough cost: **~$0.20–0.50 per hour** of meeting (transcription + diarization + LeMUR).

## Structure

```
src/
  app/
    page.tsx              # orchestrates the flow and the duration limit
    layout.tsx
    globals.css
    api/
      transcribe/route.ts # AssemblyAI: upload + transcription with diarization
      acta/route.ts       # LeMUR → minutes JSON
  components/
    Recorder.tsx          # toggle button + timer
    DurationSelector.tsx  # max-duration radios
    ActaView.tsx          # minutes + participants + export
  hooks/
    useRecorder.ts        # microphone capture
  lib/
    assemblyai.ts         # upload, transcription and LeMUR
    api.ts                # fetch calls from the client
    types.ts              # shared types
    format.ts             # timer, Markdown, download
```

## Deploying to a server (Node, e.g. CloudPanel)

The app is meant to run on a **long-running Node server** (not serverless). The transcription flow is asynchronous: `/api/transcribe` uploads the audio and queues the job (returns an id quickly), and the browser polls `/api/transcribe/status` every few seconds until it's ready. This way no request stays open for minutes.

### Compact build (standalone output + PM2)

With `output: "standalone"` (already set in `next.config.mjs`), Next bundles only what's needed to run (~30 MB instead of the ~370 MB of `node_modules`).

```bash
npm install
npm run build
cp -r .next/static .next/standalone/.next/static
cp .env.local .next/standalone/.env.local
rm -rf node_modules .next/cache        # optional: free up space
pm2 start ecosystem.config.js          # starts the bundled server.js
pm2 save
```

`ecosystem.config.js` already points to `.next/standalone/server.js`, with `PORT=3000` (adjust it to the CloudPanel App Port) and `HOSTNAME=0.0.0.0`. Sensitive values (keys, hash, secret) are read from the `.env.local` you copied into `.next/standalone/`.

Things to configure:

- **HTTPS is mandatory.** Without a secure connection, browsers (especially Safari on iPhone) **block the microphone**. Add a certificate (e.g. Let's Encrypt).
- **nginx as a reverse proxy:** raise the body-size limit so a 2-hour audio file (20–40 MB) fits, and extend the timeouts:

  ```nginx
  client_max_body_size 100M;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  ```

- Start it with PM2 using the bundled server (`pm2 start ecosystem.config.js`), ideally with boot persistence.

## Using it from an iPhone (Safari)

- Safari records in `mp4/aac` (not webm); the app detects this and handles it automatically.
- While recording, the app activates a **Wake Lock** to keep the screen on. Even so, **do not lock the phone or switch apps**: iOS suspends the page and recording would stop. Keep Safari in the foreground for the whole meeting.

## Notes and limits

- **Diarization** returns generic labels (`Speaker A`, `B`…). If someone says their name during the meeting, LeMUR tries to map it to the real name.
- Recording stops automatically when the chosen maximum duration is reached.
- The client polling waits up to 35 min for AssemblyAI to finish (adjustable in `src/lib/api.ts`). In practice, 2 hours of audio are transcribed in a few minutes.

## License

This project is available under a custom noncommercial software license based on the principles of the PolyForm Noncommercial License 1.0.0.

You may:

- download and use the application for noncommercial purposes;
- inspect and study its source code;
- modify it;
- create forks and derivative works;
- redistribute original or modified versions for noncommercial purposes.

You may not:

- sell the application or a modified version;
- charge users for access to it;
- offer it as a paid hosted service;
- include it in a commercial product or service;
- otherwise exploit it commercially without prior written permission.

### Attribution requirement

All copies, forks, modifications, and derivative works must retain the following attribution:

> Original project by Carles Melgarejo Vila

This attribution must remain visible in the application’s **About section or equivalent credits page**.

Modified versions must clearly identify their changes and must not imply that they are official versions maintained or endorsed by the original author.

See [`LICENSE.md`](./LICENSE.md) and [`NOTICE.md`](./NOTICE.md) for the complete terms.

### Commercial licensing

Commercial use requires a separate written license from Carles Melgarejo Vila.
