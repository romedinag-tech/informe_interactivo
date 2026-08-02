"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishNewVersion } from "@/app/actions/versions";

export function PublishVersionButton({
  reportId,
  pendingCount,
}: {
  reportId: string;
  pendingCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const run = async () => {
    setPending(true);
    try {
      const r = await publishNewVersion({ reportId, note: note.trim() || undefined });
      alert(
        `Versión ${r.label} registrada.\n${r.reanchoredCount} observaciones re-ancladas, ${r.orphanCount} huérfanas.`
      );
      setOpen(false);
      setNote("");
      router.refresh();
    } catch {
      alert("No se pudo registrar la versión.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="btn-primary ring-focus rounded-lg px-3 py-1.5 text-sm"
        >
          Registrar nueva versión
        </button>
      ) : (
        <div className="surface-card max-w-md p-4">
          <p className="text-sm font-medium text-ink">Registrar nueva versión</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--faint)" }}>
            Toma un snapshot del contenido actual, re-ancla las observaciones y sube la versión.
            {pendingCount > 0 ? ` Hay ${pendingCount} cambio(s) pendiente(s).` : " Sin cambios pendientes."}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Nota de la entrega (opcional)…"
            className="field ring-focus mt-3 w-full p-2 text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost ring-focus px-3 py-1.5 text-sm">
              Cancelar
            </button>
            <button
              onClick={run}
              disabled={pending}
              className="btn-primary ring-focus px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {pending ? "Registrando…" : "Registrar versión"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
