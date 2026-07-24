"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function fmt(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
}

export function AudioPlayer({
  src,
  peaks,
}: {
  src: string;
  peaks?: number[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  const hasWave = !!peaks && peaks.length > 0;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || !peaks.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim() || "#6d8bff";
    const muted = styles.getPropertyValue("--muted").trim() || "#9aa6c7";

    const ratio = dur > 0 ? cur / dur : 0;
    const N = peaks.length;
    const step = w / N;
    const barW = Math.max(1, step - 1);
    const mid = h / 2;

    for (let i = 0; i < N; i++) {
      const barH = Math.max(2, peaks[i] * (h - 2));
      const played = i / N <= ratio;
      ctx.globalAlpha = played ? 1 : 0.4;
      ctx.fillStyle = played ? accent : muted;
      ctx.fillRect(i * step, mid - barH / 2, barW, barH);
    }
    ctx.globalAlpha = 1;
  }, [peaks, cur, dur]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function seekRatio(ratio: number) {
    const a = audioRef.current;
    if (!a || !dur) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    a.currentTime = clamped * dur;
    setCur(clamped * dur);
  }

  return (
    <div className="player">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="player-btn"
        onClick={toggle}
        aria-label={playing ? "Pausa" : "Reprodueix"}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {hasWave ? (
        <canvas
          ref={canvasRef}
          className="player-wave"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekRatio((e.clientX - rect.left) / rect.width);
          }}
        />
      ) : (
        <input
          className="player-range"
          type="range"
          min={0}
          max={dur || 0}
          step={0.1}
          value={Math.min(cur, dur || 0)}
          onChange={(e) => seekRatio(dur ? Number(e.target.value) / dur : 0)}
          style={
            { ["--pct"]: `${dur ? (cur / dur) * 100 : 0}%` } as React.CSSProperties
          }
          aria-label="Posició de l'àudio"
        />
      )}

      <span className="player-time">
        {fmt(cur)} / {fmt(dur)}
      </span>
    </div>
  );
}
