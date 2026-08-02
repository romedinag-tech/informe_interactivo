import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, isConsultor } from "@/lib/rbac";

const statusLabel: Record<string, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelto",
  ARCHIVED: "Archivado",
};

export default async function ReportsPage() {
  const user = await requireUser();

  // Consultor/Admin ven todo; el revisor sólo los informes que le fueron asignados.
  const reports = await prisma.report.findMany({
    where: isConsultor(user)
      ? undefined
      : { assignments: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { annotations: true } },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-navy">Informes</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {isConsultor(user)
              ? "Todos los informes de la plataforma."
              : "Informes asignados para su revisión."}
          </p>
        </div>
        {isConsultor(user) && (
          <Link
            href="/reports/importar"
            className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
          >
            + Importar informe (.docx)
          </Link>
        )}
      </div>

      <div className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {reports.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-soft">
            No hay informes disponibles.
          </p>
        )}
        {reports.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between px-4 py-4 hover:bg-gray-50"
          >
            <Link href={`/reports/${r.slug}`} className="min-w-0 flex-1">
              <div className="font-medium text-ink">{r.title}</div>
              {r.subtitle && (
                <div className="text-sm text-ink-soft">{r.subtitle}</div>
              )}
            </Link>
            <div className="flex items-center gap-4 text-sm text-ink-soft">
              <span>{r._count.annotations} observaciones</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                {statusLabel[r.status] ?? r.status}
              </span>
              {isConsultor(user) && (
                <Link
                  href={`/reports/${r.slug}/editar`}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs text-navy hover:bg-navy hover:text-white"
                >
                  Editar
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
