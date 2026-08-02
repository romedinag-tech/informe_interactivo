import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";

// Registra un evento de auditoría (append-only). Nunca rompe la operación
// principal: si el log falla, se ignora silenciosamente.
export async function logAudit(
  reportId: string,
  actor: SessionUser,
  action: string,
  summary: string,
  opts?: { target?: string; detail?: Prisma.InputJsonValue }
) {
  try {
    await prisma.auditEvent.create({
      data: {
        reportId,
        actorId: actor.id,
        actorName: actor.name || actor.email || "—",
        action,
        summary,
        target: opts?.target,
        detail: opts?.detail,
      },
    });
  } catch {
    /* el audit trail no debe interrumpir el flujo */
  }
}
