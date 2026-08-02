import Link from "next/link";
import { signOut } from "@/lib/auth";
import type { SessionUser } from "@/lib/rbac";

const roleLabel: Record<string, string> = {
  CONSULTOR: "Consultor",
  REVISOR: "Revisor ministerial",
  ADMIN: "Administrador",
};

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/reports" className="font-serif text-lg text-navy">
          Informes Interactivos
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink-soft">
            {user.name}{" "}
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-ink">
              {roleLabel[user.role] ?? user.role}
            </span>
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-ink-soft hover:text-navy">Salir</button>
          </form>
        </div>
      </div>
    </header>
  );
}
