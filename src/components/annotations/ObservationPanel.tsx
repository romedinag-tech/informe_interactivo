"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceInput } from "./VoiceInput";
import {
  replyToAnnotation,
  setAnnotationStatus,
  updateAnnotationBody,
  deleteAnnotation,
} from "@/app/actions/annotations";

export type PanelReply = {
  id: string;
  authorName: string;
  body: string;
  isResolution: boolean;
  createdAt: string;
};

export type PanelObservation = {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
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

const statusMeta: Record<
  string,
  { label: string; cls: string }
> = {
  OPEN: { label: "Abierta", cls: "bg-amber-100 text-amber-800" },
  IN_PROGRESS: { label: "En proceso", cls: "bg-blue-100 text-blue-800" },
  RESOLVED: { label: "Resuelta", cls: "bg-green-100 text-green-800" },
  DISMISSED: { label: "Descartada", cls: "bg-gray-100 text-gray-600" },
};

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
  const total = chapters.reduce((n, c) => n + c.observations.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-serif text-2xl text-navy">
        Consolidado de observaciones
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {total} observaciones agrupadas por capítulo.
      </p>

      <div className="mt-8 space-y-10">
        {chapters.map((ch) => (
          <section key={ch.id}>
            <h2 className="border-b border-gray-200 pb-2 font-serif text-lg text-navy">
              {ch.number ? `${ch.number}. ` : ""}
              {ch.title}{" "}
              <span className="text-sm font-normal text-ink-soft">
                ({ch.observations.length})
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
    </div>
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
  const meta = statusMeta[obs.status];

  const isOwner = obs.authorId === currentUserId;
  const canDelete = isOwner || canEdit;

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

  const changeStatus = async (status: PanelObservation["status"]) => {
    setPending(true);
    try {
      await setAnnotationStatus({ annotationId: obs.id, status });
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {/* Contexto original */}
      <div className="rounded-md border-l-4 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-ink-soft">
        {obs.contextLabel}
      </div>

      {/* Observación del revisor */}
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-ink-soft">
            {obs.authorName} · {new Date(obs.createdAt).toLocaleDateString("es-CL")}
          </div>
          {editing ? (
            <div className="mt-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                autoFocus
                className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-ink focus:border-navy focus:outline-none"
              />
              <div className="mt-1 flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={pending || !draft.trim()}
                  className="rounded-md bg-navy px-3 py-1 text-xs font-medium text-white hover:bg-navy-700 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setDraft(obs.body);
                    setEditing(false);
                  }}
                  className="rounded-md px-3 py-1 text-xs text-ink-soft hover:bg-gray-100"
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
                      className="text-navy hover:underline"
                    >
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={remove}
                      disabled={pending}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${meta.cls}`}>
          {meta.label}
        </span>
      </div>

      {/* Hilo de respuestas / contrapropuestas */}
      {obs.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {obs.replies.map((r) => (
            <div key={r.id} className="rounded-md bg-navy/5 px-3 py-2">
              <div className="text-xs text-navy">
                {r.authorName}
                {r.isResolution && (
                  <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-800">
                    Contrapropuesta
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      {canComment && obs.status !== "RESOLVED" && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder={
              canEdit
                ? "Escriba la contrapropuesta o respuesta…"
                : "Escriba una réplica…"
            }
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-navy focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <VoiceInput onAppend={(t) => setReply((p) => (p ? `${p} ${t}` : t))} />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => sendReply(false)}
                disabled={pending || !reply.trim()}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-ink hover:bg-gray-50 disabled:opacity-50"
              >
                Responder
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={() => sendReply(true)}
                    disabled={pending || !reply.trim()}
                    className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    Resolver con contrapropuesta
                  </button>
                  {obs.status === "OPEN" && (
                    <button
                      onClick={() => changeStatus("IN_PROGRESS")}
                      disabled={pending}
                      className="rounded-md border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      Marcar en proceso
                    </button>
                  )}
                  <button
                    onClick={() => changeStatus("DISMISSED")}
                    disabled={pending}
                    className="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-gray-100 disabled:opacity-50"
                  >
                    Descartar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
