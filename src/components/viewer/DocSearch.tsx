"use client";

import { useMemo, useState } from "react";

export type SearchEntry = { blockId: string; chapter: string; text: string };

function snippet(text: string, at: number, len: number): [string, string, string] {
  const start = Math.max(0, at - 32);
  const end = Math.min(text.length, at + len + 40);
  return [
    (start > 0 ? "…" : "") + text.slice(start, at),
    text.slice(at, at + len),
    text.slice(at + len, end) + (end < text.length ? "…" : ""),
  ];
}

export function DocSearch({ index, onNavigate }: { index: SearchEntry[]; onNavigate?: () => void }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 3) return [];
    const out: (SearchEntry & { parts: [string, string, string] })[] = [];
    for (const e of index) {
      const i = e.text.toLowerCase().indexOf(query);
      if (i >= 0) {
        out.push({ ...e, parts: snippet(e.text, i, query.length) });
        if (out.length >= 25) break;
      }
    }
    return out;
  }, [q, index]);

  const goto = (blockId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash-target");
    window.setTimeout(() => el.classList.remove("flash-target"), 1600);
    onNavigate?.();
  };

  return (
    <div className="mb-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar en el informe…"
        aria-label="Buscar en el informe"
        className="field ring-focus w-full px-2.5 py-1.5 text-sm"
      />
      {q.trim().length >= 3 && (
        <div className="mt-2 max-h-[40vh] overflow-y-auto rounded-md border" style={{ borderColor: "var(--line)" }}>
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-soft">Sin coincidencias.</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={`${r.blockId}-${i}`}>
                  <button
                    onClick={() => goto(r.blockId)}
                    className="ring-focus block w-full border-b px-3 py-2 text-left text-xs last:border-b-0 hover:bg-[color:var(--surface-2)]"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span className="block font-medium" style={{ color: "var(--accent)" }}>
                      {r.chapter}
                    </span>
                    <span className="mt-0.5 block leading-snug" style={{ color: "var(--muted)" }}>
                      {r.parts[0]}
                      <mark className="rounded px-0.5" style={{ background: "var(--highlight)", color: "var(--ink)" }}>
                        {r.parts[1]}
                      </mark>
                      {r.parts[2]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
