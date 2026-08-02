// Motor de generación de informes. Un solo comando arma un informe completo
// desde una carpeta declarativa (ver GENERACION.md).
//   npx tsx scripts/generar-informe.ts <carpeta> [neon]
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import sharp from "sharp";
import { parseDocx } from "../src/lib/docx";
import { buildSnapshot } from "../src/lib/snapshot";

const dir = process.argv[2];
if (!dir) throw new Error("Uso: npx tsx scripts/generar-informe.ts <carpeta> [neon]");
const useNeon = process.argv[3] === "neon";
const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
if (!dbUrl) throw new Error(`No encontré DATABASE_URL en ${envFile}`);
console.log("DB:", dbUrl.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const rd = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const clean = (s?: string) => (s || "").replace(/\s+/g, " ").trim();
const figKey = (s?: string) => {
  const m = /Figura\s+(\d+)[-.](\d+)/i.exec(s || "");
  return m ? `${m[1]}-${m[2]}` : null;
};

// Recompresión de imágenes (idéntica a place-figures).
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

async function main() {
  const meta = rd("informe.json");
  const graficos: { numero: string; [k: string]: unknown }[] = existsSync(join(dir, "graficos.json"))
    ? rd("graficos.json")
    : [];
  const mapas: { numero: string; [k: string]: unknown }[] = existsSync(join(dir, "mapas.json"))
    ? rd("mapas.json")
    : [];
  const chartByNum = new Map(graficos.map((g) => [g.numero, g]));
  const mapByNum = new Map(mapas.map((m) => [m.numero, m]));

  const consultor = await prisma.user.findFirst({ where: { role: "CONSULTOR" }, select: { id: true } });
  const revisor = await prisma.user.findFirst({ where: { role: "REVISOR" }, select: { id: true } });
  if (!consultor) throw new Error("No hay usuario CONSULTOR (corre el seed primero).");

  const parsed = await parseDocx(readFileSync(join(dir, "informe.docx")));
  await prisma.report.deleteMany({ where: { slug: meta.slug } });

  const report = await prisma.report.create({
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
        create: (meta.glosario ?? []).map((g: Record<string, string>) => ({
          term: g.term,
          definition: g.definition,
          source: g.source ?? null,
          pronunciation: g.pronunciation ?? null,
        })),
      },
      chapters: {
        create: parsed.chapters.map((ch, ci) => ({
          order: ci + 1,
          number: ch.number,
          title: ch.title,
          sections: {
            create: ch.sections.map((sec, si) => ({
              order: si + 1,
              title: sec.title,
              collapsedByDefault: /supuesto|brecha|alcance|anexo/i.test(sec.title ?? ""),
              blocks: {
                create: sec.blocks.map((b, bi) => ({
                  order: bi + 1,
                  type: b.type,
                  content: b.content as Prisma.InputJsonValue,
                })),
              },
            })),
          },
        })),
      },
    },
  });

  // Recorre los bloques en orden y resuelve cada figura por su número de pie.
  const chapters = await prisma.chapter.findMany({
    where: { reportId: report.id },
    orderBy: { order: "asc" },
    include: { sections: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" } } } } },
  });
  const flat = chapters.flatMap((c) => c.sections.flatMap((s) => s.blocks));

  let nChart = 0, nMap = 0, nFig = 0, nPh = 0;
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    const c = (b.content ?? {}) as Record<string, unknown>;
    if (b.type !== "IMAGE" || c.src) continue;
    let cap = "";
    for (let j = i + 1; j < flat.length && j < i + 3; j++) {
      const t = clean((flat[j].content as { text?: string })?.text);
      if (t) { cap = t; break; }
    }
    const num = figKey(cap);

    if (num && chartByNum.has(num)) {
      const g = chartByNum.get(num)!;
      await prisma.block.update({
        where: { id: b.id },
        data: { type: "CHART", content: { _dash: true, ...g } as Prisma.InputJsonValue },
      });
      nChart++;
    } else if (num && mapByNum.has(num)) {
      const m = mapByNum.get(num)! as Record<string, any>;
      const zonas = JSON.parse(readFileSync(join(dir, m.geojson), "utf8"));
      const vars = (m.indicadores ?? []).map((v: any) => [v.campo, v.label, v.unidad ?? "", v.escala ?? "seq"]);
      const data: Record<string, unknown> = { zonas, vars, area: m.area ?? null };
      for (const cp of m.capasPunto ?? []) {
        const gj = JSON.parse(readFileSync(join(dir, cp.archivo), "utf8"));
        const pts = (gj.features ?? [])
          .filter((f: any) => f.geometry?.type === "Point")
          .map((f: any) => ({ la: f.geometry.coordinates[1], lo: f.geometry.coordinates[0] }));
        const key = /siniestr|atropell/i.test(cp.label) ? "siniestros"
          : /colegio|escuela|establec/i.test(cp.label) ? "colegios" : null;
        if (key) data[key] = pts;
      }
      const key = `mapa-${num}`;
      await prisma.mapAsset.upsert({
        where: { reportId_key: { reportId: report.id, key } },
        create: { reportId: report.id, key, title: m.titulo, data: data as Prisma.InputJsonValue },
        update: { title: m.titulo, data: data as Prisma.InputJsonValue },
      });
      const capa = data.siniestros ? "siniestros" : data.colegios ? "colegios" : null;
      await prisma.block.update({
        where: { id: b.id },
        data: { type: "CHART", content: { _map: true, key, titulo: m.titulo, var: m.indicadorDefecto ?? vars[0]?.[0] ?? null, capa } as Prisma.InputJsonValue },
      });
      nMap++;
    } else {
      const figFile = join(dir, "figuras", `figura-${num}.png`);
      if (num && existsSync(figFile)) {
        const opt = await optimize(readFileSync(figFile));
        await prisma.figureAsset.upsert({
          where: { blockId: b.id },
          create: { reportId: report.id, blockId: b.id, contentType: opt.contentType, data: new Uint8Array(opt.buffer) },
          update: { contentType: opt.contentType, data: new Uint8Array(opt.buffer) },
        });
        await prisma.block.update({
          where: { id: b.id },
          data: { content: { src: `/api/reports/${meta.slug}/figure/${b.id}`, alt: cap.slice(0, 90), kind: "figure" } as Prisma.InputJsonValue },
        });
        nFig++;
      } else {
        nPh++;
      }
    }
  }

  // Versión base 1.0 (para el diff futuro).
  const snapshot = await buildSnapshot(prisma, report.id);
  await prisma.reportVersion.create({
    data: { reportId: report.id, number: 1, label: "1.0", note: "Versión inicial", createdById: consultor.id, snapshot: snapshot as unknown as Prisma.InputJsonValue },
  });

  console.log(`\n✓ Informe /reports/${meta.slug}`);
  console.log(`  Capítulos: ${parsed.chapters.length} · Gráficos: ${nChart} · Mapas: ${nMap} · Figuras: ${nFig} · Placeholders sin asset: ${nPh}`);
  console.log(`  Glosario: ${(meta.glosario ?? []).length} · Resumen ejecutivo: ${meta.execSummary ? "sí" : "no"} · Versión base 1.0 creada`);
  console.log(`\n  Audio (opcional, cuesta créditos): node scripts/pregenerate-audio.mjs ${meta.slug} ${useNeon ? "neon" : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
