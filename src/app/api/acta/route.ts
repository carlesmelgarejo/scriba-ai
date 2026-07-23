import { NextRequest, NextResponse } from "next/server";
import { generateWithLLM } from "@/lib/assemblyai";
import { saveMeeting } from "@/lib/store";
import type { Acta, Utterance } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const PROMPT = `Ets un assistent expert que redacta actes de reunió detallades en català a partir d'una transcripció amb interlocutors identificats (Interlocutor A, B, C...).

Instruccions:
- Analitza la transcripció de manera fidel i completa, sense inventar dades ni ometre temes rellevants.
- Si durant la reunió algú diu el seu nom, fes servir el nom real en comptes de l'etiqueta d'interlocutor (i mapa la resta de mencions d'aquell interlocutor al mateix nom).
- Atribueix les intervencions als interlocutors: als punts tractats, acords i tasques, indica QUI ho proposa, hi està d'acord o se n'encarrega, referenciant l'interlocutor o el seu nom.
- El resum ha de ser substancial (2-4 paràgrafs): context de la reunió, temes principals, posicions dels interlocutors i conclusions.
- A "punts_tractats", detalla cada tema amb prou context (què s'ha dit, matisos, discrepàncies), no una sola frase telegràfica; menciona els interlocutors implicats.
- A "acords", recull les decisions preses i qui les impulsa.
- A "tasques", indica la tasca, el responsable (dedueix-lo de qui parla) i la data límit si es diu.
- Si algun camp no es pot determinar, deixa'l buit.

Respon NOMÉS amb un objecte JSON vàlid, sense text addicional ni marcadors de codi, amb aquesta forma exacta:
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
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  return JSON.parse(raw.slice(start, end + 1));
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      utterances?: Utterance[];
      transcript?: string;
      audioToken?: string | null;
    };

    const text =
      body.utterances && body.utterances.length
        ? labeledTranscript(body.utterances)
        : body.transcript ?? "";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "La transcripció és buida" },
        { status: 400 }
      );
    }

    const response = await generateWithLLM(text, PROMPT);
    const acta = buildActa(extractJson(response));

    // Desa la reunió a l'històric (no bloqueja la resposta si falla).
    let id: string | null = null;
    try {
      const meeting = await saveMeeting(
        acta,
        body.utterances ?? [],
        body.audioToken ?? undefined
      );
      id = meeting.id;
    } catch (e) {
      console.error("No s'ha pogut desar la reunió:", e);
    }

    return NextResponse.json({ acta, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut generar l'acta: ${message}` },
      { status: 500 }
    );
  }
}
