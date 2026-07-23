export interface Utterance {
  speaker: string;
  text: string;
}

export interface ActionItem {
  tasca: string;
  responsable: string;
  data_limit: string;
}

export interface Acta {
  titol: string;
  participants: string[];
  resum: string;
  punts_tractats: string[];
  acords: string[];
  tasques: ActionItem[];
}

export interface TranscribeResponse {
  transcript: string;
  utterances: Utterance[];
}

export interface ActaResponse {
  acta: Acta;
}

export const DURATION_OPTIONS = [60, 90, 120, 180] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number];

// 0 = automàtic (deixa que el model ho dedueixi). La resta és un LÍMIT SUPERIOR
// de participants, no un nombre exacte (evita sobre-dividir si no parlen tots).
export const SPEAKER_OPTIONS = [0, 2, 3, 4, 5, 6, 8, 10, 15, 20] as const;
export type SpeakerOption = (typeof SPEAKER_OPTIONS)[number];

// Estats derivats (no es desen; es calculen segons què tingui la reunió):
// audio → només àudio; transcribing → transcripció en marxa; transcribed →
// transcripció feta; done → acta generada.
export type MeetingStatus = "audio" | "transcribing" | "transcribed" | "done";

export interface LlmUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Meeting {
  id: string;
  createdAt: string;
  title: string; // etiqueta (data/hora) fins que hi ha acta
  hasAudio: boolean;
  transcriptId?: string; // id de la feina d'AssemblyAI durant la transcripció
  speakers?: number; // pista de participants triada en gravar
  durationSec?: number; // durada de l'àudio gravat (per calcular el cost)
  llm?: LlmUsage; // ús de l'LLM en generar l'acta (per calcular el cost)
  utterances: Utterance[]; // buit fins que es transcriu
  acta: Acta | null; // null fins que es genera
}

export interface MeetingSummary {
  id: string;
  createdAt: string;
  title: string;
  status: MeetingStatus;
  hasAudio: boolean;
}

export function meetingStatus(m: {
  acta: Acta | null;
  utterances: Utterance[];
  transcriptId?: string;
}): MeetingStatus {
  if (m.acta) return "done";
  if (m.utterances && m.utterances.length) return "transcribed";
  if (m.transcriptId) return "transcribing";
  return "audio";
}
