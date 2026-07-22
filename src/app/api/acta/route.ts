import { NextRequest, NextResponse } from "next/server";
import { lemurTask } from "@/lib/assemblyai";
import type { Acta, Utterance } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const PROMPT = `Ets un assistent que redacta actes de reunió en català a partir d'una transcripció amb interlocutors identificats (Interlocutor A, B, C...).
Analitza la transcripció de manera fidel, sense inventar dades.
Si durant la reunió algú diu el seu nom, fes servir el nom real en comptes de l'etiqueta d'interlocutor.
A "participants" llista els interlocutors detectats (amb nom real si es coneix).
A cada tasca, indica el responsable si es pot deduir de qui parla.
Si algun camp no es pot determinar, deixa'l buit.
Respon NOMÉS amb un objecte JSON vàlid, sense text addicional ni marcadors de codi, amb aquesta forma exacta:
{
  "titol": "títol breu i descriptiu",
  "participants": ["Interlocutor A o nom", "..."],
  "resum": "resum executiu d'un o dos paràgrafs",
  "punts_tractats": ["punt 1", "punt 2"],
  "acords": ["acord 1", "acord 2"],
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

    const response = await lemurTask(text, PROMPT);
    const acta = buildActa(extractJson(response));

    return NextResponse.json({ acta });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut generar l'acta: ${message}` },
      { status: 500 }
    );
  }
}
