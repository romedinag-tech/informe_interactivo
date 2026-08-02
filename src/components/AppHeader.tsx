import Link from "next/link";
import { signOut } from "@/lib/auth";
import type { SessionUser } from "@/lib/rbac";
import { BrandMark } from "@/components/brand/BrandMark";
import { APP_VERSION, buildId } from "@/lib/version";

const roleLabel: Record<string, string> = {
  CONSULTOR: "Consultor",
  REVISOR: "Revisor ministerial",
  ADMIN: "Administrador",
};

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        background: "color-mix(in srgb, var(--surface) 85%, transparent)",
        borderColor: "var(--line)",
      }}
    >
      <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/reports" className="ring-focus flex items-center gap-2 rounded text-ink">
            <BrandMark slot="header" className="h-5 w-5 text-[color:var(--accent)]" />
          </Link>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--surface-2)", color: "var(--faint)" }}
            title={`Versión ${APP_VERSION} · build ${buildId()}`}
          >
            v{APP_VERSION} · {buildId()}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/instrucciones"
            className="ring-focus rounded-md px-2 py-1 text-ink-soft hover:bg-[color:var(--surface-2)] hover:text-ink"
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
            <button className="ring-focus rounded-md px-2 py-1 text-ink-soft hover:bg-[color:var(--surface-2)] hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
