import { spawn } from "child_process";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

/**
 * Transcodifica qualsevol àudio (webm/opus, mp4/aac...) a Opus mono 16 kHz 24 kbps
 * (contenidor Ogg) fent servir ffmpeg del sistema. Retorna null si ffmpeg no està
 * disponible o falla; el route de desat ho tracta com a error (l'àudio SEMPRE es
 * desa en Opus) perquè el client pugui reintentar.
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

/**
 * Extreu una forma d'ona (envelope d'amplitud) de l'àudio amb ffmpeg: descodifica
 * a PCM mono 1 kHz i agrupa en `numPeaks` valors (màxim per tram, normalitzat 0..1).
 * Es fa al servidor per no haver de descodificar àudios llargs al navegador.
 */
export function extractPeaks(
  input: Buffer,
  numPeaks = 600
): Promise<number[] | null> {
  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-ac", "1",
      "-ar", "1000",
      "-f", "s16le",
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
    proc.on("error", () => resolve(null));
    proc.on("close", (code) => {
      if (code !== 0 || !chunks.length) {
        resolve(null);
        return;
      }
      const buf = Buffer.concat(chunks);
      const usable = buf.byteLength - (buf.byteLength % 2);
      if (usable <= 0) {
        resolve(null);
        return;
      }
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + usable);
      const samples = new Int16Array(ab);
      const L = samples.length;
      const P = Math.min(numPeaks, L);
      const bucket = Math.floor(L / P) || 1;
      const peaks: number[] = [];
      for (let i = 0; i < P; i++) {
        let max = 0;
        const start = i * bucket;
        const end = Math.min(start + bucket, L);
        for (let j = start; j < end; j++) {
          const v = Math.abs(samples[j]);
          if (v > max) max = v;
        }
        peaks.push(Number((max / 32768).toFixed(3)));
      }
      resolve(peaks);
    });

    proc.stdin.on("error", () => {});
    proc.stdin.write(input);
    proc.stdin.end();
  });
}
