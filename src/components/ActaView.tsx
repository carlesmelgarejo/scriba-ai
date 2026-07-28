"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Meeting } from "@/lib/types";
import { meetingStatus, actaHasContent, displayUtterances } from "@/lib/types";
import {
  actaToMarkdown,
  transcriptToMarkdown,
  downloadText,
  slugify,
} from "@/lib/format";
import { meetingCost, formatEur } from "@/lib/pricing";
import {
  startTranscription,
  checkTranscription,
  cleanTranscript,
  generateActa,
} from "@/lib/api";
import { useWakeLock } from "@/hooks/useWakeLock";
import { CollapsibleSection } from "./CollapsibleSection";
import { ProcessingWarning } from "./ProcessingWarning";
import { AudioPlayer } from "./AudioPlayer";

interface MeetingViewProps {
  meeting: Meeting;
  onClose?: () => void;
  onUpdated: (m: Meeting) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ca-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DownloadIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 18.5a4.2 4.2 0 0 1-.8-8.32 5.2 5.2 0 0 1 10.1-1.03A3.8 3.8 0 0 1 16.8 18.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11v6m0 0l-2.3-2.3M12 17l2.3-2.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="icon-download"
      title="Descarrega"
      aria-label="Descarrega"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <DownloadIcon />
    </button>
  );
}

