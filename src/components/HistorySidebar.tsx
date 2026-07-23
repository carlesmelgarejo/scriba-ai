"use client";

import { useCallback, useEffect, useState } from "react";
import { listMeetings, deleteMeeting } from "@/lib/api";
import type { MeetingSummary } from "@/lib/types";

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
              <span className="history-title">{m.titol}</span>
              <span className="history-date">
                {formatDate(m.createdAt)}
                {m.hasAudio && <span className="audio-dot" title="Amb àudio">♪</span>}
              </span>
            </div>
            <button
              type="button"
              className="history-delete"
              onClick={(e) => handleDelete(e, m.id)}
              aria-label="Esborrar"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
