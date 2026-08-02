"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Var = [string, string, string, string]; // [campo, etiqueta, unidad, escala]
type MapData = {
  zonas?: GeoJSON.FeatureCollection;
  area?: GeoJSON.GeoJsonObject;
  vars?: Var[];
};

const PALETTES: Record<string, string[]> = {
  seq: ["#e8edf5", "#b9c9e0", "#7f9dc6", "#456da2", "#16305a"],
  div0: ["#b45c4e", "#d9a48f", "#efe9e0", "#8fb3a0", "#2f6b57"],
  div1: ["#b45c4e", "#d9a48f", "#efe9e0", "#8fb3a0", "#2f6b57"],
};

function quantileBreaks(values: number[], n = 5): number[] {
  const v = values.filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return [];
  const breaks: number[] = [];
  for (let i = 1; i < n; i++) breaks.push(v[Math.floor((i / n) * v.length)]);
  return breaks;
}
function classOf(value: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && value > breaks[i]) i++;
  return i;
}
function fmt(x: number): string {
  if (!isFinite(x)) return "—";
  return Math.abs(x) >= 100 ? Math.round(x).toLocaleString("es-CL") : x.toFixed(1);
}

export function TerritorialMap({
  reportSlug,
  mapKey,
  title,
  defaultVar,
}: {
  reportSlug: string;
  mapKey: string;
  title?: string;
  defaultVar?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const dataRef = useRef<MapData | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [vars, setVars] = useState<Var[]>([]);
  const [indicator, setIndicator] = useState<string>(defaultVar ?? "atr_neta");
  const [legend, setLegend] = useState<
    { label: string; unit: string; classes: { color: string; from: number; to: number }[] } | null
  >(null);

  // Crea el mapa una vez.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        const res = await fetch(`/api/reports/${reportSlug}/map/${mapKey}`);
        if (!res.ok) throw new Error();
        const { data } = (await res.json()) as { data: MapData };
        if (cancelled || !ref.current) return;
        dataRef.current = data;
        const vlist = data.vars ?? [];
        setVars(vlist);
        if (!vlist.some((v) => v[0] === indicator) && vlist[0]) setIndicator(vlist[0][0]);

        const map = L.map(ref.current, { scrollWheelZoom: true });
        mapRef.current = map;
        const base = "https://server.arcgisonline.com/ArcGIS/rest/services";
        L.tileLayer(`${base}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
          maxZoom: 19,
          attribution: "Imágenes: Esri, Maxar, Earthstar Geographics",
        }).addTo(map);
        L.tileLayer(`${base}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, opacity: 0.9 }).addTo(map);
        L.tileLayer(`${base}/Reference/World_Hydro_Reference_Overlay/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, opacity: 0.85 }).addTo(map);

        let bounds: import("leaflet").LatLngBounds | null = null;
        if (data.zonas) {
          const layer = L.geoJSON(data.zonas, {
            style: { color: "#ffffff", weight: 0.4, opacity: 0.6, fillColor: "#8ba7cd", fillOpacity: 0.6 },
            onEachFeature: (f, l) => l.bindTooltip("", { sticky: true }),
          }).addTo(map);
          layerRef.current = layer;
          bounds = layer.getBounds();
        }
        // Área de estudio con casing oscuro + trazo brillante (alto contraste).
        if (data.area) {
          L.geoJSON(data.area, { style: { color: "#000000", weight: 6, opacity: 0.4, fill: false } }).addTo(map);
          const a = L.geoJSON(data.area, { style: { color: "#ffe14d", weight: 3, opacity: 1, fill: false } }).addTo(map);
          if (!bounds) bounds = a.getBounds();
        }
        if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });
        else map.setView([-35.43, -71.65], 12);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportSlug, mapKey]);

  // Recolorea la coropleta al cambiar de indicador.
  useEffect(() => {
    const data = dataRef.current;
    const layer = layerRef.current;
    if (!data?.zonas || !layer) return;
    const meta = (data.vars ?? []).find((v) => v[0] === indicator);
    const scale = meta?.[3] ?? "seq";
    const palette = PALETTES[scale] ?? PALETTES.seq;
    const values = data.zonas.features.map((f) => Number((f.properties as Record<string, number>)?.[indicator]));
    const breaks = quantileBreaks(values);
    const min = Math.min(...values.filter(isFinite));
    const max = Math.max(...values.filter(isFinite));

    layer.setStyle((f) => {
      const val = Number((f?.properties as Record<string, number>)?.[indicator]);
      const c = isFinite(val) ? palette[classOf(val, breaks)] : "#cccccc";
      return { color: "#ffffff", weight: 0.4, opacity: 0.6, fillColor: c, fillOpacity: 0.75 };
    });
    layer.eachLayer((l) => {
      const feat = (l as unknown as { feature?: GeoJSON.Feature }).feature;
      const props = (feat?.properties ?? {}) as Record<string, number>;
      const val = Number(props[indicator]);
      (l as unknown as { setTooltipContent: (s: string) => void }).setTooltipContent(
        `<b>Zona ${props.zona ?? ""}</b><br>${meta?.[1] ?? indicator}: ${fmt(val)} ${meta?.[2] ?? ""}`
      );
    });

    const classes = palette.map((color, i) => ({
      color,
      from: i === 0 ? min : breaks[i - 1],
      to: i === palette.length - 1 ? max : breaks[i],
    }));
    setLegend({ label: meta?.[1] ?? indicator, unit: meta?.[2] ?? "", classes });
  }, [indicator, status]);

  return (
    <figure className="my-2">
      {title && (
        <figcaption className="mb-2 text-center text-sm font-medium text-ink">{title}</figcaption>
      )}
      <div className="relative">
        <div ref={ref} className="h-[30rem] w-full overflow-hidden rounded-xl2" style={{ background: "var(--surface-2)" }} />

        {/* Selector de indicador */}
        {vars.length > 0 && (
          <select
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
            className="absolute right-3 top-3 z-[500] max-w-[60%] truncate rounded-md border border-gray-300 bg-white/95 px-2 py-1 text-xs text-ink shadow"
          >
            {vars.map((v) => (
              <option key={v[0]} value={v[0]}>
                {v[1]}
              </option>
            ))}
          </select>
        )}

        {/* Leyenda */}
        {legend && (
          <div className="absolute bottom-6 right-3 z-[500] rounded-md border border-gray-200 bg-white/95 p-2 text-[11px] text-ink shadow">
            <div className="mb-1 max-w-[12rem] font-medium leading-tight">{legend.label}</div>
            {legend.classes.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-4 rounded-sm" style={{ background: c.color }} />
                <span className="text-ink-soft">
                  {fmt(c.from)} – {fmt(c.to)}
                </span>
              </div>
            ))}
            {legend.unit && <div className="mt-1 text-[10px] text-ink-soft">{legend.unit}</div>}
          </div>
        )}

        {status !== "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-soft">
            {status === "loading" ? "Cargando mapa…" : "No se pudo cargar el mapa."}
          </div>
        )}
      </div>
      <figcaption className="mt-1 text-center text-[11px] text-ink-soft">
        Elige el indicador · arrastra para desplazar · rueda para acercar · pasa el cursor por una zona
      </figcaption>
    </figure>
  );
}
