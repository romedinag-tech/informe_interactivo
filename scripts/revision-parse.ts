// Etapa 1 del modo revisión: corre el parser sobre un .docx de informe-word y
// resume el modelo de datos, validando figuras/cuadros contra el mapa de rótulos.
//   npx tsx scripts/revision-parse.ts "<informe.docx>" "<mapa_rotulos.csv>"
import { readFileSync } from "node:fs";
import { parseReviewDocx, type MapaRotulo } from "../src/lib/revision/parse";

// CSV mínimo con comillas y BOM (columnas: codigo,rotulo,orden_md,seccion_archivo,titulo).
function parseCsv(text: string): Record<string, string>[] {
  const t = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift()!;
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

async function main() {
  const [docxPath, csvPath] = process.argv.slice(2);
  if (!docxPath) throw new Error("Uso: npx tsx scripts/revision-parse.ts <docx> [mapa.csv]");

  const mapa: MapaRotulo[] = csvPath
    ? parseCsv(readFileSync(csvPath, "utf8")).map((r) => ({ codigo: r.codigo, rotulo: r.rotulo, seccionArchivo: r.seccion_archivo, titulo: r.titulo }))
    : [];

  const doc = await parseReviewDocx(readFileSync(docxPath), mapa);

  const totalBlocks: Record<string, number> = {};
  let secciones = 0;
  for (const ch of doc.chapters) { secciones += ch.sections.length; for (const s of ch.sections) for (const b of s.blocks) totalBlocks[b.type] = (totalBlocks[b.type] ?? 0) + 1; }

  console.log(`CAPÍTULOS: ${doc.chapters.length} · SECCIONES: ${secciones}`);
  for (const ch of doc.chapters) {
    const tipos: Record<string, number> = {};
    for (const s of ch.sections) for (const b of s.blocks) tipos[b.type] = (tipos[b.type] ?? 0) + 1;
    console.log(`  C${ch.number} «${ch.title.slice(0, 46)}» · ${ch.sections.length} secc · ${JSON.stringify(tipos)}`);
  }
  console.log(`\nBLOQUES: ${JSON.stringify(totalBlocks)}`);
  console.log(`IMÁGENES extraídas: ${doc.images.length} (${(doc.images.reduce((a, i) => a + i.bytes, 0) / 1e6).toFixed(1)} MB) · tipos ${JSON.stringify([...new Set(doc.images.map((i) => i.contentType))])}`);
  console.log(`STATS: figuras=${doc.stats.figuras} cuadros=${doc.stats.cuadros} tablas=${doc.stats.tablas} rótulos-sin-elemento=${doc.stats.rotulosNoAdyacentes}`);
  console.log(`MAPA: ${doc.mapa.emparejados}/${doc.mapa.total} rótulos emparejados · sin emparejar: ${doc.mapa.sinEmparejar.slice(0, 10).join(", ") || "ninguno"}`);

  // Muestra de figuras y cuadros ya etiquetados (con su código y sección).
  const muestra = (tipo: "FIGURE" | "CUADRO") => doc.chapters.flatMap((c) => c.sections.flatMap((s) => s.blocks)).filter((b) => b.type === tipo).slice(0, 3);
  for (const b of [...muestra("FIGURE"), ...muestra("CUADRO")] as Extract<typeof doc.chapters[0]["sections"][0]["blocks"][0], { rotulo: string }>[]) {
    console.log(`   ${b.type} «${b.rotulo}» → código ${(b as { codigo: string | null }).codigo ?? "—"} · secc ${(b as { seccionArchivo: string | null }).seccionArchivo ?? "—"} · ${(b as { titulo: string }).titulo.slice(0, 40)}`);
  }
  if (doc.warnings.length) console.log(`\nWARNINGS: ${doc.warnings.slice(0, 4).join(" · ")}`);
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1); });
