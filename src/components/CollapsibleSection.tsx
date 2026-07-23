"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  actions,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="card">
      <div className="section-head">
        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className={`chevron${open ? " open" : ""}`} aria-hidden>
            ▶
          </span>
          <span className="section-title">{title}</span>
        </button>
        {actions && <div className="section-actions">{actions}</div>}
      </div>
      {open && <div className="collapse-body">{children}</div>}
    </section>
  );
}
