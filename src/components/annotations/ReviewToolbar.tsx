"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitReview, reopenReview } from "@/app/actions/annotations";
import type { PanelChapter } from "./ObservationPanel";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const statusEs: Record<string, string> = {
  OPEN: "Abierta",
  IN_PROGRESS: "En proceso",
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
  submittedAt,
}: {
  reportId: string;
  reportSlug: string;
  reportTitle: string;
  chapters: PanelChapter[];
  isReviewer: boolean;
  submittedAt: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

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

  const submit = async () => {
    if (
      !confirm(
        "¿Está seguro de enviar sus observaciones al consultor?\n\n¿Confirma que la revisión está terminada? Podrá reabrirla si lo necesita."
      )
    )
      return;
    setPending(true);
    try {
      await submitReview(reportId);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const reopen = async () => {
    setPending(true);
    try {
      await reopenReview(reportId);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        onClick={downloadWord}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-ink hover:bg-gray-50"
      >
        Descargar Word
      </button>
      <button
        onClick={() => window.print()}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-ink hover:bg-gray-50"
      >
        Imprimir / PDF
      </button>

      {isReviewer &&
        (submittedAt ? (
          <span className="flex items-center gap-2 text-sm text-green-700">
            ✓ Enviada el {new Date(submittedAt).toLocaleDateString("es-CL")}
            <button
              onClick={reopen}
              disabled={pending}
              className="rounded-md px-2 py-1 text-xs text-ink-soft underline hover:text-navy disabled:opacity-50"
            >
              Reabrir
            </button>
          </span>
        ) : (
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
          >
            {pending ? "Enviando…" : "Enviar al consultor"}
          </button>
        ))}
    </div>
  );
}
