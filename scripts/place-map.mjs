// Extrae el mapa "Explorador territorial" del dashboard, lo guarda como MapAsset
// y coloca un bloque de mapa navegable en el capítulo correspondiente.
// Uso: node scripts/place-map.mjs [neon]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const DASH = "Insumos/Plan de Talca/Dashboard_Diagnostico_Talca.html";
const SLUG = "prediagnostico-talca";
const KEY = "explorador";
const CHAPTER_KEY = "DÓNDE SE VIAJA";

const useNeon = process.argv[2] === "neon";
const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
if (!dbUrl) throw new Error(`No encontré DATABASE_URL en ${envFile}`);
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
    else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
  }
  return JSON.parse(s.slice(start, j));
}

async function main() {
  const mapa = objAt(readFileSync(DASH, "utf8"), '"mapa":');
  // Guardamos lo necesario para el mapa navegable (+ vars para la coropleta futura).
  const data = {
    titulo: mapa.titulo,
    id_campo: mapa.id_campo,
    etiqueta: mapa.etiqueta,
    zonas: mapa.zonas,
    area: mapa.area ?? null,
    vars: mapa.vars ?? null,
    capas: mapa.capas ?? null,
  };
  console.log(`Zonas: ${mapa.zonas?.features?.length} · tamaño data: ${Math.round(JSON.stringify(data).length / 1024)} KB`);

  const report = await prisma.report.findUnique({
    where: { slug: SLUG },
    select: {
      id: true,
      chapters: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, sections: { orderBy: { order: "asc" }, select: { id: true, blocks: { orderBy: { order: "asc" }, select: { id: true, type: true, content: true } } } } },
      },
    },
  });
  if (!report) throw new Error("No existe el informe.");

  await prisma.mapAsset.upsert({
    where: { reportId_key: { reportId: report.id, key: KEY } },
    create: { reportId: report.id, key: KEY, title: data.titulo, data },
    update: { title: data.titulo, data },
  });
  console.log("MapAsset guardado.");

  // ¿Ya existe el bloque de mapa?
  let exists = false;
  for (const ch of report.chapters)
    for (const s of ch.sections)
      for (const b of s.blocks)
        if (b.type === "CHART" && b.content?._map && b.content?.key === KEY) exists = true;
  if (exists) { console.log("El bloque de mapa ya existía."); return; }

  const chapter = report.chapters.find((c) => c.title.toUpperCase().includes(CHAPTER_KEY));
  if (!chapter) throw new Error("No encontré el capítulo del mapa.");

  const content = { _map: true, key: KEY, titulo: data.titulo };
  // Convertir el primer placeholder de imagen; si no hay, agregar al final.
  let target = null;
  for (const s of chapter.sections) { for (const b of s.blocks) { if (b.type === "IMAGE" && (!b.content || !b.content.src)) { target = b; break; } } if (target) break; }
  if (target) {
    await prisma.block.update({ where: { id: target.id }, data: { type: "CHART", content } });
  } else {
    const sec = chapter.sections[chapter.sections.length - 1];
    const max = await prisma.block.findFirst({ where: { sectionId: sec.id }, orderBy: { order: "desc" }, select: { order: true } });
    await prisma.block.create({ data: { sectionId: sec.id, order: (max?.order ?? 0) + 1, type: "CHART", content } });
  }
  console.log(`Mapa colocado en: ${chapter.title.slice(0, 45)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
