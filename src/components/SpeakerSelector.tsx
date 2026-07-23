"use client";

import { SPEAKER_OPTIONS, type SpeakerOption } from "@/lib/types";

interface SpeakerSelectorProps {
  value: SpeakerOption;
  disabled: boolean;
  onChange: (value: SpeakerOption) => void;
}

export function SpeakerSelector({
  value,
  disabled,
  onChange,
}: SpeakerSelectorProps) {
  return (
    <fieldset className="duration" disabled={disabled}>
      <legend>Participants màxim (Auto si no ho saps)</legend>
      <div className="duration-options">
        {SPEAKER_OPTIONS.map((n) => (
          <label
            key={n}
            className={`duration-option${value === n ? " active" : ""}`}
          >
            <input
              type="radio"
              name="speakers"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            {n === 0 ? "Auto" : n}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
