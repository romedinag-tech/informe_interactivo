import Link from "next/link";
import { signOut } from "@/lib/auth";
import type { SessionUser } from "@/lib/rbac";
import { TalcaMark } from "@/components/viewer/TalcaMark";

const roleLabel: Record<string, string> = {
  CONSULTOR: "Consultor",
  REVISOR: "Revisor ministerial",
  ADMIN: "Administrador",
};

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-4">
        <Link href="/reports" className="flex items-center gap-2 text-navy">
          <TalcaMark className="h-5 w-5" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
            Informes Interactivos
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-ink-soft sm:inline">
            {user.name}
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-ink">
              {roleLabel[user.role] ?? user.role}
            </span>
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded-md px-2 py-1 text-ink-soft hover:bg-gray-100 hover:text-navy">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
