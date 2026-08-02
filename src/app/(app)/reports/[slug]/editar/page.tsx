import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getReportAccess } from "@/lib/rbac";
import { ReportEditor } from "@/components/editor/ReportEditor";

export default async function EditarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();

  const report = await prisma.report.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: { blocks: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  if (!report) notFound();

  const access = await getReportAccess(report.id, user.id);
  if (!access.canEdit) redirect(`/reports/${slug}`); // sólo edición para consultores

  const chapters = report.chapters.map((ch) => ({
    id: ch.id,
    number: ch.number,
    title: ch.title,
    sections: ch.sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      blocks: sec.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        content: (b.content ?? {}) as Record<string, unknown>,
      })),
    })),
  }));

  return (
    <ReportEditor
      reportId={report.id}
      reportSlug={report.slug}
      reportTitle={report.title}
      status={report.status}
      chapters={chapters}
    />
  );
}
