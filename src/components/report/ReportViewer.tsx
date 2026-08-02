"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartBlock } from "./ChartBlock";
import { DashboardChart, type DashChart } from "./DashboardChart";
import { TerritorialMap } from "./TerritorialMap";
import { VoiceInput } from "@/components/annotations/VoiceInput";
import { GlossaryTooltip, type GlossaryEntry } from "@/components/viewer/GlossaryTooltip";
import {
  createAnnotation,
  updateAnnotationBody,
  deleteAnnotation,
} from "@/app/actions/annotations";
import type {
  ViewChapter,
  ViewSection,
  ViewBlock,
  ParagraphContent,
  HeadingContent,
  CalloutContent,
  TableContent,
  ChartContent,
  ImageContent,
} from "@/types/content";

export type ClientAnnotation = {
  id: string;
  blockId: string;
  quote: string | null;
  prefix: string | null;
  suffix: string | null;
  rangeStart: number | null;
  rangeEnd: number | null;
  body: string;
  status: "OPEN" | "IN_PROGRESS" | "ANSWERED" | "RESOLVED" | "DISMISSED";
  authorId: string;
  authorName: string;
  createdAt: string;
};

type Draft = {
  blockId: string;
  quote?: string;
  prefix?: string;
  suffix?: string;
  rangeStart?: number;
  rangeEnd?: number;
  label: string;
};

const statusMeta: Record<string, { label: string; badge: string }> = {
  OPEN: { label: "Abierta", badge: "badge-warn" },
  IN_PROGRESS: { label: "En proceso", badge: "badge-info" },
  ANSWERED: { label: "Respondida", badge: "badge-info" },
  RESOLVED: { label: "Resuelta", badge: "badge-ok" },
  DISMISSED: { label: "Descartada", badge: "badge-neutral" },
};

// Paleta sobria y de baja saturación para diferenciar capítulos (wayfinding).
const SECTION_ACCENTS = [
  "#1c3663", // navy
  "#2f5d54", // verde bosque
  "#6b4a2f", // tierra
  "#4a4a6f", // índigo apagado
  "#5b4a2a", // ocre
  "#7a4a4a", // tinto suave
  "#2a5570", // azul petróleo
];

