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

const MAX_IMPORT_SECONDS = 180 * 60;

/** Llegeix la durada d'un fitxer d'àudio al navegador. Retorna 0 si no es pot
 *  determinar. Gestiona el cas dels webm de MediaRecorder, que reporten
 *  `Infinity` fins que es força un seek al final. */
function readAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const done = (secs: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(secs) ? Math.round(secs) : 0);
    };
    const timeout = setTimeout(() => done(0), 8000);
    el.preload = "metadata";
    el.onerror = () => {
      clearTimeout(timeout);
      done(0);
    };
    el.onloadedmetadata = () => {
      if (el.duration === Infinity) {
        el.ontimeupdate = () => {
          el.ontimeupdate = null;
          clearTimeout(timeout);
          done(el.duration);
        };
        el.currentTime = 1e101; // força el càlcul de la durada real
      } else {
        clearTimeout(timeout);
        done(el.duration);
      }
    };
    el.src = url;
  });
}

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
  // Àudio gravat pendent de desar: es reté per poder reintentar si el desat falla.
  const [pending, setPending] = useState<{
    blob: Blob;
    durationSec: number;
    speakers: SpeakerOption;
  } | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const autoStopped = useRef(false);

  // URL local del blob pendent (per a la descàrrega de seguretat).
  useEffect(() => {
    if (!pending) {
      setPendingUrl(null);
      return;
    }
    const url = URL.createObjectURL(pending.blob);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  const doSave = useCallback(
    async (item: { blob: Blob; durationSec: number; speakers: SpeakerOption }) => {
      setError(null);
      setPhase("saving"); // el Wake Lock segueix actiu durant el desat
      try {
        const meeting = await saveAudioMeeting(
          item.blob,
          item.speakers,
          item.durationSec
        );
        setPending(null);
        setViewing(meeting);
        setSelectedId(meeting.id);
        setReloadSignal((n) => n + 1);
      } catch (e) {
        // No esborrem el pendent: així es pot reintentar sense perdre l'àudio.
        setError(e instanceof Error ? e.message : "Error desant l'àudio");
      } finally {
        setPhase("idle");
        await wake.release();
      }
    },
    [wake]
  );

  const saveRecording = useCallback(async () => {
    const durationSec = recorder.seconds;
    const blob = await recorder.stop();
    if (!blob || blob.size === 0) {
      setPhase("idle");
      setError("No s'ha capturat àudio.");
      await wake.release();
      return;
    }
    const item = { blob, durationSec, speakers };
    setPending(item);
    await doSave(item);
  }, [recorder, speakers, doSave]);

  const retrySave = useCallback(async () => {
    if (!pending) return;
    await wake.acquire(); // dins del gest de l'usuari (necessari a iOS)
    await doSave(pending);
  }, [pending, wake, doSave]);

  const importAudio = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // permet reimportar el mateix fitxer
      if (!file || phase === "saving" || recorder.state === "recording") return;
      setError(null);
      setViewing(null);
      setSelectedId(null);
      const durationSec = await readAudioDuration(file);
      if (durationSec > MAX_IMPORT_SECONDS) {
        setError("L'àudio supera el màxim de 180 minuts.");
        return;
      }
      const item = { blob: file, durationSec, speakers };
      setPending(item);
      await wake.acquire();
      await doSave(item);
    },
    [phase, recorder.state, speakers, wake, doSave]
  );

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
    setPending(null); // descartem qualsevol àudio pendent no desat
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 12H3m0 0l3.5-3.5M3 12l3.5 3.5M10 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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

              {recorder.state !== "recording" && !busy && (
                <label className="btn ghost import-btn">
                  Importar àudio
                  <input
                    type="file"
                    accept="audio/*,video/mp4,.webm,.m4a,.mp3,.wav,.opus,.ogg"
                    hidden
                    onChange={importAudio}
                  />
                </label>
              )}

              {(recorder.state === "recording" || busy) && <ProcessingWarning />}

              {error && <div className="error">{error}</div>}

              {pending && !busy && (
                <div className="retry-actions">
                  <button type="button" className="btn primary" onClick={retrySave}>
                    Reintentar desar
                  </button>
                  {pendingUrl && (
                    <a
                      className="btn ghost"
                      href={pendingUrl}
                      download={`reunio-${pending.durationSec}s.${
                        pending.blob.type.includes("mp4") ? "m4a" : "webm"
                      }`}
                    >
                      Descarregar còpia
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
