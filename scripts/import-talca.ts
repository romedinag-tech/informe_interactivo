// Importa el informe real de Talca (docx) y siembra un glosario técnico.
// Uso: npx tsx scripts/import-talca.ts
import { readFileSync } from "node:fs";
import { PrismaClient, type Prisma } from "@prisma/client";
import { parseDocx } from "../src/lib/docx";

try {
  process.loadEnvFile();
} catch {
  /* ya cargado */
}

const prisma = new PrismaClient();

const GLOSARIO: {
  term: string;
  definition: string;
  source?: string;
  pronunciation?: string;
}[] = [
  { term: "IMIV", definition: "Informe de Mitigación de Impacto Vial: estudio que evalúa los efectos de un proyecto sobre el sistema de transporte y define medidas de mitigación.", source: "Ley 20.958; DS 30/2019 MTT-MINVU", pronunciation: "ímiv" },
  { term: "SECTRA", definition: "Programa de Vialidad y Transporte Urbano del Ministerio de Transportes; genera y administra los modelos de transporte de las ciudades chilenas.", source: "MTT", pronunciation: "Séctra" },
  { term: "EOD", definition: "Encuesta Origen–Destino de viajes: levantamiento de los viajes de los hogares por propósito, modo, hora y zona.", source: "SECTRA", pronunciation: "e o de" },
  { term: "TMDA", definition: "Tránsito Medio Diario Anual: promedio de vehículos que circulan por un punto de la red en un día, promediado sobre el año.", source: "Manual de Carreteras, MOP", pronunciation: "te eme de a" },
  { term: "partición modal", definition: "Distribución porcentual de los viajes entre los distintos modos de transporte (auto, transporte público, caminata, bicicleta, etc.).", source: "Modelo de 4 etapas" },
  { term: "NSE", definition: "Nivel socioeconómico: clasificación de los hogares según ingreso y características, usada para segmentar la demanda.", source: "AIM / CASEN", pronunciation: "ene ese e" },
  { term: "GEH", definition: "Estadístico de bondad de ajuste que compara flujos modelados con observados; valores bajo 5 indican buen ajuste.", source: "WebTAG, UK DfT", pronunciation: "ge e hache" },
  { term: "Plan Maestro", definition: "Instrumento de planificación que ordena las intervenciones de transporte y uso de suelo de un territorio en un horizonte de largo plazo." },
  { term: "V&R Ltda", definition: "Consultora responsable del presente estudio de transporte y movilidad.", pronunciation: "ve y erre limitada" },
];

async function main() {
  const consultor = await prisma.user.findUniqueOrThrow({ where: { email: "consultor@demo.cl" } });
  const revisor = await prisma.user.findUniqueOrThrow({ where: { email: "revisor@demo.cl" } });

  const buffer = readFileSync("Insumos/Plan de Talca/Sintesis_Prediagnostico_Talca.docx");
  const parsed = await parseDocx(buffer);

  const slug = "prediagnostico-talca";
  await prisma.report.deleteMany({ where: { slug } });

  const report = await prisma.report.create({
    data: {
      slug,
      title: "Síntesis de Prediagnóstico — Talca",
      subtitle: "Diagnóstico territorial y de movilidad para el Plan Maestro",
      status: "IN_REVIEW",
      createdById: consultor.id,
      assignments: {
        create: [
          { userId: consultor.id, role: "CONSULTOR" },
          { userId: revisor.id, role: "REVISOR" },
        ],
      },
      glossary: {
        create: GLOSARIO.map((g) => ({
          term: g.term,
          definition: g.definition,
          source: g.source ?? null,
          pronunciation: g.pronunciation ?? null,
        })),
      },
      chapters: {
        create: parsed.chapters.map((ch, ci) => ({
          order: ci + 1,
          number: ch.number,
          title: ch.title,
          sections: {
            create: ch.sections.map((sec, si) => ({
              order: si + 1,
              title: sec.title,
              // Colapsa por defecto secciones tipo anexo (supuestos / brechas).
              collapsedByDefault: /supuesto|brecha|alcance/i.test(sec.title ?? ""),
              blocks: {
                create: sec.blocks.map((b, bi) => ({
                  order: bi + 1,
                  type: b.type,
                  content: b.content as Prisma.InputJsonValue,
                })),
              },
            })),
          },
        })),
      },
    },
  });

  const counts = await prisma.block.count({
    where: { section: { chapter: { reportId: report.id } } },
  });
  console.log(`Importado: /reports/${report.slug}`);
  console.log(`  Capítulos: ${parsed.chapters.length} · Bloques: ${counts} · Glosario: ${GLOSARIO.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
