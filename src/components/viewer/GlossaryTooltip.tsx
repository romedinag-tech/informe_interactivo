"use client";

import { useState } from "react";

export type GlossaryEntry = { term: string; definition: string; source?: string | null };

// Término subrayado que despliega una tarjeta con su definición (hover o clic).
export function GlossaryTooltip({
  label,
  entry,
}: {
  label: string;
  entry: GlossaryEntry;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="glossary-term relative"
      tabIndex={0}
      role="button"
      aria-label={`Definición de ${entry.term}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
    >
      {label}
      {open && (
        <span
          className="surface-card absolute left-0 top-full z-30 mt-1 block w-64 p-3 text-left text-xs font-normal not-italic leading-snug text-ink shadow-lg"
          style={{ whiteSpace: "normal" }}
        >
          <span className="block font-semibold" style={{ color: "var(--accent)" }}>{entry.term}</span>
          <span className="mt-1 block text-ink-soft">{entry.definition}</span>
          {entry.source && (
            <span className="mt-1 block text-[10px] text-ink-soft">
              Fuente: {entry.source}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
