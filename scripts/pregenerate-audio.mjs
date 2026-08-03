// Pre-genera y GUARDA el audio de todos los capítulos de un informe, para que
// cada reproducción sea instantánea (HIT desde la base, sin lag ni re-gasto).
// Replica exactamente la lógica del endpoint (voces alternadas + diccionario).
// Solo genera los capítulos NUEVOS o CAMBIADOS (los demás quedan HIT) → sirve
// también tras corregir un informe: re-genera solo lo que cambió.
// Uso: node scripts/pregenerate-audio.mjs <slug> [neon]
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// --- Config (idéntica al servidor: ver src/lib/voices.ts) ---
const NARRATOR_VOICES = [
  { id: "ClNifCEVq1smkl4M3aTk" },
];
const VOICE_SCHEME = "alt-" + NARRATOR_VOICES.map((v) => v.id.slice(0, 4)).join("-");
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const MAX_CHARS = 5000;
const SLUG = process.argv[2];
if (!SLUG) throw new Error("Uso: node scripts/pregenerate-audio.mjs <slug> [neon]");

try { process.loadEnvFile(".env"); } catch {}
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) throw new Error("Falta ELEVENLABS_API_KEY en .env");

const useNeon = process.argv[3] === "neon";
const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
if (!dbUrl) throw new Error(`No encontré DATABASE_URL en ${envFile}`);
console.log("DB:", dbUrl.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

// --- Réplicas exactas de la lógica del servidor ---
function segmentsFor(title, blocks) {
  const parts = [title];
  for (const b of blocks) {
    const c = b.content ?? {};
    if (b.type === "PARAGRAPH" || b.type === "HEADING" || b.type === "CALLOUT") {
      if (typeof c.text === "string" && c.text.trim()) parts.push(c.text.trim());
    } else if (b.type === "TABLE" || b.type === "CHART") {
      if (typeof c.caption === "string" && c.caption.trim()) parts.push(c.caption.trim());
    }
  }
  return parts;
}
function buildRules(glossary) {
  return glossary
    .filter((t) => t.pronunciation && t.pronunciation.trim())
    .map((t) => ({ string_to_replace: t.term, alias: t.pronunciation.trim() }))
    .sort((a, b) => a.string_to_replace.localeCompare(b.string_to_replace));
}
async function createDict(name, rules) {
  const res = await fetch("https://api.elevenlabs.io/v1/pronunciation-dictionaries/add-from-rules", {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ name, rules: rules.map((r) => ({ ...r, type: "alias" })) }),
  });
  if (!res.ok) throw new Error("dict " + res.status + " " + (await res.text()).slice(0, 150));
  const d = await res.json();
  return { id: d.id, versionId: d.version_id };
}
async function tts(text, voiceId, dictLocators) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: text.slice(0, MAX_CHARS),
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 },
      ...(dictLocators?.length ? { pronunciation_dictionary_locators: dictLocators } : {}),
    }),
  });
  if (!res.ok) throw new Error("tts " + res.status + " " + (await res.text()).slice(0, 150));
  return Buffer.from(await res.arrayBuffer());
}
const CONCURRENCY = Number(process.env.ELEVENLABS_CONCURRENCY || 2);
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) { const i = idx++; results[i] = await fn(items[i], i); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
async function synthAlternating(segments, dictLocators) {
  const clean = segments.map((s) => s.trim()).filter(Boolean);
  const bufs = await mapLimit(clean, CONCURRENCY, (seg, i) =>
    tts(seg, NARRATOR_VOICES[i % NARRATOR_VOICES.length].id, dictLocators)
  );
  return Buffer.concat(bufs);
}

async function main() {
  const report = await prisma.report.findUnique({
    where: { slug: SLUG },
    select: {
      id: true,
      pronunciationDictId: true,
      pronunciationDictVersion: true,
      pronunciationHash: true,
      glossary: { select: { term: true, pronunciation: true } },
      chapters: {
        orderBy: { order: "asc" },
        select: {
          id: true, title: true,
          sections: { orderBy: { order: "asc" }, select: { blocks: { orderBy: { order: "asc" }, select: { type: true, content: true } } } },
        },
      },
    },
  });
  if (!report) throw new Error("No existe el informe.");

  // Diccionario de pronunciación (crear/reutilizar como el servidor).
  const rules = buildRules(report.glossary);
  let dictVersion = report.pronunciationDictVersion ?? "";
  let dictLocators;
  if (rules.length) {
    const hash = createHash("sha256").update(JSON.stringify(rules)).digest("hex");
    let dictId = report.pronunciationDictId;
    if (!dictId || report.pronunciationHash !== hash) {
      const d = await createDict(`informe-${SLUG}`, rules);
      dictId = d.id; dictVersion = d.versionId;
      await prisma.report.update({ where: { id: report.id }, data: { pronunciationDictId: d.id, pronunciationDictVersion: d.versionId, pronunciationHash: hash } });
      console.log("Diccionario de pronunciación (re)creado.");
    }
    if (dictId && dictVersion) dictLocators = [{ pronunciation_dictionary_id: dictId, version_id: dictVersion }];
  }

  let done = 0, skip = 0;
  for (const ch of report.chapters) {
    const blocks = ch.sections.flatMap((s) => s.blocks);
    const segments = segmentsFor(ch.title, blocks);
    const text = segments.join(" ");
    const textHash = createHash("sha256").update(`${VOICE_SCHEME}|${MODEL}|${dictVersion}|${text}`).digest("hex");

    const existing = await prisma.audioAsset.findUnique({ where: { textHash }, select: { data: true } });
    if (existing?.data) { skip++; process.stdout.write("·"); continue; }

    const audio = await synthAlternating(segments, dictLocators);
    const bytes = new Uint8Array(audio);
    await prisma.audioAsset.upsert({
      where: { textHash },
      create: { reportId: report.id, chapterId: ch.id, textHash, voiceId: VOICE_SCHEME, model: MODEL, data: bytes, bytes: bytes.length },
      update: { data: bytes, bytes: bytes.length },
    });
    done++;
    process.stdout.write("✓");
  }
  console.log(`\n${useNeon ? "NEON" : "LOCAL"}: generados ${done}, ya estaban ${skip}. Audio cargado y listo.`);
}

main().catch((e) => { console.error("\n", e); process.exit(1); }).finally(() => prisma.$disconnect());
