// Exporta la ronda a un HTML OFFLINE autocontenido (un archivo, sin servidor ni
// nube): recomprime las figuras y las incrusta como data: URI, con el visor y el
// esquema de observaciones. Rodrigo lo revisa sin conexión; al volver, lo importa
// con revision-import-offline.ts.
//   npx tsx scripts/revision-export-offline.ts <docx> <mapa.csv> <salida.html> [version] [ronda] [informe]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseReviewDocx, type MapaRotulo } from "../src/lib/revision/parse";
import { renderOfflineHtml } from "../src/lib/revision/offline-html";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

function parseCsv(t: string): Record<string, string>[] {
  t = t.replace(/^﻿/, ""); const rows: string[][] = []; let f = "", r: string[] = [], q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { r.push(f); f = ""; } else if (c === "\n") { r.push(f); rows.push(r); r = []; f = ""; } else if (c !== "\r") f += c; }
  if (f || r.length) { r.push(f); rows.push(r); } const h = rows.shift()!;
  return rows.filter((x) => x.some((v) => v.trim())).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ""])));
}

async function main() {
  const [docxPath, csvPath, outPath, version = "v08", rondaStr = "1", informe = "Informe de avance 1 · PMTU Talca–Maule"] = process.argv.slice(2);
  if (!docxPath || !csvPath || !outPath) throw new Error("Uso: revision-export-offline.ts <docx> <mapa.csv> <salida.html> [version] [ronda] [informe]");

  const mapa: MapaRotulo[] = parseCsv(readFileSync(csvPath, "utf8")).map((r) => ({ codigo: r.codigo, rotulo: r.rotulo, seccionArchivo: r.seccion_archivo, titulo: r.titulo }));
  const doc = await parseReviewDocx(readFileSync(docxPath), mapa);

  // Recomprime cada figura a ~1600px JPEG y la incrusta como data: URI (legible y liviano).
  let bruto = 0, comp = 0;
  const dataUris: string[] = [];
  for (const buf of doc.imageBuffers) {
    bruto += buf.length;
    const out: Buffer = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    comp += out.length;
    dataUris.push("data:image/jpeg;base64," + out.toString("base64"));
  }

  const html = renderOfflineHtml(doc, { informe, version, ronda: Number(rondaStr) }, dataUris);
  writeFileSync(outPath, html, "utf8");
  console.log(`OFFLINE: ${outPath}`);
  console.log(`  ${doc.chapters.filter((c) => !c.frontMatter).length} caps · ${doc.stats.figuras} figuras · ${doc.stats.cuadros} cuadros`);
  console.log(`  figuras ${(bruto / 1e6).toFixed(1)} MB → ${(comp / 1e6).toFixed(1)} MB recomprimidas · HTML ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB`);
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1); });
