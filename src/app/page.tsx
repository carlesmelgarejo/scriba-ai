"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecorder } from "@/hooks/useRecorder";
import { Recorder } from "@/components/Recorder";
import { DurationSelector } from "@/components/DurationSelector";
import { ActaView } from "@/components/ActaView";
import { transcribeAudio, generateActa } from "@/lib/api";
import type { Acta, Utterance, DurationOption } from "@/lib/types";

type Phase = "idle" | "recording" | "transcribing" | "generating" | "done";

const STATUS_TEXT: Record<Phase, string> = {
  idle: "Prem el botó per començar a gravar la reunió.",
  recording: "Gravant… prem de nou per aturar i generar l'acta.",
  transcribing: "Transcrivint i identificant interlocutors…",
  generating: "Redactant l'acta…",
  done: "Acta generada. Pots exportar-la o iniciar una nova reunió.",
};

export default function Home() {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>("idle");
  const [limitMinutes, setLimitMinutes] = useState<DurationOption>(60);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [acta, setActa] = useState<Acta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoStopped = useRef(false);

  const busy = phase === "transcribing" || phase === "generating";

  const runPipeline = useCallback(async () => {
    const blob = await recorder.stop();
    if (!blob || blob.size === 0) {
      setPhase("idle");
      setError("No s'ha capturat àudio.");
      return;
    }

    try {
      setPhase("transcribing");
      const result = await transcribeAudio(blob);
      setUtterances(result.utterances);

      setPhase("generating");
      const generated = await generateActa(result.utterances);
      setActa(generated);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperat");
      setPhase("idle");
    }
  }, [recorder]);

  // Aturada automàtica en arribar al límit de durada seleccionat.
  useEffect(() => {
    if (phase !== "recording") {
      autoStopped.current = false;
      return;
    }
    if (recorder.seconds >= limitMinutes * 60 && !autoStopped.current) {
      autoStopped.current = true;
      void runPipeline();
    }
  }, [phase, recorder.seconds, limitMinutes, runPipeline]);

  async function handleToggle() {
    setError(null);
    if (recorder.state === "recording") {
      await runPipeline();
      return;
    }
    setActa(null);
    setUtterances([]);
    await recorder.start();
    setPhase("recording");
  }

  function handleReset() {
    setActa(null);
    setUtterances([]);
    setError(null);
    setPhase("idle");
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="container">
      <div className="header">
        <div className="logo" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
              fill="white"
            />
            <path
              d="M6 11a6 6 0 0 0 12 0M12 18v3"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="header-text">
          <h1 className="title">ScribaAI</h1>
          <p className="subtitle">
            Grava la reunió i obté la transcripció amb interlocutors i l&apos;acta.
          </p>
        </div>
        <button
          type="button"
          className="btn ghost logout"
          onClick={handleLogout}
        >
          Sortir
        </button>
      </div>

      <div className="card">
        <DurationSelector
          value={limitMinutes}
          disabled={recorder.state === "recording" || busy}
          onChange={setLimitMinutes}
        />

        <Recorder
          state={recorder.state}
          seconds={recorder.seconds}
          disabled={busy}
          onToggle={handleToggle}
        />

        <div className="status">
          {busy ? (
            <span className="busy">
              <span className="spinner" />
              {STATUS_TEXT[phase]}
            </span>
          ) : (
            recorder.error ?? STATUS_TEXT[phase]
          )}
        </div>

        {phase === "done" && (
          <div className="footer-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="btn ghost" onClick={handleReset}>
              Nova reunió
            </button>
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </div>

      {acta && <ActaView acta={acta} utterances={utterances} />}
    </main>
  );
}
