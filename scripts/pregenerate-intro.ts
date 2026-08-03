// Pre-genera y cachea el audio del resumen ejecutivo (portada) con ElevenLabs,
// para que quede FIJO (no re-gasta créditos) y verificar la voz.
//   npx tsx scripts/pregenerate-intro.ts <slug> [neon]
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { synthesizeWithTimestamps, audioConfig } from "../src/lib/elevenlabs";

try { process.loadEnvFile(); } catch { /* ya cargado */ }

const slug = process.argv[2];
if (!slug) throw new Error("Uso: npx tsx scripts/pregenerate-intro.ts <slug> [neon]");
const useNeon = process.argv[3] === "neon";
const envFile = useNeon ? ".env.production.local" : ".env";
const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const VOICE = process.env.ELEVENLABS_INTRO_VOICE_ID || "ClNifCEVq1smkl4M3aTk";

async function main() {
  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true, execSummary: true, pronunciationDictId: true, pronunciationDictVersion: true,
      chapters: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
  });
  if (!report?.execSummary) throw new Error("El informe no tiene resumen ejecutivo.");

  const model = audioConfig.model;
  const dictVersion = report.pronunciationDictVersion ?? "";
  const dictLocators = report.pronunciationDictId && report.pronunciationDictVersion
    ? [{ pronunciation_dictionary_id: report.pronunciationDictId, version_id: report.pronunciationDictVersion }]
    : undefined;

  const textHash = createHash("sha256")
    .update(`intro|${VOICE}|${model}|${dictVersion}|${report.execSummary.trim()}`)
    .digest("hex");

  const existing = await prisma.audioAsset.findUnique({ where: { textHash } });
  if (existing?.data) { console.log(`Ya cacheado (${existing.bytes} bytes). Nada que hacer.`); return; }

  console.log(`Generando con voz ${VOICE}…`);
  const { audio, charStartTimes } = await synthesizeWithTimestamps(report.execSummary.trim(), { voiceId: VOICE, model, dictLocators });
  const bytes = new Uint8Array(audio);
  await prisma.audioAsset.upsert({
    where: { textHash },
    create: { reportId: report.id, chapterId: report.chapters[0].id, textHash, voiceId: VOICE, model, data: bytes, bytes: bytes.length, alignment: charStartTimes },
    update: { data: bytes, bytes: bytes.length, alignment: charStartTimes },
  });
  console.log(`✓ Intro cacheada: ${(bytes.length/1024).toFixed(0)}KB, ${charStartTimes.length} marcas de tiempo. Voz OK.`);
}
main().catch((e) => { console.error("ERROR:", String(e).slice(0, 400)); process.exit(1); }).finally(() => prisma.$disconnect());
