// Motor de generación de informes. Un solo comando arma (o ACTUALIZA) un informe
// completo desde una carpeta declarativa (ver GENERACION.md).
//   npx tsx scripts/generar-informe.ts <carpeta> [neon]                → crea (reemplaza si existe)
//   npx tsx scripts/generar-informe.ts <carpeta> [neon] --actualizar   → corrige EN SU LUGAR
//        (preserva observaciones y versiones; registra una versión nueva)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import sharp from "sharp";
import { parseDocx, type ParsedChapter } from "../src/lib/docx";
import { buildSnapshot } from "../src/lib/snapshot";
import { reanchor } from "../src/lib/anchor";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--") && a !== "neon");
const useNeon = args.includes("neon");
const doUpdate = args.includes("--actualizar") || args.includes("--update");
if (!dir) throw new Error("Uso: npx tsx scripts/generar-informe.ts <carpeta> [neon] [--actualizar]");

const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
if (!dbUrl) throw new Error(`No encontré DATABASE_URL en ${envFile}`);
console.log("DB:", dbUrl.replace(/:\/\/[^@]*@/, "://***@").split("?")[0], doUpdate ? "· MODO ACTUALIZAR" : "· MODO CREAR");
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const rd = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const clean = (s?: string) => (s || "").replace(/\s+/g, " ").trim();
const figKey = (s?: string) => {
  const m = /Figura\s+(\d+)[-.](\d+)/i.exec(s || "");
  return m ? `${m[1]}-${m[2]}` : null;
};

async function optimize(buf: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    let img = sharp(buf, { failOn: "none", unlimited: true });
    const meta = await img.metadata();
    if ((meta.width || 0) > 1600) img = img.resize({ width: 1600, withoutEnlargement: true });
    const png = await img.clone().png({ compressionLevel: 9 }).toBuffer();
    if (png.length > 1_200_000) {
      const jpg = await img.clone().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      if (jpg.length < png.length) return { buffer: jpg, contentType: "image/jpeg" };
    }
    return { buffer: png.length < buf.length ? png : buf, contentType: "image/png" };
  } catch {
    return { buffer: buf, contentType: "image/png" };
  }
}

type Meta = { slug: string; title: string; subtitle?: string; execSummary?: string; glosario?: Record<string, string>[] };

// Crea el informe desde cero (reemplaza si el slug ya existía).
async function createReport(meta: Meta, parsed: { chapters: ParsedChapter[] }) {
  const consultor = await prisma.user.findFirst({ where: { role: "CONSULTOR" }, select: { id: true } });
  const revisor = await prisma.user.findFirst({ where: { role: "REVISOR" }, select: { id: true } });
  if (!consultor) throw new Error("No hay usuario CONSULTOR (corre el seed primero).");

  await prisma.report.deleteMany({ where: { slug: meta.slug } });
  return prisma.report.create({
    data: {
      slug: meta.slug,
      title: meta.title,
      subtitle: meta.subtitle ?? null,
      status: "IN_REVIEW",
      createdById: consultor.id,
      execSummary: meta.execSummary ?? null,
      execSummaryDraft: true,
      assignments: {
        create: [
          { userId: consultor.id, role: "CONSULTOR" },
          ...(revisor ? [{ userId: revisor.id, role: "REVISOR" as const }] : []),
        ],
      },
      glossary: {
        create: (meta.glosario ?? []).map((g) => ({
          term: g.term, definition: g.definition, source: g.source ?? null, pronunciation: g.pronunciation ?? null,
        })),
      },
      chapters: {
        create: parsed.chapters.map((ch, ci) => ({
          order: ci + 1, number: ch.number, title: ch.title,
          sections: {
            create: ch.sections.map((sec, si) => ({
              order: si + 1, title: sec.title,
              collapsedByDefault: /supuesto|brecha|alcance|anexo/i.test(sec.title ?? ""),
              blocks: { create: sec.blocks.map((b, bi) => ({ order: bi + 1, type: b.type, content: b.content as Prisma.InputJsonValue })) },
            })),
          },
        })),
      },
    },
    select: { id: true },
  });
}

