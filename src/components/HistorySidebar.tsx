"use client";

import { useCallback, useEffect, useState } from "react";
import { listMeetings, deleteMeeting } from "@/lib/api";
import type { MeetingSummary, MeetingStatus } from "@/lib/types";

const STATUS_LABEL: Record<MeetingStatus, string> = {
  audio: "Àudio",
  transcribing: "Transcrivint…",
  transcribed: "Transcrit",
  done: "Acta",
};

interface HistorySidebarProps {
  reloadSignal: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ca-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistorySidebar({
  reloadSignal,
  selectedId,
  onSelect,
}: HistorySidebarProps) {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setMeetings(await listMeetings());
    } catch {
      /* silenci: la llista buida ja ho reflecteix */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Esborrar aquesta reunió?")) return;
    await deleteMeeting(id);
    setMeetings((m) => m.filter((x) => x.id !== id));
    if (id === selectedId) onSelect(null);
  }

  return (
    <aside className="sidebar card">
      <h2 className="sidebar-title">Històric</h2>

      {loading && <p className="muted-note">Carregant…</p>}
      {!loading && meetings.length === 0 && (
        <p className="muted-note">Encara no hi ha reunions.</p>
      )}

      <ul className="history-list">
        {meetings.map((m) => (
          <li
            key={m.id}
            className={`history-item${m.id === selectedId ? " active" : ""}`}
            onClick={() => onSelect(m.id)}
          >
            <div className="history-main">
              <span className="history-title">
                {m.title || formatDate(m.createdAt)}
              </span>
              <span className="history-date">
                {formatDate(m.createdAt)}
                <span className={`status-pill status-${m.status}`}>
                  {STATUS_LABEL[m.status]}
                </span>
                {m.hasAudio && (
                  <span className="audio-dot" title="Amb àudio">
                    ♪
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              className="history-delete"
              onClick={(e) => handleDelete(e, m.id)}
              aria-label="Esborrar"
              title="Esborrar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
