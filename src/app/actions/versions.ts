"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, getReportAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { buildSnapshot } from "@/lib/snapshot";
import { reanchor } from "@/lib/anchor";
import type { Prisma } from "@prisma/client";

const schema = z.object({
  reportId: z.string().min(1),
  label: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

// Registra una nueva versión (entrega): toma un snapshot inmutable del contenido
// actual, re-ancla todas las observaciones contra el nuevo texto (marcando las
// huérfanas) y sube el número de versión del documento.
export async function publishNewVersion(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const data = schema.parse(input);

  const access = await getReportAccess(data.reportId, user.id);
  if (!access.canEdit) throw new Error("SIN_PERMISO");

  const report = await prisma.report.findUnique({
    where: { id: data.reportId },
    select: { versionNumber: true },
  });
  if (!report) throw new Error("NO_ENCONTRADO");

  const snapshot = await buildSnapshot(prisma, data.reportId);
  const textByBlock = new Map(snapshot.map((b) => [b.blockId, b.text]));

  // Re-anclaje de todas las observaciones contra el contenido actual.
  const annotations = await prisma.annotation.findMany({
    where: { reportId: data.reportId },
    select: {
      id: true,
      quote: true,
      prefix: true,
      suffix: true,
      rangeStart: true,
      rangeEnd: true,
      blockId: true,
      orphaned: true,
    },
  });

  let orphanCount = 0;
  let reanchoredCount = 0;
  for (const a of annotations) {
    const text = textByBlock.get(a.blockId);
    const found = text != null ? reanchor(text, a) : null;
    if (!found) {
      if (!a.orphaned) {
        await prisma.annotation.update({
          where: { id: a.id },
          data: { orphaned: true, orphanedAt: new Date() },
        });
      }
      orphanCount++;
    } else {
      const moved = found.start !== a.rangeStart || found.end !== a.rangeEnd;
      if (moved || a.orphaned) {
        await prisma.annotation.update({
          where: { id: a.id },
          data: { rangeStart: found.start, rangeEnd: found.end, orphaned: false, orphanedAt: null },
        });
        if (moved) reanchoredCount++;
      }
    }
  }

  const newNumber = report.versionNumber + 1;
  const label = data.label || `${newNumber}.0`;

  await prisma.$transaction([
    prisma.reportVersion.create({
      data: {
        reportId: data.reportId,
        number: newNumber,
        label,
        note: data.note ?? null,
        createdById: user.id,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.report.update({
      where: { id: data.reportId },
      data: { versionNumber: newNumber, versionLabel: label },
    }),
  ]);

  await logAudit(
    data.reportId,
    user,
    "report.version",
    `Registró la versión ${label} (${reanchoredCount} re-ancladas, ${orphanCount} huérfanas)`,
    { detail: { label, reanchored: reanchoredCount, orphans: orphanCount } }
  );

  revalidatePath("/reports", "layout");
  return { label, orphanCount, reanchoredCount };
}

// Bloqueo/desbloqueo de una sección conforme entre rondas (consultor).
const lockSchema = z.object({ sectionId: z.string().min(1), locked: z.boolean() });
export async function setSectionLocked(input: z.infer<typeof lockSchema>) {
  const user = await requireUser();
  const data = lockSchema.parse(input);
  const section = await prisma.section.findUnique({
    where: { id: data.sectionId },
    select: { chapter: { select: { reportId: true } } },
  });
  if (!section) throw new Error("NO_ENCONTRADO");
  const access = await getReportAccess(section.chapter.reportId, user.id);
  if (!access.canEdit) throw new Error("SIN_PERMISO");
  await prisma.section.update({ where: { id: data.sectionId }, data: { locked: data.locked } });
  revalidatePath("/reports", "layout");
}
