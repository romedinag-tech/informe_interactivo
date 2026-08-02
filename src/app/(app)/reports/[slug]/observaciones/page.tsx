import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getReportAccess } from "@/lib/rbac";
import {
  ObservationPanel,
  type PanelChapter,
} from "@/components/annotations/ObservationPanel";
import { ReviewToolbar } from "@/components/annotations/ReviewToolbar";
import type { BlockContent, TableContent, ChartContent, ImageContent } from "@/types/content";

// Deriva la etiqueta de contexto que se muestra junto a la observación.
function contextLabel(
  blockType: string,
  content: BlockContent,
  quote: string | null
): string {
  if (quote) return `«${quote}»`;
  switch (blockType) {
    case "TABLE": {
      const c = content as TableContent;
      return `Tabla — ${c.caption ?? c.columns.join(" · ")}`;
    }
    case "CHART": {
      const c = content as ChartContent;
      return `Gráfico — ${c.caption ?? c.kind}`;
    }
    case "IMAGE": {
      const c = content as ImageContent;
      return `Imagen — ${c.alt}`;
    }
    default:
      return (content as { text?: string }).text?.slice(0, 140) ?? "Bloque";
  }
}

export default async function ObservacionesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();

  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });
  if (!report) notFound();

  const access = await getReportAccess(report.id, user.id);
  if (!access.canView) redirect("/reports");

  // Estado de envío de la revisión (para el botón "Enviar al consultor").
  const assignment = await prisma.reportAssignment.findUnique({
    where: { reportId_userId: { reportId: report.id, userId: user.id } },
    select: { submittedAt: true },
  });
  const isReviewer = access.canComment && !access.canEdit;

  // Para el consultor: estado de envío de los revisores.
  const reviewerSubs = access.canEdit
    ? await prisma.reportAssignment.findMany({
        where: { reportId: report.id, role: "REVISOR" },
        select: { submittedAt: true, user: { select: { name: true } } },
      })
    : [];

  // Capítulos con sus observaciones (a través de bloque → sección → capítulo).
  const chapters = await prisma.chapter.findMany({
    where: { reportId: report.id },
    orderBy: { order: "asc" },
    include: {
      sections: {
        include: {
          blocks: {
            include: {
              annotations: {
                orderBy: { createdAt: "asc" },
                include: {
                  author: { select: { name: true } },
                  replies: {
                    orderBy: { createdAt: "asc" },
                    include: { author: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const panelChapters: PanelChapter[] = chapters.map((ch) => {
    const observations = ch.sections
      .flatMap((s) => s.blocks)
      .flatMap((b) =>
        b.annotations.map((a) => ({
          id: a.id,
          status: a.status,
          authorId: a.authorId,
          authorName: a.author.name,
          createdAt: a.createdAt.toISOString(),
          body: a.body,
          contextLabel: contextLabel(b.type, b.content as BlockContent, a.quote),
          replies: a.replies.map((r) => ({
            id: r.id,
            authorName: r.author.name,
            body: r.body,
            isResolution: r.isResolution,
            createdAt: r.createdAt.toISOString(),
          })),
        }))
      );
    return {
      id: ch.id,
      title: ch.title,
      number: ch.number,
      observations,
    };
  });

  return (
    <>
      <div
        className="no-print border-b"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href={`/reports/${report.slug}`}
              className="ring-focus rounded text-sm hover:underline"
              style={{ color: "var(--accent)" }}
            >
              ← Volver
            </Link>
            <h1 className="font-serif text-lg text-ink">{report.title}</h1>
          </div>
          <ReviewToolbar
            reportId={report.id}
            reportSlug={report.slug}
            reportTitle={report.title}
            chapters={panelChapters}
            isReviewer={isReviewer}
            submittedAt={assignment?.submittedAt?.toISOString() ?? null}
          />
        </div>
      </div>
      {reviewerSubs.length > 0 && (
        <div className="no-print mx-auto max-w-4xl px-4 pt-4">
          <div className="surface-flat flex flex-wrap gap-x-4 gap-y-1 p-3 text-xs">
            {reviewerSubs.map((r, i) => (
              <span key={i} className="text-ink-soft">
                {r.user.name}:{" "}
                {r.submittedAt ? (
                  <span style={{ color: "var(--ok)" }}>
                    enviada el {new Date(r.submittedAt).toLocaleDateString("es-CL")}
                  </span>
                ) : (
                  <span style={{ color: "var(--warn)" }}>en revisión</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="print-area">
        <ObservationPanel
          chapters={panelChapters}
          canEdit={access.canEdit}
          canComment={access.canComment}
          currentUserId={user.id}
        />
      </div>
    </>
  );
}
