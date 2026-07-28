import { useCallback, useEffect, useRef } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: "release", cb: () => void) => void;
}

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
 * Manté la pantalla encesa mentre hi ha una feina en marxa. `acquire` s'ha de
 * cridar dins d'un gest de l'usuari (iOS ho exigeix). Es reincorpora sol si la
 * pàgina torna a ser visible mentre encara està actiu.
 */
export function useWakeLock() {
  const ref = useRef<WakeLockSentinelLike | null>(null);
  const activeRef = useRef(false);

  // Desa el sentinel i, quan el sistema l'alliberi (p. ex. en apagar-se la
  // pantalla), neteja la referència perquè es pugui tornar a demanar.
  const setSentinel = useCallback((s: WakeLockSentinelLike | null) => {
    if (!s) return;
    s.addEventListener?.("release", () => {
      ref.current = null;
    });
    ref.current = s;
  }, []);

  const acquire = useCallback(async () => {
    activeRef.current = true;
    if (!ref.current) setSentinel(await requestWakeLock());
  }, [setSentinel]);

  const release = useCallback(async () => {
    activeRef.current = false;
    await ref.current?.release().catch(() => {});
    ref.current = null;
  }, []);

  useEffect(() => {
    const onVisible = async () => {
      if (
        document.visibilityState === "visible" &&
        activeRef.current &&
        !ref.current
      ) {
        setSentinel(await requestWakeLock());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [setSentinel]);

  useEffect(() => {
    return () => {
      void ref.current?.release().catch(() => {});
    };
  }, []);

  return { acquire, release };
}
