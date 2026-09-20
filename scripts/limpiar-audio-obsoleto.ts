// Limpia el audio cacheado de un esquema de voz OBSOLETO (p. ej. tras cambiar la
// voz de la app, las grabaciones del esquema viejo ya no calzan con el hash y solo
// ocupan espacio). Por defecto SOLO MIDE (dry-run); borra únicamente con --borrar.
//   npx tsx scripts/limpiar-audio-obsoleto.ts [neon] [esquema] [--borrar]
// Ejemplos:
//   npx tsx scripts/limpiar-audio-obsoleto.ts neon                 # mide alt-EXAV-JBFq
//   npx tsx scripts/limpiar-audio-obsoleto.ts neon --borrar        # borra alt-EXAV-JBFq
//   npx tsx scripts/limpiar-audio-obsoleto.ts neon alt-XXXX --borrar
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const args = process.argv.slice(2);
  const useNeon = args.includes("neon");
  const borrar = args.includes("--borrar");
  // Esquema = primer argumento que no sea "neon" ni una bandera; default el histórico.
  const scheme = args.find((a) => a !== "neon" && !a.startsWith("--")) ?? "alt-EXAV-JBFq";

  const envFile = useNeon ? ".env.production.local" : ".env";
  const dbUrl = readFileSync(envFile, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
  console.log("DB:", dbUrl!.replace(/:\/\/[^@]*@/, "://***@").split("?")[0]);
  console.log("Esquema objetivo:", scheme, borrar ? "· MODO BORRAR" : "· dry-run (no borra)");
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  // Mide antes de borrar (mostrar el objetivo, no descartar en silencio).
  const target = await prisma.audioAsset.findMany({
    where: { voiceId: scheme },
    select: { id: true, bytes: true, report: { select: { slug: true } } },
  });
  const totalBytes = target.reduce((a, r) => a + (r.bytes ?? 0), 0);
  const bySlug = target.reduce<Record<string, number>>((m, r) => {
    const s = r.report?.slug ?? "(sin informe)"; m[s] = (m[s] ?? 0) + 1; return m;
  }, {});
  console.log(`Objetivo: ${target.length} filas, ${(totalBytes / 1e6).toFixed(1)} MB`);
  console.log("Por informe:", JSON.stringify(bySlug));

  if (target.length === 0) { console.log("Nada que borrar."); await prisma.$disconnect(); return; }
  if (!borrar) { console.log("\n(dry-run) Vuelve a correr con --borrar para eliminarlas."); await prisma.$disconnect(); return; }

  const del = await prisma.audioAsset.deleteMany({ where: { voiceId: scheme } });
  const left = await prisma.audioAsset.count({ where: { voiceId: scheme } });
  console.log(`Borradas ${del.count} filas. Liberados ~${(totalBytes / 1e6).toFixed(1)} MB. Quedan del esquema viejo: ${left}.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
