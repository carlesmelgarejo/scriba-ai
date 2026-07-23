"use client";

import type { Acta, Utterance } from "@/lib/types";
import {
  actaToMarkdown,
  transcriptToMarkdown,
  downloadText,
  slugify,
} from "@/lib/format";
import { CollapsibleSection } from "./CollapsibleSection";

interface ActaViewProps {
  acta: Acta;
  utterances: Utterance[];
  audioUrl?: string;
  onClose?: () => void;
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      ↓ Exportar Markdown
    </button>
  );
}

export function ActaView({ acta, utterances, audioUrl, onClose }: ActaViewProps) {
  const slug = slugify(acta.titol);

  const exportActa = () =>
    downloadText(`acta-${slug}.md`, actaToMarkdown(acta, utterances));
  const exportTranscript = () =>
    downloadText(
      `transcripcio-${slug}.md`,
      transcriptToMarkdown(utterances, acta.titol)
    );

  return (
    <section className="card meeting-card">
      <div className="meeting-header">
        <h2 className="meeting-title-main">{acta.titol}</h2>
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
          <audio className="audio-player" controls preload="none" src={audioUrl}>
            El navegador no pot reproduir aquest àudio.
          </audio>
          <a className="btn" href={audioUrl} download={`audio-${slug}.opus`}>
            ↓ Àudio
          </a>
        </div>
      )}

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

      <CollapsibleSection
        title="Transcripció"
        card={false}
        actions={
          utterances.length > 0 ? (
            <ExportButton onClick={exportTranscript} />
          ) : undefined
        }
      >
        <div className="transcript">
          {utterances.length > 0 ? (
            utterances.map((u, i) => (
              <p className="utterance" key={i}>
                <span className="speaker">{u.speaker}</span>
                {u.text}
              </p>
            ))
          ) : (
            <p className="muted-note">No s&apos;han detectat interlocutors.</p>
          )}
        </div>
      </CollapsibleSection>
    </section>
  );
}
