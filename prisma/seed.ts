import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Carga .env al ejecutar directamente con tsx (Prisma CLI ya lo hace por su cuenta).
try {
  process.loadEnvFile();
} catch {
  // .env ya cargado o no disponible; se ignora.
}

const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash("demo1234", 10);

  const consultor = await prisma.user.upsert({
    where: { email: "consultor@demo.cl" },
    update: {},
    create: {
      email: "consultor@demo.cl",
      name: "Rodrigo (Consultor)",
      passwordHash: pass,
      role: "CONSULTOR",
    },
  });

  const revisor = await prisma.user.upsert({
    where: { email: "revisor@demo.cl" },
    update: {},
    create: {
      email: "revisor@demo.cl",
      name: "Revisor Ministerial",
      passwordHash: pass,
      role: "REVISOR",
    },
  });

  // El informe de ejemplo se retiró (ya no se usa). Se limpia si quedara.
  await prisma.report.deleteMany({ where: { slug: "estudio-transporte-demo" } });

  // Garantiza el acceso de los usuarios demo al informe real (Talca), si existe,
  // para que re-sembrar no deje sin acceso al revisor.
  const talca = await prisma.report.findUnique({
    where: { slug: "prediagnostico-talca" },
    select: { id: true },
  });
  if (talca) {
    const accesos: [string, "CONSULTOR" | "REVISOR"][] = [
      [consultor.id, "CONSULTOR"],
      [revisor.id, "REVISOR"],
    ];
    for (const [userId, role] of accesos) {
      await prisma.reportAssignment.upsert({
        where: { reportId_userId: { reportId: talca.id, userId } },
        update: {},
        create: { reportId: talca.id, userId, role },
      });
    }
  }

  console.log("Seed listo:");
  console.log("  Consultor: consultor@demo.cl / demo1234");
  console.log("  Revisor:   revisor@demo.cl / demo1234");
  console.log(`  Acceso a Talca asegurado: ${talca ? "sí" : "(informe no encontrado)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
