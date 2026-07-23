import type { Meeting, MeetingSummary } from "./types";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? fallback);
  return data as T;
}

/** Pas 1: puja l'àudio gravat (cos binari cru) i el desa com a nova reunió. */
export async function saveAudioMeeting(
  blob: Blob,
  speakers?: number,
  durationSec?: number
): Promise<Meeting> {
  const params = new URLSearchParams();
  if (speakers && speakers >= 2) params.set("speakers", String(speakers));
  if (durationSec && durationSec > 0)
    params.set("duration", String(durationSec));
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/meetings${query}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  const data = await jsonOrThrow<{ meeting: Meeting }>(
    res,
    "No s'ha pogut desar l'àudio"
  );
  return data.meeting;
}

/** Pas 2 (inici): encua la transcripció. */
export async function startTranscription(id: string): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}/transcribe`, { method: "POST" });
  const data = await jsonOrThrow<{ meeting: Meeting }>(
    res,
    "No s'ha pogut iniciar la transcripció"
  );
  return data.meeting;
}

/** Pas 2 (comprovació): consulta l'estat i, si està llest, desa la transcripció. */
export async function checkTranscription(
  id: string
): Promise<{ status: string; meeting: Meeting; error?: string }> {
  const res = await fetch(`/api/meetings/${id}/transcribe`);
  return jsonOrThrow(res, "No s'ha pogut consultar la transcripció");
}

/** Pas 3: genera l'acta a partir de la transcripció. */
export async function generateActa(id: string): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}/acta`, { method: "POST" });
  const data = await jsonOrThrow<{ meeting: Meeting }>(
    res,
    "No s'ha pogut generar l'acta"
  );
  return data.meeting;
}

export async function listMeetings(): Promise<MeetingSummary[]> {
  const res = await fetch("/api/meetings");
  const data = await jsonOrThrow<{ meetings: MeetingSummary[] }>(
    res,
    "Error carregant l'històric"
  );
  return data.meetings;
}

export async function getMeeting(id: string): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}`);
  const data = await jsonOrThrow<{ meeting: Meeting }>(res, "Reunió no trobada");
  return data.meeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
  await jsonOrThrow(res, "No s'ha pogut esborrar");
}
