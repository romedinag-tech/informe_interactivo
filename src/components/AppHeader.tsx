import Link from "next/link";
import { signOut } from "@/lib/auth";
import type { SessionUser } from "@/lib/rbac";
import { TalcaMark } from "@/components/viewer/TalcaMark";
import { APP_VERSION, buildId } from "@/lib/version";

const roleLabel: Record<string, string> = {
  CONSULTOR: "Consultor",
  REVISOR: "Revisor ministerial",
  ADMIN: "Administrador",
};

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/reports" className="flex items-center gap-2 text-navy">
            <TalcaMark className="h-5 w-5" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
              Informes Interactivos
            </span>
          </Link>
          <span
            className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-ink-soft"
            title={`Versión ${APP_VERSION} · build ${buildId()}`}
          >
            v{APP_VERSION} · {buildId()}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/instrucciones"
            className="ring-focus rounded-md px-2 py-1 text-ink-soft hover:bg-gray-100 hover:text-navy"
          >
            Instrucciones
          </Link>
          {/* Identidad del usuario: nombre + rol (sin duplicar si coinciden). */}
          <span className="hidden items-center gap-2 sm:inline-flex">
            <span className="text-ink">{user.name}</span>
            {(roleLabel[user.role] ?? user.role) !== user.name && (
              <span className="badge badge-neutral">
                {roleLabel[user.role] ?? user.role}
              </span>
            )}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="ring-focus rounded-md px-2 py-1 text-ink-soft hover:bg-gray-100 hover:text-navy">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
