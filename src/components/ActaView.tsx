"use client";

import type { Acta, Utterance } from "@/lib/types";
import { actaToMarkdown, downloadText } from "@/lib/format";

interface ActaViewProps {
  acta: Acta;
  utterances: Utterance[];
}

export function ActaView({ acta, utterances }: ActaViewProps) {
  const handleExport = () => {
    const slug = acta.titol
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    downloadText(`acta-${slug || "reunio"}.md`, actaToMarkdown(acta, utterances));
  };

  return (
    <div className="results">
      <section className="card">
        <div className="section-head">
          <h2 className="section-title">Acta</h2>
          <button type="button" className="btn" onClick={handleExport}>
            ↓ Exportar Markdown
          </button>
        </div>

        <h3 className="acta-title">{acta.titol}</h3>

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
      </section>

      <section className="card">
        <div className="section-head">
          <h2 className="section-title">Transcripció</h2>
        </div>
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
      </section>
    </div>
  );
}
