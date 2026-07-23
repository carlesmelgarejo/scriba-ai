import type { Acta, Utterance, Meeting, MeetingSummary } from "./types";

function fileExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Puja l'àudio, encua la transcripció i fa polling fins que està llesta. */
export async function transcribeAudio(
  blob: Blob,
  speakers?: number
): Promise<{
  transcript: string;
  utterances: Utterance[];
  audioToken: string | null;
}> {
  const form = new FormData();
  form.append("audio", blob, `reunio.${fileExtension(blob.type)}`);
  if (speakers && speakers >= 2) form.append("speakers", String(speakers));

  const startRes = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(startData.error ?? "Error en la transcripció");

  const id: string = startData.id;
  const audioToken: string | null = startData.audioToken ?? null;
  const deadline = Date.now() + 35 * 60 * 1000; // 35 min de marge

  while (Date.now() < deadline) {
    await sleep(4000);
    const res = await fetch(`/api/transcribe/status?id=${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error consultant la transcripció");
    if (data.status === "completed") {
      return {
        transcript: data.text,
        utterances: data.utterances ?? [],
        audioToken,
      };
    }
    if (data.status === "error") {
      throw new Error(data.error ?? "La transcripció ha fallat");
    }
  }
  throw new Error("La transcripció ha excedit el temps màxim d'espera");
}

/** Genera l'acta i la desa a l'històric; retorna l'acta i l'id guardat. */
export async function generateActa(
  utterances: Utterance[],
  audioToken?: string | null
): Promise<{ acta: Acta; id: string | null }> {
  const res = await fetch("/api/acta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utterances, audioToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error generant l'acta");
  return { acta: data.acta as Acta, id: (data.id as string) ?? null };
}

export async function listMeetings(): Promise<MeetingSummary[]> {
  const res = await fetch("/api/meetings");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error carregant l'històric");
  return data.meetings as MeetingSummary[];
}

export async function getMeeting(id: string): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Reunió no trobada");
  return data.meeting as Meeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "No s'ha pogut esborrar");
  }
}
