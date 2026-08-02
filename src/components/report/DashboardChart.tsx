"use client";

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

const PAL = [
  "#1c3663",
  "#2f5d54",
  "#6b4a2f",
  "#4a4a6f",
  "#5b4a2a",
  "#7a4a4a",
  "#2a5570",
];

const axisProps = {
  tick: { fontSize: 11, fill: "var(--muted)" },
  stroke: "var(--line)",
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
            <Tooltip formatter={(v: number) => `${v}${c.unidad ?? ""}`} />
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
            <Tooltip formatter={(v: number) => `${v}${c.unidad ?? ""}`} />
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
            <Tooltip />
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
            <Tooltip />
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
            <Tooltip />
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
            <Tooltip />
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
