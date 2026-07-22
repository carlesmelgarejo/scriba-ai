"use client";

import { formatTime } from "@/lib/format";
import type { RecorderState } from "@/hooks/useRecorder";

interface RecorderProps {
  state: RecorderState;
  seconds: number;
  disabled: boolean;
  onToggle: () => void;
}

export function Recorder({ state, seconds, disabled, onToggle }: RecorderProps) {
  const recording = state === "recording";

  return (
    <div className="recorder">
      <button
        type="button"
        className={`rec-button${recording ? " recording" : ""}`}
        onClick={onToggle}
        disabled={disabled}
        aria-label={recording ? "Aturar la gravació" : "Començar a gravar"}
      >
        {recording ? (
          <span className="rec-icon-square" />
        ) : (
          <span className="rec-icon-dot" />
        )}
      </button>

      <div className="timer">{formatTime(seconds)}</div>
    </div>
  );
}
