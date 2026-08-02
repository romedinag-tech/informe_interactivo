import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getReportAccess } from "@/lib/rbac";
import { ReportViewer, type ClientAnnotation } from "@/components/report/ReportViewer";
import { ThemeToggle } from "@/components/viewer/ThemeToggle";
import { ReadingProgress } from "@/components/viewer/ReadingProgress";
import { TableOfContents, type TocChapter } from "@/components/viewer/TableOfContents";
import { AudioPlayer, type AudioChapter } from "@/components/viewer/AudioPlayer";
import { TalcaMark } from "@/components/viewer/TalcaMark";
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
    authorId: a.authorId,
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

  // Sello de estado del documento (mapea Report.status + observaciones abiertas).
  const openCount = annotations.filter((a) => a.status === "OPEN").length;
  const seal = ((): { label: string; cls: string } => {
    switch (report.status) {
      case "DRAFT":
        return { label: "Borrador", cls: "badge-neutral" };
      case "IN_REVIEW":
        return openCount > 0
          ? { label: "Observado", cls: "badge-warn" }
          : { label: "En revisión", cls: "badge-info" };
      case "RESOLVED":
        return { label: "Aprobado", cls: "badge-ok" };
      default:
        return { label: "Archivado", cls: "badge-neutral" };
    }
  })();

  return (
    <>
      <ReadingProgress />

      <div
        className="sticky top-11 z-30 border-b backdrop-blur"
        style={{ background: "color-mix(in srgb, var(--surface) 90%, transparent)", borderColor: "var(--line)" }}
      >
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-2.5">
          {/* Identidad del documento (agrupada) */}
          <div className="flex min-w-0 items-center gap-3">
            <TalcaMark className="h-9 w-9 shrink-0 text-navy" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-serif text-base font-semibold text-ink md:text-lg">
                  {report.title}
                </h1>
                <span className={`badge ${seal.cls} shrink-0`}>{seal.label}</span>
              </div>
              <p className="truncate text-[11px]" style={{ color: "var(--faint)" }}>
                {report.subtitle && <span>{report.subtitle} · </span>}
                <span className="uppercase tracking-wide">Informe {report.slug}</span>
              </p>
            </div>
          </div>
          {/* Acciones */}
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {access.canEdit && (
              <Link
                href={`/reports/${report.slug}/editar`}
                className="ring-focus rounded-lg border px-3 py-1.5 text-sm font-medium text-ink hover:bg-gray-50"
                style={{ borderColor: "var(--line)" }}
              >
                Editar
              </Link>
            )}
            <Link
              href={`/reports/${report.slug}/observaciones`}
              className="ring-focus rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700"
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
          reportSlug={report.slug}
          chapters={chapters}
          annotations={annotations}
          canComment={access.canComment}
          canEdit={access.canEdit}
          currentUserId={user.id}
          glossary={glossary}
        />
      </div>

      <AudioPlayer reportSlug={report.slug} chapters={audioChapters} />
    </>
  );
}
