// Actualiza el MapAsset con las capas de puntos (siniestros/colegios) y coloca
// los mapas temáticos restantes (cada placeholder de mapa → explorador con su
// indicador / capa). Uso: node scripts/place-thematic-maps.mjs [neon]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const DASH = "Insumos/Plan de Talca/Dashboard_Diagnostico_Talca.html";
const SLUG = "prediagnostico-talca";
const KEY = "explorador";

const useNeon = process.argv[2] === "neon";
const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
console.log("DB:", dbUrl.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

function objAt(s, marker) {
  const i = s.indexOf(marker);
  if (i === -1) return null;
  const start = s.indexOf("{", i + marker.length - 1);
  let depth = 0, inStr = false, esc = false, j = start;
  for (; j < s.length; j++) {
    const ch = s[j];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; }
    else if (ch === '"') inStr = true; else if (ch === "{") depth++; else if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
  }
  return JSON.parse(s.slice(start, j));
}

function matchVar(cap) {
  const t = cap.toLowerCase();
  if (/aceler|densific|edificaci/.test(t)) return "acel";
  if (/uso de suelo|clasifica cada zona|mixtura|monofuncional/.test(t)) return "entropia";
  if (/equipamiento|actividad/.test(t)) return "act_pct";
  if (/\bnse\b|socioecon/.test(t)) return "nse_bajo_pct";
  if (/balance|polo|dormitorio/.test(t)) return "atr_neta";
  if (/caminata|peatonal/.test(t)) return "pie_gen";
  if (/bicicleta|ciclista/.test(t)) return "bici_gen";
  return null;
}
function matchCapa(cap) {
  const t = cap.toLowerCase();
  // Colegios primero y específico (evita capturar "cobertura escolar" genérica).
  if (/colegio|escuela|entornos escolares|riesgo escolar|seguridad vial/.test(t)) return "colegios";
  if (/siniestr|atropell/.test(t)) return "siniestros";
  return null;
}

async function main() {
  const mapa = objAt(readFileSync(DASH, "utf8"), '"mapa":');
  const varLabel = Object.fromEntries((mapa.vars ?? []).map((v) => [v[0], v[1]]));

  // Actualiza MapAsset agregando las capas de puntos.
  const report = await prisma.report.findUnique({
    where: { slug: SLUG },
    select: { id: true, chapters: { orderBy: { order: "asc" }, select: { title: true, sections: { orderBy: { order: "asc" }, select: { blocks: { orderBy: { order: "asc" }, select: { id: true, type: true, content: true } } } } } } },
  });
  if (!report) throw new Error("No existe el informe.");

  // Muestrea los siniestros (~2000) para que el mapa no vaya lento.
  const sinAll = mapa.siniestros ?? [];
  const step = Math.max(1, Math.ceil(sinAll.length / 2000));
  const siniestros = sinAll.filter((_, i) => i % step === 0);

  const asset = await prisma.mapAsset.findUnique({ where: { reportId_key: { reportId: report.id, key: KEY } }, select: { data: true } });
  const data = { ...(asset?.data ?? {}), siniestros, colegios: mapa.colegios ?? null };
  await prisma.mapAsset.update({ where: { reportId_key: { reportId: report.id, key: KEY } }, data: { data } });
  console.log(`MapAsset + capas: siniestros=${siniestros.length} (de ${sinAll.length}), colegios=${mapa.colegios?.length ?? 0}`);

  // Coloca los mapas temáticos.
  let placed = 0;
  for (const ch of report.chapters) {
    const blocks = ch.sections.flatMap((s) => s.blocks);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const isPlaceholder = b.type === "IMAGE" && (!b.content || !b.content.src);
      const isThematic = b.type === "CHART" && b.content?._map && b.content?.titulo !== "Explorador territorial";
      if (!isPlaceholder && !isThematic) continue; // no tocar el explorador principal
      const cap = typeof blocks[i + 1]?.content?.text === "string" ? blocks[i + 1].content.text : "";
      if (!/mapa/i.test(cap)) continue;

      let v = matchVar(cap);
      const capa = matchCapa(cap);
      if (!v && capa) v = capa === "siniestros" ? "gen" : "cobertura";
      const titulo = capa === "siniestros" ? "Siniestralidad" : capa === "colegios" ? "Establecimientos y riesgo escolar" : (v ? varLabel[v] : "Explorador territorial");

      await prisma.block.update({ where: { id: b.id }, data: { type: "CHART", content: { _map: true, key: KEY, titulo, var: v ?? null, capa: capa ?? null } } });
      placed++;
      console.log(`  ✓ ${cap.slice(0, 46)}  →  var:${v ?? "-"} capa:${capa ?? "-"}`);
    }
  }
  console.log(`\n${useNeon ? "NEON" : "LOCAL"}: ${placed} mapas temáticos colocados.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
