import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getReportAccess } from "@/lib/rbac";
import { ReportViewer, type ClientAnnotation } from "@/components/report/ReportViewer";
import { ThemeToggle } from "@/components/viewer/ThemeToggle";
import { ReadingProgress } from "@/components/viewer/ReadingProgress";
import { TableOfContents, type TocChapter } from "@/components/viewer/TableOfContents";
import { AudioPlayer, type AudioChapter } from "@/components/viewer/AudioPlayer";
import { chapterNarrationText } from "@/lib/chapter-text";
import type { GlossaryEntry } from "@/components/viewer/GlossaryTooltip";
import type { ViewChapter } from "@/types/content";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();

  const report = await prisma.report.findUnique({
    where: { slug },
    include: {
      glossary: true,
      chapters: {
        orderBy: { order: "asc" },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: { blocks: { orderBy: { order: "asc" } } },
          },
        },
      },
      annotations: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!report) notFound();

  const access = await getReportAccess(report.id, user.id);
  if (!access.canView) redirect("/reports");

  type BlockContentT = ViewChapter["sections"][number]["blocks"][number]["content"];

  const chapters: ViewChapter[] = report.chapters.map((ch) => ({
    id: ch.id,
    number: ch.number,
    title: ch.title,
    sections: ch.sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      collapsedByDefault: sec.collapsedByDefault,
      blocks: sec.blocks.map((b) => ({
        id: b.id,
        anchorKey: b.anchorKey,
        type: b.type,
        content: b.content as BlockContentT,
        annotationCount: 0,
      })),
    })),
  }));

  const annotations: ClientAnnotation[] = report.annotations.map((a) => ({
    id: a.id,
    blockId: a.blockId,
    quote: a.quote,
    rangeStart: a.rangeStart,
    rangeEnd: a.rangeEnd,
    body: a.body,
    status: a.status,
    authorName: a.author.name,
    createdAt: a.createdAt.toISOString(),
  }));

  const toc: TocChapter[] = report.chapters.map((ch) => ({
    id: ch.id,
    number: ch.number,
    title: ch.title,
    sections: ch.sections.map((s) => ({ id: s.id, title: s.title })),
  }));

  const audioChapters: AudioChapter[] = report.chapters.map((ch) => ({
    id: ch.id,
    title: `${ch.number ? ch.number + ". " : ""}${ch.title}`,
    text: chapterNarrationText(
      ch.title,
      ch.sections.flatMap((s) => s.blocks)
    ),
  }));

  const glossary: GlossaryEntry[] = report.glossary.map((g) => ({
    term: g.term,
    definition: g.definition,
    source: g.source,
  }));

  return (
    <>
      <ReadingProgress />

      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-xl text-navy">{report.title}</h1>
            {report.subtitle && (
              <p className="truncate text-sm text-ink-soft">{report.subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            {access.canEdit && (
              <Link
                href={`/reports/${report.slug}/editar`}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-ink hover:bg-gray-50"
              >
                Editar
              </Link>
            )}
            <Link
              href={`/reports/${report.slug}/observaciones`}
              className="rounded-md border border-navy px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy hover:text-white"
            >
              Observaciones ({annotations.length})
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <TableOfContents chapters={toc} />
        <ReportViewer
          reportId={report.id}
          chapters={chapters}
          annotations={annotations}
          canComment={access.canComment}
          glossary={glossary}
        />
      </div>

      <AudioPlayer reportSlug={report.slug} chapters={audioChapters} />
    </>
  );
}