export function MeetingView({ meeting, onClose, onUpdated }: MeetingViewProps) {
  const wake = useWakeLock();
  const [working, setWorking] = useState<
    null | "transcribing" | "cleaning" | "generating"
  >(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef(false);

  const status = meetingStatus(meeting);
  const { acta } = meeting;
  const transcript = displayUtterances(meeting);
  const isCleaned = !!(
    meeting.cleanedUtterances && meeting.cleanedUtterances.length
  );
  const title = meeting.title || acta?.titol || formatDateTime(meeting.createdAt);
  const slug = slugify(title);
  const audioUrl = meeting.hasAudio
    ? `/api/meetings/${meeting.id}/audio`
    : undefined;

  const poll = useCallback(
    async (id: string) => {
      const deadline = Date.now() + 40 * 60 * 1000;
      while (Date.now() < deadline) {
        await sleep(5000);
        const res = await checkTranscription(id);
        if (res.status === "completed") {
          onUpdated(res.meeting);
          return;
        }
        if (res.status === "error") {
          throw new Error(res.error ?? "La transcripció ha fallat");
        }
      }
      throw new Error("La transcripció ha excedit el temps màxim d'espera");
    },
    [onUpdated]
  );

  // Represa automàtica: si tornem a una reunió que estava transcrivint, continua.
  useEffect(() => {
    if (status === "transcribing" && working === null && !pollingRef.current) {
      pollingRef.current = true;
      poll(meeting.id)
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Error en la transcripció")
        )
        .finally(() => (pollingRef.current = false));
    }
  }, [status, working, meeting.id, poll]);

  async function handleTranscribe() {
    setError(null);
    setWorking("transcribing");
    await wake.acquire();
    try {
      const started = await startTranscription(meeting.id);
      onUpdated(started);
      await poll(meeting.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en la transcripció");
    } finally {
      await wake.release();
      setWorking(null);
    }
  }

  async function handleClean() {
    setError(null);
    setWorking("cleaning");
    await wake.acquire();
    try {
      const updated = await cleanTranscript(meeting.id);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error netejant la transcripció");
    } finally {
      await wake.release();
      setWorking(null);
    }
  }

  async function handleActa() {
    setError(null);
    setWorking("generating");
    await wake.acquire();
    try {
      const updated = await generateActa(meeting.id);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generant l'acta");
    } finally {
      await wake.release();
      setWorking(null);
    }
  }

  const exportActa = () =>
    acta && downloadText(`acta-${slug}.md`, actaToMarkdown(acta, transcript));
  const exportTranscript = () =>
    downloadText(
      `transcripcio-${slug}.md`,
      transcriptToMarkdown(transcript, title)
    );

  const transcribing = status === "transcribing" || working === "transcribing";
  const cost = meetingCost(meeting);

  return (
    <section className="card meeting-card">
      <div className="meeting-header">
        <h2 className="meeting-title-main">{title}</h2>
        {onClose && (
          <button
            type="button"
            className="icon-btn close-btn"
            onClick={onClose}
            aria-label="Tancar"
            title="Tancar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {audioUrl && (
        <div className="audio-block">
          <AudioPlayer src={audioUrl} peaks={meeting.peaks} />
          <a
            className="icon-download"
            href={audioUrl}
            download={`audio-${slug}.opus`}
            title="Descarrega"
            aria-label="Descarrega"
          >
            <DownloadIcon />
          </a>
        </div>
      )}

      {cost && cost.totalEur > 0 && (
        <p className="meeting-cost" title="Cost orientatiu del processament">
          Cost aproximat: <strong>{formatEur(cost.totalEur)}</strong>
          <span className="cost-breakdown">
            {" "}
            (transcripció {formatEur(cost.transcriptionEur)} · acta{" "}
            {formatEur(cost.llmEur)})
          </span>
        </p>
      )}

      {/* Pas 2: transcriure */}
      {status === "audio" && !transcribing && (
        <div className="step-action">
          <button type="button" className="btn primary" onClick={handleTranscribe}>
            Transcriure l&apos;àudio
          </button>
        </div>
      )}

      {transcribing && (
        <div className="step-status">
          <span className="spinner" /> Transcrivint i identificant
          interlocutors… pots tancar; es desarà sol.
        </div>
      )}

      {/* Acta (si té contingut real) */}
      {actaHasContent(acta) && (
        <CollapsibleSection
          title="Acta"
          card={false}
          defaultOpen
          actions={<ExportButton onClick={exportActa} />}
        >
          {acta.participants.length > 0 && (
            <div className="participants">
              {acta.participants.map((p, i) => (
                <span className="tag" key={i}>
                  {p}
                </span>
              ))}
            </div>
          )}
          {acta.resum && <p className="acta-summary">{acta.resum}</p>}
          {acta.punts_tractats.length > 0 && (
            <div className="block">
              <h4>Punts tractats</h4>
              <ul className="list">
                {acta.punts_tractats.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {acta.acords.length > 0 && (
            <div className="block">
              <h4>Acords</h4>
              <ul className="list">
                {acta.acords.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {acta.tasques.length > 0 && (
            <div className="block">
              <h4>Tasques</h4>
              <div className="tasks">
                {acta.tasques.map((t, i) => (
                  <div className="task" key={i}>
                    <span className="task-name">{t.tasca}</span>
                    {t.responsable && <span className="tag">{t.responsable}</span>}
                    {t.data_limit && (
                      <span className="tag date">{t.data_limit}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Transcripció (si existeix) */}
      {transcript.length > 0 && (
        <CollapsibleSection
          title={isCleaned ? "Transcripció (corregida)" : "Transcripció"}
          card={false}
          actions={<ExportButton onClick={exportTranscript} />}
        >
          <div className="transcript">
            {transcript.map((u, i) => (
              <p className="utterance" key={i}>
                <span className="speaker">{u.speaker}</span>
                {u.text}
              </p>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Pas opcional: netejar/corregir la transcripció abans de l'acta */}
      {status === "transcribed" && !isCleaned && (
        <div className="step-action">
          {working === "cleaning" ? (
            <span className="step-status">
              <span className="spinner" /> Corregint la transcripció…
            </span>
          ) : (
            <button type="button" className="btn ghost" onClick={handleClean}>
              Netejar transcripció (opcional)
            </button>
          )}
        </div>
      )}

      {/* Pas 3: generar acta */}
      {status === "transcribed" && (
        <div className="step-action">
          {working === "generating" ? (
            <span className="step-status">
              <span className="spinner" /> Redactant l&apos;acta…
            </span>
          ) : (
            <button type="button" className="btn primary" onClick={handleActa}>
              Generar acta
            </button>
          )}
        </div>
      )}

      {(transcribing ||
        working === "cleaning" ||
        working === "generating") && <ProcessingWarning />}

      {error && <div className="error">{error}</div>}
    </section>
  );
}
