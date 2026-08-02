"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartBlock } from "@/components/report/ChartBlock";
import { ChartForm } from "./ChartForm";
import {
  updateBlockContent,
  deleteBlock,
  moveBlock,
  addBlock,
  updateChapterMeta,
  updateSectionTitle,
  setReportStatus,
} from "@/app/actions/reports";
import type { TableContent, ChartContent } from "@/types/content";

type EditBlock = { id: string; type: string; content: Record<string, unknown> };
type EditSection = { id: string; title: string | null; blocks: EditBlock[] };
type EditChapter = {
  id: string;
  number: string | null;
  title: string;
  sections: EditSection[];
};

const statusLabel: Record<string, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelto",
  ARCHIVED: "Archivado",
};

export function ReportEditor({
  reportId,
  reportSlug,
  reportTitle,
  status,
  chapters,
}: {
  reportId: string;
  reportSlug: string;
  reportTitle: string;
  status: string;
  chapters: EditChapter[];
}) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    setPublishing(true);
    try {
      await setReportStatus(reportId, "IN_REVIEW");
      router.refresh();
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-navy">{reportTitle}</h1>
          <span className="text-xs text-ink-soft">
            Estado: {statusLabel[status] ?? status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/reports/${reportSlug}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-ink hover:bg-gray-50"
          >
            Previsualizar
          </Link>
          {status === "DRAFT" && (
            <button
              onClick={publish}
              disabled={publishing}
              className="rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
            >
              {publishing ? "Publicando…" : "Publicar a revisión"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {chapters.map((ch) => (
          <ChapterEditor key={ch.id} chapter={ch} />
        ))}
        {chapters.length === 0 && (
          <p className="text-sm text-ink-soft">
            El informe no tiene contenido. Importa un Word para comenzar.
          </p>
        )}
      </div>
    </div>
  );
}

function ChapterEditor({ chapter }: { chapter: EditChapter }) {
  const [number, setNumber] = useState(chapter.number ?? "");
  const [title, setTitle] = useState(chapter.title);

  const saveMeta = () => {
    if (number === (chapter.number ?? "") && title === chapter.title) return;
    void updateChapterMeta(chapter.id, title, number);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onBlur={saveMeta}
          className="w-14 rounded border border-gray-200 px-2 py-1 text-sm"
          placeholder="N°"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveMeta}
          className="flex-1 rounded border border-gray-200 px-2 py-1 font-serif text-lg text-navy"
          placeholder="Título del capítulo"
        />
      </div>

      <div className="mt-4 space-y-6">
        {chapter.sections.map((sec) => (
          <SectionEditor key={sec.id} section={sec} />
        ))}
      </div>
    </section>
  );
}

function SectionEditor({ section }: { section: EditSection }) {
  const router = useRouter();
  const [title, setTitle] = useState(section.title ?? "");

  const saveTitle = () => {
    if (title === (section.title ?? "")) return;
    void updateSectionTitle(section.id, title);
  };

  const add = async () => {
    await addBlock({ sectionId: section.id, type: "PARAGRAPH" });
    router.refresh();
  };

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        placeholder="Título de la sección (opcional)"
        className="mb-2 w-full rounded border border-transparent px-2 py-1 font-serif text-base text-ink hover:border-gray-200 focus:border-gray-300 focus:outline-none"
      />
      <div className="space-y-2">
        {section.blocks.map((b, i) => (
          <BlockEditorCard
            key={b.id}
            block={b}
            isFirst={i === 0}
            isLast={i === section.blocks.length - 1}
          />
        ))}
      </div>
      <button
        onClick={add}
        className="mt-2 text-xs text-navy hover:underline"
      >
        + Agregar párrafo
      </button>
    </div>
  );
}

function BlockEditorCard({
  block,
  isFirst,
  isLast,
}: {
  block: EditBlock;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [chartOpen, setChartOpen] = useState(false);

  const remove = async () => {
    if (!confirm("¿Eliminar este bloque?")) return;
    await deleteBlock(block.id);
    router.refresh();
  };
  const move = async (dir: "up" | "down") => {
    await moveBlock(block.id, dir);
    router.refresh();
  };

  return (
    <div className="group relative rounded-md border border-gray-100 p-3 hover:border-gray-200">
      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
        <IconBtn label="Subir" disabled={isFirst} onClick={() => move("up")}>
          ↑
        </IconBtn>
        <IconBtn label="Bajar" disabled={isLast} onClick={() => move("down")}>
          ↓
        </IconBtn>
        <IconBtn label="Eliminar" onClick={remove}>
          ✕
        </IconBtn>
      </div>

      <span className="text-[10px] uppercase tracking-wide text-ink-soft">
        {block.type}
      </span>

      <div className="mt-1">
        {(block.type === "PARAGRAPH" ||
          block.type === "HEADING" ||
          block.type === "CALLOUT") && <TextBlockEditor block={block} />}

        {block.type === "TABLE" && <TableEditor block={block} />}

        {block.type === "CHART" && (
          <div>
            <ChartBlock content={block.content as unknown as ChartContent} />
            <button
              onClick={() => setChartOpen((v) => !v)}
              className="mt-1 text-xs text-navy hover:underline"
            >
              {chartOpen ? "Cerrar" : "Editar datos del gráfico"}
            </button>
            {chartOpen && (
              <div className="mt-2">
                <ChartForm blockId={block.id} onDone={() => setChartOpen(false)} />
              </div>
            )}
          </div>
        )}

        {block.type === "IMAGE" && (
          <div>
            <div className="flex items-center justify-between rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-sm text-amber-800">
              <span>
                Gráfico estático del Word
                {typeof block.content.alt === "string" && block.content.alt
                  ? ` — «${block.content.alt}»`
                  : ""}
              </span>
              <button
                onClick={() => setChartOpen((v) => !v)}
                className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-700"
              >
                {chartOpen ? "Cerrar" : "Reemplazar por gráfico interactivo"}
              </button>
            </div>
            {chartOpen && (
              <div className="mt-2">
                <ChartForm blockId={block.id} onDone={() => setChartOpen(false)} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TextBlockEditor({ block }: { block: EditBlock }) {
  const initial = typeof block.content.text === "string" ? block.content.text : "";
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (text === initial) return;
    void updateBlockContent({ blockId: block.id, content: { ...block.content, text } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={block.type === "PARAGRAPH" ? 3 : 1}
        className={`w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-navy focus:outline-none ${
          block.type === "HEADING" ? "font-serif font-medium" : ""
        }`}
      />
      {saved && <span className="text-[10px] text-green-600">guardado ✓</span>}
    </div>
  );
}

function TableEditor({ block }: { block: EditBlock }) {
  const router = useRouter();
  const initial = block.content as unknown as TableContent;
  const [columns, setColumns] = useState<string[]>(initial.columns ?? []);
  const [rows, setRows] = useState<(string | number)[][]>(initial.rows ?? []);
  const [caption, setCaption] = useState(initial.caption ?? "");

  const setCell = (r: number, c: number, v: string) =>
    setRows((prev) => prev.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? v : cell)) : row)));
  const setCol = (c: number, v: string) =>
    setColumns((prev) => prev.map((col, i) => (i === c ? v : col)));
  const addRow = () => setRows((prev) => [...prev, columns.map(() => "")]);

  const save = async () => {
    await updateBlockContent({
      blockId: block.id,
      content: { columns, rows, caption },
    });
    router.refresh();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col, c) => (
              <th key={c} className="border border-gray-200 p-1">
                <input
                  value={col}
                  onChange={(e) => setCol(c, e.target.value)}
                  className="w-full px-1 text-left font-semibold"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-gray-100 p-1">
                  <input
                    value={String(cell)}
                    onChange={(e) => setCell(r, c, e.target.value)}
                    className="w-full px-1"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Pie de tabla (opcional)"
        className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs"
      />
      <div className="mt-2 flex gap-2">
        <button onClick={addRow} className="text-xs text-navy hover:underline">
          + Fila
        </button>
        <button
          onClick={save}
          className="rounded bg-navy px-3 py-1 text-xs font-medium text-white hover:bg-navy-700"
        >
          Guardar tabla
        </button>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="h-6 w-6 rounded border border-gray-200 bg-white text-xs text-ink-soft hover:bg-gray-50 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
