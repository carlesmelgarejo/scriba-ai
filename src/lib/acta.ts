import { generateWithLLM } from "./assemblyai";
import type { Acta, LlmUsage, Utterance } from "./types";

const PROMPT = `Ets un assistent expert que redacta actes de reunió detallades en català a partir d'una transcripció amb interlocutors identificats (Interlocutor A, B, C...).

Instruccions:
- Analitza la transcripció de manera fidel i completa, sense inventar dades ni ometre temes rellevants.
- Si durant la reunió algú diu el seu nom, fes servir el nom real en comptes de l'etiqueta d'interlocutor (i mapa la resta de mencions d'aquell interlocutor al mateix nom).
- Atribueix les intervencions als interlocutors: als punts tractats, acords i tasques, indica QUI ho proposa, hi està d'acord o se n'encarrega, referenciant l'interlocutor o el seu nom.
- IMPORTANT: les etiquetes d'interlocutor poden ser imprecises en els canvis de torn ràpids (una mateixa intervenció pot aparèixer partida entre dos interlocutors, o una pregunta atribuïda a qui no la fa). Fes servir el context i la coherència del diàleg (preguntes i respostes, el fil de la conversa) per atribuir cada intervenció a l'interlocutor correcte, corregint mentalment aquests errors d'etiquetatge abans de redactar.
- El resum ha de ser substancial (2-4 paràgrafs): context de la reunió, temes principals, posicions dels interlocutors i conclusions.
- A "punts_tractats", detalla cada tema amb prou context (què s'ha dit, matisos, discrepàncies), no una sola frase telegràfica; menciona els interlocutors implicats.
- A "acords", recull les decisions preses i qui les impulsa.
- A "tasques", indica la tasca, el responsable (dedueix-lo de qui parla) i la data límit si es diu.
- Si algun camp no es pot determinar, deixa'l buit.

Respon NOMÉS amb un objecte JSON vàlid, sense text addicional, sense marcadors de codi i SENSE comes finals (trailing commas), amb aquesta forma exacta:
{
  "titol": "títol breu i descriptiu",
  "participants": ["Interlocutor A o nom", "..."],
  "resum": "resum executiu detallat de diversos paràgrafs",
  "punts_tractats": ["punt detallat amb context i interlocutors implicats", "..."],
  "acords": ["acord amb qui l'impulsa", "..."],
  "tasques": [{ "tasca": "descripció", "responsable": "nom o buit", "data_limit": "data o buit" }]
}`;

function labeledTranscript(utterances: Utterance[]): string {
  return utterances.map((u) => `${u.speaker}: ${u.text}`).join("\n");
}

function extractJson(raw: string): unknown {
  let s = raw.trim().replace(/^```(?:json)?/i, "").replace(/```\s*$/, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  s = s.slice(start, end + 1);
  s = s.replace(/,(\s*[}\]])/g, "$1"); // comes finals
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(s.replace(/,(\s*[\r\n]*\s*[}\]])/g, "$1"));
    } catch {
      return {};
    }
  }
}

function buildActa(raw: unknown): Acta {
  const o = (raw ?? {}) as Record<string, unknown>;
  const asStringList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    titol: typeof o.titol === "string" ? o.titol : "Acta de reunió",
    participants: asStringList(o.participants),
    resum: typeof o.resum === "string" ? o.resum : "",
    punts_tractats: asStringList(o.punts_tractats),
    acords: asStringList(o.acords),
    tasques: Array.isArray(o.tasques)
      ? o.tasques.map((t) => {
          const item = (t ?? {}) as Record<string, unknown>;
          return {
            tasca: typeof item.tasca === "string" ? item.tasca : "",
            responsable:
              typeof item.responsable === "string" ? item.responsable : "",
            data_limit:
              typeof item.data_limit === "string" ? item.data_limit : "",
          };
        })
      : [],
  };
}

/** Genera l'acta estructurada a partir de la transcripció per interlocutors. */
export async function generateActa(
  utterances: Utterance[]
): Promise<{ acta: Acta; usage: LlmUsage }> {
  const text = labeledTranscript(utterances);
  const result = await generateWithLLM(text, PROMPT);
  const acta = buildActa(extractJson(result.text));

  // Si l'acta ha tornat buida, la resposta del model no s'ha pogut interpretar
  // (sovint perquè s'ha truncat). Fem que falli de forma visible en comptes de
  // desar una acta buida que després sembla la transcripció.
  const isEmpty =
    !acta.resum &&
    acta.participants.length === 0 &&
    acta.punts_tractats.length === 0 &&
    acta.acords.length === 0 &&
    acta.tasques.length === 0;
  if (isEmpty) {
    const hint =
      result.finishReason === "length"
        ? "la resposta del model s'ha truncat (transcripció massa llarga)"
        : "no s'ha pogut interpretar la resposta del model";
    throw new Error(`L'acta ha tornat buida: ${hint}. Torna-ho a provar.`);
  }

  return {
    acta,
    usage: {
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
  };
}
