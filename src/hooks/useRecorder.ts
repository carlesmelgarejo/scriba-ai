import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording";

interface UseRecorder {
  state: RecorderState;
  seconds: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

/** Manté la pantalla encesa mentre es grava (iOS Safari 16.4+, Chrome…). */
async function requestWakeLock(): Promise<WakeLockSentinelLike | null> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    return nav.wakeLock ? await nav.wakeLock.request("screen") : null;
  } catch {
    return null;
  }
}

/**
 * Encapsula la captura de micròfon amb MediaRecorder.
 * `start` demana permís i comença a gravar; `stop` retorna el Blob resultant.
 */
export function useRecorder(): UseRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const releaseWakeLock = useCallback(async () => {
    await wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      recorderRef.current = recorder;

      wakeLockRef.current = await requestWakeLock();

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
        void releaseWakeLock();
        setState("idle");
        resolve(blob);
      };
      recorder.stop();
    });
  }, [clearTimer, stopTracks, releaseWakeLock]);

  // iOS/Chrome alliberen el wake lock quan s'amaga la pàgina: el reincorporem.
  useEffect(() => {
    if (state !== "recording") return;
    const onVisible = async () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        wakeLockRef.current = await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [state]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      void releaseWakeLock();
    };
  }, [clearTimer, stopTracks, releaseWakeLock]);

  return { state, seconds, error, start, stop };
}
