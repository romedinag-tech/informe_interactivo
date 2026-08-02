import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Capa de autorización (RBAC). Toda comprobación de permisos vive aquí y se
 * ejecuta SIEMPRE en el servidor (Server Actions / Route Handlers / Server Components).
 * El cliente nunca es la fuente de verdad.
 */

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
};

/** Devuelve el usuario autenticado o null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };
}

/** Exige sesión; lanza si no hay usuario. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return user;
}

/** Exige un rol global concreto. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("SIN_PERMISO");
  return user;
}

export const isConsultor = (u: { role: Role }) =>
  u.role === "CONSULTOR" || u.role === "ADMIN";
export const isRevisor = (u: { role: Role }) => u.role === "REVISOR";

/**
 * Permiso efectivo sobre un informe. Combina el rol global con la asignación
 * específica del informe (ReportAssignment).
 */
export async function getReportAccess(reportId: string, userId: string) {
  const [assignment, user] = await Promise.all([
    prisma.reportAssignment.findUnique({
      where: { reportId_userId: { reportId, userId } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);

  const globalAdmin = user?.role === "ADMIN";
  const effectiveRole = assignment?.role ?? (globalAdmin ? "ADMIN" : user?.role);

  const canEdit = effectiveRole === "CONSULTOR" || effectiveRole === "ADMIN";
  const canComment = Boolean(effectiveRole); // cualquier rol asignado puede comentar
  const canView = Boolean(effectiveRole) || globalAdmin;

  return { effectiveRole, canView, canEdit, canComment };
}
