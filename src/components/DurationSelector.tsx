"use client";

import { DURATION_OPTIONS, type DurationOption } from "@/lib/types";

interface DurationSelectorProps {
  value: DurationOption;
  disabled: boolean;
  onChange: (value: DurationOption) => void;
}

export function DurationSelector({
  value,
  disabled,
  onChange,
}: DurationSelectorProps) {
  return (
    <fieldset className="duration" disabled={disabled}>
      <legend>Durada màxima de gravació</legend>
      <div className="duration-options">
        {DURATION_OPTIONS.map((minutes) => (
          <label
            key={minutes}
            className={`duration-option${value === minutes ? " active" : ""}`}
          >
            <input
              type="radio"
              name="duration"
              value={minutes}
              checked={value === minutes}
              onChange={() => onChange(minutes)}
            />
            {minutes} min
          </label>
        ))}
      </div>
    </fieldset>
  );
}
