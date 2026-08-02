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

  // Scrollspy: marca el capítulo visible.
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
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [chapters]);

  const go = (domId: string) => {
    document.getElementById(domId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setOpen(false);
  };

  const list = (
    <nav className="space-y-1 text-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Contenidos
      </div>
      {chapters.map((c) => (
        <div key={c.id}>
          <button
            onClick={() => go(`ch-${c.id}`)}
            className={`block w-full truncate rounded px-2 py-1 text-left hover:bg-gray-100 ${
              active === c.id ? "bg-gray-100 font-medium text-navy" : "text-ink"
            }`}
            title={c.title}
          >
            {c.number ? `${c.number}. ` : ""}
            {c.title}
          </button>
          {c.sections.some((s) => s.title) && active === c.id && (
            <div className="ml-3 border-l border-gray-200 pl-2">
              {c.sections
                .filter((s) => s.title)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => go(`sec-${s.id}`)}
                    className="block w-full truncate rounded px-2 py-0.5 text-left text-xs text-ink-soft hover:bg-gray-100"
                    title={s.title ?? ""}
                  >
                    {s.title}
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Escritorio: columna sticky */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
          {list}
        </div>
      </aside>

      {/* Móvil: botón + drawer */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white shadow-lg lg:hidden"
      >
        ☰ Índice
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white p-4 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="mb-3 text-sm text-ink-soft"
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
