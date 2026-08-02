// Fija el resumen ejecutivo (borrador) del informe de Talca.
// Uso: node scripts/set-exec-summary.mjs [neon]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const which = process.argv[2] === "neon" ? ".env.production.local" : ".env";
const dbUrl = readFileSync(which, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const SUMMARY = [
  "La conurbación de Talca y Maule crece de forma acelerada y expansiva: la edificación se acumula en la periferia sin densificar, con un uso de suelo monofuncional que obliga a desplazarse.",
  "El valor del suelo muestra un fuerte gradiente y una base fiscal desigual, mientras la población de menor nivel socioeconómico se concentra en los bordes, lo que tensiona el acceso a equipamiento y la dependencia escolar.",
  "La demanda de viajes se concentra en la punta de la mañana y es mayoritariamente obligada; Talca opera como polo de atracción y Maule como comuna dormitorio.",
  "La partición modal está equilibrada entre el automóvil (49,6%) y los modos no motorizados, con una caminata relevante (20,6%) y un transporte público que sostiene cerca de un cuarto de los viajes.",
  "En seguridad vial, un tercio de los siniestros ocurre a menos de 150 metros de un establecimiento escolar.",
  "El diagnóstico describe una ciudad segregada y dependiente del automóvil, con oportunidades claras para fortalecer los modos activos y el transporte público.",
].join(" ");

const r = await prisma.report.update({
  where: { slug: "prediagnostico-talca" },
  data: { execSummary: SUMMARY, execSummaryDraft: true },
  select: { execSummary: true },
});
console.log(`[${which}] resumen fijado (${r.execSummary.length} chars)`);
await prisma.$disconnect();
