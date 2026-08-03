import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, isAdmin } from "@/lib/rbac";
import { AdminAccess, type AdminReport, type AdminUser } from "@/components/admin/AdminAccess";

// Panel de administración de accesos: habilita/quita qué estudios ve cada
// usuario. Admin gestiona todos los estudios y crea usuarios; un consultor
// gestiona los accesos de los estudios que edita.
export default async function AdminPage() {
  const user = await requireUser();
  const admin = isAdmin(user);

  const reportsRaw = await prisma.report.findMany({
    where: admin ? undefined : { assignments: { some: { userId: user.id, role: "CONSULTOR" } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      assignments: {
        orderBy: { role: "asc" },
        select: { userId: true, role: true, user: { select: { name: true, email: true } } },
      },
    },
  });

  // Sin permisos de gestión → fuera.
  if (!admin && reportsRaw.length === 0) redirect("/reports");

  const reports: AdminReport[] = reportsRaw.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    assignments: r.assignments.map((a) => ({
      userId: a.userId,
      role: a.role,
      name: a.user.name,
      email: a.user.email,
    })),
  }));

  const users: AdminUser[] = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-serif text-2xl text-ink">Administración de accesos</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Habilita qué estudios ve cada usuario. Sin acceso explícito, un usuario no ve ni puede abrir un estudio.
      </p>
      <div className="mt-6">
        <AdminAccess reports={reports} users={users} isAdmin={admin} />
      </div>
    </main>
  );
}
