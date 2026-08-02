"use client";

import { useEffect, useState } from "react";

export type TocSection = { id: string; title: string | null };
export type TocChapter = {
  id: string;
  number: string | null;
  title: string;
  sections: TocSection[];
};

export function TableOfContents({ chapters }: { chapters: TocChapter[] }) {
  const [open, setOpen] = useState(false); // drawer móvil
  const [active, setActive] = useState<string | null>(null);
  const [depth, setDepth] = useState<1 | 2>(1); // niveles del índice

  useEffect(() => {
    const targets = chapters
      .map((c) => document.getElementById(`ch-${c.id}`))
      .filter((el): el is HTMLElement => el != null);
    if (targets.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace("ch-", ""));
      },
      { rootMargin: "-12% 0px -70% 0px", threshold: 0 }
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [chapters]);

  const go = (domId: string) => {
    document.getElementById(domId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setOpen(false);
  };

  const hasSubsections = chapters.some((c) => c.sections.some((s) => s.title));

  const list = (
    <nav aria-label="Contenidos">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          Contenidos
        </span>
        {hasSubsections && (
          <div className="flex overflow-hidden rounded-full border border-gray-200 text-[10px]">
            <button
              onClick={() => setDepth(1)}
              className={`px-2 py-0.5 ${depth === 1 ? "bg-navy text-white" : "text-ink-soft hover:bg-gray-100"}`}
              title="Solo capítulos"
            >
              N1
            </button>
            <button
              onClick={() => setDepth(2)}
              className={`px-2 py-0.5 ${depth === 2 ? "bg-navy text-white" : "text-ink-soft hover:bg-gray-100"}`}
              title="Capítulos y secciones"
            >
              N2
            </button>
          </div>
        )}
      </div>

      <ul className="space-y-0.5">
        {chapters.map((c) => {
          const isActive = active === c.id;
          const subs = c.sections.filter((s) => s.title);
          return (
            <li key={c.id}>
              <button
                onClick={() => go(`ch-${c.id}`)}
                title={c.title}
                className={`group relative block w-full rounded-md py-1.5 pl-3 pr-2 text-left text-[13px] leading-snug transition ${
                  isActive
                    ? "bg-[var(--accent-soft)] font-semibold text-navy"
                    : "text-ink hover:bg-gray-100"
                }`}
              >
                <span
                  className={`absolute inset-y-1 left-0 w-0.5 rounded-full ${
                    isActive ? "bg-navy" : "bg-transparent"
                  }`}
                />
                <span className="line-clamp-1 group-hover:line-clamp-none">
                  {c.title}
                </span>
              </button>
              {depth === 2 && subs.length > 0 && (
                <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
                  {subs.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => go(`sec-${s.id}`)}
                        title={s.title ?? ""}
                        className="block w-full rounded px-2 py-1 text-left text-xs text-ink-soft hover:bg-gray-100"
                      >
                        <span className="line-clamp-1 hover:line-clamp-none">
                          {s.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      <aside className="hidden lg:block">
        <div className="surface-card sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-4">
          {list}
        </div>
      </aside>

      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white shadow-lg lg:hidden"
      >
        ☰ Índice
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white p-4 shadow-xl">
            <button onClick={() => setOpen(false)} className="mb-3 text-sm text-ink-soft">
              ✕ Cerrar
            </button>
            {list}
          </div>
        </div>
      )}
    </>
  );
}
