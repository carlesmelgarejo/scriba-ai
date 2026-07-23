"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMeetings, deleteMeeting } from "@/lib/api";
import type { MeetingSummary } from "@/lib/types";

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

export default function HistoricPage() {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setMeetings(await listMeetings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error carregant l'històric");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Segur que vols esborrar aquesta reunió?")) return;
    await deleteMeeting(id);
    setMeetings((m) => m.filter((x) => x.id !== id));
  }

  return (
    <main className="container">
      <div className="header">
        <div className="header-text">
          <h1 className="title">Històric</h1>
          <p className="subtitle">Reunions transcrites i les seves actes.</p>
        </div>
        <Link href="/" className="btn ghost">
          ← Nova reunió
        </Link>
      </div>

      {loading && <div className="card">Carregant…</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && meetings.length === 0 && (
        <div className="card muted-note">Encara no hi ha cap reunió desada.</div>
      )}

      <div className="meeting-list">
        {meetings.map((m) => (
          <div className="meeting-item card" key={m.id}>
            <Link href={`/historic/${m.id}`} className="meeting-link">
              <span className="meeting-title">{m.titol}</span>
              <span className="meeting-date">{formatDate(m.createdAt)}</span>
              {m.participants.length > 0 && (
                <span className="meeting-participants">
                  {m.participants.join(", ")}
                </span>
              )}
            </Link>
            <button
              type="button"
              className="btn ghost"
              onClick={() => handleDelete(m.id)}
              aria-label="Esborrar"
            >
              Esborrar
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
