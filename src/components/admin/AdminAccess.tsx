"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignUserToReport, unassignUserFromReport, createUser } from "@/app/actions/admin";

export type AdminUser = { id: string; name: string | null; email: string | null; role: string };
export type AdminReport = {
  id: string;
  slug: string;
  title: string;
  assignments: { userId: string; role: string; name: string | null; email: string | null }[];
};

const roleEs: Record<string, string> = { CONSULTOR: "Consultor", REVISOR: "Revisor", ADMIN: "Admin" };

export function AdminAccess({
  reports,
  users,
  isAdmin,
}: {
  reports: AdminReport[];
  users: AdminUser[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error && e.message === "EMAIL_YA_EXISTE" ? "Ese correo ya existe." : "No se pudo completar la acción.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-8">
      {isAdmin && <CreateUserCard onCreate={(d) => run(() => createUser(d))} pending={pending} />}

      {reports.length === 0 ? (
        <p className="text-sm text-ink-soft">No administras ningún estudio.</p>
      ) : (
        reports.map((r) => (
          <ReportAccessCard
            key={r.id}
            report={r}
            users={users}
            pending={pending}
            onAssign={(userId, role) => run(() => assignUserToReport({ reportId: r.id, userId, role }))}
            onUnassign={(userId) => run(() => unassignUserFromReport({ reportId: r.id, userId }))}
          />
        ))
      )}
    </div>
  );
}

function ReportAccessCard({
  report,
  users,
  pending,
  onAssign,
  onUnassign,
}: {
  report: AdminReport;
  users: AdminUser[];
  pending: boolean;
  onAssign: (userId: string, role: "CONSULTOR" | "REVISOR") => void;
  onUnassign: (userId: string) => void;
}) {
  const assignedIds = new Set(report.assignments.map((a) => a.userId));
  const available = users.filter((u) => !assignedIds.has(u.id) && u.role !== "ADMIN");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"CONSULTOR" | "REVISOR">("REVISOR");

  return (
    <div className="surface-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg text-ink">{report.title}</h2>
        <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{report.slug}</span>
      </div>

      <ul className="mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
        {report.assignments.length === 0 && (
          <li className="py-2 text-sm text-ink-soft">Nadie tiene acceso todavía.</li>
        )}
        {report.assignments.map((a) => (
          <li key={a.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="text-ink">{a.name || a.email}</span>{" "}
              <span className={`badge ${a.role === "REVISOR" ? "badge-info" : "badge-neutral"}`}>{roleEs[a.role] ?? a.role}</span>
            </span>
            <button
              onClick={() => onUnassign(a.userId)}
              disabled={pending}
              className="ring-focus rounded px-2 py-1 text-xs hover:underline disabled:opacity-50"
              style={{ color: "var(--danger)" }}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      {available.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="field ring-focus px-2 py-1.5 text-sm"
            aria-label="Usuario a habilitar"
          >
            <option value="">Elegir usuario…</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email} ({u.email})
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "CONSULTOR" | "REVISOR")}
            className="field ring-focus px-2 py-1.5 text-sm"
            aria-label="Rol"
          >
            <option value="REVISOR">Revisor</option>
            <option value="CONSULTOR">Consultor</option>
          </select>
          <button
            onClick={() => userId && onAssign(userId, role)}
            disabled={pending || !userId}
            className="btn-primary ring-focus px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Habilitar
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs" style={{ color: "var(--faint)" }}>Todos los usuarios ya tienen acceso.</p>
      )}
    </div>
  );
}

function CreateUserCard({
  onCreate,
  pending,
}: {
  onCreate: (d: { email: string; name: string; password: string; role: "CONSULTOR" | "REVISOR" }) => void;
  pending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CONSULTOR" | "REVISOR">("REVISOR");
  const valid = email.includes("@") && name.trim() && password.length >= 6;

  return (
    <div className="surface-card p-4">
      <h2 className="font-serif text-lg text-ink">Crear usuario</h2>
      <p className="mt-0.5 text-xs" style={{ color: "var(--faint)" }}>
        Crea la cuenta y luego habilítala en los estudios que corresponda. Comparte la contraseña inicial con la persona.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className="field ring-focus px-2 py-1.5 text-sm" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field ring-focus px-2 py-1.5 text-sm" placeholder="correo@dominio.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="field ring-focus px-2 py-1.5 text-sm" type="text" placeholder="Contraseña inicial (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <select className="field ring-focus px-2 py-1.5 text-sm" value={role} onChange={(e) => setRole(e.target.value as "CONSULTOR" | "REVISOR")}>
          <option value="REVISOR">Revisor</option>
          <option value="CONSULTOR">Consultor / Ingeniero</option>
        </select>
      </div>
      <button
        onClick={() => valid && onCreate({ email: email.trim(), name: name.trim(), password, role })}
        disabled={pending || !valid}
        className="btn-primary ring-focus mt-3 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        Crear usuario
      </button>
    </div>
  );
}
