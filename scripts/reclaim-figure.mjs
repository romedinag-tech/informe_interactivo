// Fuerza que el bloque de una figura (identificada por su número de pie, p.ej.
// "11-4") sea una IMAGEN ESTÁTICA del Word, aunque haya sido convertido a mapa.
// Útil cuando el auto-emparejamiento asignó dos figuras distintas al mismo mapa.
// Uso: node scripts/reclaim-figure.mjs <figKey> [neon]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import mammoth from "mammoth";
import { parse } from "node-html-parser";
import sharp from "sharp";

const DOCX = "Insumos/Plan de Talca/Sintesis_Prediagnostico_Talca.docx";
const SLUG = "prediagnostico-talca";

const target = process.argv[2];
if (!target) throw new Error("Falta el número de figura (p.ej. 11-4)");
const useNeon = process.argv[3] === "neon";
const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
console.log("DB:", dbUrl.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
const figKey = (s) => {
  const m = /Figura\s+(\d+)[-.](\d+)/i.exec(s || "");
  return m ? `${m[1]}-${m[2]}` : null;
};
async function optimize(buf) {
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
async function docxByKey() {
  const buffer = readFileSync(DOCX);
  const byIdx = [];
  const { value: html } = await mammoth.convertToHtml({ buffer }, {
    convertImage: mammoth.images.imgElement(async (image) => {
      byIdx.push({ contentType: image.contentType, buffer: await image.read() });
      return { src: `##IMG${byIdx.length - 1}##` };
    }),
  });
  const kids = parse(html).childNodes.filter((n) => n.tagName);
  const map = new Map();
  for (let k = 0; k < kids.length; k++) {
    for (const img of kids[k].querySelectorAll?.("img") ?? []) {
      const m = /##IMG(\d+)##/.exec(img.getAttribute("src") || "");
      if (!m) continue;
      let cap = "";
      for (let j = k + 1; j < kids.length && j < k + 3; j++) { const t = clean(kids[j].text); if (t) { cap = t; break; } }
      const key = figKey(cap);
      if (key && !map.has(key)) map.set(key, { ...byIdx[+m[1]], cap });
    }
  }
  return map;
}

async function main() {
  const byKey = await docxByKey();
  const img = byKey.get(target);
  if (!img) throw new Error(`No encontré la figura ${target} en el .docx`);

  const report = await prisma.report.findUnique({
    where: { slug: SLUG },
    include: { chapters: { orderBy: { order: "asc" }, include: {
      sections: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" } } } } } } },
  });
  const flat = [];
  for (const ch of report.chapters) for (const s of ch.sections) for (const b of s.blocks) flat.push(b);

  // El bloque de la figura es el que precede al pie "Figura <target>".
  let block = null;
  for (let i = 0; i < flat.length; i++) {
    let cap = "";
    for (let j = i + 1; j < flat.length && j < i + 3; j++) { const t = clean(flat[j].content?.text); if (t) { cap = t; break; } }
    if (figKey(cap) === target && (flat[i].type === "IMAGE" || flat[i].type === "CHART")) { block = flat[i]; break; }
  }
  if (!block) throw new Error(`No encontré el bloque de la figura ${target}`);

  const opt = await optimize(img.buffer);
  await prisma.figureAsset.upsert({
    where: { blockId: block.id },
    create: { reportId: report.id, blockId: block.id, contentType: opt.contentType, data: new Uint8Array(opt.buffer) },
    update: { contentType: opt.contentType, data: new Uint8Array(opt.buffer) },
  });
  await prisma.block.update({
    where: { id: block.id },
    data: { type: "IMAGE", content: { src: `/api/reports/${SLUG}/figure/${block.id}`, alt: img.cap.slice(0, 90), kind: "figure" } },
  });
  console.log(`✓ Figura ${target} → imagen estática (${(opt.buffer.length / 1024).toFixed(0)}KB ${opt.contentType}) en bloque ${block.id}`);
}

main().finally(() => prisma.$disconnect());
