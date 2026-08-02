"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Sigue el tema activo (claro/sepia/oscuro) para adaptar la paleta de series.
function useTheme(): string {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.getAttribute("data-theme") || "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return theme;
}

// Contenido de un gráfico recreado a partir del dashboard de origen.
export type DashChart = {
  _dash: true;
  tipo: string;
  titulo?: string;
  unidad?: string;
  fuente?: string;
  eje_izq?: string;
  eje_der?: string;
  labels?: (string | number)[];
  data?: number[];
  series?: { label: string; data: number[] }[];
  serie_barra?: { label: string; data: number[] };
  serie_linea?: { label: string; data: number[] };
};

// Paleta para fondos claros (claro + sepia): tonos institucionales sobrios.
const PAL_LIGHT = [
  "#1c3663",
  "#2f5d54",
  "#6b4a2f",
  "#4a4a6f",
  "#5b4a2a",
  "#7a4a4a",
  "#2a5570",
];
// Paleta para fondo oscuro: mismas familias, subidas en luminosidad para contraste.
const PAL_DARK = [
  "#7aa2e3",
  "#6fc2a8",
  "#c9a06a",
  "#9a9ad6",
  "#c9a25e",
  "#d98a8a",
  "#78b4d6",
];

const axisProps = {
  tick: { fontSize: 11, fill: "var(--muted)" },
  stroke: "var(--line)",
} as const;

const tooltipProps = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    boxShadow: "var(--shadow-card)",
    color: "var(--ink)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
  itemStyle: { color: "var(--muted)" },
} as const;

function rowsFromSeries(labels: (string | number)[], series: { label: string; data: number[] }[]) {
  return labels.map((lab, i) => {
    const row: Record<string, string | number> = { name: String(lab) };
    for (const s of series) row[s.label] = s.data[i];
    return row;
  });
}

export function DashboardChart({ c }: { c: DashChart }) {
  const labels = c.labels ?? [];
  const theme = useTheme();
  const PAL = theme === "dark" ? PAL_DARK : PAL_LIGHT;

  const chart = () => {
    switch (c.tipo) {
      case "dona": {
        const data = labels.map((lab, i) => ({ name: String(lab), value: c.data?.[i] ?? 0 }));
        return (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={1}>
              {data.map((_, i) => (
                <Cell key={i} fill={PAL[i % PAL.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipProps} formatter={(v: number) => `${v}${c.unidad ?? ""}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        );
      }
      case "barras": {
        const data = labels.map((lab, i) => ({ name: String(lab), value: c.data?.[i] ?? 0 }));
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(v: number) => `${v}${c.unidad ?? ""}`} />
            <Bar dataKey="value" fill={PAL[0]} radius={[3, 3, 0, 0]} />
          </BarChart>
        );
      }
      case "barras_h": {
        const series = c.series ?? [];
        const data = rowsFromSeries(labels, series);
        return (
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey="name" width={90} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, i) => (
              <Bar key={s.label} dataKey={s.label} fill={PAL[i % PAL.length]} radius={[0, 3, 3, 0]} />
            ))}
          </BarChart>
        );
      }
      case "barras_apiladas": {
        const series = c.series ?? [];
        const data = rowsFromSeries(labels, series);
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, i) => (
              <Bar key={s.label} dataKey={s.label} stackId="a" fill={PAL[i % PAL.length]} />
            ))}
          </BarChart>
        );
      }
      case "barras_linea": {
        const bar = c.serie_barra;
        const line = c.serie_linea;
        const data = labels.map((lab, i) => ({
          name: String(lab),
          [bar?.label ?? "barra"]: bar?.data[i] ?? 0,
          [line?.label ?? "linea"]: line?.data[i] ?? 0,
        }));
        return (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis yAxisId="l" {...axisProps} />
            <YAxis yAxisId="r" orientation="right" {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey={bar?.label ?? "barra"} fill={PAL[0]} radius={[3, 3, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey={line?.label ?? "linea"} stroke={PAL[2]} strokeWidth={2} dot={false} />
          </ComposedChart>
        );
      }
      case "linea":
      default: {
        const series = c.series ?? [];
        const data = rowsFromSeries(labels, series);
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, i) => (
              <Line key={s.label} type="monotone" dataKey={s.label} stroke={PAL[i % PAL.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        );
      }
    }
  };

  return (
    <figure className="my-2">
      {c.titulo && (
        <figcaption className="mb-2 text-center text-sm font-medium text-ink">
          {c.titulo}
        </figcaption>
      )}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart()}
        </ResponsiveContainer>
      </div>
      {c.fuente && (
        <p className="mt-1 text-center text-[11px] text-ink-soft">Fuente: {c.fuente}</p>
      )}
    </figure>
  );
}
