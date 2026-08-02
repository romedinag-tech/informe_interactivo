"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole, requireUser, getReportAccess } from "@/lib/rbac";
import { parseDocx } from "@/lib/docx";

// ── Utilidades ──
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || "informe";
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  let i = 1;
  while (await prisma.report.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${root}-${++i}`;
  }
  return slug;
}

/** Verifica que el usuario pueda editar ESTE informe; devuelve el userId. */
async function assertCanEditReport(reportId: string): Promise<string> {
  const user = await requireUser();
  const access = await getReportAccess(reportId, user.id);
  if (!access.canEdit) throw new Error("SIN_PERMISO");
  return user.id;
}

// Devuelve el reportId y RECHAZA si la sección del bloque está bloqueada
// (conforme entre rondas). Úsese en toda edición de bloque.
async function assertBlockEditable(blockId: string): Promise<string> {
  const block = await prisma.block.findFirst({
    where: { id: blockId },
    select: { section: { select: { locked: true, chapter: { select: { reportId: true } } } } },
  });
  if (!block) throw new Error("BLOQUE_INVALIDO");
  if (block.section.locked) throw new Error("SECCION_BLOQUEADA");
  return block.section.chapter.reportId;
}

// ── Importación desde Word (.docx) ──
export async function importDocx(formData: FormData): Promise<void> {
  const user = await requireRole("CONSULTOR", "ADMIN");

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) throw new Error("ARCHIVO_REQUERIDO");
  if (!file.name.toLowerCase().endsWith(".docx")) throw new Error("FORMATO_INVALIDO");

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseDocx(buffer);

  const finalTitle = title || file.name.replace(/\.docx$/i, "");
  const slug = await uniqueSlug(finalTitle);

  const report = await prisma.report.create({
    data: {
      slug,
      title: finalTitle,
      subtitle: subtitle || null,
      status: "DRAFT",
      createdById: user.id,
      assignments: { create: [{ userId: user.id, role: "CONSULTOR" }] },
      chapters: {
        create: parsed.chapters.map((ch, ci) => ({
          order: ci + 1,
          number: ch.number,
          title: ch.title,
          sections: {
            create: ch.sections.map((sec, si) => ({
              order: si + 1,
              title: sec.title,
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

  redirect(`/reports/${report.slug}/editar`);
}

// ── Edición de bloques ──
const updateBlockSchema = z.object({
  blockId: z.string().min(1),
  content: z.record(z.any()),
});

export async function updateBlockContent(input: z.infer<typeof updateBlockSchema>) {
  const { blockId, content } = updateBlockSchema.parse(input);
  await assertCanEditReport(await assertBlockEditable(blockId));
  await prisma.block.update({
    where: { id: blockId },
    data: { content: content as Prisma.InputJsonValue },
  });
  revalidatePath("/reports", "layout");
}

export async function deleteBlock(blockId: string) {
  const reportId = await assertBlockEditable(blockId);
  await assertCanEditReport(reportId);
  await prisma.block.delete({ where: { id: blockId } });
  revalidatePath("/reports", "layout");
}

/** Mueve un bloque dentro de su sección (intercambia orden con el vecino). */
export async function moveBlock(blockId: string, direction: "up" | "down") {
  const reportId = await assertBlockEditable(blockId);
  await assertCanEditReport(reportId);

  const block = await prisma.block.findUniqueOrThrow({
    where: { id: blockId },
    select: { id: true, sectionId: true, order: true },
  });
  const siblings = await prisma.block.findMany({
    where: { sectionId: block.sectionId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const idx = siblings.findIndex((s) => s.id === block.id);
  const swapWith = direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
  if (!swapWith) return; // ya está en el extremo

  // Swap seguro con la restricción única [sectionId, order] (orden temporal -1).
  await prisma.$transaction([
    prisma.block.update({ where: { id: block.id }, data: { order: -1 } }),
    prisma.block.update({ where: { id: swapWith.id }, data: { order: block.order } }),
    prisma.block.update({ where: { id: block.id }, data: { order: swapWith.order } }),
  ]);
  revalidatePath("/reports", "layout");
}

const addBlockSchema = z.object({
  sectionId: z.string().min(1),
  type: z.enum(["PARAGRAPH", "HEADING", "CALLOUT"]),
});

export async function addBlock(input: z.infer<typeof addBlockSchema>) {
  const { sectionId, type } = addBlockSchema.parse(input);
  const section = await prisma.section.findUniqueOrThrow({
    where: { id: sectionId },
    select: { locked: true, chapter: { select: { reportId: true } } },
  });
  if (section.locked) throw new Error("SECCION_BLOQUEADA");
  await assertCanEditReport(section.chapter.reportId);

  const last = await prisma.block.findFirst({
    where: { sectionId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.block.create({
    data: {
      sectionId,
      order: (last?.order ?? 0) + 1,
      type,
      content: { text: "" },
    },
  });
  revalidatePath("/reports", "layout");
}

// ── Convertir un placeholder de imagen en un gráfico interactivo ──
const chartSchema = z.object({
  blockId: z.string().min(1),
  kind: z.enum(["bar", "line", "area"]),
  caption: z.string().optional(),
  xKey: z.string().min(1),
  series: z
    .array(z.object({ key: z.string().min(1), label: z.string().min(1) }))
    .min(1),
  data: z.array(z.record(z.union([z.string(), z.number()]))).min(1),
});

export async function convertImageToChart(input: z.infer<typeof chartSchema>) {
  const data = chartSchema.parse(input);
  await assertCanEditReport(await assertBlockEditable(data.blockId));
  await prisma.block.update({
    where: { id: data.blockId },
    data: {
      type: "CHART",
      content: {
        kind: data.kind,
        caption: data.caption ?? "",
        xKey: data.xKey,
        series: data.series,
        data: data.data,
      } as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/reports", "layout");
}

// ── Títulos de capítulo / sección ──
export async function updateChapterMeta(
  chapterId: string,
  title: string,
  number: string
) {
  const ch = await prisma.chapter.findUniqueOrThrow({
    where: { id: chapterId },
    select: { reportId: true },
  });
  await assertCanEditReport(ch.reportId);
  await prisma.chapter.update({
    where: { id: chapterId },
    data: { title: title.trim(), number: number.trim() || null },
  });
  revalidatePath("/reports", "layout");
}

export async function updateSectionTitle(sectionId: string, title: string) {
  const sec = await prisma.section.findUniqueOrThrow({
    where: { id: sectionId },
    select: { chapter: { select: { reportId: true } } },
  });
  await assertCanEditReport(sec.chapter.reportId);
  await prisma.section.update({
    where: { id: sectionId },
    data: { title: title.trim() || null },
  });
  revalidatePath("/reports", "layout");
}

// ── Estado del informe (publicar a revisión) ──
export async function setReportStatus(
  reportId: string,
  status: "DRAFT" | "IN_REVIEW" | "RESOLVED" | "ARCHIVED"
) {
  await assertCanEditReport(reportId);
  await prisma.report.update({ where: { id: reportId }, data: { status } });
  revalidatePath("/reports", "layout");
}
