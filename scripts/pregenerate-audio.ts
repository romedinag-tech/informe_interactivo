// Pre-genera y GUARDA el audio de todos los capítulos de un informe usando las
// FUNCIONES REALES del servidor (misma narración, misma voz, mismo hash) → cada
// reproducción es HIT instantáneo, sin re-gasto. Solo genera lo nuevo/cambiado.
//   npx tsx scripts/pregenerate-audio.ts <slug> [neon]
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chapterNarrationSegments } from "../src/lib/chapter-text";
import { audioConfig, synthesizeAlternating, createPronunciationDictionary, VOICE_SCHEME } from "../src/lib/elevenlabs";
import { buildPronRules, pronRulesHash } from "../src/lib/pronunciation";

try { process.loadEnvFile(".env"); } catch { /* API key */ }

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("Uso: npx tsx scripts/pregenerate-audio.ts <slug> [neon]");
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("Falta ELEVENLABS_API_KEY en .env");
  const useNeon = process.argv[3] === "neon";
  const envFile = useNeon ? ".env.production.local" : ".env";
  const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
  console.log("DB:", dbUrl!.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const model = audioConfig.model;
  const report = await prisma.report.findUnique({
    where: { slug },
    select: {
      id: true, pronunciationDictId: true, pronunciationDictVersion: true, pronunciationHash: true,
      glossary: { select: { term: true, pronunciation: true } },
      chapters: { orderBy: { order: "asc" }, select: { id: true, title: true, sections: { orderBy: { order: "asc" }, select: { blocks: { orderBy: { order: "asc" }, select: { type: true, content: true } } } } } },
    },
  });
  if (!report) throw new Error("No existe el informe.");

  // Diccionario de pronunciación (crear/reutilizar, idéntico al servidor).
  const rules = buildPronRules(report.glossary);
  let dictVersion = report.pronunciationDictVersion ?? "";
  let dictLocators: { pronunciation_dictionary_id: string; version_id: string }[] | undefined;
  if (rules.length) {
    const hash = pronRulesHash(rules);
    let dictId = report.pronunciationDictId;
    if (!dictId || report.pronunciationHash !== hash) {
      const d = await createPronunciationDictionary(`informe-${slug}`, rules);
      dictId = d.id; dictVersion = d.versionId;
      await prisma.report.update({ where: { id: report.id }, data: { pronunciationDictId: d.id, pronunciationDictVersion: d.versionId, pronunciationHash: hash } });
      console.log("Diccionario de pronunciación (re)creado.");
    }
    if (dictId && dictVersion) dictLocators = [{ pronunciation_dictionary_id: dictId, version_id: dictVersion }];
  }

  let done = 0, skip = 0;
  for (const ch of report.chapters) {
    const blocks = ch.sections.flatMap((s) => s.blocks);
    const segments = chapterNarrationSegments(ch.title, blocks as { type: string; content: unknown }[]);
    const text = segments.join(" ");
    const textHash = createHash("sha256").update(`${VOICE_SCHEME}|${model}|${dictVersion}|${text}`).digest("hex");

    const existing = await prisma.audioAsset.findUnique({ where: { textHash }, select: { data: true } });
    if (existing?.data) { skip++; process.stdout.write("·"); continue; }

    const audio = await synthesizeAlternating(segments, { model, dictLocators });
    const bytes = new Uint8Array(audio);
    await prisma.audioAsset.upsert({
      where: { textHash },
      create: { reportId: report.id, chapterId: ch.id, textHash, voiceId: VOICE_SCHEME, model, data: bytes, bytes: bytes.length },
      update: { data: bytes, bytes: bytes.length },
    });
    done++; process.stdout.write("✓");
  }
  console.log(`\n${useNeon ? "NEON" : "LOCAL"}: generados ${done}, ya estaban ${skip}. Audio cargado (voz ${VOICE_SCHEME}).`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("\n", String(e).slice(0, 300)); process.exit(1); });
