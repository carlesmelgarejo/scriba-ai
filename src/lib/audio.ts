import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

/** Executa ffmpeg amb els arguments donats i retorna el que escriu a stdout
 *  (o null si falla). No fem servir stdin: l'entrada va sempre per fitxer,
 *  perquè amb `pipe:0` ffmpeg no pot cercar i talla mp4/webm i entrades grans. */
function runFfmpeg(args: string[]): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(FFMPEG, args);
    } catch (e) {
      console.error("[ffmpeg] spawn ha fallat:", (e as Error).message);
      resolve(null);
      return;
    }
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.stderr.on("data", (d: Buffer) => errChunks.push(d));
    proc.on("error", (e) => {
      console.error("[ffmpeg] error de procés:", e.message);
      resolve(null);
    });
    proc.on("close", (code) => {
      if (code === 0 && chunks.length) {
        resolve(Buffer.concat(chunks));
        return;
      }
      console.error(
        `[ffmpeg] exit=${code} · stderr=${Buffer.concat(errChunks)
          .toString()
          .slice(0, 600)}`
      );
      resolve(null);
    });
  });
}

/** Escriu l'entrada a un fitxer temporal, executa `fn` amb la ruta i el neteja. */
async function withTempInput<T>(
  input: Buffer,
  fn: (path: string) => Promise<T>
): Promise<T | null> {
  const path = join(tmpdir(), `scriba-${randomBytes(8).toString("hex")}`);
  try {
    await writeFile(path, input);
  } catch (e) {
    console.error("[audio] no s'ha pogut escriure el temporal:", (e as Error).message);
    return null;
  }
  try {
    return await fn(path);
  } finally {
    await unlink(path).catch(() => {});
  }
}

/**
 * Transcodifica qualsevol àudio (webm/opus, mp4/aac...) a Opus mono 16 kHz 32 kbps
 * (contenidor Ogg) fent servir ffmpeg del sistema. Retorna null si ffmpeg no està
 * disponible o falla; el route de desat ho tracta com a error (l'àudio SEMPRE es
 * desa en Opus) perquè el client pugui reintentar.
 */
export function transcodeToOpus(input: Buffer): Promise<Buffer | null> {
  return withTempInput(input, (path) =>
    runFfmpeg([
      "-hide_banner",
      "-loglevel", "error",
      "-i", path,
      "-ac", "1", // mono
      "-ar", "16000", // 16 kHz
      "-c:a", "libopus",
      "-b:a", "32k", // 32 kbps
      "-application", "voip", // optimitzat per veu
      "-f", "ogg",
      "pipe:1",
    ])
  );
}

/**
 * Extreu una forma d'ona (envelope d'amplitud) de l'àudio amb ffmpeg: descodifica
 * a PCM mono 1 kHz i agrupa en `numPeaks` valors (màxim per tram, normalitzat 0..1).
 * Es fa al servidor per no haver de descodificar àudios llargs al navegador.
 */
export async function extractPeaks(
  input: Buffer,
  numPeaks = 600
): Promise<number[] | null> {
  const buf = await withTempInput(input, (path) =>
    runFfmpeg([
      "-hide_banner",
      "-loglevel", "error",
      "-i", path,
      "-ac", "1",
      "-ar", "1000",
      "-f", "s16le",
      "pipe:1",
    ])
  );
  if (!buf) return null;

  const usable = buf.byteLength - (buf.byteLength % 2);
  if (usable <= 0) return null;
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
  return peaks;
}
