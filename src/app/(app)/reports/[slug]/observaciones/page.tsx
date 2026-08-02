import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getReportAccess } from "@/lib/rbac";
import {
  ObservationPanel,
  type PanelChapter,
} from "@/components/annotations/ObservationPanel";
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
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="font-serif text-xl text-navy">{report.title}</h1>
          <Link
            href={`/reports/${report.slug}`}
            className="text-sm text-navy hover:underline"
          >
            ← Volver al informe
          </Link>
        </div>
      </div>
      <ObservationPanel
        chapters={panelChapters}
        canEdit={access.canEdit}
        canComment={access.canComment}
      />
    </>
  );
}
