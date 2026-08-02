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
  const activeIndex = chapters.findIndex((c) => c.id === active);
  const position = activeIndex >= 0 ? activeIndex + 1 : 0;
  const progress = chapters.length ? position / chapters.length : 0;

  const list = (
    <nav aria-label="Contenidos">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
          Contenidos
        </span>
        {hasSubsections && (
          <div
            className="flex overflow-hidden rounded-full border text-[10px]"
            style={{ borderColor: "var(--line)" }}
            role="group"
            aria-label="Nivel de detalle del índice"
          >
            {([1, 2] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                aria-pressed={depth === d}
                className="ring-focus px-2 py-0.5 font-medium transition-colors"
                style={
                  depth === d
                    ? { background: "var(--accent)", color: "#fff" }
                    : { color: "var(--muted)" }
                }
                title={d === 1 ? "Solo capítulos" : "Capítulos y secciones"}
              >
                N{d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progreso de lectura */}
      <div className="mb-3">
        <div
          className="h-1 overflow-hidden rounded-full"
          style={{ background: "var(--surface-3)" }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={chapters.length}
          aria-valuenow={position}
          aria-label="Progreso de lectura"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress * 100}%`, background: "var(--accent)" }}
          />
        </div>
        <div className="mt-1 text-[10px]" style={{ color: "var(--faint)" }}>
          {position > 0 ? `Capítulo ${position} de ${chapters.length}` : `${chapters.length} capítulos`}
        </div>
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
                aria-current={isActive ? "location" : undefined}
                className="ring-focus group relative block w-full rounded-md py-1.5 pl-3 pr-2 text-left text-[13px] leading-snug transition"
                style={
                  isActive
                    ? { background: "var(--accent-soft)", color: "var(--accent-strong)", fontWeight: 600 }
                    : { color: "var(--ink)" }
                }
              >
                <span
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full"
                  style={{ background: isActive ? "var(--accent)" : "transparent" }}
                  aria-hidden
                />
                <span className="line-clamp-1 group-hover:line-clamp-none">{c.title}</span>
              </button>
              {depth === 2 && subs.length > 0 && (
                <ul className="ml-4 mt-0.5 space-y-0.5 border-l pl-2" style={{ borderColor: "var(--line)" }}>
                  {subs.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => go(`sec-${s.id}`)}
                        title={s.title ?? ""}
                        className="ring-focus block w-full rounded px-2 py-1 text-left text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        <span className="line-clamp-1 hover:line-clamp-none">{s.title}</span>
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
        className="ring-focus fixed bottom-4 left-4 z-40 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg lg:hidden"
        style={{ background: "var(--accent)" }}
      >
        ☰ Índice
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-0 h-full w-72 overflow-y-auto p-4 shadow-xl"
            style={{ background: "var(--surface)" }}
          >
            <button
              onClick={() => setOpen(false)}
              className="ring-focus mb-3 text-sm"
              style={{ color: "var(--muted)" }}
            >
              ✕ Cerrar
            </button>
            {list}
          </div>
        </div>
      )}
    </>
  );
}
