import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, isConsultor, isAdmin } from "@/lib/rbac";

const statusLabel: Record<string, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelto",
  ARCHIVED: "Archivado",
};

export default async function ReportsPage() {
  const user = await requireUser();

  // Visibilidad por asignación: cada usuario ve solo sus estudios; el Admin ve todos.
  const reports = await prisma.report.findMany({
    where: isAdmin(user) ? undefined : { assignments: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { annotations: true } },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Informes</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {isConsultor(user)
              ? "Todos los informes de la plataforma."
              : "Informes asignados para su revisión."}
          </p>
        </div>
        {isConsultor(user) && (
          <Link
            href="/reports/importar"
            className="btn-primary ring-focus shrink-0 rounded-md px-4 py-2 text-sm"
          >
            + Importar informe (.docx)
          </Link>
        )}
      </div>

      <div className="surface-card mt-6 divide-y divide-[color:var(--line)] overflow-hidden">
        {reports.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-soft">
            No hay informes disponibles.
          </p>
        )}
        {reports.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between px-4 py-4 hover:bg-[color:var(--surface-2)]"
            style={{ borderColor: "var(--line)" }}
          >
            <Link href={`/reports/${r.slug}`} className="ring-focus min-w-0 flex-1 rounded">
              <div className="font-medium text-ink">{r.title}</div>
              {r.subtitle && (
                <div className="text-sm text-ink-soft">{r.subtitle}</div>
              )}
            </Link>
            <div className="flex items-center gap-4 text-sm text-ink-soft">
              <span className="hidden sm:inline">{r._count.annotations} observaciones</span>
              <span className="badge badge-neutral">
                {statusLabel[r.status] ?? r.status}
              </span>
              {isConsultor(user) && (
                <Link
                  href={`/reports/${r.slug}/editar`}
                  className="ring-focus rounded-md border px-3 py-1 text-xs hover:bg-[color:var(--surface-2)]"
                  style={{ borderColor: "var(--line)", color: "var(--accent)" }}
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
