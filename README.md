# ScribaAI — AI meeting transcription, diarization and minutes

A **Next.js + TypeScript** web app to record a meeting with a single toggle button, transcribe the audio **identifying the different speakers**, and automatically generate **structured minutes** (participants, summary, discussion points, agreements and tasks). Everything runs on **AssemblyAI**: transcription + diarization, and drafting of the minutes through the **AssemblyAI LLM Gateway** (a built-in, OpenAI-compatible interface to models like Claude, GPT, Gemini or Qwen). One provider, one key.

> [!IMPORTANT]
> **This web app is currently in a testing phase.** Features, behaviour, configuration and output formats may change, and errors or unexpected results may still occur. It is not yet recommended for critical or production use.

## How it works

The workflow is split into **three decoupled steps**, each of which is saved on its own. Between steps nothing is processing, so you can close the app, lock the phone, or come back later.

1. **Record → save audio.** Pick the max recording length (60 / 90 / 120 / 180 min) and, optionally, an **upper bound of participants** (a hint that improves diarization — not an exact count). Press the round button to record; press again (or reach the limit) and the audio is uploaded and stored on the server as **Opus**. The meeting appears in the history with a **Transcribe** button.
2. **Transcribe.** Press the button → AssemblyAI transcribes with `speaker_labels` (diarization) and the per-speaker transcript is saved. This step is **resumable**: if you close the app while it runs, reopening the meeting picks the result up once AssemblyAI finishes.
3. **Generate minutes.** Press the button → the **LLM Gateway** drafts detailed minutes (attributing points, agreements and tasks to speakers) and saves them as Markdown.

Each meeting shows an **audio player**, and its minutes and transcript as collapsible sections with their own **Export** buttons, plus the **approximate processing cost in euros**.

## Features

- **Three-step, decoupled flow** (audio → transcript → minutes), each persisted immediately; safe to pause between steps.
- **Single-button recording** with a live timer, a max-duration cap and a **Wake Lock** to keep the screen awake during any processing.
- **Speaker diarization** with an optional participant-count hint (upper bound).
- **Detailed minutes** in Catalan that reference the speakers; the LLM is told the diarization may be imperfect and to fix obvious attribution errors from context.
- **Persistent history** in a left sidebar (most recent first, with a status pill); click any meeting to view its audio, transcript and minutes.
- **Audio archive** in Opus (mono, 16 kHz, 24 kbps), playable (with seeking) and downloadable.
- **Approximate cost per meeting** in euros (audio duration × transcription rate + real LLM token usage).
- **Light / dark theme** toggle (persisted).
- **Markdown export** for both the minutes and the transcript.
- **Password login** (bcrypt hash, signed cookie) protecting every page and API route.
- **Not indexable** by search engines (`noindex`, `robots.txt`, `X-Robots-Tag`).

> ⚠️ **While a step is running** (recording, saving, transcribing or generating the minutes) **do not close the app or let the device sleep** — the app keeps the screen awake and shows a reminder, but on iOS especially, locking the phone or switching apps suspends the page and interrupts the running step.

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
| `ASSEMBLYAI_LLM_MODEL` | `qwen3-32B` | LLM Gateway model for the minutes (e.g. `claude-sonnet-4-5-20250929`, `gemini-2.5-flash`, `gpt-5-mini`). |
| `AUTH_PASSWORD_HASH_B64` | — | **Required.** Base64-encoded bcrypt hash of the access password. |
| `AUTH_SECRET` | — | **Required.** Random secret used to sign the session cookie. |
| `SCRIBA_DATA_DIR` | `./data` | Folder where meetings are stored (JSON + Markdown + Opus). In production point it outside `.next`. |
| `FFMPEG_PATH` | `ffmpeg` | Path to the ffmpeg binary used to transcode the audio to Opus. |

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
3. **Add a payment method** (pay-as-you-go). Transcription works on the free tier, but the **LLM Gateway** (used for the minutes) requires billing enabled — otherwise `/api/acta` returns a `401` "does not have access to LLM Gateway".
4. AssemblyAI works on **prepaid credit**: load a fixed amount (e.g. $10) and, when it runs out, calls stop — so there are no surprise bills (keep auto-refill off for a hard cap).
5. Extra control on the app side: the **duration selector** caps the minutes per meeting and therefore the cost.

