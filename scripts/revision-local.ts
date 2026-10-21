// MODO REVISIÓN INTERNA (local, sin Vercel/Postgres/Auth/audio).
// Levanta un servidor local que sirve el informe para leerlo y dejar observaciones
// ancladas, y las guarda en archivos dentro de la carpeta de revisión del estudio.
//   npx tsx scripts/revision-local.ts <informe.docx> <mapa.csv> <carpeta_revision> [version] [ronda] [puerto]
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
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
  texto: string; origen: string; audio: string | null; transcripcion: string | null; creada: string;
};

async function main() {
  const [docxPath, csvPath, revDir, version = "v08", rondaStr = "1", puertoStr = "4610"] = process.argv.slice(2);
  if (!docxPath || !csvPath || !revDir) throw new Error("Uso: revision-local.ts <docx> <mapa.csv> <carpeta_revision> [version] [ronda] [puerto]");
  const ronda = Number(rondaStr), puerto = Number(puertoStr);
  mkdirSync(revDir, { recursive: true });
  const jsonPath = join(revDir, "observaciones.json");
  const mdPath = join(revDir, "observaciones.md");
  const audiosDir = join(revDir, "audios");
  mkdirSync(audiosDir, { recursive: true });
  // Barrido de audios pendientes (grabaciones sin guardar de corridas anteriores).
  for (const f of readdirSync(audiosDir)) if (f.startsWith("_pending_")) try { unlinkSync(join(audiosDir, f)); } catch { /* ignore */ }

  // Transcriptor LOCAL persistente (faster-whisper, scripts/transcribe.py --server):
  // carga el modelo UNA vez y transcribe cada dictado en segundos. Sin nube.
  const transcribePy = join(dirname(fileURLToPath(import.meta.url)), "transcribe.py");
  const whisper = spawn("python", ["-X", "utf8", transcribePy, "--server"], { windowsHide: true });
  const transQueue: ((t: string) => void)[] = [];
  let outBuf = "";
  whisper.stdout.on("data", (d: Buffer) => {
    outBuf += d.toString("utf8");
    let nl: number;
    while ((nl = outBuf.indexOf("\n")) >= 0) {
      const line = outBuf.slice(0, nl).trim(); outBuf = outBuf.slice(nl + 1);
      if (line === "READY") console.log("  transcriptor (faster-whisper small) listo");
      else if (line.startsWith("T\t")) transQueue.shift()?.(line.slice(2));
    }
  });
  whisper.stderr.on("data", (d: Buffer) => { const s = d.toString("utf8").trim(); if (s) console.error("  whisper:", s.slice(0, 160)); });
  whisper.on("error", (e) => console.error("  whisper no disponible (dictado deshabilitado):", String(e).slice(0, 120)));
  process.on("exit", () => { try { whisper.kill(); } catch { /* ignore */ } });
  const transcribir = (audioPath: string) => new Promise<string>((resolve) => {
    if (!whisper.stdin.writable) { resolve(""); return; }
    transQueue.push(resolve);
    whisper.stdin.write(audioPath + "\n");
  });

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
      if (o.audio) lines.push(`- **Audio:** \`${o.audio}\` (voz; transcripción revisable)`);
      lines.push("");
    }
    writeFileSync(mdPath, lines.join("\n"), "utf8");
  };

  const readBody = (req: import("node:http").IncomingMessage) => new Promise<string>((res) => { const cs: Buffer[] = []; req.on("data", (c: Buffer) => cs.push(c)); req.on("end", () => res(Buffer.concat(cs).toString("utf8"))); });
  const readBodyBuffer = (req: import("node:http").IncomingMessage) => new Promise<Buffer>((res) => { const cs: Buffer[] = []; req.on("data", (c: Buffer) => cs.push(c)); req.on("end", () => res(Buffer.concat(cs))); });

  const server = createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0]; // ignora el query (cache-buster)
    try {
      if (url === "/" ) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); return; }
      if (url.startsWith("/img/")) { const i = Number(url.slice(5)); const buf = doc.imageBuffers[i]; if (!buf) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "Content-Type": doc.images[i]?.contentType || "image/png", "Cache-Control": "max-age=3600" }); res.end(buf); return; }
      if (url === "/observaciones") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(store.observaciones)); return; }
      if (url === "/transcribe" && req.method === "POST") {
        const buf = await readBodyBuffer(req);
        const audioId = "_pending_" + Date.now();
        writeFileSync(join(audiosDir, audioId + ".webm"), buf);
        const transcript = await transcribir(join(audiosDir, audioId + ".webm"));
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ audioId, transcript })); return;
      }
      if (url === "/observacion" && req.method === "POST") {
        const p = JSON.parse(await readBody(req));
        const id = nextId();
        let audio: string | null = null, transcripcion: string | null = null;
        if (p.audioId) { const pend = join(audiosDir, p.audioId + ".webm");
          if (existsSync(pend)) { renameSync(pend, join(audiosDir, id + ".webm")); audio = "audios/" + id + ".webm"; transcripcion = p.transcripcion || null; } }
        const o: Obs = { id, version_revisada: version, tipo: p.tipo || "texto",
          seccion_titulos: [p.ch, p.sec].filter(Boolean), seccion_archivo: p.seccionArchivo || null,
          ancla: { cita: p.cita || "", prefijo: p.prefijo || "", sufijo: p.sufijo || "", rotulo: p.rotulo || null, codigo: p.codigo || null },
          texto: p.texto || "", origen: p.origen || (audio ? "voz" : "escrito"), audio, transcripcion, creada: new Date().toISOString() };
        store.observaciones.push(o); persist();
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(store.observaciones)); return;
      }
      if (url.startsWith("/audios/")) { const f = join(audiosDir, decodeURIComponent(url.slice(8))); if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "Content-Type": "audio/webm" }); res.end(readFileSync(f)); return; }
      if (url === "/observacion/delete" && req.method === "POST") {
        const { id } = JSON.parse(await readBody(req));
        const victim = store.observaciones.find((o) => o.id === id);
        if (victim?.audio) try { unlinkSync(join(revDir, victim.audio)); } catch { /* ignore */ }
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
