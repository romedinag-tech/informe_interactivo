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
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
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
      severity: data.severity ?? "MEDIUM",
    },
  });

  revalidatePath(`/reports`, "layout");
  return { id: annotation.id };
}

// ── Editar el texto de una observación (solo el autor) ──
export async function updateAnnotationBody(annotationId: string, body: string) {
  const user = await requireUser();
  const text = body.trim();
  if (!text) throw new Error("VACIO");

  const annotation = await prisma.annotation.findUnique({
    where: { id: annotationId },
    select: { authorId: true, reportId: true },
  });
  if (!annotation) throw new Error("NO_ENCONTRADO");
  if (annotation.authorId !== user.id) throw new Error("SIN_PERMISO");

  await prisma.annotation.update({ where: { id: annotationId }, data: { body: text } });
  revalidatePath("/reports", "layout");
}

// ── Eliminar una observación (el autor, o el consultor del informe) ──
export async function deleteAnnotation(annotationId: string) {
  const user = await requireUser();
  const annotation = await prisma.annotation.findUnique({
    where: { id: annotationId },
    select: { authorId: true, reportId: true },
  });
  if (!annotation) throw new Error("NO_ENCONTRADO");

  const access = await getReportAccess(annotation.reportId, user.id);
  if (annotation.authorId !== user.id && !access.canEdit) throw new Error("SIN_PERMISO");

  await prisma.annotation.delete({ where: { id: annotationId } });
  revalidatePath("/reports", "layout");
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
      // Contrapropuesta que cierra: queda Resuelta.
      await tx.annotation.update({
        where: { id: data.annotationId },
        data: { status: "RESOLVED" },
      });
    } else if (access.canEdit) {
      // El consultor respondió sin cerrar → pasa a Respondida (espera al revisor).
      await tx.annotation.update({
        where: { id: data.annotationId },
        data: { status: "ANSWERED" },
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

// ── Cambiar estado del flujo de revisión ──
const statusSchema = z.object({
  annotationId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "ANSWERED", "RESOLVED", "DISMISSED"]),
  note: z.string().trim().optional(), // justificación (obligatoria al descartar)
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
  // Consultor gestiona el flujo; el revisor puede reabrir/aceptar.
  if (!access.canEdit && !access.canComment) throw new Error("SIN_PERMISO");
  if (data.status === "DISMISSED" && !data.note) throw new Error("JUSTIFICACION_REQUERIDA");

  await prisma.annotation.update({
    where: { id: data.annotationId },
    data: {
      status: data.status,
      // Guarda la justificación al descartar/resolver; la limpia al reabrir.
      resolutionNote:
        data.status === "DISMISSED" || data.status === "RESOLVED"
          ? data.note ?? undefined
          : data.status === "OPEN"
            ? null
            : undefined,
    },
  });

  revalidatePath(`/reports`, "layout");
}

// ── Fijar severidad de una observación (el revisor autor) ──
const severitySchema = z.object({
  annotationId: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export async function setAnnotationSeverity(input: z.infer<typeof severitySchema>) {
  const user = await requireUser();
  const data = severitySchema.parse(input);

  const annotation = await prisma.annotation.findUnique({
    where: { id: data.annotationId },
    select: { reportId: true, authorId: true },
  });
  if (!annotation) throw new Error("NO_ENCONTRADO");

  const access = await getReportAccess(annotation.reportId, user.id);
  if (annotation.authorId !== user.id && !access.canComment) throw new Error("SIN_PERMISO");

  await prisma.annotation.update({
    where: { id: data.annotationId },
    data: { severity: data.severity },
  });
  revalidatePath("/reports", "layout");
}

// ── Pronunciamiento consolidado del revisor (estilo PR review) ──
const verdictSchema = z.object({
  reportId: z.string().min(1),
  verdict: z.enum(["PENDING", "CONFORME", "CON_OBSERVACIONES", "RECHAZADO"]),
  comment: z.string().trim().optional(),
});

export async function setReviewVerdict(input: z.infer<typeof verdictSchema>) {
  const user = await requireUser();
  const data = verdictSchema.parse(input);

  const access = await getReportAccess(data.reportId, user.id);
  if (!access.canComment || access.canEdit) throw new Error("SIN_PERMISO"); // solo revisor

  // Bloqueo: no se puede declarar CONFORME con observaciones sin resolver.
  if (data.verdict === "CONFORME") {
    const pendientes = await prisma.annotation.count({
      where: {
        reportId: data.reportId,
        authorId: user.id,
        status: { in: ["OPEN", "IN_PROGRESS", "ANSWERED"] },
      },
    });
    if (pendientes > 0) throw new Error("HAY_OBSERVACIONES_SIN_RESOLVER");
  }

  await prisma.reportAssignment.update({
    where: { reportId_userId: { reportId: data.reportId, userId: user.id } },
    data: {
      verdict: data.verdict,
      verdictComment: data.comment ?? null,
      verdictAt: data.verdict === "PENDING" ? null : new Date(),
      submittedAt: data.verdict === "PENDING" ? undefined : new Date(),
    },
  });

  revalidatePath("/reports", "layout");
}
