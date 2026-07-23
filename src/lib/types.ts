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

export interface Meeting {
  id: string;
  createdAt: string;
  acta: Acta;
  utterances: Utterance[];
  hasAudio?: boolean;
}

export interface MeetingSummary {
  id: string;
  createdAt: string;
  titol: string;
  participants: string[];
  hasAudio?: boolean;
}
