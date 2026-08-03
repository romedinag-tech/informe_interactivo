// Convierte CSVs de gráficos en graficos.json (formato del motor).
//   node scripts/csv-a-graficos.mjs <carpeta>
//
// Espera:
//   <carpeta>/graficos/grafico-<numero>.csv   (uno por gráfico)
//   <carpeta>/graficos-meta.json              { "<numero>": { tipo, titulo, unidad, fuente, eje_izq, eje_der } }
//
// Convención del CSV (autodetecta separador ; , o tab; decimales con coma OK):
//   fila 1 = encabezado: 1ª celda = nombre de la categoría, resto = nombres de series
//   filas siguientes: 1ª celda = etiqueta, resto = valores
//   2 columnas  → 1 serie  → usa "data"   (dona, barras)
//   >2 columnas → varias   → usa "series" (barras_apiladas, barras_h, linea)
//   tipo barras_linea → 1ª serie = barra, 2ª = línea
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("Uso: node scripts/csv-a-graficos.mjs <carpeta>");
const gdir = join(dir, "graficos");
if (!existsSync(gdir)) throw new Error(`No existe ${gdir}`);
const meta = existsSync(join(dir, "graficos-meta.json"))
  ? JSON.parse(readFileSync(join(dir, "graficos-meta.json"), "utf8"))
  : {};

const detectSep = (line) => {
  for (const s of [";", "\t", ","]) if (line.includes(s)) return s;
  return ",";
};
const toNum = (s) => {
  const t = String(s).trim().replace(/\./g, "").replace(",", "."); // "1.234,5" → "1234.5"
  const n = Number(t);
  return Number.isFinite(n) ? n : Number(String(s).trim().replace(",", "."));
};
const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const sep = detectSep(lines[0]);
  return lines.map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
};

const out = [];
for (const f of readdirSync(gdir).filter((f) => /^grafico-.+\.csv$/i.test(f))) {
  const numero = f.replace(/^grafico-/i, "").replace(/\.csv$/i, "");
  const rows = parseCsv(readFileSync(join(gdir, f), "utf8"));
  const header = rows[0];
  const body = rows.slice(1);
  const labels = body.map((r) => r[0]);
  const seriesNames = header.slice(1);
  const m = meta[numero] || {};
  const tipo = m.tipo || (seriesNames.length <= 1 ? "barras" : "barras_apiladas");

  const g = { numero, tipo, titulo: m.titulo || numero };
  if (m.unidad != null) g.unidad = m.unidad;
  if (m.fuente != null) g.fuente = m.fuente;
  if (m.eje_izq != null) g.eje_izq = m.eje_izq;
  if (m.eje_der != null) g.eje_der = m.eje_der;
  g.labels = labels;

  const series = seriesNames.map((name, ci) => ({ label: name, data: body.map((r) => toNum(r[ci + 1])) }));
  if (tipo === "dona" || tipo === "barras") {
    g.data = series[0]?.data ?? [];
  } else if (tipo === "barras_linea") {
    g.serie_barra = series[0];
    g.serie_linea = series[1];
    delete g.labels; // barras_linea usa labels igual; lo dejamos
    g.labels = labels;
  } else {
    g.series = series;
  }
  out.push(g);
  console.log(`  ✓ ${numero}  (${tipo}, ${labels.length} etiquetas, ${series.length} serie/s)`);
}

out.sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true }));
writeFileSync(join(dir, "graficos.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`\n✓ ${out.length} gráficos → ${join(dir, "graficos.json")}`);
