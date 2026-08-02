"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setReviewVerdict } from "@/app/actions/annotations";
import type { PanelChapter } from "./ObservationPanel";

type Verdict = "PENDING" | "CONFORME" | "CON_OBSERVACIONES" | "RECHAZADO";

const verdictMeta: Record<Verdict, { label: string; badge: string }> = {
  PENDING: { label: "Sin pronunciarse", badge: "badge-neutral" },
  CONFORME: { label: "Conforme", badge: "badge-ok" },
  CON_OBSERVACIONES: { label: "Con observaciones", badge: "badge-warn" },
  RECHAZADO: { label: "Rechazado", badge: "badge-danger" },
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const statusEs: Record<string, string> = {
  OPEN: "Abierta",
  IN_PROGRESS: "En proceso",
  ANSWERED: "Respondida",
  RESOLVED: "Resuelta",
  DISMISSED: "Descartada",
};

function buildDocHtml(title: string, chapters: PanelChapter[]): string {
  const total = chapters.reduce((n, c) => n + c.observations.length, 0);
  const body = chapters
    .filter((ch) => ch.observations.length > 0)
    .map(
      (ch) => `
    <h2 style="font-family:Georgia,serif;color:#1c3663">${esc(ch.number ? ch.number + ". " : "")}${esc(ch.title)}</h2>
    ${ch.observations
      .map(
        (o) => `
      <div style="margin:14px 0;padding:10px 12px;border-left:3px solid #c9d2e0;background:#f6f8fb">
        <p style="color:#5b6675;font-style:italic;margin:0 0 6px">${esc(o.contextLabel)}</p>
        <p style="margin:0"><b>${esc(o.authorName)}</b> — <i>${esc(statusEs[o.status] ?? o.status)}</i><br>${esc(o.body)}</p>
        ${o.replies
          .map(
            (r) =>
              `<p style="margin:8px 0 0 18px;color:#333">↳ <b>${esc(r.authorName)}</b>${r.isResolution ? " (contrapropuesta)" : ""}: ${esc(r.body)}</p>`
          )
          .join("")}
      </div>`
      )
      .join("")}`
    )
    .join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="font-family:Calibri,Arial,sans-serif;color:#1a2231">
<h1 style="font-family:Georgia,serif;color:#12294d">${esc(title)}</h1>
<p style="color:#5b6675">Consolidado de observaciones — ${total} en total.</p>
${body}
</body></html>`;
}

export function ReviewToolbar({
  reportId,
  reportSlug,
  reportTitle,
  chapters,
  isReviewer,
  verdict,
  verdictComment,
  unresolvedCount,
}: {
  reportId: string;
  reportSlug: string;
  reportTitle: string;
  chapters: PanelChapter[];
  isReviewer: boolean;
  submittedAt: string | null;
  verdict: Verdict;
  verdictComment: string | null;
  unresolvedCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Verdict>("CON_OBSERVACIONES");
  const [comment, setComment] = useState("");

  const downloadWord = () => {
    const html = buildDocHtml(reportTitle, chapters);
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportSlug}-observaciones.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pronounce = async (v: Verdict, c: string) => {
    setPending(true);
    try {
      await setReviewVerdict({ reportId, verdict: v, comment: c.trim() || undefined });
      setOpen(false);
      setComment("");
      router.refresh();
    } catch (e) {
      alert(
        e instanceof Error && e.message === "HAY_OBSERVACIONES_SIN_RESOLVER"
          ? "No puede declarar Conforme: quedan observaciones sin resolver."
          : "No se pudo registrar el pronunciamiento."
      );
    } finally {
      setPending(false);
    }
  };

  const vm = verdictMeta[verdict];

  return (
    <div className="no-print flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={downloadWord}
          className="ring-focus rounded-lg border px-3 py-1.5 text-sm text-ink hover:bg-[color:var(--surface-2)]"
          style={{ borderColor: "var(--line)" }}
        >
          Descargar Word
        </button>
        <button
          onClick={() => window.print()}
          className="ring-focus rounded-lg border px-3 py-1.5 text-sm text-ink hover:bg-[color:var(--surface-2)]"
          style={{ borderColor: "var(--line)" }}
        >
          Imprimir / PDF
        </button>

        {isReviewer && verdict !== "PENDING" && (
          <span className="flex items-center gap-2 text-sm">
            <span className={`badge ${vm.badge}`}>{vm.label}</span>
            <button
              onClick={() => pronounce("PENDING", "")}
              disabled={pending}
              className="ring-focus rounded-md px-2 py-1 text-xs underline hover:text-ink disabled:opacity-50"
              style={{ color: "var(--muted)" }}
            >
              Rectificar
            </button>
          </span>
        )}
        {isReviewer && verdict === "PENDING" && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn-primary ring-focus rounded-lg px-3 py-1.5 text-sm"
          >
            Pronunciarse sobre el entregable
          </button>
        )}
      </div>

      {/* Panel de pronunciamiento (estilo revisión de PR) */}
      {isReviewer && verdict === "PENDING" && open && (
        <div className="surface-card w-full max-w-md p-4 text-left sm:w-[26rem]">
          <p className="text-sm font-medium text-ink">Pronunciamiento sobre el entregable</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--faint)" }}>
            {unresolvedCount > 0
              ? `${unresolvedCount} observación(es) sin resolver — no puede declararse Conforme.`
              : "Sin observaciones pendientes."}
          </p>
          <div className="mt-3 space-y-1.5">
            {(["CONFORME", "CON_OBSERVACIONES", "RECHAZADO"] as const).map((v) => {
              const blocked = v === "CONFORME" && unresolvedCount > 0;
              const active = choice === v;
              return (
                <button
                  key={v}
                  onClick={() => !blocked && setChoice(v)}
                  disabled={blocked}
                  className="ring-focus flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm disabled:opacity-40"
                  style={{
                    borderColor: active ? "var(--accent)" : "var(--line)",
                    background: active ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  <span className={`badge ${verdictMeta[v].badge}`}>{verdictMeta[v].label}</span>
                  {blocked && (
                    <span className="text-xs" style={{ color: "var(--faint)" }}>
                      bloqueado
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Comentario del pronunciamiento (recomendado; obligatorio si rechaza)…"
            className="field ring-focus mt-3 w-full p-2 text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost ring-focus px-3 py-1.5 text-sm">
              Cancelar
            </button>
            <button
              onClick={() => pronounce(choice, comment)}
              disabled={pending || (choice === "RECHAZADO" && !comment.trim())}
              className="btn-primary ring-focus px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {pending ? "Registrando…" : "Registrar pronunciamiento"}
            </button>
          </div>
        </div>
      )}
      {isReviewer && verdict !== "PENDING" && verdictComment && (
        <p className="max-w-md text-xs" style={{ color: "var(--muted)" }}>
          “{verdictComment}”
        </p>
      )}
    </div>
  );
}
