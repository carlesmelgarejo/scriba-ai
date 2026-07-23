import { spawn } from "child_process";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

/**
 * Transcodifica qualsevol àudio (webm/opus, mp4/aac...) a Opus mono 16 kHz 24 kbps
 * (contenidor Ogg) fent servir ffmpeg del sistema. Retorna null si ffmpeg no està
 * disponible o falla, perquè el desat d'àudio és opcional i no ha de trencar el flux.
 */
export function transcodeToOpus(input: Buffer): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-ac", "1", // mono
      "-ar", "16000", // 16 kHz
      "-c:a", "libopus",
      "-b:a", "24k", // 24 kbps
      "-application", "voip", // optimitzat per veu
      "-f", "ogg",
      "pipe:1",
    ];

    let proc;
    try {
      proc = spawn(FFMPEG, args);
    } catch {
      resolve(null);
      return;
    }

    const chunks: Buffer[] = [];
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.on("error", () => resolve(null)); // ffmpeg no instal·lat
    proc.on("close", (code) => {
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
      else resolve(null);
    });

    proc.stdin.on("error", () => {});
    proc.stdin.write(input);
    proc.stdin.end();
  });
}
