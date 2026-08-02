"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { convertImageToChart } from "@/app/actions/reports";
import { ChartBlock } from "@/components/report/ChartBlock";
import type { ChartContent } from "@/types/content";

// Convierte datos pegados (estilo CSV) en la configuración del gráfico.
// Primera fila = encabezados; primera columna = eje X; el resto, series.
function parseCsv(csv: string): ChartContent | null {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(/[,;\t]/).map((c) => c.trim()))
    .filter((r) => r.some((c) => c.length > 0));
  if (lines.length < 2) return null;

  const headers = lines[0];
  if (headers.length < 2) return null;
  const xKey = headers[0];
  const seriesKeys = headers.slice(1);

  const data = lines.slice(1).map((row) => {
    const obj: Record<string, string | number> = { [xKey]: row[0] ?? "" };
    seriesKeys.forEach((key, i) => {
      const raw = row[i + 1] ?? "";
      const num = Number(raw.replace(/\./g, "").replace(",", "."));
      obj[key] = Number.isFinite(num) && raw !== "" ? num : raw;
    });
    return obj;
  });

  return {
    kind: "bar",
    xKey,
    series: seriesKeys.map((k) => ({ key: k, label: k })),
    data,
  };
}

export function ChartForm({
  blockId,
  onDone,
}: {
  blockId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"bar" | "line" | "area">("bar");
  const [caption, setCaption] = useState("");
  const [csv, setCsv] = useState("Año,Flujo\n2019,12400\n2020,9800\n2021,11900");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const preview = parseCsv(csv);
  const previewContent: ChartContent | null = preview
    ? { ...preview, kind, caption }
    : null;

  const submit = async () => {
    setError(null);
    if (!previewContent) {
      setError("Revisa el formato: primera fila encabezados, primera columna eje X.");
      return;
    }
    setPending(true);
    try {
      await convertImageToChart({
        blockId,
        kind,
        caption,
        xKey: previewContent.xKey,
        series: previewContent.series,
        data: previewContent.data,
      });
      onDone();
      router.refresh();
    } catch {
      setError("No se pudo guardar el gráfico.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-md border border-navy/30 bg-white p-4">
      <div className="text-sm font-medium text-navy">
        Reemplazar por gráfico interactivo
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-ink-soft">Tipo</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="bar">Barras</option>
            <option value="line">Líneas</option>
            <option value="area">Área</option>
          </select>
          <label className="mt-3 block text-xs font-medium text-ink-soft">
            Título / pie de figura
          </label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Figura X — …"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <label className="mt-3 block text-xs font-medium text-ink-soft">
            Datos (CSV: encabezados + filas)
          </label>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-soft">
            Vista previa
          </label>
          <div className="mt-1 rounded-md border border-gray-100 p-2">
            {previewContent ? (
              <ChartBlock content={previewContent} />
            ) : (
              <p className="p-6 text-center text-xs text-ink-soft">
                Datos no válidos aún.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={pending || !previewContent}
          className="rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Crear gráfico"}
        </button>
      </div>
    </div>
  );
}
