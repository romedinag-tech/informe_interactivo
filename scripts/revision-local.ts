// MODO REVISIÓN INTERNA (local, sin Vercel/Postgres/Auth/audio).
// Levanta un servidor local que sirve el informe para leerlo y dejar observaciones
// ancladas, y las guarda en archivos dentro de la carpeta de revisión del estudio.
//   npx tsx scripts/revision-local.ts <informe.docx> <mapa.csv> <carpeta_revision> [version] [ronda] [puerto]
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseReviewDocx, type MapaRotulo } from "../src/lib/revision/parse";
import { renderReviewHtml } from "../src/lib/revision/viewer-html";

function parseCsv(text: string): Record<string, string>[] {
  const t = text.replace(/^﻿/, "");
  const rows: string[][] = []; let field = "", row: string[] = [], q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; } else if (c !== "\r") field += c; }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift()!;
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

type Obs = {
  id: string; version_revisada: string; tipo: string;
  seccion_titulos: string[]; seccion_archivo: string | null;
  ancla: { cita: string; prefijo: string; sufijo: string; rotulo: string | null; codigo: string | null };
  texto: string; origen: string; audio: string | null; creada: string;
};

async function main() {
  const [docxPath, csvPath, revDir, version = "v08", rondaStr = "1", puertoStr = "4610"] = process.argv.slice(2);
  if (!docxPath || !csvPath || !revDir) throw new Error("Uso: revision-local.ts <docx> <mapa.csv> <carpeta_revision> [version] [ronda] [puerto]");
  const ronda = Number(rondaStr), puerto = Number(puertoStr);
  mkdirSync(revDir, { recursive: true });
  const jsonPath = join(revDir, "observaciones.json");
  const mdPath = join(revDir, "observaciones.md");

  const mapa: MapaRotulo[] = parseCsv(readFileSync(csvPath, "utf8")).map((r) => ({ codigo: r.codigo, rotulo: r.rotulo, seccionArchivo: r.seccion_archivo, titulo: r.titulo }));
  const doc = await parseReviewDocx(readFileSync(docxPath), mapa);
  const informe = "Informe de avance 1 · PMTU Talca–Maule";
  const html = renderReviewHtml(doc, { informe, version, ronda });

  // Estado persistido.
  let store: { informe: string; version_revisada: string; ronda: number; fecha: string; observaciones: Obs[] } =
    existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, "utf8"))
      : { informe, version_revisada: version, ronda, fecha: new Date().toISOString().slice(0, 10), observaciones: [] };

  const nextId = () => { const n = store.observaciones.reduce((m, o) => Math.max(m, Number(o.id.replace(/\D/g, "")) || 0), 0); return "obs-" + String(n + 1).padStart(4, "0"); };
  const persist = () => {
    writeFileSync(jsonPath, JSON.stringify(store, null, 2), "utf8");
    const lines = [`# Observaciones · ${informe} · ${version} · ronda ${ronda}`, "", `Total: ${store.observaciones.length}`, ""];
    for (const o of store.observaciones) {
      lines.push(`## ${o.id} · ${o.tipo}${o.ancla.rotulo ? " · " + o.ancla.rotulo : ""}`);
      lines.push(`- **Sección:** ${o.seccion_titulos.join(" › ")}${o.seccion_archivo ? ` (\`${o.seccion_archivo}\`)` : ""}`);
      lines.push(`- **Cita:** «${o.ancla.cita}»`);
      lines.push(`- **Observación:** ${o.texto}`);
      lines.push("");
    }
    writeFileSync(mdPath, lines.join("\n"), "utf8");
  };

  const readBody = (req: import("node:http").IncomingMessage) => new Promise<string>((res) => { const cs: Buffer[] = []; req.on("data", (c: Buffer) => cs.push(c)); req.on("end", () => res(Buffer.concat(cs).toString("utf8"))); });

  const server = createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0]; // ignora el query (cache-buster)
    try {
      if (url === "/" ) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); return; }
      if (url.startsWith("/img/")) { const i = Number(url.slice(5)); const buf = doc.imageBuffers[i]; if (!buf) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "Content-Type": doc.images[i]?.contentType || "image/png", "Cache-Control": "max-age=3600" }); res.end(buf); return; }
      if (url === "/observaciones") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(store.observaciones)); return; }
      if (url === "/observacion" && req.method === "POST") {
        const p = JSON.parse(await readBody(req));
        const o: Obs = { id: nextId(), version_revisada: version, tipo: p.tipo || "texto",
          seccion_titulos: [p.ch, p.sec].filter(Boolean), seccion_archivo: p.seccionArchivo || null,
          ancla: { cita: p.cita || "", prefijo: p.prefijo || "", sufijo: p.sufijo || "", rotulo: p.rotulo || null, codigo: p.codigo || null },
          texto: p.texto || "", origen: p.origen || "escrito", audio: null, creada: new Date().toISOString() };
        store.observaciones.push(o); persist();
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(store.observaciones)); return;
      }
      if (url === "/observacion/delete" && req.method === "POST") {
        const { id } = JSON.parse(await readBody(req));
        store.observaciones = store.observaciones.filter((o) => o.id !== id); persist();
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(store.observaciones)); return;
      }
      res.writeHead(404); res.end();
    } catch (e) { res.writeHead(500); res.end(String(e).slice(0, 300)); }
  });
  server.listen(puerto, () => {
    console.log(`\nRevisión local lista: http://localhost:${puerto}`);
    console.log(`  informe: ${informe} · ${version} · ronda ${ronda}`);
    console.log(`  figuras ${doc.stats.figuras} · cuadros ${doc.stats.cuadros} · imágenes ${doc.images.length}`);
    console.log(`  observaciones → ${jsonPath}`);
    console.log(`  (Ctrl-C para terminar)`);
  });
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1); });
