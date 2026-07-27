import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording";

interface UseRecorder {
  state: RecorderState;
  seconds: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
}

/**
 * Encapsula la captura de micròfon amb MediaRecorder.
 * `start` demana permís i comença a gravar; `stop` retorna el Blob resultant.
 * El Wake Lock es gestiona fora (a la pàgina) per cobrir també el desat.
 */
export function useRecorder(): UseRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 48 kbps: prou per a veu i manté els fitxers petits (m4a de l'iPhone,
      // webm de Chrome) per no topar amb el límit de pujada. El servidor ho
      // reconverteix a Opus igualment.
      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 48000 });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      recorderRef.current = recorder;

      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setState("recording");
    } catch {
      setError(
        "No s'ha pogut accedir al micròfon. Comprova els permisos del navegador."
      );
    }
  }, []);

  const stop = useCallback(() => {
    return new Promise<Blob | null>((resolve) => {
      const recorder = recorderRef.current;
      clearTimer();

      if (!recorder || recorder.state === "inactive") {
        setState("idle");
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stopTracks();
        setState("idle");
        resolve(blob);
      };
      recorder.stop();
    });
  }, [clearTimer, stopTracks]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
    };
  }, [clearTimer, stopTracks]);

  return { state, seconds, error, start, stop };
}
