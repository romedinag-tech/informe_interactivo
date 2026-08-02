// Actualiza (sin re-importar) las pronunciaciones del glosario del informe de Talca.
// Uso:
//   node scripts/set-pronunciations.mjs         → base local (.env)
//   node scripts/set-pronunciations.mjs neon    → base Neon (.env.production.local)
import { PrismaClient } from "@prisma/client";

const useNeon = process.argv[2] === "neon";
try {
  process.loadEnvFile(useNeon ? ".env.production.local" : ".env");
} catch {
  /* ya cargado */
}

const prisma = new PrismaClient();

const SLUG = "prediagnostico-talca";
const PRON = {
  IMIV: "ímiv",
  SECTRA: "Séctra",
  EOD: "e o de",
  TMDA: "te eme de a",
  NSE: "ene ese e",
  GEH: "ge e hache",
};

async function main() {
  const report = await prisma.report.findUnique({
    where: { slug: SLUG },
    select: { id: true },
  });
  if (!report) throw new Error(`No existe el informe ${SLUG} en esta base.`);

  let n = 0;
  for (const [term, pronunciation] of Object.entries(PRON)) {
    const res = await prisma.glossaryTerm.updateMany({
      where: { reportId: report.id, term },
      data: { pronunciation },
    });
    n += res.count;
  }

  // Invalida el diccionario previo para forzar su regeneración con las reglas nuevas.
  await prisma.report.update({
    where: { id: report.id },
    data: { pronunciationHash: null },
  });

  console.log(`✅ ${useNeon ? "Neon" : "Local"}: ${n} términos con pronunciación actualizada.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
