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

  // Informe de ejemplo (idempotente por slug).
  const slug = "estudio-transporte-demo";
  await prisma.report.deleteMany({ where: { slug } });

  const report = await prisma.report.create({
    data: {
      slug,
      title: "Estudio de Transporte y Movilidad — Demo",
      subtitle: "Análisis de demanda, capítulo de diagnóstico",
      status: "IN_REVIEW",
      createdById: consultor.id,
      assignments: {
        create: [
          { userId: consultor.id, role: "CONSULTOR" },
          { userId: revisor.id, role: "REVISOR" },
        ],
      },
      chapters: {
        create: [
          {
            order: 1,
            number: "1",
            title: "Diagnóstico de la situación actual",
            sections: {
              create: [
                {
                  order: 1,
                  title: "1.1 Caracterización de la demanda",
                  blocks: {
                    create: [
                      {
                        order: 1,
                        type: "PARAGRAPH",
                        content: {
                          text: "El presente estudio caracteriza la demanda de transporte en el área de influencia, considerando los desplazamientos en horario punta mañana. Los antecedentes recopilados provienen de encuestas origen-destino y conteos de tránsito realizados en terreno durante el período de análisis.",
                        },
                      },
                      {
                        order: 2,
                        type: "PARAGRAPH",
                        content: {
                          text: "La partición modal observada muestra un predominio del transporte privado, con una participación relevante del transporte público mayor en los pares de viaje de mayor distancia. Estos resultados son consistentes con la estructura territorial del área de estudio.",
                        },
                      },
                      {
                        order: 3,
                        type: "TABLE",
                        content: {
                          caption: "Tabla 1.1 — Partición modal por período",
                          columns: ["Período", "Auto (%)", "Bus (%)", "Otros (%)"],
                          rows: [
                            ["Punta mañana", 58, 34, 8],
                            ["Fuera de punta", 62, 29, 9],
                            ["Punta tarde", 55, 37, 8],
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  order: 2,
                  title: "1.2 Evolución de flujos",
                  blocks: {
                    create: [
                      {
                        order: 1,
                        type: "PARAGRAPH",
                        content: {
                          text: "La evolución de los flujos vehiculares en el eje principal evidencia un crecimiento sostenido en los últimos años, con una tasa promedio anual coherente con la expansión del parque automotor comunal.",
                        },
                      },
                      {
                        order: 2,
                        type: "CHART",
                        content: {
                          kind: "line",
                          caption: "Figura 1.1 — Evolución del flujo diario (veh/día)",
                          xKey: "anio",
                          series: [{ key: "flujo", label: "Flujo diario" }],
                          data: [
                            { anio: "2019", flujo: 12400 },
                            { anio: "2020", flujo: 9800 },
                            { anio: "2021", flujo: 11900 },
                            { anio: "2022", flujo: 13600 },
                            { anio: "2023", flujo: 14800 },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("Seed listo:");
  console.log("  Consultor: consultor@demo.cl / demo1234");
  console.log("  Revisor:   revisor@demo.cl / demo1234");
  console.log(`  Informe:   /reports/${report.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