// Actualiza el contenido EN SU LUGAR (preserva blockId → observaciones). Empareja
// por posición (capítulo/sección/bloque). NUNCA borra un bloque con observaciones.
async function updateReport(meta: Meta, parsed: { chapters: ParsedChapter[] }) {
  const report = await prisma.report.findUnique({ where: { slug: meta.slug }, select: { id: true } });
  if (!report) throw new Error(`No existe el informe "${meta.slug}" para actualizar. ¿Querías crear (sin --actualizar)?`);

  await prisma.report.update({
    where: { id: report.id },
    data: { title: meta.title, subtitle: meta.subtitle ?? null, execSummary: meta.execSummary ?? undefined },
  });
  // Glosario: reemplaza (no está referenciado por FK).
  await prisma.glossaryTerm.deleteMany({ where: { reportId: report.id } });
  if (meta.glosario?.length) {
    await prisma.glossaryTerm.createMany({
      data: meta.glosario.map((g) => ({ reportId: report.id, term: g.term, definition: g.definition, source: g.source ?? null, pronunciation: g.pronunciation ?? null })),
    });
  }

  const existing = await prisma.chapter.findMany({
    where: { reportId: report.id }, orderBy: { order: "asc" },
    include: { sections: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" }, include: { _count: { select: { annotations: true } } } } } } },
  });

  let kept = 0, updated = 0, created = 0, deleted = 0, keptObserved = 0;

  for (let ci = 0; ci < parsed.chapters.length; ci++) {
    const nc = parsed.chapters[ci];
    let ec = existing[ci];
    if (!ec) {
      const created2 = await prisma.chapter.create({
        data: {
          reportId: report.id, order: ci + 1, number: nc.number, title: nc.title,
          sections: { create: nc.sections.map((s, si) => ({ order: si + 1, title: s.title, blocks: { create: s.blocks.map((b, bi) => ({ order: bi + 1, type: b.type, content: b.content as Prisma.InputJsonValue })) } })) },
        },
        include: { sections: { include: { blocks: true } } },
      });
      created += created2.sections.reduce((n, s) => n + s.blocks.length, 0);
      continue;
    }
    await prisma.chapter.update({ where: { id: ec.id }, data: { number: nc.number, title: nc.title } });

    for (let si = 0; si < nc.sections.length; si++) {
      const ns = nc.sections[si];
      const es = ec.sections[si];
      if (!es) {
        const s2 = await prisma.section.create({
          data: { chapterId: ec.id, order: si + 1, title: ns.title, blocks: { create: ns.blocks.map((b, bi) => ({ order: bi + 1, type: b.type, content: b.content as Prisma.InputJsonValue })) } },
          include: { blocks: true },
        });
        created += s2.blocks.length;
        continue;
      }
      await prisma.section.update({ where: { id: es.id }, data: { title: ns.title } });

      // Libera los 'order' (a negativos) para evitar colisiones con la única.
      for (const b of es.blocks) await prisma.block.update({ where: { id: b.id }, data: { order: -(b.order) } });

      let ord = 0;
      for (let bi = 0; bi < ns.blocks.length; bi++, ord++) {
        const nb = ns.blocks[bi];
        const eb = es.blocks[bi];
        if (eb) {
          await prisma.block.update({ where: { id: eb.id }, data: { order: ord + 1, type: nb.type, content: nb.content as Prisma.InputJsonValue } });
          updated++;
        } else {
          await prisma.block.create({ data: { sectionId: es.id, order: ord + 1, type: nb.type, content: nb.content as Prisma.InputJsonValue } });
          created++;
        }
      }
      // Bloques sobrantes: se preservan si tienen observaciones; si no, se borran.
      for (let bi = ns.blocks.length; bi < es.blocks.length; bi++) {
        const eb = es.blocks[bi];
        if (eb._count.annotations > 0) {
          await prisma.block.update({ where: { id: eb.id }, data: { order: ord + 1 } });
          ord++; keptObserved++;
        } else {
          await prisma.block.delete({ where: { id: eb.id } });
          deleted++;
        }
      }
    }
    // Secciones sobrantes: se preservan si algún bloque tiene observaciones.
    for (let si = nc.sections.length; si < ec.sections.length; si++) {
      const es = ec.sections[si];
      const obs = es.blocks.reduce((n, b) => n + b._count.annotations, 0);
      if (obs === 0) { await prisma.section.delete({ where: { id: es.id } }); }
    }
  }
  // Capítulos sobrantes: se preservan si tienen observaciones.
  for (let ci = parsed.chapters.length; ci < existing.length; ci++) {
    const ec = existing[ci];
    const obs = ec.sections.reduce((n, s) => n + s.blocks.reduce((m, b) => m + b._count.annotations, 0), 0);
    if (obs === 0) await prisma.chapter.delete({ where: { id: ec.id } });
  }

  console.log(`  Bloques: ${updated} actualizados, ${created} nuevos, ${deleted} eliminados (sin obs.), ${keptObserved} conservados con observaciones.`);
  return { id: report.id };
}

// Resuelve cada figura (placeholder IMAGE) a gráfico/mapa/imagen por su número.
async function resolveFigures(reportId: string, meta: Meta) {
  const graficos: Record<string, unknown>[] = existsSync(join(dir!, "graficos.json")) ? rd("graficos.json") : [];
  const mapas: Record<string, any>[] = existsSync(join(dir!, "mapas.json")) ? rd("mapas.json") : [];
  const chartByNum = new Map(graficos.map((g) => [g.numero as string, g]));
  const mapByNum = new Map(mapas.map((m) => [m.numero as string, m]));

  const chapters = await prisma.chapter.findMany({
    where: { reportId }, orderBy: { order: "asc" },
    include: { sections: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" } } } } },
  });
  const flat = chapters.flatMap((c) => c.sections.flatMap((s) => s.blocks));

  let nChart = 0, nMap = 0, nFig = 0, nPh = 0;
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    const c = (b.content ?? {}) as Record<string, unknown>;
    if (b.type !== "IMAGE" || c.src) continue;
    let cap = "";
    for (let j = i + 1; j < flat.length && j < i + 3; j++) { const t = clean((flat[j].content as { text?: string })?.text); if (t) { cap = t; break; } }
    const num = figKey(cap);

    if (num && chartByNum.has(num)) {
      await prisma.block.update({ where: { id: b.id }, data: { type: "CHART", content: { _dash: true, ...chartByNum.get(num) } as Prisma.InputJsonValue } });
      nChart++;
    } else if (num && mapByNum.has(num)) {
      const m = mapByNum.get(num)!;
      const zonas = JSON.parse(readFileSync(join(dir!, m.geojson), "utf8"));
      const vars = (m.indicadores ?? []).map((v: any) => [v.campo, v.label, v.unidad ?? "", v.escala ?? "seq"]);
      const data: Record<string, unknown> = { zonas, vars, area: m.area ?? null };
      for (const cp of m.capasPunto ?? []) {
        const gj = JSON.parse(readFileSync(join(dir!, cp.archivo), "utf8"));
        const pts = (gj.features ?? []).filter((f: any) => f.geometry?.type === "Point").map((f: any) => ({ la: f.geometry.coordinates[1], lo: f.geometry.coordinates[0] }));
        const key = /siniestr|atropell/i.test(cp.label) ? "siniestros" : /colegio|escuela|establec/i.test(cp.label) ? "colegios" : null;
        if (key) data[key] = pts;
      }
      const key = `mapa-${num}`;
      await prisma.mapAsset.upsert({ where: { reportId_key: { reportId, key } }, create: { reportId, key, title: m.titulo, data: data as Prisma.InputJsonValue }, update: { title: m.titulo, data: data as Prisma.InputJsonValue } });
      const capa = data.siniestros ? "siniestros" : data.colegios ? "colegios" : null;
      await prisma.block.update({ where: { id: b.id }, data: { type: "CHART", content: { _map: true, key, titulo: m.titulo, var: m.indicadorDefecto ?? vars[0]?.[0] ?? null, capa } as Prisma.InputJsonValue } });
      nMap++;
    } else {
      const figFile = join(dir!, "figuras", `figura-${num}.png`);
      if (num && existsSync(figFile)) {
        const opt = await optimize(readFileSync(figFile));
        await prisma.figureAsset.upsert({ where: { blockId: b.id }, create: { reportId, blockId: b.id, contentType: opt.contentType, data: new Uint8Array(opt.buffer) }, update: { contentType: opt.contentType, data: new Uint8Array(opt.buffer) } });
        await prisma.block.update({ where: { id: b.id }, data: { content: { src: `/api/reports/${meta.slug}/figure/${b.id}`, alt: cap.slice(0, 90), kind: "figure" } as Prisma.InputJsonValue } });
        nFig++;
      } else nPh++;
    }
  }
  return { nChart, nMap, nFig, nPh };
}

// Registra una versión: snapshot + re-ancla todas las observaciones (marca huérfanas).
async function registerVersion(reportId: string, note: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { versionNumber: true, createdById: true } });
  if (!report) return;
  const snapshot = await buildSnapshot(prisma, reportId);
  const textByBlock = new Map(snapshot.map((b) => [b.blockId, b.text]));
  const anns = await prisma.annotation.findMany({ where: { reportId }, select: { id: true, quote: true, prefix: true, suffix: true, rangeStart: true, rangeEnd: true, blockId: true, orphaned: true } });
  let orphans = 0, reanchored = 0;
  for (const a of anns) {
    const text = textByBlock.get(a.blockId);
    const found = text != null ? reanchor(text, a) : null;
    if (!found) { if (!a.orphaned) await prisma.annotation.update({ where: { id: a.id }, data: { orphaned: true, orphanedAt: new Date() } }); orphans++; }
    else {
      const moved = found.start !== a.rangeStart || found.end !== a.rangeEnd;
      if (moved || a.orphaned) { await prisma.annotation.update({ where: { id: a.id }, data: { rangeStart: found.start, rangeEnd: found.end, orphaned: false, orphanedAt: null } }); if (moved) reanchored++; }
    }
  }
  const n = report.versionNumber + 1;
  const label = `${n}.0`;
  await prisma.$transaction([
    prisma.reportVersion.create({ data: { reportId, number: n, label, note, createdById: report.createdById, snapshot: snapshot as unknown as Prisma.InputJsonValue } }),
    prisma.report.update({ where: { id: reportId }, data: { versionNumber: n, versionLabel: label } }),
  ]);
  console.log(`  Versión ${label}: ${reanchored} observaciones re-ancladas, ${orphans} huérfanas.`);
}

