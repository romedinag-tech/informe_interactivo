// Reproductor de la consulta: HIT/MISS de audio por capítulo para cada informe de
// Talca, replicando EXACTAMENTE el hash del endpoint de audio. DRY-RUN: no genera
// ni muta nada. Corre desde la RAÍZ del motor (lee .env.production.local de ahí):
//   npx tsx consultas/2026-10_re-facturacion-audio-elevenlabs-talca-original/reproducir.ts [neon]
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chapterNarrationSegments } from "../../src/lib/chapter-text";
import { audioConfig, VOICE_SCHEME } from "../../src/lib/elevenlabs";
import { buildPronRules, pronRulesHash } from "../../src/lib/pronunciation";

// Mismo filtro que el reproductor (src/app/(app)/reports/[slug]/page.tsx): el player
// no sirve portada ni índice, así que esos capítulos nunca facturan.
const esPortadaOIndice = (t: string) => /^\s*(introducci[oó]n|[ií]ndice de contenidos?)/i.test(t);

async function main() {
  const useNeon = process.argv[2] === "neon";
  const envFile = useNeon ? ".env.production.local" : ".env";
  const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
  console.log("DB:", dbUrl!.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
  console.log("VOICE_SCHEME:", VOICE_SCHEME, "| model:", audioConfig.model, "\n");
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const model = audioConfig.model;
  const reports = await prisma.report.findMany({
    where: { slug: { contains: "talca" } },
    orderBy: { slug: "asc" },
    select: {
      id: true, slug: true,
      pronunciationDictId: true, pronunciationDictVersion: true, pronunciationHash: true,
      glossary: { select: { term: true, pronunciation: true } },
      chapters: { orderBy: { order: "asc" }, select: { id: true, title: true, sections: { orderBy: { order: "asc" }, select: { blocks: { orderBy: { order: "asc" }, select: { type: true, content: true } } } } } },
    },
  });

  for (const r of reports) {
    const assets = await prisma.audioAsset.groupBy({ by: ["voiceId"], where: { reportId: r.id }, _count: { _all: true } });
    const byScheme = assets.map((a) => `${a.voiceId}:${a._count._all}`).join("  ");

    const rules = buildPronRules(r.glossary);
    let dictVersion = r.pronunciationDictVersion ?? "";
    if (rules.length && (!r.pronunciationDictId || r.pronunciationHash !== pronRulesHash(rules))) {
      console.log(`⚠ ${r.slug}: diccionario desactualizado → el endpoint lo recrea y cambia el hash`);
    }

    let hit = 0, miss = 0, front = 0;
    for (const ch of r.chapters) {
      if (esPortadaOIndice(ch.title)) { front++; continue; }
      const blocks = ch.sections.flatMap((s) => s.blocks);
      const text = chapterNarrationSegments(ch.title, blocks).join(" ");
      if (!text.trim()) continue;
      const textHash = createHash("sha256").update(`${VOICE_SCHEME}|${model}|${dictVersion}|${text}`).digest("hex");
      (await prisma.audioAsset.findUnique({ where: { textHash }, select: { bytes: true } })) ? hit++ : miss++;
    }
    console.log(`── ${r.slug}  (${r.chapters.length} caps; ${front} portada/índice omitidos)`);
    console.log(`   AudioAssets por esquema: ${byScheme || "(ninguno)"}`);
    console.log(`   servidos: HIT ${hit} / MISS ${miss}\n`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
