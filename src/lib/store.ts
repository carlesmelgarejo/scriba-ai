import { promises as fs } from "fs";
import path from "path";
import type { Acta, Meeting, MeetingSummary, Utterance } from "./types";
import { actaToMarkdown } from "./format";

// Carpeta persistent de dades. En producció (standalone) cal apuntar-la
// FORA de .next amb SCRIBA_DATA_DIR perquè no es perdi en cada build.
const DATA_DIR =
  process.env.SCRIBA_DATA_DIR ?? path.join(process.cwd(), "data");

const PENDING_DIR = path.join(DATA_DIR, "pending");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

const safeId = (id: string) => /^[\w-]+$/.test(id);

/** Desa temporalment l'àudio ja transcodificat, identificat per un token. */
export async function savePendingAudio(
  token: string,
  opus: Buffer
): Promise<void> {
  if (!safeId(token)) return;
  await fs.mkdir(PENDING_DIR, { recursive: true });
  await fs.writeFile(path.join(PENDING_DIR, `${token}.opus`), opus);
}

async function attachAudio(token: string, meetingId: string): Promise<boolean> {
  if (!safeId(token)) return false;
  try {
    await fs.rename(
      path.join(PENDING_DIR, `${token}.opus`),
      path.join(DATA_DIR, `${meetingId}.opus`)
    );
    return true;
  } catch {
    return false;
  }
}

/** Ruta del fitxer d'àudio d'una reunió, si existeix. */
export async function getMeetingAudioPath(id: string): Promise<string | null> {
  if (!safeId(id)) return null;
  const p = path.join(DATA_DIR, `${id}.opus`);
  try {
    await fs.access(p);
    return p;
  } catch {
    return null;
  }
}

function newId(): string {
  const d = new Date();
  const stamp = d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${stamp}_${rand}`;
}

/** Desa una reunió (JSON per la UI + Markdown per conservar + àudio opcional). */
export async function saveMeeting(
  acta: Acta,
  utterances: Utterance[],
  audioToken?: string
): Promise<Meeting> {
  await ensureDir();
  const id = newId();
  const hasAudio = audioToken ? await attachAudio(audioToken, id) : false;

  const meeting: Meeting = {
    id,
    createdAt: new Date().toISOString(),
    acta,
    utterances,
    hasAudio,
  };
  await fs.writeFile(
    path.join(DATA_DIR, `${id}.json`),
    JSON.stringify(meeting, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(DATA_DIR, `${id}.md`),
    actaToMarkdown(acta, utterances),
    "utf8"
  );
  return meeting;
}

export async function listMeetings(): Promise<MeetingSummary[]> {
  await ensureDir();
  const files = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
  const meetings: MeetingSummary[] = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
      const m = JSON.parse(raw) as Meeting;
      meetings.push({
        id: m.id,
        createdAt: m.createdAt,
        titol: m.acta.titol,
        participants: m.acta.participants ?? [],
        hasAudio: !!m.hasAudio,
      });
    } catch {
      // ignora fitxers malformats
    }
  }
  return meetings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  if (!/^[\w-]+$/.test(id)) return null; // evita path traversal
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as Meeting;
  } catch {
    return null;
  }
}

export async function deleteMeeting(id: string): Promise<boolean> {
  if (!/^[\w-]+$/.test(id)) return false;
  let removed = false;
  for (const ext of ["json", "md", "opus"]) {
    try {
      await fs.unlink(path.join(DATA_DIR, `${id}.${ext}`));
      removed = true;
    } catch {
      // el fitxer pot no existir
    }
  }
  return removed;
}
