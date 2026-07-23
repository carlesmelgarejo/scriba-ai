import type { Acta, Utterance } from "./types";

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Converteix una acta en Markdown per exportar-la. */
export function actaToMarkdown(acta: Acta, utterances: Utterance[]): string {
  const lines: string[] = [`# ${acta.titol}`, ""];

  if (acta.participants.length) {
    lines.push(`**Participants:** ${acta.participants.join(", ")}`, "");
  }
  if (acta.resum) {
    lines.push("## Resum", "", acta.resum, "");
  }
  if (acta.punts_tractats.length) {
    lines.push("## Punts tractats", "");
    acta.punts_tractats.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }
  if (acta.acords.length) {
    lines.push("## Acords", "");
    acta.acords.forEach((a) => lines.push(`- ${a}`));
    lines.push("");
  }
  if (acta.tasques.length) {
    lines.push(
      "## Tasques",
      "",
      "| Tasca | Responsable | Data límit |",
      "| --- | --- | --- |"
    );
    acta.tasques.forEach((t) =>
      lines.push(
        `| ${t.tasca} | ${t.responsable || "—"} | ${t.data_limit || "—"} |`
      )
    );
    lines.push("");
  }

  lines.push("---", "", "## Transcripció completa", "");
  utterances.forEach((u) => lines.push(`**${u.speaker}:** ${u.text}`, ""));

  return lines.join("\n");
}

/** Converteix només la transcripció per interlocutors en Markdown. */
export function transcriptToMarkdown(
  utterances: Utterance[],
  title = "Transcripció"
): string {
  const lines: string[] = [`# ${title}`, ""];
  utterances.forEach((u) => lines.push(`**${u.speaker}:** ${u.text}`, ""));
  return lines.join("\n");
}

/** Genera un slug per als noms de fitxer. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "reunio"
  );
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
