"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getMeeting } from "@/lib/api";
import { ActaView } from "@/components/ActaView";
import type { Meeting } from "@/lib/types";

export default function MeetingPage() {
  const params = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    getMeeting(params.id)
      .then(setMeeting)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Reunió no trobada")
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <main className="container">
      <div className="header">
        <div className="header-text">
          <h1 className="title">ScribaAI</h1>
          <p className="subtitle">Acta i transcripció de la reunió.</p>
        </div>
        <Link href="/historic" className="btn ghost">
          ← Històric
        </Link>
      </div>

      {loading && <div className="card">Carregant…</div>}
      {error && <div className="error">{error}</div>}

      {meeting && (
        <ActaView acta={meeting.acta} utterances={meeting.utterances} />
      )}
    </main>
  );
}
