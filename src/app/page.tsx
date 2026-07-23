"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecorder } from "@/hooks/useRecorder";
import { useWakeLock } from "@/hooks/useWakeLock";
import { Recorder } from "@/components/Recorder";
import { DurationSelector } from "@/components/DurationSelector";
import { SpeakerSelector } from "@/components/SpeakerSelector";
import { MeetingView } from "@/components/ActaView";
import { HistorySidebar } from "@/components/HistorySidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProcessingWarning } from "@/components/ProcessingWarning";
import { saveAudioMeeting, getMeeting } from "@/lib/api";
import type { Meeting, DurationOption, SpeakerOption } from "@/lib/types";

type Phase = "idle" | "recording" | "saving";

const STATUS_TEXT: Record<Phase, string> = {
  idle: "Prem el botó per començar a gravar la reunió.",
  recording: "Gravant… prem de nou per aturar i desar l'àudio.",
  saving: "Desant l'àudio…",
};

export default function Home() {
  const recorder = useRecorder();
  const wake = useWakeLock();
  const [phase, setPhase] = useState<Phase>("idle");
  const [limitMinutes, setLimitMinutes] = useState<DurationOption>(60);
  const [speakers, setSpeakers] = useState<SpeakerOption>(0);
  const [viewing, setViewing] = useState<Meeting | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const autoStopped = useRef(false);

  const saveRecording = useCallback(async () => {
    const durationSec = recorder.seconds;
    const blob = await recorder.stop();
    if (!blob || blob.size === 0) {
      setPhase("idle");
      setError("No s'ha capturat àudio.");
      await wake.release();
      return;
    }
    try {
      setPhase("saving"); // el Wake Lock segueix actiu durant el desat
      const meeting = await saveAudioMeeting(blob, speakers, durationSec);
      setViewing(meeting);
      setSelectedId(meeting.id);
      setReloadSignal((n) => n + 1);
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desant l'àudio");
      setPhase("idle");
    } finally {
      await wake.release();
    }
  }, [recorder, speakers, wake]);

  // Aturada automàtica en arribar al límit de durada seleccionat.
  useEffect(() => {
    if (phase !== "recording") {
      autoStopped.current = false;
      return;
    }
    if (recorder.seconds >= limitMinutes * 60 && !autoStopped.current) {
      autoStopped.current = true;
      void saveRecording();
    }
  }, [phase, recorder.seconds, limitMinutes, saveRecording]);

  async function handleToggle() {
    setError(null);
    if (recorder.state === "recording") {
      await saveRecording();
      return;
    }
    setViewing(null);
    setSelectedId(null);
    await wake.acquire(); // dins del gest de l'usuari (necessari a iOS)
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
      setViewing(await getMeeting(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No s'ha pogut carregar");
    }
  }

  function handleUpdated(m: Meeting) {
    setViewing(m);
    setReloadSignal((n) => n + 1);
  }

  function handleClose() {
    setViewing(null);
    setSelectedId(null);
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const busy = phase === "saving";

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
            Grava la reunió; transcriu i genera l&apos;acta quan vulguis.
          </p>
        </div>
        <div className="header-nav">
          <ThemeToggle />
          <button type="button" className="btn ghost logout" onClick={handleLogout}>
            Sortir
          </button>
        </div>
      </div>

      <div className="layout">
        <HistorySidebar
          reloadSignal={reloadSignal}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        <div className="main-col">
          {viewing ? (
            <MeetingView
              meeting={viewing}
              onClose={handleClose}
              onUpdated={handleUpdated}
            />
          ) : (
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

              {(recorder.state === "recording" || busy) && <ProcessingWarning />}

              {error && <div className="error">{error}</div>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
