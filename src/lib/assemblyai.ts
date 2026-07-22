import type { Utterance } from "./types";

const BASE = "https://api.assemblyai.com";

export const LANGUAGE = process.env.ASSEMBLYAI_LANGUAGE ?? "ca";
export const LEMUR_MODEL =
  process.env.ASSEMBLYAI_LEMUR_MODEL ?? "anthropic/claude-3-5-sonnet";

function apiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error("Falta la variable d'entorn ASSEMBLYAI_API_KEY");
  return key;
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = { authorization: apiKey() };
  if (json) h["content-type"] = "application/json";
  return h;
}

/** Puja l'àudio i retorna la URL temporal d'AssemblyAI. */
async function uploadAudio(file: File): Promise<string> {
  const res = await fetch(`${BASE}/v2/upload`, {
    method: "POST",
    headers: headers(),
    body: await file.arrayBuffer(),
  });
  if (!res.ok) throw new Error(`Error pujant l'àudio (${res.status})`);
  const data = (await res.json()) as { upload_url: string };
  return data.upload_url;
}

interface TranscriptResult {
  status: string;
  text?: string;
  error?: string;
  utterances?: { speaker: string; text: string }[];
}

async function createTranscript(audioUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/v2/transcript`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true,
      language_code: LANGUAGE,
    }),
  });
  if (!res.ok) throw new Error(`Error creant la transcripció (${res.status})`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export interface TranscriptionStatus {
  status: "queued" | "processing" | "completed" | "error";
  text: string;
  utterances: Utterance[];
  error?: string;
}

/** Puja l'àudio i encua la transcripció; retorna l'id de la feina. */
export async function startTranscription(file: File): Promise<string> {
  const audioUrl = await uploadAudio(file);
  return createTranscript(audioUrl);
}

/** Consulta l'estat d'una transcripció i, si està llesta, retorna el resultat. */
export async function getTranscriptionStatus(
  id: string
): Promise<TranscriptionStatus> {
  const res = await fetch(`${BASE}/v2/transcript/${id}`, { headers: headers() });
  if (!res.ok) throw new Error(`Error consultant la transcripció (${res.status})`);
  const data = (await res.json()) as TranscriptResult;

  const utterances: Utterance[] = (data.utterances ?? []).map((u) => ({
    speaker: `Interlocutor ${u.speaker}`,
    text: u.text,
  }));

  return {
    status: data.status as TranscriptionStatus["status"],
    text: data.text ?? "",
    utterances,
    error: data.error,
  };
}

/** Genera text lliure amb LeMUR a partir d'un prompt i un text d'entrada. */
export async function lemurTask(
  inputText: string,
  prompt: string
): Promise<string> {
  const res = await fetch(`${BASE}/lemur/v3/generate/task`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      input_text: inputText,
      prompt,
      final_model: LEMUR_MODEL,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Error de LeMUR (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { response: string };
  return data.response;
}
