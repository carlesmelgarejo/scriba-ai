import { generateWithLLM } from "./assemblyai";
import type { LlmUsage, Utterance } from "./types";

const PROMPT = `Ets un corrector de transcripcions automàtiques en català (poden contenir castellà). Rebràs un array JSON de textos: cada element és una intervenció d'una reunió, EN ORDRE.

La teva única feina és corregir errors EVIDENTS de transcripció automàtica fent servir el context de la conversa:
- homòfons mal transcrits (p. ex. b/v: "bicis"→"vicis"; "haver"/"a veure"; "s"/"ss"/"ç"; accents oberts/tancats),
- límits de paraula mal tallats i paraules clarament mal sentides que no tenen sentit en la frase,
- puntuació o majúscules mínimes per llegibilitat.

NORMES ESTRICTES:
- NO resumeixis, NO reescriguis l'estil, NO afegeixis ni eliminis contingut.
- NO tradueixis: mantén cada intervenció en la llengua original (català o castellà tal com es va dir).
- NO inventis paraules ni completis frases inacabades.
- Si una intervenció ja és correcta, o no tens prou context per estar segur, deixa-la EXACTAMENT igual.

Respon NOMÉS amb un array JSON de la MATEIXA longitud i el MATEIX ordre que l'entrada, on cada element és el text corregit (string). Sense cap text addicional ni marcadors de codi.`;

// Mida màxima (caràcters) per lot: la sortida és tan llarga com l'entrada, així
// que trossegem perquè càpiga dins del límit de tokens del model.
const MAX_CHARS = 5000;

function chunkUtterances(
  utterances: Utterance[],
  maxChars = MAX_CHARS
): Utterance[][] {
  const chunks: Utterance[][] = [];
  let current: Utterance[] = [];
  let size = 0;
  for (const u of utterances) {
    const len = u.text.length + 20;
    if (current.length && size + len > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(u);
    size += len;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function extractStringArray(raw: string): string[] | null {
  let s = raw.trim().replace(/^```(?:json)?/i, "").replace(/```\s*$/, "");
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  s = s.slice(start, end + 1).replace(/,(\s*[\]}])/g, "$1");
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed as string[];
    }
  } catch {
    // format inesperat
  }
  return null;
}

/**
 * Corregeix la transcripció crua amb l'LLM, mantenint els interlocutors i l'ordre.
 * Trosseja per lots i, si un lot no torna un array vàlid de la mateixa llargada,
 * conserva el text original d'aquell lot (mai perd intervencions).
 */
export async function cleanTranscript(
  utterances: Utterance[]
): Promise<{ utterances: Utterance[]; usage: LlmUsage }> {
  const chunks = chunkUtterances(utterances);
  const cleaned: Utterance[] = [];
  const usage: LlmUsage = { model: "", inputTokens: 0, outputTokens: 0 };

  for (const chunk of chunks) {
    const texts = chunk.map((u) => u.text);
    const result = await generateWithLLM(JSON.stringify(texts), PROMPT, "");
    usage.model = result.model;
    usage.inputTokens += result.inputTokens;
    usage.outputTokens += result.outputTokens;

    const corrected = extractStringArray(result.text);
    if (corrected && corrected.length === chunk.length) {
      chunk.forEach((u, i) =>
        cleaned.push({ speaker: u.speaker, text: corrected[i].trim() || u.text })
      );
    } else {
      cleaned.push(...chunk); // conserva l'original si el format no encaixa
    }
  }

  return { utterances: cleaned, usage };
}