export function ReportViewer({
  reportId,
  reportSlug,
  chapters,
  annotations,
  canComment,
  canEdit,
  currentUserId,
  glossary,
}: {
  reportId: string;
  reportSlug: string;
  chapters: ViewChapter[];
  annotations: ClientAnnotation[];
  canComment: boolean;
  canEdit: boolean;
  currentUserId: string;
  glossary: GlossaryEntry[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [floatBtn, setFloatBtn] = useState<{ x: number; y: number } | null>(null);

  const byBlock = useMemo(() => {
    const m = new Map<string, ClientAnnotation[]>();
    for (const a of annotations) {
      const list = m.get(a.blockId) ?? [];
      list.push(a);
      m.set(a.blockId, list);
    }
    return m;
  }, [annotations]);

  // Índice de glosario + matcher (una sola vez).
  const glossaryIndex = useMemo(() => {
    const map = new Map<string, GlossaryEntry>();
    for (const g of glossary) map.set(g.term.toLowerCase(), g);
    if (glossary.length === 0) return { map, regex: null as RegExp | null };
    const alt = [...glossary]
      .sort((a, b) => b.term.length - a.term.length)
      .map((g) => g.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    let regex: RegExp | null = null;
    try {
      regex = new RegExp(`(?<![\\p{L}\\p{N}])(${alt})(?![\\p{L}\\p{N}])`, "giu");
    } catch {
      regex = new RegExp(`\\b(${alt})\\b`, "gi");
    }
    return { map, regex };
  }, [glossary]);

  const onMouseUp = useCallback(() => {
    if (!canComment) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setFloatBtn(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const node =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as HTMLElement);
    const blockEl = node?.closest<HTMLElement>("[data-block-id][data-text='true']");
    if (!blockEl) {
      setFloatBtn(null);
      return;
    }
    const pre = document.createRange();
    pre.selectNodeContents(blockEl);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const quote = range.toString();
    if (!quote.trim()) return;

    // Texto completo del bloque → contexto (prefix/suffix) para re-anclar.
    const fullRange = document.createRange();
    fullRange.selectNodeContents(blockEl);
    const fullText = fullRange.toString();
    const end = start + quote.length;
    const prefix = fullText.slice(Math.max(0, start - 40), start);
    const suffix = fullText.slice(end, end + 40);

    const rect = range.getBoundingClientRect();
    setFloatBtn({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setDraft({
      blockId: blockEl.dataset.blockId!,
      quote,
      prefix,
      suffix,
      rangeStart: start,
      rangeEnd: end,
      label: `«${quote.length > 60 ? quote.slice(0, 60) + "…" : quote}»`,
    });
  }, [canComment]);

  const annotateBlock = (blockId: string, label: string) => {
    setFloatBtn(null);
    window.getSelection()?.removeAllRanges();
    setDraft({ blockId, label });
    setBody("");
  };

  const submit = async () => {
    if (!draft || !body.trim()) return;
    setPending(true);
    try {
      await createAnnotation({
        reportId,
        blockId: draft.blockId,
        body: body.trim(),
        quote: draft.quote,
        prefix: draft.prefix,
        suffix: draft.suffix,
        rangeStart: draft.rangeStart,
        rangeEnd: draft.rangeEnd,
      });
      setDraft(null);
      setBody("");
      window.getSelection()?.removeAllRanges();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const appendVoice = useCallback((t: string) => {
    setBody((prev) => (prev ? `${prev} ${t}` : t));
  }, []);

  const compose = draft && (
    <ComposeCard
      draft={draft}
      body={body}
      setBody={setBody}
      onSubmit={submit}
      onCancel={() => setDraft(null)}
      pending={pending}
      appendVoice={appendVoice}
    />
  );

  return (
    <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* ── Documento ── */}
      <article
        ref={containerRef}
        onMouseUp={onMouseUp}
        className="reading reading-surface surface-card px-5 py-10 sm:px-12"
      >
        {chapters.map((ch, ci) => {
          const accent = SECTION_ACCENTS[ci % SECTION_ACCENTS.length];
          const isCover = ci === 0;
          return (
            <section
              key={ch.id}
              id={`ch-${ch.id}`}
              className={`scroll-mt-28 ${isCover ? "cover mb-16" : "mb-14"}`}
            >
              {isCover ? (
                <div className="cover-head">
                  <span className="cover-eyebrow">Informe técnico</span>
                  <h2>{ch.title}</h2>
                  <span className="cover-rule" aria-hidden />
                </div>
              ) : (
                <div
                  className="mb-6 flex items-center gap-3 border-b pb-3"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span
                    className="h-7 w-1 shrink-0 rounded-full"
                    style={{ background: accent }}
                    aria-hidden
                  />
                  <h2>{ch.title}</h2>
                </div>
              )}
              <div className={isCover ? "" : "space-y-8"}>
                {ch.sections.map((sec) => (
                  <SectionView
                    key={sec.id}
                    section={sec}
                    byBlock={byBlock}
                    glossaryIndex={glossaryIndex}
                    onAnnotateBlock={annotateBlock}
                    canComment={canComment}
                    reportSlug={reportSlug}
                  />
                ))}
              </div>
              <ChapterNav
                prev={chapters[ci - 1]}
                next={chapters[ci + 1]}
              />
            </section>
          );
        })}
      </article>

      {/* ── Panel lateral (escritorio) ── */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 self-start">
          {compose ?? (
            <div className="surface-card p-4">
              <div className="text-sm font-medium text-ink">Observaciones</div>
              <p className="mt-1 text-xs text-ink-soft">
                {canComment
                  ? "Seleccione texto, o use «Observar» en una tabla o gráfico."
                  : "Modo lectura."}
              </p>
              <div className="mt-3 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                {annotations.length === 0 && (
                  <p className="text-xs text-ink-soft">Aún no hay observaciones.</p>
                )}
                {annotations.map((a) => (
                  <SidebarObs
                    key={a.id}
                    a={a}
                    canEdit={canEdit}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Compositor como bottom-sheet en móvil ── */}
      {compose && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-2xl lg:hidden"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          {compose}
        </div>
      )}

      {/* ── Botón flotante junto a la selección ── */}
      {floatBtn && draft && (
        <button
          onClick={() => setFloatBtn(null)}
          style={{
            position: "fixed",
            left: floatBtn.x,
            top: floatBtn.y,
            transform: "translate(-50%, -100%)",
          }}
          className="btn-primary ring-focus z-50 rounded-full px-3 py-1.5 text-xs shadow-lg"
        >
          + Observar
        </button>
      )}
    </div>
  );
}

// Observación en el panel lateral, con editar/eliminar en línea.
function SidebarObs({
  a,
  canEdit,
  currentUserId,
}: {
  a: ClientAnnotation;
  canEdit: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.body);
  const [pending, setPending] = useState(false);
  const isOwner = a.authorId === currentUserId;
  const canDelete = isOwner || canEdit;

  const save = async () => {
    if (!draft.trim()) return;
    setPending(true);
    try {
      await updateAnnotationBody(a.id, draft.trim());
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  };
  const remove = async () => {
    if (!confirm("¿Eliminar esta observación?")) return;
    setPending(true);
    try {
      await deleteAnnotation(a.id);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-md border p-2" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-soft">{a.authorName}</span>
        <span className={`badge ${statusMeta[a.status]?.badge ?? "badge-neutral"}`}>
          {statusMeta[a.status]?.label ?? a.status}
        </span>
      </div>
      {editing ? (
        <div className="mt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            className="field w-full p-1.5 text-xs"
          />
          <div className="mt-1 flex gap-2">
            <button
              onClick={save}
              disabled={pending || !draft.trim()}
              className="btn-primary ring-focus px-2 py-0.5 text-[11px]"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setDraft(a.body);
                setEditing(false);
              }}
              className="btn-ghost ring-focus px-2 py-0.5 text-[11px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink">{a.body}</p>
          {(isOwner || canDelete) && (
            <div className="mt-1 flex gap-3 text-[11px]">
              {isOwner && (
                <button
                  onClick={() => {
                    setDraft(a.body);
                    setEditing(true);
                  }}
                  className="ring-focus font-medium hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  Editar
                </button>
              )}
              {canDelete && (
                <button
                  onClick={remove}
                  disabled={pending}
                  className="ring-focus font-medium hover:underline disabled:opacity-50"
                  style={{ color: "var(--danger)" }}
                >
                  Eliminar
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sección con acordeón ──
function SectionView({
  section,
  byBlock,
  glossaryIndex,
  onAnnotateBlock,
  canComment,
  reportSlug,
}: {
  section: ViewSection;
  byBlock: Map<string, ClientAnnotation[]>;
  glossaryIndex: { map: Map<string, GlossaryEntry>; regex: RegExp | null };
  onAnnotateBlock: (blockId: string, label: string) => void;
  canComment: boolean;
  reportSlug: string;
}) {
  const [open, setOpen] = useState(!section.collapsedByDefault);

  const body = section.blocks.map((b) => (
    <BlockView
      key={b.id}
      block={b}
      annotations={byBlock.get(b.id) ?? []}
      glossaryIndex={glossaryIndex}
      onAnnotateBlock={onAnnotateBlock}
      canComment={canComment}
      reportSlug={reportSlug}
    />
  ));

  if (!section.title) {
    return <div id={`sec-${section.id}`} className="scroll-mt-24">{body}</div>;
  }

  return (
    <div id={`sec-${section.id}`} className="scroll-mt-24">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="ring-focus -mx-2 mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-[color:var(--surface-2)]"
      >
        <span
          className="text-ink-soft transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
          aria-hidden
        >
          ▸
        </span>
        <h3 className="my-0 font-serif">{section.title}</h3>
      </button>
      {open && <div className="mt-2">{body}</div>}
    </div>
  );
}

function BlockView({
  block,
  annotations,
  glossaryIndex,
  onAnnotateBlock,
  canComment,
  reportSlug,
}: {
  block: ViewBlock;
  annotations: ClientAnnotation[];
  glossaryIndex: { map: Map<string, GlossaryEntry>; regex: RegExp | null };
  onAnnotateBlock: (blockId: string, label: string) => void;
  canComment: boolean;
  reportSlug: string;
}) {
  const hasAnn = annotations.length > 0;
  const common = { "data-block-id": block.id } as const;

  if (block.type === "HEADING") {
    const c = block.content as HeadingContent;
    return (
      <h4 {...common} data-text="true" className={hasAnn ? "has-annotation" : ""}>
        {c.text}
      </h4>
    );
  }

  if (block.type === "PARAGRAPH" || block.type === "CALLOUT") {
    const c = block.content as ParagraphContent | CalloutContent;
    const wrap =
      block.type === "CALLOUT"
        ? "rounded-md border-l-4 border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-4 py-2"
        : "";
    return (
      <p {...common} data-text="true" className={wrap}>
        <RichText text={c.text} annotations={annotations} glossaryIndex={glossaryIndex} />
      </p>
    );
  }

  if (block.type === "TABLE") {
    const c = block.content as TableContent;
    return (
      <BlockShell blockId={block.id} annotated={hasAnn} canComment={canComment} label={`Tabla: ${c.caption ?? c.columns.join(", ")}`} onAnnotate={onAnnotateBlock}>
        <div className="overflow-x-auto">
          <table {...common} className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {c.columns.map((col) => (
                  <th key={col} className="border-b-2 border-[color:var(--line-strong)] px-2 py-1 text-left font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border-b border-[color:var(--line)] px-2 py-1">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {c.caption && <p className="mt-1 text-center text-xs text-ink-soft">{c.caption}</p>}
      </BlockShell>
    );
  }

  if (block.type === "CHART") {
    const raw = block.content as Record<string, unknown>;
    // Mapa navegable (Leaflet + satélite).
    if (raw._map) {
      return (
        <BlockShell blockId={block.id} annotated={hasAnn} canComment={canComment} label={`Mapa: ${(raw.titulo as string) ?? "territorial"}`} onAnnotate={onAnnotateBlock}>
          <div {...common}>
            <TerritorialMap
              reportSlug={reportSlug}
              mapKey={raw.key as string}
              title={raw.titulo as string | undefined}
              defaultVar={raw.var as string | undefined}
              capa={raw.capa as "siniestros" | "colegios" | undefined}
            />
          </div>
        </BlockShell>
      );
    }
    // Gráfico recreado del dashboard (interactivo, estilo de la página).
    if (raw._dash) {
      const dc = raw as unknown as DashChart;
      return (
        <BlockShell blockId={block.id} annotated={hasAnn} canComment={canComment} label={`Gráfico: ${dc.titulo ?? dc.tipo}`} onAnnotate={onAnnotateBlock}>
          <div {...common}>
            <DashboardChart c={dc} />
          </div>
        </BlockShell>
      );
    }
    const c = block.content as ChartContent;
    return (
      <BlockShell blockId={block.id} annotated={hasAnn} canComment={canComment} label={`Gráfico: ${c.caption ?? c.kind}`} onAnnotate={onAnnotateBlock}>
        <div {...common}>
          <ChartBlock content={c} />
        </div>
      </BlockShell>
    );
  }

  if (block.type === "IMAGE") {
    const c = block.content as ImageContent;
    // Placeholder de gráfico del Word aún sin reemplazar (src vacío).
    if (!c.src) {
      return (
        <BlockShell blockId={block.id} annotated={hasAnn} canComment={canComment} label={`Figura: ${c.alt || "gráfico"}`} onAnnotate={onAnnotateBlock}>
          <figure
            {...common}
            className="flex flex-col items-center justify-center gap-2 rounded-xl2 px-4 py-10 text-center"
            style={{
              background:
                "repeating-linear-gradient(135deg, var(--surface) 0 14px, var(--surface-2) 14px 15px)",
              border: "1px solid var(--line)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M3 3v18h18" strokeLinecap="round" />
              <rect x="7" y="11" width="3" height="6" rx="0.5" />
              <rect x="12.5" y="7" width="3" height="10" rx="0.5" />
              <rect x="18" y="13" width="3" height="4" rx="0.5" />
            </svg>
            <figcaption className="text-sm font-medium text-ink">
              {c.alt || "Figura del informe"}
            </figcaption>
            <span className="text-xs text-ink-soft">
              Gráfico interactivo — pendiente de conectar con el dashboard
            </span>
          </figure>
        </BlockShell>
      );
    }
    return (
      <BlockShell blockId={block.id} annotated={hasAnn} canComment={canComment} label={`Figura: ${c.alt}`} onAnnotate={onAnnotateBlock}>
        <figure {...common} className="m-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.src}
            alt={c.alt}
            loading="lazy"
            decoding="async"
            className="mx-auto block h-auto max-w-full rounded-lg"
            style={{ border: "1px solid var(--line)", background: "#fff" }}
          />
          {c.caption && (
            <figcaption className="mt-1 text-center text-xs text-ink-soft">{c.caption}</figcaption>
          )}
        </figure>
      </BlockShell>
    );
  }

  return null;
}

function BlockShell({
  blockId,
  annotated,
  canComment,
  label,
  onAnnotate,
  children,
}: {
  blockId: string;
  annotated: boolean;
  canComment: boolean;
  label: string;
  onAnnotate: (blockId: string, label: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`group relative my-6 rounded-xl2 p-4 ${annotated ? "block-annotated" : ""}`}
      style={{ background: "var(--surface-2)" }}
    >
      {canComment && (
        <button
          onClick={() => onAnnotate(blockId, label)}
          className="btn-primary ring-focus absolute -right-2 -top-2 z-10 hidden rounded-full px-2 py-1 text-[11px] shadow group-hover:block"
        >
          + Observar
        </button>
      )}
      {children}
    </div>
  );
}

// ── Compositor de observación (reutilizado en sidebar y bottom-sheet) ──
function ComposeCard({
  draft,
  body,
  setBody,
  onSubmit,
  onCancel,
  pending,
  appendVoice,
}: {
  draft: Draft;
  body: string;
  setBody: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  appendVoice: (t: string) => void;
}) {
  return (
    <div className="surface-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        Nueva observación
      </div>
      <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{draft.label}</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        autoFocus
        placeholder="Escriba o dicte su observación…"
        className="field ring-focus mt-3 w-full p-2 text-sm"
      />
      <div className="mt-2 flex items-center justify-between">
        <VoiceInput onAppend={appendVoice} />
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost ring-focus px-3 py-1.5 text-sm">
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={pending || !body.trim()}
            className="btn-primary ring-focus px-3 py-1.5 text-sm"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Texto con resaltado de observaciones (por rango/cita) y términos de glosario.
// Normaliza para comparación tolerante (minúsculas + espacios colapsados) y
// devuelve el mapa de índices norm→original para recuperar offsets reales.
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      norm += " ";
      map.push(i);
      prevSpace = true;
    } else {
      norm += ch.toLowerCase();
      map.push(i);
      prevSpace = false;
    }
  }
  return { norm, map };
}

// Re-anclaje en cascada (W3C Web Annotation): posición verificada → cita exacta
// desambiguada por contexto → búsqueda normalizada → núcleo difuso. Devuelve
// null si la observación quedó huérfana (el texto ancla ya no existe).
export function reanchor(
  text: string,
  a: Pick<ClientAnnotation, "quote" | "prefix" | "suffix" | "rangeStart" | "rangeEnd">
): { start: number; end: number } | null {
  const quote = a.quote ?? "";

  // 1. Posición, pero VERIFICADA contra la cita (si el texto cambió, no confía).
  if (a.rangeStart != null && a.rangeEnd != null && a.rangeEnd <= text.length) {
    if (!quote || text.slice(a.rangeStart, a.rangeEnd) === quote) {
      return { start: a.rangeStart, end: a.rangeEnd };
    }
  }
  if (!quote) return null;

  // 2. Cita exacta; si hay repeticiones, desambigua por prefix/suffix.
  const occ: number[] = [];
  for (let i = text.indexOf(quote); i >= 0; i = text.indexOf(quote, i + 1)) occ.push(i);
  if (occ.length === 1) return { start: occ[0], end: occ[0] + quote.length };
  if (occ.length > 1) {
    let best = occ[0];
    let bestScore = -1;
    for (const o of occ) {
      const before = text.slice(Math.max(0, o - (a.prefix?.length ?? 0)), o);
      const after = text.slice(o + quote.length, o + quote.length + (a.suffix?.length ?? 0));
      const score =
        (a.prefix && before.endsWith(a.prefix) ? 2 : 0) +
        (a.suffix && after.startsWith(a.suffix) ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return { start: best, end: best + quote.length };
  }

  // 3. Búsqueda tolerante a espacios/mayúsculas.
  const T = normalizeWithMap(text);
  const q = normalizeWithMap(quote).norm.trim();
  if (q) {
    const ni = T.norm.indexOf(q);
    if (ni >= 0) {
      const start = T.map[ni];
      const end = (T.map[ni + q.length - 1] ?? start) + 1;
      return { start, end };
    }
  }

  // 4. Núcleo difuso: primeras ~24 letras de la cita.
  const core = quote.trim().slice(0, 24);
  if (core.length >= 6) {
    const ci = text.indexOf(core);
    if (ci >= 0) return { start: ci, end: ci + core.length };
  }

  return null; // huérfana
}

// Navegación anterior/siguiente entre capítulos.
function ChapterNav({
  prev,
  next,
}: {
  prev?: { id: string; title: string };
  next?: { id: string; title: string };
}) {
  if (!prev && !next) return null;
  const go = (id: string) =>
    document.getElementById(`ch-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <nav
      className="no-print mt-10 flex items-stretch justify-between gap-4 border-t pt-4"
      style={{ borderColor: "var(--line)" }}
      aria-label="Navegación entre capítulos"
    >
      {prev ? (
        <button
          onClick={() => go(prev.id)}
          className="ring-focus flex max-w-[47%] items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-[color:var(--surface-2)]"
        >
          <span aria-hidden style={{ color: "var(--accent)" }}>←</span>
          <span className="min-w-0">
            <span className="block text-[11px]" style={{ color: "var(--faint)" }}>Anterior</span>
            <span className="line-clamp-1 text-ink">{prev.title}</span>
          </span>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button
          onClick={() => go(next.id)}
          className="ring-focus ml-auto flex max-w-[47%] items-center gap-2 rounded-md p-2 text-right text-sm hover:bg-[color:var(--surface-2)]"
        >
          <span className="min-w-0">
            <span className="block text-[11px]" style={{ color: "var(--faint)" }}>Siguiente</span>
            <span className="line-clamp-1 text-ink">{next.title}</span>
          </span>
          <span aria-hidden style={{ color: "var(--accent)" }}>→</span>
        </button>
      ) : (
        <span />
      )}
    </nav>
  );
}

function RichText({
  text,
  annotations,
  glossaryIndex,
}: {
  text: string;
  annotations: ClientAnnotation[];
  glossaryIndex: { map: Map<string, GlossaryEntry>; regex: RegExp | null };
}) {
  const ranges = annotations
    .map((a) => reanchor(text, a))
    .filter((r): r is { start: number; end: number } => r != null)
    .sort((a, b) => a.start - b.start);

  const out: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  const pushPlain = (s: string) => {
    if (s) out.push(<GlossaryText key={`g${key++}`} text={s} glossaryIndex={glossaryIndex} />);
  };

  for (const r of ranges) {
    if (r.start < cursor) continue;
    pushPlain(text.slice(cursor, r.start));
    out.push(
      <mark key={`m${key++}`} className="has-annotation">
        {text.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  }
  pushPlain(text.slice(cursor));
  return <>{out}</>;
}

// Envuelve los términos de glosario dentro de un tramo de texto plano.
function GlossaryText({
  text,
  glossaryIndex,
}: {
  text: string;
  glossaryIndex: { map: Map<string, GlossaryEntry>; regex: RegExp | null };
}) {
  const { map, regex } = glossaryIndex;
  if (!regex) return <>{text}</>;

  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const matched = m[1];
    const entry = map.get(matched.toLowerCase());
    if (m.index > last) out.push(text.slice(last, m.index));
    if (entry) {
      out.push(<GlossaryTooltip key={`t${key++}`} label={matched} entry={entry} />);
    } else {
      out.push(matched);
    }
    last = m.index + matched.length;
    if (m.index === regex.lastIndex) regex.lastIndex++; // evita bucles con match vacío
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
