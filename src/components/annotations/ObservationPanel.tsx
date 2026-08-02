"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceInput } from "./VoiceInput";
import {
  replyToAnnotation,
  setAnnotationStatus,
  setAnnotationSeverity,
  updateAnnotationBody,
  deleteAnnotation,
} from "@/app/actions/annotations";

export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type ObsStatus = "OPEN" | "IN_PROGRESS" | "ANSWERED" | "RESOLVED" | "DISMISSED";

export type PanelReply = {
  id: string;
  authorName: string;
  body: string;
  isResolution: boolean;
  createdAt: string;
};

export type PanelObservation = {
  id: string;
  status: ObsStatus;
  severity: Severity;
  orphaned: boolean;
  resolutionNote: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  body: string;
  contextLabel: string; // fragmento citado o descripción del nodo (tabla/gráfico)
  replies: PanelReply[];
};

export type PanelChapter = {
  id: string;
  title: string;
  number: string | null;
  observations: PanelObservation[];
};

const statusMeta: Record<string, { label: string; badge: string }> = {
  OPEN: { label: "Abierta", badge: "badge-warn" },
  IN_PROGRESS: { label: "En proceso", badge: "badge-info" },
  ANSWERED: { label: "Respondida", badge: "badge-info" },
  RESOLVED: { label: "Resuelta", badge: "badge-ok" },
  DISMISSED: { label: "Descartada", badge: "badge-neutral" },
};

const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "ANSWERED", "RESOLVED", "DISMISSED"] as const;

// Observaciones que aún cuentan como "sin resolver" (bloquean la conformidad).
const UNRESOLVED: ObsStatus[] = ["OPEN", "IN_PROGRESS", "ANSWERED"];

const severityMeta: Record<Severity, { label: string; badge: string }> = {
  LOW: { label: "Menor", badge: "badge-neutral" },
  MEDIUM: { label: "Importante", badge: "badge-info" },
  HIGH: { label: "Crítica", badge: "badge-danger" },
};
const SEVERITY_ORDER: Severity[] = ["HIGH", "MEDIUM", "LOW"];

