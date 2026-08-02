// Extrae los gráficos del dashboard de Talca y los coloca (interactivos) en el
// capítulo que corresponde, convirtiendo un placeholder de figura en gráfico.
// Uso: node scripts/place-dashboard-charts.mjs [neon]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const useNeon = process.argv[2] === "neon";
// Lee la URL del archivo elegido y la pasa EXPLÍCITAMENTE a Prisma
// (process.loadEnvFile no sobrescribe variables ya definidas → conectaba a local).
const envFile = useNeon ? ".env.production.local" : ".env";
const envText = readFileSync(envFile, "utf8");
const dbUrl = envText.match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
if (!dbUrl) throw new Error(`No encontré DATABASE_URL en ${envFile}`);
console.log("DB:", dbUrl.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const DASH =
  "Insumos/Plan de Talca/Dashboard_Diagnostico_Talca.html";
const SLUG = "prediagnostico-talca";

// ── Extracción de los objetos de gráfico (JSON embebido) ──
function extractCharts(html) {
  const out = [];
  let i = 0;
  const marker = '"tipo":';
  while ((i = html.indexOf(marker, i)) !== -1) {
    const start = html.lastIndexOf("{", i);
    let depth = 0, inStr = false, esc = false, j = start;
    for (; j < html.length; j++) {
      const ch = html[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
    }
    try { out.push(JSON.parse(html.slice(start, j))); } catch {}
    i = j;
  }
  return out;
}

function chapterKeyFor(titulo) {
  const t = (titulo || "").toLowerCase();
  if (t.includes("partición modal") || (t.includes("distancia") && t.includes("tiempo"))) return "PARTICIÓN MODAL";
  if (t.includes("distribución horaria") || t.includes("hora a hora")) return "CUÁNTA DEMANDA";
  if (t.includes("poblacional")) return "QUIÉN VIVE";
  if (t.includes("superficie por habitante")) return "QUÉ HAY EN ESE SUELO";
  if (t.includes("trabajadores")) return "ESTRUCTURA FUNCIONAL";
  if (t.includes("siniestralidad")) return "SEGURIDAD VIAL";
  if (t.includes("frente a su región")) return "SÍNTESIS";
  if (t.includes("stock") || t.includes("superficie edificada")) return "CÓMO CRECIÓ";
  return null;
}

function toContent(c) {
  return {
    _dash: true,
    tipo: c.tipo,
    titulo: c.titulo ?? null,
    unidad: c.unidad ?? null,
    fuente: c.fuente ?? null,
    eje_izq: c.eje_izq ?? null,
    eje_der: c.eje_der ?? null,
    labels: c.labels ?? [],
    data: c.data ?? null,
    series: c.series ?? null,
    serie_barra: c.serie_barra ?? null,
    serie_linea: c.serie_linea ?? null,
  };
}

function hasData(c) {
  return (
    (Array.isArray(c.data) && c.data.length) ||
    (Array.isArray(c.series) && c.series.length) ||
    c.serie_barra
  );
}

async function main() {
  const html = readFileSync(DASH, "utf8");
  const charts = extractCharts(html).filter((c) => c.titulo && hasData(c));
  console.log(`Gráficos con datos: ${charts.length}`);

  const report = await prisma.report.findUnique({
    where: { slug: SLUG },
    select: {
      id: true,
      chapters: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          sections: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              blocks: { orderBy: { order: "asc" }, select: { id: true, type: true, content: true } },
            },
          },
        },
      },
    },
  });
  if (!report) throw new Error("No existe el informe de Talca en esta base.");

  // Títulos de gráficos ya colocados (para idempotencia).
  const already = new Set();
  for (const ch of report.chapters)
    for (const s of ch.sections)
      for (const b of s.blocks)
        if (b.type === "CHART" && b.content && b.content._dash && b.content.titulo)
          already.add(b.content.titulo);

  let placed = 0, skipped = 0;
  for (const c of charts) {
    if (already.has(c.titulo)) { skipped++; continue; }
    const key = chapterKeyFor(c.titulo);
    const chapter =
      (key && report.chapters.find((ch) => ch.title.toUpperCase().includes(key))) ||
      report.chapters.find((ch) => ch.title.toUpperCase().includes("SÍNTESIS"));
    if (!chapter) { console.log("  sin capítulo:", c.titulo); continue; }

    // Buscar el primer placeholder de imagen libre en el capítulo.
    let target = null;
    for (const s of chapter.sections) {
      for (const b of s.blocks) {
        if (b.type === "IMAGE" && (!b.content || !b.content.src)) { target = b; break; }
      }
      if (target) break;
    }

    if (target) {
      await prisma.block.update({
        where: { id: target.id },
        data: { type: "CHART", content: toContent(c) },
      });
      // marcarlo usado en memoria
      target.type = "CHART";
    } else {
      // Sin placeholder: agregar al final de la última sección del capítulo,
      // consultando el orden máximo REAL en la base (evita colisiones).
      const sec = chapter.sections[chapter.sections.length - 1];
      const maxBlock = await prisma.block.findFirst({
        where: { sectionId: sec.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      await prisma.block.create({
        data: {
          sectionId: sec.id,
          order: (maxBlock?.order ?? 0) + 1,
          type: "CHART",
          content: toContent(c),
        },
      });
    }
    already.add(c.titulo);
    placed++;
    console.log(`  ✓ ${c.titulo}  →  ${chapter.title.slice(0, 40)}`);
  }
  console.log(`\n${useNeon ? "NEON" : "LOCAL"}: colocados ${placed}, ya existían ${skipped}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
