import { promises as fs } from "fs";
import path from "path";
import type { Acta, Meeting, MeetingSummary, Utterance } from "./types";
import { meetingStatus } from "./types";
import { actaToMarkdown } from "./format";
import { extractPeaks } from "./audio";

// Carpeta persistent de dades. En producció (standalone) cal apuntar-la
// FORA de .next amb SCRIBA_DATA_DIR perquè no es perdi en cada build.
const DATA_DIR =
  process.env.SCRIBA_DATA_DIR ?? path.join(process.cwd(), "data");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

const safeId = (id: string) => /^[\w-]+$/.test(id);

function newId(): string {
  const d = new Date();
  const stamp = d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${stamp}_${rand}`;
}

/** Normalitza una reunió llegida del disc (compatibilitat amb dades antigues). */
function normalize(raw: unknown): Meeting {
  const m = (raw ?? {}) as Partial<Meeting> & { acta?: Acta | null };
  return {
    id: m.id ?? "",
    createdAt: m.createdAt ?? new Date().toISOString(),
    title: m.title ?? m.acta?.titol ?? "",
    hasAudio: !!m.hasAudio,
    transcriptId: m.transcriptId,
    speakers: m.speakers,
    durationSec: m.durationSec,
    peaks: m.peaks,
    llm: m.llm,
    utterances: Array.isArray(m.utterances) ? m.utterances : [],
    acta: m.acta ?? null,
  };
}

async function writeMeeting(meeting: Meeting): Promise<void> {
  await fs.writeFile(
    path.join(DATA_DIR, `${meeting.id}.json`),
    JSON.stringify(meeting, null, 2),
    "utf8"
  );
  // Markdown conservable només quan ja hi ha acta.
  if (meeting.acta) {
    await fs.writeFile(
      path.join(DATA_DIR, `${meeting.id}.md`),
      actaToMarkdown(meeting.acta, meeting.utterances),
      "utf8"
    );
  }
}

/** Crea una reunió amb només l'àudio (pas 1). */
export async function createAudioMeeting(
  opus: Buffer,
  speakers?: number,
  durationSec?: number
): Promise<Meeting> {
  await ensureDir();
  const id = newId();
  const hasAudio = opus.length > 0;
  let peaks: number[] | undefined;
  if (hasAudio) {
    await fs.writeFile(path.join(DATA_DIR, `${id}.opus`), opus);
    peaks = (await extractPeaks(opus)) ?? undefined;
  }
  const meeting: Meeting = {
    id,
    createdAt: new Date().toISOString(),
    title: "",
    hasAudio,
    speakers,
    durationSec,
    peaks,
    utterances: [],
    acta: null,
  };
  await writeMeeting(meeting);
  return meeting;
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  if (!safeId(id)) return null;
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Aplica canvis a una reunió i la torna a desar. */
export async function updateMeeting(
  id: string,
  patch: Partial<Meeting>
): Promise<Meeting | null> {
  const current = await getMeeting(id);
  if (!current) return null;
  const updated: Meeting = { ...current, ...patch };
  if (updated.acta && !patch.title && !current.title) {
    updated.title = updated.acta.titol;
  }
  await writeMeeting(updated);
  return updated;
}

export async function listMeetings(): Promise<MeetingSummary[]> {
  await ensureDir();
  const files = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
  const meetings: MeetingSummary[] = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
      const m = normalize(JSON.parse(raw));
      meetings.push({
        id: m.id,
        createdAt: m.createdAt,
        title: m.title || m.acta?.titol || "",
        status: meetingStatus(m),
        hasAudio: m.hasAudio,
      });
    } catch {
      // ignora fitxers malformats
    }
  }
  return meetings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteMeeting(id: string): Promise<boolean> {
  if (!safeId(id)) return false;
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

/** Bytes de l'àudio d'una reunió (per pujar-lo a AssemblyAI). */
export async function readMeetingAudio(id: string): Promise<Buffer | null> {
  if (!safeId(id)) return null;
  try {
    return await fs.readFile(path.join(DATA_DIR, `${id}.opus`));
  } catch {
    return null;
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