export function ObservationPanel({
  chapters,
  canEdit,
  canComment,
  currentUserId,
}: {
  chapters: PanelChapter[];
  canEdit: boolean;
  canComment: boolean;
  currentUserId: string;
}) {
  const [statusF, setStatusF] = useState<"all" | string>("all");
  const [chapterF, setChapterF] = useState<"all" | string>("all");
  const [severityF, setSeverityF] = useState<"all" | Severity>("all");

  const all = chapters.flatMap((c) => c.observations);
  const total = all.length;
  const unresolved = all.filter((o) => UNRESOLVED.includes(o.status)).length;
  const countByStatus = (s: string) => all.filter((o) => o.status === s).length;
  const countBySeverity = (s: Severity) => all.filter((o) => o.severity === s).length;

  const visible = chapters
    .filter((ch) => chapterF === "all" || ch.id === chapterF)
    .map((ch) => ({
      ...ch,
      observations: ch.observations.filter(
        (o) =>
          (statusF === "all" || o.status === statusF) &&
          (severityF === "all" || o.severity === severityF)
      ),
    }))
    .filter((ch) => ch.observations.length > 0);
  const shown = visible.reduce((n, c) => n + c.observations.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-serif text-2xl text-ink">Consolidado de observaciones</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {total} {total === 1 ? "observación" : "observaciones"} en total
        {unresolved > 0 && (
          <>
            {" · "}
            <span style={{ color: "var(--warn)" }} className="font-medium">
              {unresolved} sin resolver
            </span>
          </>
        )}
        {total > 0 && unresolved === 0 && (
          <>
            {" · "}
            <span style={{ color: "var(--ok)" }} className="font-medium">
              todas resueltas
            </span>
          </>
        )}
        .
      </p>

      {/* Filtros */}
      {total > 0 && (
        <div className="no-print mt-5 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={statusF === "all"} onClick={() => setStatusF("all")}>
                Todas ({total})
              </FilterChip>
              {STATUS_ORDER.map((s) => {
                const n = countByStatus(s);
                if (n === 0) return null;
                return (
                  <FilterChip key={s} active={statusF === s} onClick={() => setStatusF(s)}>
                    {statusMeta[s].label} ({n})
                  </FilterChip>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
                Severidad
              </span>
              <FilterChip active={severityF === "all"} onClick={() => setSeverityF("all")}>
                Todas
              </FilterChip>
              {SEVERITY_ORDER.map((s) => {
                const n = countBySeverity(s);
                if (n === 0) return null;
                return (
                  <FilterChip key={s} active={severityF === s} onClick={() => setSeverityF(s)}>
                    {severityMeta[s].label} ({n})
                  </FilterChip>
                );
              })}
            </div>
          <select
            value={chapterF}
            onChange={(e) => setChapterF(e.target.value)}
            className="ring-focus ml-auto rounded-md border px-2 py-1 text-xs text-ink"
            style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
            aria-label="Filtrar por capítulo"
          >
            <option value="all">Todos los capítulos</option>
            {chapters
              .filter((c) => c.observations.length > 0)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
          </div>
        </div>
      )}

      {shown === 0 ? (
        <div className="surface-flat mt-8 p-10 text-center">
          <p className="font-serif text-lg text-ink">
            {total === 0 ? "Aún no hay observaciones" : "Sin resultados"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {total === 0
              ? "Las observaciones que el revisor deje sobre el informe aparecerán aquí, agrupadas por capítulo."
              : "Ninguna observación coincide con el filtro. Ajusta el estado o el capítulo."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          {visible.map((ch) => (
            <section key={ch.id}>
              <h2 className="flex items-baseline gap-2 border-b pb-2 font-serif text-lg text-ink" style={{ borderColor: "var(--line)" }}>
                {ch.title}
                <span className="text-sm font-normal text-ink-soft">
                  {ch.observations.length}
                </span>
              </h2>
              <div className="mt-4 space-y-4">
                {ch.observations.map((o) => (
                  <ObservationCard
                    key={o.id}
                    obs={o}
                    canEdit={canEdit}
                    canComment={canComment}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="ring-focus rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      style={
        active
          ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
          : { color: "var(--muted)", background: "var(--surface)", borderColor: "var(--line)" }
      }
    >
      {children}
    </button>
  );
}

function ObservationCard({
  obs,
  canEdit,
  canComment,
  currentUserId,
}: {
  obs: PanelObservation;
  canEdit: boolean;
  canComment: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(obs.body);
  const [dismissing, setDismissing] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const meta = statusMeta[obs.status];
  const sev = severityMeta[obs.severity];

  const isOwner = obs.authorId === currentUserId;
  const canDelete = isOwner || canEdit;
  const isReviewer = canComment && !canEdit;

  const saveEdit = async () => {
    if (!draft.trim()) return;
    setPending(true);
    try {
      await updateAnnotationBody(obs.id, draft.trim());
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!confirm("¿Eliminar esta observación? No se puede deshacer.")) return;
    setPending(true);
    try {
      await deleteAnnotation(obs.id);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const sendReply = async (isResolution: boolean) => {
    if (!reply.trim()) return;
    setPending(true);
    try {
      await replyToAnnotation({
        annotationId: obs.id,
        body: reply.trim(),
        isResolution,
      });
      setReply("");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const changeStatus = async (status: ObsStatus, note?: string) => {
    setPending(true);
    try {
      await setAnnotationStatus({ annotationId: obs.id, status, note });
      setDismissing(false);
      setDismissReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const changeSeverity = async (severity: Severity) => {
    setPending(true);
    try {
      await setAnnotationSeverity({ annotationId: obs.id, severity });
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="surface-flat p-4">
      {/* Ancla citada (a qué se refiere la observación) */}
      <div
        className="rounded-md px-3 py-2 text-sm"
        style={{ background: "var(--surface-2)", borderLeft: "3px solid var(--accent)", color: "var(--muted)" }}
      >
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>
          Ancla ·
        </span>
        {obs.contextLabel}
      </div>

      {/* Observación del revisor */}
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs" style={{ color: "var(--faint)" }}>
            {obs.authorName} ·{" "}
            {new Date(obs.createdAt).toLocaleString("es-CL", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
          {editing ? (
            <div className="mt-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                autoFocus
                className="field ring-focus w-full p-2 text-sm"
              />
              <div className="mt-1 flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={pending || !draft.trim()}
                  className="btn-primary ring-focus px-3 py-1 text-xs"
                >
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setDraft(obs.body);
                    setEditing(false);
                  }}
                  className="btn-ghost ring-focus px-3 py-1 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-ink">{obs.body}</p>
              {(isOwner || canDelete) && (
                <div className="mt-1 flex gap-3 text-xs">
                  {isOwner && (
                    <button
                      onClick={() => {
                        setDraft(obs.body);
                        setEditing(true);
                      }}
                      className="ring-focus font-medium hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={remove}
                      disabled={pending}
                      className="ring-focus font-medium hover:underline disabled:opacity-50"
                      style={{ color: "var(--danger)" }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {obs.orphaned && (
            <span className="badge badge-danger" title="El texto anclado ya no existe en esta versión">
              Ancla perdida
            </span>
          )}
          <span className={`badge ${meta.badge}`}>{meta.label}</span>
          {isOwner ? (
            <select
              value={obs.severity}
              onChange={(e) => changeSeverity(e.target.value as Severity)}
              disabled={pending}
              aria-label="Severidad"
              className="ring-focus rounded-md border px-1.5 py-0.5 text-[11px]"
              style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--muted)" }}
            >
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {severityMeta[s].label}
                </option>
              ))}
            </select>
          ) : (
            <span className={`badge ${sev.badge}`}>{sev.label}</span>
          )}
        </div>
      </div>

      {/* Justificación de cierre (resuelta/descartada) */}
      {obs.resolutionNote && (obs.status === "DISMISSED" || obs.status === "RESOLVED") && (
        <div
          className="mt-2 rounded-md px-3 py-2 text-xs"
          style={{ background: "var(--surface-2)", color: "var(--muted)" }}
        >
          <span className="font-semibold" style={{ color: "var(--faint)" }}>
            {obs.status === "DISMISSED" ? "Justificación del descarte: " : "Nota de resolución: "}
          </span>
          {obs.resolutionNote}
        </div>
      )}

      {/* Hilo de respuestas / contrapropuestas */}
      {obs.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--line)" }}>
          {obs.replies.map((r) => (
            <div key={r.id} className="rounded-md px-3 py-2" style={{ background: "var(--accent-soft)" }}>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--accent-strong)" }}>
                {r.authorName}
                {r.isResolution && <span className="badge badge-ok">Contrapropuesta</span>}
              </div>
              <p className="mt-1 text-sm text-ink">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      {canComment && (obs.status === "RESOLVED" || obs.status === "DISMISSED") && (
        <div className="mt-3 flex items-center gap-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            Observación {statusMeta[obs.status].label.toLowerCase()}.
          </span>
          <button
            onClick={() => changeStatus("OPEN")}
            disabled={pending}
            className="ring-focus ml-auto rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            style={{ color: "var(--warn)", borderColor: "var(--warn-border)" }}
          >
            Reabrir
          </button>
        </div>
      )}

      {canComment && obs.status !== "RESOLVED" && obs.status !== "DISMISSED" && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
          {dismissing ? (
            <div>
              <label className="text-xs font-medium text-ink">
                Justificación del descarte (obligatoria)
              </label>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Explique por qué la observación se descarta…"
                className="field ring-focus mt-1 w-full p-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => changeStatus("DISMISSED", dismissReason.trim())}
                  disabled={pending || !dismissReason.trim()}
                  className="ring-focus rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  style={{ background: "var(--danger)" }}
                >
                  Confirmar descarte
                </button>
                <button
                  onClick={() => {
                    setDismissing(false);
                    setDismissReason("");
                  }}
                  className="btn-ghost ring-focus px-3 py-1.5 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder={
                  canEdit ? "Escriba la contrapropuesta o respuesta…" : "Escriba una réplica…"
                }
                className="field ring-focus w-full p-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <VoiceInput onAppend={(t) => setReply((p) => (p ? `${p} ${t}` : t))} />
                <div className="flex flex-wrap gap-2">
                  {isReviewer && obs.status === "ANSWERED" && (
                    <button
                      onClick={() => changeStatus("RESOLVED")}
                      disabled={pending}
                      className="ring-focus rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      style={{ background: "var(--ok)" }}
                    >
                      Aceptar y resolver
                    </button>
                  )}
                  <button
                    onClick={() => sendReply(false)}
                    disabled={pending || !reply.trim()}
                    className="ring-focus rounded-md border px-3 py-1.5 text-sm text-ink hover:bg-[color:var(--surface-2)] disabled:opacity-50"
                    style={{ borderColor: "var(--line)" }}
                  >
                    Responder
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => sendReply(true)}
                        disabled={pending || !reply.trim()}
                        className="btn-primary ring-focus px-3 py-1.5 text-sm"
                      >
                        Resolver con contrapropuesta
                      </button>
                      {obs.status === "OPEN" && (
                        <button
                          onClick={() => changeStatus("IN_PROGRESS")}
                          disabled={pending}
                          className="ring-focus rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                          style={{ color: "var(--info)", borderColor: "var(--info-border)" }}
                        >
                          Marcar en proceso
                        </button>
                      )}
                      <button
                        onClick={() => setDismissing(true)}
                        disabled={pending}
                        className="btn-ghost ring-focus px-3 py-1.5 text-sm"
                      >
                        Descartar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
