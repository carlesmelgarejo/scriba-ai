import type { Utterance } from "./types";

const BASE = "https://api.assemblyai.com";
const LLM_GATEWAY = "https://llm-gateway.assemblyai.com/v1/chat/completions";

export const LANGUAGE = process.env.ASSEMBLYAI_LANGUAGE ?? "ca";
export const LLM_MODEL = process.env.ASSEMBLYAI_LLM_MODEL ?? "qwen3-32B";

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

/** Puja bytes d'àudio i retorna la URL temporal d'AssemblyAI. */
async function uploadBytes(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const res = await fetch(`${BASE}/v2/upload`, {
    method: "POST",
    headers: headers(),
    body: bytes as BodyInit,
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

async function createTranscript(
  audioUrl: string,
  maxSpeakers?: number
): Promise<string> {
  const body: Record<string, unknown> = {
    audio_url: audioUrl,
    speaker_labels: true,
    language_code: LANGUAGE,
  };
  // Límit superior de participants (no un nombre exacte): acota la diarització
  // sense forçar el model a inventar interlocutors si no parlen tots.
  if (maxSpeakers && maxSpeakers >= 2) {
    body.speaker_options = { max_speakers_expected: maxSpeakers };
  }

  const res = await fetch(`${BASE}/v2/transcript`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(body),
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

/** Puja bytes d'àudio i encua la transcripció; retorna l'id de la feina. */
export async function startTranscriptionFromBytes(
  bytes: Buffer,
  speakersExpected?: number
): Promise<string> {
  const audioUrl = await uploadBytes(bytes);
  return createTranscript(audioUrl, speakersExpected);
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

export interface LlmResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Genera text a partir d'un prompt i un text d'entrada amb l'LLM Gateway
 * d'AssemblyAI (compatible amb OpenAI, mateixa clau d'API). Retorna també l'ús
 * de tokens per calcular el cost.
 */
export async function generateWithLLM(
  inputText: string,
  prompt: string
): Promise<LlmResult> {
  const res = await fetch(LLM_GATEWAY, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: 2000,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Transcripció de la reunió:\n\n${inputText}` },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Error de l'LLM Gateway (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model: LLM_MODEL,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
