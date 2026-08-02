"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

// Mapa navegable (fondo satelital tipo Google Earth + vialidad/agua) con las
// zonas del área de estudio. Se carga en el cliente; la geodata vía API.
export function TerritorialMap({
  reportSlug,
  mapKey,
  title,
}: {
  reportSlug: string;
  mapKey: string;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        const res = await fetch(`/api/reports/${reportSlug}/map/${mapKey}`);
        if (!res.ok) throw new Error("map fetch");
        const { data } = (await res.json()) as {
          data: { zonas?: GeoJSON.FeatureCollection; area?: GeoJSON.GeoJsonObject };
        };
        if (cancelled || !ref.current) return;

        map = L.map(ref.current, { scrollWheelZoom: true, attributionControl: true });

        const esri =
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        const roads =
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
        const hydro =
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Hydro_Reference_Overlay/MapServer/tile/{z}/{y}/{x}";

        L.tileLayer(esri, { maxZoom: 19, attribution: "Imágenes: Esri, Maxar, Earthstar Geographics" }).addTo(map);
        L.tileLayer(roads, { maxZoom: 19, opacity: 0.9 }).addTo(map);
        L.tileLayer(hydro, { maxZoom: 19, opacity: 0.85 }).addTo(map);

        let bounds: import("leaflet").LatLngBounds | null = null;

        if (data.zonas) {
          const zonas = L.geoJSON(data.zonas, {
            style: {
              color: "#ffd24a",
              weight: 0.8,
              opacity: 0.9,
              fillColor: "#1c3663",
              fillOpacity: 0.06,
            },
          }).addTo(map);
          bounds = zonas.getBounds();
        }
        if (data.area) {
          const area = L.geoJSON(data.area, {
            style: { color: "#ffffff", weight: 2.5, fill: false },
          }).addTo(map);
          if (!bounds) bounds = area.getBounds();
        }

        if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });
        else map.setView([-35.43, -71.65], 12); // Talca, respaldo

        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [reportSlug, mapKey]);

  return (
    <figure className="my-2">
      {title && (
        <figcaption className="mb-2 text-center text-sm font-medium text-ink">
          {title}
        </figcaption>
      )}
      <div className="relative">
        <div
          ref={ref}
          className="h-[28rem] w-full overflow-hidden rounded-xl2"
          style={{ background: "var(--surface-2)" }}
        />
        {status !== "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-soft">
            {status === "loading" ? "Cargando mapa…" : "No se pudo cargar el mapa."}
          </div>
        )}
      </div>
      <figcaption className="mt-1 text-center text-[11px] text-ink-soft">
        Arrastra para desplazar · rueda para acercar
      </figcaption>
    </figure>
  );
}
