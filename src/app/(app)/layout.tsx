import { redirect } from "next/navigation";
import { currentUser } from "@/lib/rbac";
import { AppHeader } from "@/components/AppHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="ring-focus sr-only rounded-md px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-50"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        Saltar al contenido
      </a>
      <AppHeader user={user} />
      <div id="contenido">{children}</div>
    </div>
  );
}
