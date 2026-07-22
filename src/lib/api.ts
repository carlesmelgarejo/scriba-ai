import type { Acta, Utterance } from "./types";

function fileExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Puja l'àudio, encua la transcripció i fa polling fins que està llesta. */
export async function transcribeAudio(
  blob: Blob
): Promise<{ transcript: string; utterances: Utterance[] }> {
  const form = new FormData();
  form.append("audio", blob, `reunio.${fileExtension(blob.type)}`);

  const startRes = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(startData.error ?? "Error en la transcripció");

  const id: string = startData.id;
  const deadline = Date.now() + 35 * 60 * 1000; // 35 min de marge

  while (Date.now() < deadline) {
    await sleep(4000);
    const res = await fetch(`/api/transcribe/status?id=${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error consultant la transcripció");
    if (data.status === "completed") {
      return { transcript: data.text, utterances: data.utterances ?? [] };
    }
    if (data.status === "error") {
      throw new Error(data.error ?? "La transcripció ha fallat");
    }
  }
  throw new Error("La transcripció ha excedit el temps màxim d'espera");
}

export async function generateActa(utterances: Utterance[]): Promise<Acta> {
  const res = await fetch("/api/acta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utterances }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error generant l'acta");
  return data.acta as Acta;
}