Rough cost with `claude-haiku-4-5-20251001` for the minutes: **~$0.38 for a 2-hour meeting** — transcription + diarization is the bulk (~$0.34) and the minutes add only a few cents (~$0.04 for ~30k input + ~1.5k output tokens at $1 / $5 per 1M). With a cheaper model like `qwen3-32B` the minutes are a fraction of a cent (total ~$0.35).

## Structure

```
src/
  middleware.ts             # login guard for every page and API route
  app/
    page.tsx                # main flow: recorder + history sidebar + meeting viewer
    login/page.tsx          # password login screen
    layout.tsx  globals.css  robots.ts
    api/
      meetings/route.ts                  # GET list · POST save audio (step 1)
      meetings/[id]/route.ts             # get / delete a meeting
      meetings/[id]/transcribe/route.ts  # POST start · GET check (step 2, resumable)
      meetings/[id]/acta/route.ts        # POST generate minutes (step 3)
      meetings/[id]/audio/route.ts       # stream the Opus audio (with Range/seek)
      login/route.ts  logout/route.ts
  components/
    Recorder.tsx            # toggle button + timer
    DurationSelector.tsx    # max-duration radios
    SpeakerSelector.tsx     # participant-count hint
    CollapsibleSection.tsx  # expand/collapse wrapper
    ActaView.tsx            # MeetingView: audio, steps, minutes, transcript, cost
    HistorySidebar.tsx      # left history list with status
    ThemeToggle.tsx  ProcessingWarning.tsx
  hooks/
    useRecorder.ts          # microphone capture
    useWakeLock.ts          # keep screen awake during processing
  lib/
    assemblyai.ts           # upload, transcription and LLM Gateway
    acta.ts                 # minutes prompt + JSON parsing/repair
    audio.ts                # ffmpeg → Opus transcode
    store.ts                # persistent history (JSON + Markdown + Opus)
    pricing.ts              # per-meeting cost estimate (EUR)
    auth.ts                 # signed session cookie (HMAC)
    api.ts                  # fetch calls from the client
    types.ts  format.ts     # shared types, timer, Markdown, download
```

## Deploying to a server (Node, e.g. CloudPanel)

The app is meant to run on a **long-running Node server** (not serverless). Each step is its own request: saving the audio, starting the transcription (returns quickly with a job id), polling `/api/meetings/[id]/transcribe` until AssemblyAI finishes, and generating the minutes. The audio is uploaded as a **raw binary body** (not multipart) to be robust with long recordings.

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

- Safari records in `mp4/aac` (not webm); the app handles it automatically (the server transcodes to Opus regardless).
- During any processing step the app requests a **Wake Lock** (acquired inside the button tap, as iOS requires) to keep the screen on. Even so, **do not lock the phone or switch apps** while a step runs: iOS suspends the page. Thanks to the three-step flow, if this happens the already-completed steps are safe, and the transcription step resumes on its own when you reopen the meeting.

## Notes and limits

- **Audio archive:** each meeting's audio is transcoded to **Opus (mono, 16 kHz, 24 kbps)** and stored next to the minutes, playable/downloadable from the history. Requires **`ffmpeg`** on the server (`apt install ffmpeg`); if it's missing, the app still works but skips saving audio.
- **History persistence:** meetings are stored on disk under `SCRIBA_DATA_DIR`. In production (standalone build) point it **outside `.next`** or the history is wiped on every deploy. See `DEPLOY.md`.
- **Diarization** returns generic labels (`Speaker A`, `B`…). If someone says their name during the meeting, the LLM tries to map it to the real name. The participant selector is an **upper bound**, not an exact count — audio quality (mic distance, cross-talk) is the main driver of accuracy.
- Recording stops automatically when the chosen maximum duration is reached.
- The transcription step polls for up to 40 min and is **resumable**: closing the app doesn't lose it (the job runs on AssemblyAI; reopening the meeting picks up the result). In practice, 2 hours of audio are transcribed in a few minutes.
- **Cost figures are approximate**: transcription is estimated from the audio duration at the rates in `src/lib/pricing.ts` (adjust if your account's rates differ); the minutes cost uses the LLM's real token usage.

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
