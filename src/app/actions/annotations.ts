"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, getReportAccess } from "@/lib/rbac";

// ── Crear observación (revisor sobre un bloque, con anclaje fino opcional) ──
const createSchema = z.object({
  reportId: z.string().min(1),
  blockId: z.string().min(1),
  body: z.string().trim().min(1, "La observación no puede estar vacía."),
  quote: z.string().optional(),
  rangeStart: z.number().int().nonnegative().optional(),
  rangeEnd: z.number().int().nonnegative().optional(),
});

export async function createAnnotation(input: z.infer<typeof createSchema>) {
  const user = await requireUser();
  const data = createSchema.parse(input);

  const access = await getReportAccess(data.reportId, user.id);
  if (!access.canComment) throw new Error("SIN_PERMISO");

  // El bloque debe pertenecer al informe indicado.
  const block = await prisma.block.findFirst({
    where: { id: data.blockId, section: { chapter: { reportId: data.reportId } } },
    select: { id: true },
  });
  if (!block) throw new Error("BLOQUE_INVALIDO");

  const annotation = await prisma.annotation.create({
    data: {
      reportId: data.reportId,
      blockId: data.blockId,
      authorId: user.id,
      body: data.body,
      quote: data.quote,
      rangeStart: data.rangeStart,
      rangeEnd: data.rangeEnd,
    },
  });

  revalidatePath(`/reports`, "layout");
  return { id: annotation.id };
}

// ── Responder / contrapropuesta del consultor ──
const replySchema = z.object({
  annotationId: z.string().min(1),
  body: z.string().trim().min(1),
  isResolution: z.boolean().optional(),
});

export async function replyToAnnotation(input: z.infer<typeof replySchema>) {
  const user = await requireUser();
  const data = replySchema.parse(input);

  const annotation = await prisma.annotation.findUnique({
    where: { id: data.annotationId },
    select: { reportId: true },
  });
  if (!annotation) throw new Error("NO_ENCONTRADO");

  const access = await getReportAccess(annotation.reportId, user.id);
  // Sólo quien edita (consultor) puede marcar resolución; comentar puede cualquiera.
  if (data.isResolution && !access.canEdit) throw new Error("SIN_PERMISO");
  if (!access.canComment) throw new Error("SIN_PERMISO");

  await prisma.$transaction(async (tx) => {
    await tx.annotationReply.create({
      data: {
        annotationId: data.annotationId,
        authorId: user.id,
        body: data.body,
        isResolution: Boolean(data.isResolution),
      },
    });
    if (data.isResolution) {
      await tx.annotation.update({
        where: { id: data.annotationId },
        data: { status: "RESOLVED" },
      });
    }
  });

  revalidatePath(`/reports`, "layout");
}

// ── Revisor envía formalmente sus observaciones al consultor ──
export async function submitReview(reportId: string) {
  const user = await requireUser();
  const access = await getReportAccess(reportId, user.id);
  if (!access.canComment) throw new Error("SIN_PERMISO");

  await prisma.reportAssignment.update({
    where: { reportId_userId: { reportId, userId: user.id } },
    data: { submittedAt: new Date() },
  });
  revalidatePath("/reports", "layout");
}

// ── Reabrir la revisión (deshacer el envío) ──
export async function reopenReview(reportId: string) {
  const user = await requireUser();
  const access = await getReportAccess(reportId, user.id);
  if (!access.canComment) throw new Error("SIN_PERMISO");

  await prisma.reportAssignment.update({
    where: { reportId_userId: { reportId, userId: user.id } },
    data: { submittedAt: null },
  });
  revalidatePath("/reports", "layout");
}

// ── Cambiar estado (consultor gestiona el flujo) ──
const statusSchema = z.object({
  annotationId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"]),
});

export async function setAnnotationStatus(input: z.infer<typeof statusSchema>) {
  const user = await requireUser();
  const data = statusSchema.parse(input);

  const annotation = await prisma.annotation.findUnique({
    where: { id: data.annotationId },
    select: { reportId: true },
  });
  if (!annotation) throw new Error("NO_ENCONTRADO");

  const access = await getReportAccess(annotation.reportId, user.id);
  if (!access.canEdit) throw new Error("SIN_PERMISO");

  await prisma.annotation.update({
    where: { id: data.annotationId },
    data: { status: data.status },
  });

  revalidatePath(`/reports`, "layout");
}
