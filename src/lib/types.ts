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
