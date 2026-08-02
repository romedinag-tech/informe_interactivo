// Crea la versión base (1.0) con snapshot del contenido actual, si no existe.
// Uso: node scripts/create-baseline-version.mjs [neon]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const which = process.argv[2] === "neon" ? ".env.production.local" : ".env";
const dbUrl = readFileSync(which, "utf8").match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const SLUG = "prediagnostico-talca";
const rep = await prisma.report.findUnique({ where: { slug: SLUG }, select: { id: true, versionLabel: true } });
if (!rep) { console.log(`[${which}] informe no encontrado`); process.exit(0); }
const existing = await prisma.reportVersion.findFirst({ where: { reportId: rep.id, number: 1 } });
if (existing) { console.log(`[${which}] baseline ya existe`); process.exit(0); }

const chapters = await prisma.chapter.findMany({
  where: { reportId: rep.id }, orderBy: { order: "asc" },
  include: { sections: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" } } } } },
});
const snapshot = [];
for (const ch of chapters) for (const s of ch.sections) for (const b of s.blocks) {
  const c = b.content || {};
  snapshot.push({ blockId: b.id, chapterNumber: ch.number, chapterTitle: ch.title, sectionTitle: s.title, type: b.type, text: typeof c.text === "string" ? c.text : (c.caption || "") });
}
await prisma.reportVersion.create({
  data: { reportId: rep.id, number: 1, label: rep.versionLabel || "1.0", note: "Versión inicial", createdById: (await prisma.user.findFirst({ where: { role: "CONSULTOR" }, select: { id: true } })).id, snapshot },
});
console.log(`[${which}] baseline 1.0 creada (${snapshot.length} bloques)`);
await prisma.$disconnect();
