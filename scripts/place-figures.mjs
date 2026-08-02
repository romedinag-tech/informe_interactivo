// Extrae las imágenes del .docx y las asigna a los bloques IMAGE placeholder
// del informe, emparejando por el número de figura del pie ("Figura X-Y").
// Guarda los bytes en FigureAsset y apunta block.content.src a la ruta servida.
// Uso: node scripts/place-figures.mjs [neon]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import mammoth from "mammoth";
import { parse } from "node-html-parser";
import sharp from "sharp";

// Recomprime: redimensiona a máx 1600px de ancho. PNG para line-art (gráficos);
// si sigue pesada (>1.2MB), es fotográfica (mapas satelitales) → JPEG. Evita el
// límite de ~4.5MB de respuesta serverless de Vercel y acelera la carga.
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
    return png.length < buf.length
      ? { buffer: png, contentType: "image/png" }
      : { buffer: buf, contentType: "image/png" };
  } catch {
    return { buffer: buf, contentType: "image/png" };
  }
}

const DOCX = "Insumos/Plan de Talca/Sintesis_Prediagnostico_Talca.docx";
const SLUG = "prediagnostico-talca";

const useNeon = process.argv[2] === "neon";
const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
if (!dbUrl) throw new Error(`No encontré DATABASE_URL en ${envFile}`);
console.log("DB:", dbUrl.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
const figKey = (s) => {
  const m = /Figura\s+(\d+)[-.](\d+)/i.exec(s || "");
  return m ? `${m[1]}-${m[2]}` : null;
};

// Devuelve Map<figKey, {contentType, buffer, caption}> desde el .docx.
async function docxImagesByKey() {
  const buffer = readFileSync(DOCX);
  const byIdx = [];
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buf = await image.read();
        const idx = byIdx.length;
        byIdx.push({ contentType: image.contentType, buffer: buf });
        return { src: `##IMG${idx}##` };
      }),
    }
  );
  const root = parse(html);
  const kids = root.childNodes.filter((n) => n.tagName);
  const byKey = new Map();
  for (let k = 0; k < kids.length; k++) {
    const imgs = kids[k].querySelectorAll ? kids[k].querySelectorAll("img") : [];
    for (const img of imgs) {
      const m = /##IMG(\d+)##/.exec(img.getAttribute("src") || "");
      if (!m) continue;
      const idx = Number(m[1]);
      let caption = "";
      for (let j = k + 1; j < kids.length && j < k + 3; j++) {
        const t = clean(kids[j].text);
        if (t) { caption = t; break; }
      }
      const key = figKey(caption);
      if (key && !byKey.has(key)) byKey.set(key, { ...byIdx[idx], caption });
    }
  }
  return byKey;
}

async function main() {
  const byKey = await docxImagesByKey();
  console.log(`Imágenes del .docx indexadas por figura: ${byKey.size}`);

  const report = await prisma.report.findUnique({
    where: { slug: SLUG },
    include: {
      chapters: { orderBy: { order: "asc" }, include: {
        sections: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" } } } } } },
    },
  });
  if (!report) throw new Error("No existe el informe");

  const flat = [];
  for (const ch of report.chapters)
    for (const sec of ch.sections)
      for (const b of sec.blocks) flat.push(b);

  let placed = 0, missing = [], skipped = 0;
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    const c = b.content || {};
    // Re-procesa figuras (incluso si ya tienen nuestro src) para re-optimizar;
    // no toca IMAGE con src externo ajeno a la ruta de figuras.
    const ours = typeof c.src === "string" && c.src.includes("/figure/");
    if (b.type !== "IMAGE" || (c.src && !ours)) { if (c.src) skipped++; continue; }
    // Pie = siguiente bloque con texto.
    let caption = "";
    for (let j = i + 1; j < flat.length && j < i + 3; j++) {
      const t = clean(flat[j].content?.text);
      if (t) { caption = t; break; }
    }
    const key = figKey(caption);
    const img = key && byKey.get(key);
    if (!img) { missing.push({ block: b.id, caption: caption.slice(0, 50), key }); continue; }

    const opt = await optimize(img.buffer);
    await prisma.figureAsset.upsert({
      where: { blockId: b.id },
      create: { reportId: report.id, blockId: b.id, contentType: opt.contentType, data: new Uint8Array(opt.buffer) },
      update: { contentType: opt.contentType, data: new Uint8Array(opt.buffer) },
    });
    img.buffer = opt.buffer; // para el log de tamaño
    img.contentType = opt.contentType;
    const title = caption.slice(0, 90); // pie completo (recortado) como alt
    await prisma.block.update({
      where: { id: b.id },
      data: { content: { src: `/api/reports/${SLUG}/figure/${b.id}`, alt: title, kind: "figure" } },
    });
    placed++;
    console.log(`  ✓ ${key.padEnd(6)} ${(img.buffer.length / 1024).toFixed(0).padStart(4)}KB ${img.contentType === "image/jpeg" ? "jpg" : "png"}  ${title.slice(0, 40)}`);
  }

  console.log(`\nColocadas: ${placed} · ya con imagen: ${skipped} · sin match: ${missing.length}`);
  if (missing.length) console.log("SIN MATCH:", missing);
}

main().finally(() => prisma.$disconnect());
