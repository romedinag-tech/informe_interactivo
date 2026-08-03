"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, getReportAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

// ── Asignar un usuario a un estudio (habilitar visibilidad + rol) ──
const assignSchema = z.object({
  reportId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["CONSULTOR", "REVISOR"]),
});

export async function assignUserToReport(input: z.infer<typeof assignSchema>) {
  const actor = await requireUser();
  const data = assignSchema.parse(input);

  // Solo quien gestiona el informe (admin, o consultor asignado a él).
  const access = await getReportAccess(data.reportId, actor.id);
  if (!access.canManage) throw new Error("SIN_PERMISO");

  const target = await prisma.user.findUnique({ where: { id: data.userId }, select: { name: true, email: true } });
  if (!target) throw new Error("USUARIO_INVALIDO");

  await prisma.reportAssignment.upsert({
    where: { reportId_userId: { reportId: data.reportId, userId: data.userId } },
    create: { reportId: data.reportId, userId: data.userId, role: data.role },
    update: { role: data.role },
  });
  await logAudit(data.reportId, actor, "access.grant", `Habilitó a ${target.name || target.email} como ${data.role === "REVISOR" ? "revisor" : "consultor"}`, {
    detail: { userId: data.userId, role: data.role },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/reports", "layout");
}

// ── Quitar el acceso de un usuario a un estudio ──
const unassignSchema = z.object({ reportId: z.string().min(1), userId: z.string().min(1) });

export async function unassignUserFromReport(input: z.infer<typeof unassignSchema>) {
  const actor = await requireUser();
  const data = unassignSchema.parse(input);
  const access = await getReportAccess(data.reportId, actor.id);
  if (!access.canManage) throw new Error("SIN_PERMISO");

  const target = await prisma.user.findUnique({ where: { id: data.userId }, select: { name: true, email: true } });
  await prisma.reportAssignment.deleteMany({
    where: { reportId: data.reportId, userId: data.userId },
  });
  await logAudit(data.reportId, actor, "access.revoke", `Quitó el acceso de ${target?.name || target?.email || "un usuario"}`, {
    detail: { userId: data.userId },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/reports", "layout");
}

// ── Crear un usuario (revisor o consultor) — solo Admin ──
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1),
  password: z.string().min(6),
  role: z.enum(["CONSULTOR", "REVISOR"]),
});

export async function createUser(input: z.infer<typeof createUserSchema>) {
  await requireRole("ADMIN");
  const data = createUserSchema.parse(input);
  const email = data.email.trim().toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new Error("EMAIL_YA_EXISTE");

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.user.create({
    data: { email, name: data.name, passwordHash, role: data.role },
  });
  revalidatePath("/admin", "layout");
}
