// Ingesta del PAQUETE de entrega V&R (docx + datos/ + secciones_relato) → informe.
// Mapas interactivos (MapAsset compartido de 22 variables + capas de puntos);
// gráficos e imágenes estáticos extraídos del propio docx. Enlace por ORDEN
// (docx ↔ secciones_relato). Crea un informe NUEVO (slug distinto).
//   npx tsx scripts/generar-paquete.ts <completo|ejecutivo> <slug> [neon]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import sharp from "sharp";
import mammoth from "mammoth";
import { parseDocx } from "../src/lib/docx";
import { buildSnapshot } from "../src/lib/snapshot";

const PKG = "Insumos/Plan de Talca/Nuevos informes de prediagnostico de Talca";
const DATOS = `${PKG}/3 Dashboard/datos`;

const kind = process.argv[2]; // completo | ejecutivo
const slug = process.argv[3];
const useNeon = process.argv[4] === "neon";
if (!slug || !["completo", "ejecutivo"].includes(kind)) throw new Error("Uso: npx tsx scripts/generar-paquete.ts <completo|ejecutivo> <slug> [neon]");

const CFG = {
  completo: { docx: `${PKG}/1 Informes/Sintesis_Prediagnostico_Talca.docx`, title: "Síntesis de Prediagnóstico — Talca", subtitle: "Diagnóstico territorial y de movilidad para el Plan Maestro (2026)" },
  ejecutivo: { docx: `${PKG}/1 Informes/Informe_Ejecutivo_Prediagnostico_Talca.docx`, title: "Informe Ejecutivo — Prediagnóstico Talca", subtitle: "Síntesis directiva del diagnóstico territorial y de movilidad" },
}[kind as "completo" | "ejecutivo"];

const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
console.log("DB:", dbUrl!.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const clean = (s?: string) => (s || "").replace(/\s+/g, " ").trim();
const rj = (f: string) => JSON.parse(readFileSync(join(DATOS, f), "utf8"));

const GLOSARIO = [
  { term: "IMIV", definition: "Informe de Mitigación de Impacto Vial: evalúa los efectos de un proyecto sobre el sistema de transporte y define medidas de mitigación.", source: "Ley 20.958", pronunciation: "ímiv" },
  { term: "SECTRA", definition: "Programa de Vialidad y Transporte Urbano del Ministerio de Transportes.", source: "MTT", pronunciation: "Séctra" },
  { term: "EOD", definition: "Encuesta Origen–Destino de viajes de los hogares por propósito, modo, hora y zona.", source: "SECTRA", pronunciation: "e o de" },
  { term: "NSE", definition: "Nivel socioeconómico: clasificación de los hogares según ingreso y características.", source: "AIM/CASEN", pronunciation: "ene ese e" },
  { term: "partición modal", definition: "Distribución porcentual de los viajes entre los modos de transporte." },
];

async function optimize(buf: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    let img = sharp(buf, { failOn: "none", unlimited: true });
    const m = await img.metadata();
    // Gráficos y mapas tienen texto y líneas finas: se mantienen en PNG (nítido)
    // a 2000px. Solo las MUY pesadas (fotográficas, p.ej. satélite) van a JPEG q90.
    if ((m.width || 0) > 2000) img = img.resize({ width: 2000, withoutEnlargement: true });
    const png = await img.clone().png({ compressionLevel: 9 }).toBuffer();
    if (png.length > 2_500_000) {
      const jpg = await img.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      if (jpg.length < png.length) return { buffer: jpg, contentType: "image/jpeg" };
    }
    return { buffer: png.length < buf.length ? png : buf, contentType: "image/png" };
  } catch { return { buffer: buf, contentType: "image/png" }; }
}

// Extrae las imágenes embebidas del docx EN ORDEN (una por figura).
async function extractDocxImages(docxPath: string): Promise<Buffer[]> {
  const imgs: Buffer[] = [];
  await mammoth.convertToHtml({ buffer: readFileSync(docxPath) }, {
    convertImage: mammoth.images.imgElement(async (image) => { imgs.push(await image.read()); return { src: "" }; }),
  });
  return imgs;
}

