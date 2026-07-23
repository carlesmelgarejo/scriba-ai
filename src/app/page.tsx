"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecorder } from "@/hooks/useRecorder";
import { Recorder } from "@/components/Recorder";
import { DurationSelector } from "@/components/DurationSelector";
import { SpeakerSelector } from "@/components/SpeakerSelector";
import { ActaView } from "@/components/ActaView";
import { HistorySidebar } from "@/components/HistorySidebar";
import { transcribeAudio, generateActa, getMeeting } from "@/lib/api";
import type { Acta, Utterance, DurationOption, SpeakerOption } from "@/lib/types";

type Phase = "idle" | "recording" | "transcribing" | "generating" | "done";

interface Viewing {
  id: string | null;
  acta: Acta;
  utterances: Utterance[];
  hasAudio: boolean;
}

const STATUS_TEXT: Record<Phase, string> = {
  idle: "Prem el botó per començar a gravar la reunió.",
  recording: "Gravant… prem de nou per aturar i generar l'acta.",
  transcribing: "Transcrivint i identificant interlocutors…",
  generating: "Redactant l'acta…",
  done: "Acta generada i desada a l'històric.",
};

export default function Home() {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>("idle");
  const [limitMinutes, setLimitMinutes] = useState<DurationOption>(60);
  const [speakers, setSpeakers] = useState<SpeakerOption>(0);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);
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
      const result = await transcribeAudio(blob, speakers);

      setPhase("generating");
      const generated = await generateActa(result.utterances, result.audioToken);

      setViewing({
        id: generated.id,
        acta: generated.acta,
        utterances: result.utterances,
        hasAudio: !!result.audioToken,
      });
      setSelectedId(generated.id);
      setReloadSignal((n) => n + 1);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperat");
      setPhase("idle");
    }
  }, [recorder, speakers]);

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
    setViewing(null);
    setSelectedId(null);
    await recorder.start();
    setPhase("recording");
  }

  async function handleSelect(id: string | null) {
    setError(null);
    setSelectedId(id);
    if (!id) {
      setViewing(null);
      return;
    }
    try {
      const m = await getMeeting(id);
      setViewing({
        id: m.id,
        acta: m.acta,
        utterances: m.utterances,
        hasAudio: !!m.hasAudio,
      });
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No s'ha pogut carregar");
    }
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
        <button type="button" className="btn ghost logout" onClick={handleLogout}>
          Sortir
        </button>
      </div>

      <div className="layout">
        <HistorySidebar
          reloadSignal={reloadSignal}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        <div className="main-col">
          <div className="card">
            <DurationSelector
              value={limitMinutes}
              disabled={recorder.state === "recording" || busy}
              onChange={setLimitMinutes}
            />

            <SpeakerSelector
              value={speakers}
              disabled={recorder.state === "recording" || busy}
              onChange={setSpeakers}
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

            {error && <div className="error">{error}</div>}
          </div>

          {viewing && (
            <ActaView
              acta={viewing.acta}
              utterances={viewing.utterances}
              audioUrl={
                viewing.hasAudio && viewing.id
                  ? `/api/meetings/${viewing.id}/audio`
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
