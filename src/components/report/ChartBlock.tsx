"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartContent } from "@/types/content";

const PALETTE = ["#1e3a5f", "#c05621", "#2f855a", "#6b46c1", "#b7791f"];

export function ChartBlock({ content }: { content: ChartContent }) {
  const { kind, data, xKey, series } = content;

  return (
    <figure className="my-2">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color ?? PALETTE[i % PALETTE.length]}
                />
              ))}
            </BarChart>
          ) : kind === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  fill={s.color ?? PALETTE[i % PALETTE.length]}
                  fillOpacity={0.15}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      {content.caption && (
        <figcaption className="mt-2 text-center text-xs text-ink-soft">
          {content.caption}
        </figcaption>
      )}
    </figure>
  );
}