async function main() {
  const consultor = await prisma.user.findFirst({ where: { role: "CONSULTOR" }, select: { id: true } });
  const revisor = await prisma.user.findFirst({ where: { role: "REVISOR" }, select: { id: true } });
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!consultor) throw new Error("Corre el seed primero.");

  const parsed = await parseDocx(readFileSync(CFG.docx));
  const images = await extractDocxImages(CFG.docx);

  // Omite la portada (Introducción/metadata) y el índice: el hero es la portada
  // y la app tiene su propio índice. El número editorial va en el título.
  const useCh = parsed.chapters.filter((ch) => !/^\s*(introducci[oó]n|[ií]ndice de contenidos?)/i.test(clean(ch.title)));

  // Figuras del docx en orden + su tipo/variable desde secciones_relato (completo).
  const srFigs = (kind === "completo" ? rj("secciones_relato.json").flatMap((s: any) => s.figuras || []) : []) as any[];

  // Crea el informe.
  await prisma.report.deleteMany({ where: { slug } });
  const report = await prisma.report.create({
    data: {
      slug, title: CFG.title, subtitle: CFG.subtitle, status: "IN_REVIEW", createdById: consultor.id,
      execSummary: null, execSummaryDraft: true,
      assignments: { create: [{ userId: consultor.id, role: "CONSULTOR" }, ...(revisor ? [{ userId: revisor.id, role: "REVISOR" as const }] : []), ...(admin ? [{ userId: admin.id, role: "ADMIN" as const }] : [])] },
      glossary: { create: GLOSARIO.map((g) => ({ term: g.term, definition: g.definition, source: g.source ?? null, pronunciation: g.pronunciation ?? null })) },
      chapters: { create: useCh.map((ch, ci) => ({ order: ci + 1, number: null, title: ch.title,
        sections: { create: ch.sections.map((sec, si) => ({ order: si + 1, title: sec.title, collapsedByDefault: /supuesto|brecha|alcance|anexo/i.test(sec.title ?? ""),
          blocks: { create: sec.blocks.map((b, bi) => ({ order: bi + 1, type: b.type, content: b.content as Prisma.InputJsonValue })) } })) } })) },
    }, select: { id: true },
  });

  // MapAsset compartido con las 22 variables + capas de puntos (muestrea siniestros).
  const zonas = rj("zonas.geojson");
  const vars = rj("variables_mapa.json").map((v: any) => [v.campo, v.etiqueta, v.unidad ?? "", v.escala ?? "seq"]);
  const sinAll = rj("capa_siniestros.json");
  const step = Math.max(1, Math.ceil(sinAll.length / 2000));
  const siniestros = sinAll.filter((_: unknown, i: number) => i % step === 0);
  const colegios = rj("capa_colegios_criticos.json");
  await prisma.mapAsset.upsert({ where: { reportId_key: { reportId: report.id, key: "zonas" } },
    create: { reportId: report.id, key: "zonas", title: "Explorador territorial", data: { zonas, vars, siniestros, colegios } as Prisma.InputJsonValue },
    update: { data: { zonas, vars, siniestros, colegios } as Prisma.InputJsonValue } });

  // Resuelve cada figura por su ORDEN.
  const chapters = await prisma.chapter.findMany({ where: { reportId: report.id }, orderBy: { order: "asc" }, include: { sections: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" } } } } } });
  const flat = chapters.flatMap((c) => c.sections.flatMap((s) => s.blocks));

  let fi = 0, nMap = 0, nImg = 0, nMiss = 0;
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    if (b.type !== "IMAGE") continue;
    let cap = ""; for (let j = i + 1; j < flat.length && j < i + 3; j++) { const t = clean((flat[j].content as { text?: string })?.text); if (t) { cap = t; break; } }
    const sr = srFigs[fi];
    const isMap = sr?.tipo === "mapa_interactivo" || (!sr && /—\s*mapa|mapa temático/i.test(cap));

    if (isMap) {
      // En esta entrega, los mapas de puntos (siniestros/escolar) son figuras
      // estáticas; los 14 interactivos son coropletas sin capa de puntos.
      const varName = sr?.variable ?? null;
      await prisma.block.update({ where: { id: b.id }, data: { type: "CHART", content: { _map: true, key: "zonas", titulo: sr?.dimension ?? cap.split(".")[1]?.trim() ?? "Mapa", var: varName, capa: null } as Prisma.InputJsonValue } });
      nMap++;
    } else if (images[fi]) {
      const opt = await optimize(images[fi]);
      await prisma.figureAsset.upsert({ where: { blockId: b.id }, create: { reportId: report.id, blockId: b.id, contentType: opt.contentType, data: new Uint8Array(opt.buffer) }, update: { contentType: opt.contentType, data: new Uint8Array(opt.buffer) } });
      await prisma.block.update({ where: { id: b.id }, data: { content: { src: `/api/reports/${slug}/figure/${b.id}`, alt: cap.slice(0, 90), kind: "figure" } as Prisma.InputJsonValue } });
      nImg++;
    } else nMiss++;
    fi++;
  }

  const snapshot = await buildSnapshot(prisma, report.id);
  await prisma.reportVersion.create({ data: { reportId: report.id, number: 1, label: "1.0", note: "Versión inicial", createdById: consultor.id, snapshot: snapshot as unknown as Prisma.InputJsonValue } });

  console.log(`\n✓ /reports/${slug} — ${CFG.title}`);
  console.log(`  Capítulos: ${useCh.length} (omitidos portada/índice) · Figuras: ${fi} → ${nMap} mapas interactivos, ${nImg} imágenes estáticas, ${nMiss} sin imagen`);
  console.log(`  Imágenes en docx: ${images.length} · figuras en secciones_relato: ${srFigs.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
