export type AuditRow = {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
};

// Traza inmutable de la revisión. Colapsable nativo (<details>), accesible y
// sin JS. Se puede exportar imprimiendo (queda dentro del área imprimible).
export function AuditTrail({ events }: { events: AuditRow[] }) {
  if (events.length === 0) return null;
  return (
    <details className="surface-flat mx-auto mt-8 max-w-4xl overflow-hidden">
      <summary
        className="ring-focus cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink"
        style={{ background: "var(--surface-2)" }}
      >
        Trazabilidad de la revisión ({events.length} eventos)
      </summary>
      <ol className="divide-y" style={{ borderColor: "var(--line)" }}>
        {events.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2 text-sm"
            style={{ borderColor: "var(--line)" }}
          >
            <time className="tabular-nums text-xs" style={{ color: "var(--faint)" }}>
              {new Date(e.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
            </time>
            <span className="font-medium text-ink">{e.actorName}</span>
            <span style={{ color: "var(--muted)" }}>{e.summary}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