async function main() {
  const meta: Meta = rd("informe.json");
  const parsed = await parseDocx(readFileSync(join(dir!, "informe.docx")));

  let reportId: string;
  if (doUpdate) {
    ({ id: reportId } = await updateReport(meta, parsed));
  } else {
    ({ id: reportId } = await createReport(meta, parsed));
  }

  const fig = await resolveFigures(reportId, meta);

  if (doUpdate) {
    await registerVersion(reportId, "Corrección re-subida");
  } else {
    // Versión base 1.0.
    const snapshot = await buildSnapshot(prisma, reportId);
    const rep = await prisma.report.findUnique({ where: { id: reportId }, select: { createdById: true } });
    await prisma.reportVersion.create({ data: { reportId, number: 1, label: "1.0", note: "Versión inicial", createdById: rep!.createdById, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
  }

  console.log(`\n✓ Informe /reports/${meta.slug}`);
  console.log(`  Capítulos: ${parsed.chapters.length} · Gráficos: ${fig.nChart} · Mapas: ${fig.nMap} · Figuras: ${fig.nFig} · Placeholders sin asset: ${fig.nPh}`);
  console.log(`\n  Audio (opcional, cuesta créditos; solo re-genera lo cambiado): node scripts/pregenerate-audio.mjs ${meta.slug} ${useNeon ? "neon" : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
