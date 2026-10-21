// Importa un JSON de observaciones OFFLINE (exportado desde el HTML) a la ronda:
// decodifica los audios base64 → `audios\<id>.webm`, los transcribe LOCAL con
// faster-whisper, y mezcla las observaciones en `observaciones.json` (único dueño:
// la herramienta). Los ids `off-` no chocan con los de la ronda en línea.
//   npx tsx scripts/revision-import-offline.ts <offline.json> <_revision/ronda_NN>
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

type Obs = Record<string, unknown> & { id: string; audio?: string | null; transcripcion?: string | null; audioB64?: string | null };

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) throw new Error("Uso: revision-import-offline.ts <offline.json|carpeta ...> <_revision/ronda_NN>");
  const revDir = args[args.length - 1];
  const inputs = args.slice(0, -1);
  const audiosDir = join(revDir, "audios"); mkdirSync(audiosDir, { recursive: true });
  const jsonPath = join(revDir, "observaciones.json");
  const mdPath = join(revDir, "observaciones.md");

  // Reúne los .json de cada entrada (archivo o carpeta) y deduplica por id: en
  // conflicto gana la observación más nueva (por `creada`).
  const jsonFiles: string[] = [];
  for (const inp of inputs) {
    if (statSync(inp).isDirectory()) { for (const f of readdirSync(inp)) if (f.toLowerCase().endsWith(".json")) jsonFiles.push(join(inp, f)); }
    else jsonFiles.push(inp);
  }
  const incoming = new Map<string, Obs>();
  for (const jf of jsonFiles) {
    const data = JSON.parse(readFileSync(jf, "utf8"));
    const arr: Obs[] = data.observaciones || data;
    for (const o of arr) {
      if (!o?.id) continue;
      const prev = incoming.get(o.id);
      if (!prev || (Date.parse(String(o.creada) || "") || 0) > (Date.parse(String(prev.creada) || "") || 0)) incoming.set(o.id, o);
    }
  }
  const nuevas: Obs[] = [...incoming.values()];
  console.log(`Entradas: ${jsonFiles.length} archivo(s) → ${nuevas.length} observaciones únicas por id.`);
  const meta0 = jsonFiles.length ? JSON.parse(readFileSync(jsonFiles[0], "utf8")) : {};
  const store = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, "utf8"))
    : { informe: meta0.informe, version_revisada: meta0.version_revisada, ronda: meta0.ronda, fecha: new Date().toISOString().slice(0, 10), observaciones: [] as Obs[] };

  // Transcriptor persistente (carga el modelo una vez). Solo si hay audio que transcribir.
  const hayVoz = nuevas.some((o) => typeof o.audioB64 === "string" && o.audioB64.startsWith("data:"));
  const transcribePy = join(dirname(fileURLToPath(import.meta.url)), "transcribe.py");
  const whisper = hayVoz ? spawn("python", ["-X", "utf8", transcribePy, "--server"], { windowsHide: true }) : null;
  const q: ((t: string) => void)[] = []; let buf = "";
  if (whisper) {
    whisper.stdout.on("data", (d: Buffer) => { buf += d.toString("utf8"); let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (l.startsWith("T\t")) q.shift()?.(l.slice(2)); } });
    whisper.stderr.on("data", (d: Buffer) => { const s = d.toString("utf8").trim(); if (s) console.error("  whisper:", s.slice(0, 160)); });
  }
  const transcribir = (p: string) => new Promise<string>((res) => { if (!whisper || !whisper.stdin.writable) return res(""); q.push(res); whisper.stdin.write(p + "\n"); });

  const existentes = new Set(store.observaciones.map((o: Obs) => o.id));
  let add = 0, voz = 0, dup = 0;
  for (const o of nuevas) {
    if (existentes.has(o.id)) { dup++; continue; }
    if (typeof o.audioB64 === "string" && o.audioB64.startsWith("data:")) {
      const b64 = o.audioB64.slice(o.audioB64.indexOf(",") + 1);
      const file = join(audiosDir, o.id + ".webm");
      writeFileSync(file, Buffer.from(b64, "base64"));
      const t = await transcribir(file);
      o.audio = "audios/" + o.id + ".webm";
      o.transcripcion = t;
      if (!o.texto || String(o.texto).trim() === "") o.texto = t; // si no escribió nada, el dictado es el texto
      voz++;
    } else { o.audio = o.audio ?? null; o.transcripcion = o.transcripcion ?? null; }
    delete o.audioB64;
    store.observaciones.push(o); add++;
  }
  if (whisper) whisper.stdin.end();

  writeFileSync(jsonPath, JSON.stringify(store, null, 2), "utf8");
  const lines = [`# Observaciones · ${store.informe} · ${store.version_revisada} · ronda ${store.ronda}`, "", `Total: ${store.observaciones.length}`, ""];
  for (const o of store.observaciones as Obs[]) {
    const a = (o.ancla ?? {}) as Record<string, string>;
    lines.push(`## ${o.id} · ${o.tipo}${a.rotulo ? " · " + a.rotulo : ""}`);
    lines.push(`- **Sección:** ${((o.seccion_titulos as string[]) || []).join(" › ")}${o.seccion_archivo ? ` (\`${o.seccion_archivo}\`)` : ""}`);
    lines.push(`- **Cita:** «${a.cita ?? ""}»`);
    lines.push(`- **Observación:** ${o.texto}`);
    if (o.audio) lines.push(`- **Audio:** \`${o.audio}\` (voz; transcripción revisable)`);
    lines.push("");
  }
  writeFileSync(mdPath, lines.join("\n"), "utf8");
  console.log(`IMPORTADAS ${add} observaciones (${voz} con voz transcrita, ${dup} ya estaban). Total en la ronda: ${store.observaciones.length}.`);
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1); });
