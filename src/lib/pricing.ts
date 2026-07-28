import type { Meeting } from "./types";

// Preus orientatius (USD). Ajusta'ls si canvien a AssemblyAI.
const USD_PER_HOUR_TRANSCRIBE = 0.15; // transcripció (Universal)
const USD_PER_HOUR_DIARIZATION = 0.02; // diarització (add-on)
const USD_TO_EUR = 0.92;

// LLM Gateway: preu per 1M tokens (input / output) segons model.
const LLM_PRICES: Record<string, { in: number; out: number }> = {
  "qwen3-32B": { in: 0.15, out: 0.6 },
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-5-20250929": { in: 3.0, out: 15.0 },
  "gpt-4.1": { in: 2.0, out: 8.0 },
  "gpt-5-mini": { in: 0.25, out: 2.0 },
  "gpt-5-nano": { in: 0.05, out: 0.4 },
  "gemini-2.5-flash": { in: 0.15, out: 0.6 },
};

export interface MeetingCost {
  transcriptionEur: number;
  llmEur: number;
  totalEur: number;
  partial: boolean; // falten dades per a un càlcul complet
}

/** Cost aproximat en euros del processament d'una reunió. */
export function meetingCost(m: Meeting): MeetingCost | null {
  const hasDuration = typeof m.durationSec === "number" && m.durationSec > 0;
  const usages = [m.llm, m.cleanLlm].filter((u): u is NonNullable<typeof u> => !!u);
  const hasLlm = usages.length > 0;
  if (!hasDuration && !hasLlm) return null;

  const transcriptionUsd = hasDuration
    ? (m.durationSec! / 3600) *
      (USD_PER_HOUR_TRANSCRIBE + USD_PER_HOUR_DIARIZATION)
    : 0;

  let llmUsd = 0;
  let missingPrice = false;
  for (const u of usages) {
    const p = LLM_PRICES[u.model];
    if (p) {
      llmUsd +=
        (u.inputTokens / 1_000_000) * p.in +
        (u.outputTokens / 1_000_000) * p.out;
    } else {
      missingPrice = true;
    }
  }

  const totalUsd = transcriptionUsd + llmUsd;
  return {
    transcriptionEur: transcriptionUsd * USD_TO_EUR,
    llmEur: llmUsd * USD_TO_EUR,
    totalEur: totalUsd * USD_TO_EUR,
    partial: !hasDuration || missingPrice,
  };
}

/** Format d'euros amb prou decimals per a imports petits. */
export function formatEur(eur: number): string {
  const digits = eur < 0.1 ? 4 : eur < 1 ? 3 : 2;
  return `${eur.toFixed(digits).replace(".", ",")} €`;
}
