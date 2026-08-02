import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getReportAccess } from "@/lib/rbac";
import { buildSnapshot, diffSnapshots, wordDiff, type SnapshotBlock } from "@/lib/snapshot";
import { PublishVersionButton } from "@/components/report/PublishVersionButton";

export default async function VersionesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();

  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true, versionLabel: true },
  });
  if (!report) notFound();
  const access = await getReportAccess(report.id, user.id);
  if (!access.canView) redirect("/reports");

  const versions = await prisma.reportVersion.findMany({
    where: { reportId: report.id },
    orderBy: { number: "desc" },
    select: { id: true, number: true, label: true, note: true, createdAt: true, snapshot: true },
  });

  // Cambios pendientes: última versión registrada vs contenido actual en vivo.
  const live = await buildSnapshot(prisma, report.id);
  const latest = versions[0]?.snapshot as unknown as SnapshotBlock[] | undefined;
  const pending = latest ? diffSnapshots(latest, live) : null;
  const pendingCount = pending
    ? pending.added.length + pending.removed.length + pending.modified.length
    : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/reports/${report.slug}`}
        className="ring-focus rounded text-sm hover:underline"
        style={{ color: "var(--accent)" }}
      >
        ← Volver al informe
      </Link>
      <h1 className="mt-4 font-serif text-2xl text-ink">Versiones del documento</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {report.title} · versión actual <span className="font-medium text-ink">{report.versionLabel}</span>
      </p>

      {access.canEdit && <PublishVersionButton reportId={report.id} pendingCount={pendingCount} />}

      {/* Cambios pendientes (sin registrar) */}
      {access.canEdit && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
            Cambios pendientes de registrar
          </h2>
          {pendingCount === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              El contenido coincide con la última versión registrada.
            </p>
          ) : (
            <DiffView
              added={pending!.added}
              removed={pending!.removed}
              modified={pending!.modified}
            />
          )}
        </section>
      )}

      {/* Historial */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
          Historial de entregas
        </h2>
        <ol className="surface-card mt-2 divide-y divide-[color:var(--line)] overflow-hidden">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="badge badge-info">v{v.label}</span>
              <span className="text-xs" style={{ color: "var(--faint)" }}>
                {new Date(v.createdAt).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
              </span>
              {v.note && <span style={{ color: "var(--muted)" }}>{v.note}</span>}
            </li>
          ))}
          {versions.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-soft">Aún no hay versiones registradas.</li>
          )}
        </ol>
      </section>

      {/* Diff entre las dos últimas versiones registradas */}
      {versions.length >= 2 && (
        <VersionDiff
          prev={versions[1].snapshot as unknown as SnapshotBlock[]}
          next={versions[0].snapshot as unknown as SnapshotBlock[]}
          prevLabel={versions[1].label}
          nextLabel={versions[0].label}
        />
      )}
    </main>
  );
}

function VersionDiff({
  prev,
  next,
  prevLabel,
  nextLabel,
}: {
  prev: SnapshotBlock[];
  next: SnapshotBlock[];
  prevLabel: string;
  nextLabel: string;
}) {
  const d = diffSnapshots(prev, next);
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
        Cambios entre v{prevLabel} y v{nextLabel}
      </h2>
      <DiffView added={d.added} removed={d.removed} modified={d.modified} />
    </section>
  );
}

function DiffView({
  added,
  removed,
  modified,
}: {
  added: SnapshotBlock[];
  removed: SnapshotBlock[];
  modified: { block: SnapshotBlock; before: string; after: string }[];
}) {
  if (added.length + removed.length + modified.length === 0) {
    return <p className="mt-2 text-sm text-ink-soft">Sin diferencias.</p>;
  }
  return (
    <div className="mt-2 space-y-3">
      {modified.map((m) => (
        <div key={m.block.blockId} className="surface-flat p-3 text-sm">
          <div className="mb-1 text-xs" style={{ color: "var(--faint)" }}>
            Modificado · {m.block.chapterNumber ? m.block.chapterNumber + ". " : ""}
            {m.block.chapterTitle}
          </div>
          <p className="leading-relaxed">
            {wordDiff(m.before, m.after).map((part, i) =>
              part.op === "same" ? (
                <span key={i}>{part.text}</span>
              ) : part.op === "add" ? (
                <span key={i} style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
                  {part.text}
                </span>
              ) : (
                <del key={i} style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                  {part.text}
                </del>
              )
            )}
          </p>
        </div>
      ))}
      {added.map((b) => (
        <div key={b.blockId} className="surface-flat p-3 text-sm">
          <div className="mb-1 text-xs" style={{ color: "var(--faint)" }}>
            Añadido · {b.chapterTitle}
          </div>
          <p style={{ background: "var(--ok-bg)", color: "var(--ok)" }} className="rounded px-1">
            {b.text || `(${b.type})`}
          </p>
        </div>
      ))}
      {removed.map((b) => (
        <div key={b.blockId} className="surface-flat p-3 text-sm">
          <div className="mb-1 text-xs" style={{ color: "var(--faint)" }}>
            Eliminado · {b.chapterTitle}
          </div>
          <del style={{ color: "var(--danger)" }}>{b.text || `(${b.type})`}</del>
        </div>
      ))}
    </div>
  );
}
