import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isConsultor } from "@/lib/rbac";
import { importDocx } from "@/app/actions/reports";
import { SubmitButton } from "@/components/SubmitButton";

export default async function ImportarPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isConsultor(user)) redirect("/reports"); // sólo consultor/admin

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/reports" className="ring-focus rounded text-sm hover:underline" style={{ color: "var(--accent)" }}>
        ← Volver a informes
      </Link>
      <h1 className="mt-4 font-serif text-2xl text-ink">Importar informe</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Sube el documento Word (.docx). Se convertirá en capítulos, secciones y
        bloques editables. Los títulos (Heading&nbsp;1/2) definen la estructura y
        los gráficos estáticos quedan marcados para reemplazar por versiones
        interactivas.
      </p>

      <form action={importDocx} className="surface-card mt-6 space-y-4 p-6">
        <div>
          <label className="block text-sm font-medium text-ink">
            Documento Word (.docx)
          </label>
          <input
            name="file"
            type="file"
            accept=".docx"
            required
            className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--accent)] file:px-3 file:py-2 file:text-[color:var(--accent-contrast)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Título del informe{" "}
            <span className="text-ink-soft">(opcional)</span>
          </label>
          <input
            name="title"
            type="text"
            placeholder="Si se deja vacío, se usa el nombre del archivo"
            className="field ring-focus mt-1 w-full px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Subtítulo <span className="text-ink-soft">(opcional)</span>
          </label>
          <input
            name="subtitle"
            type="text"
            className="field ring-focus mt-1 w-full px-3 py-2 text-sm"
          />
        </div>

        <SubmitButton pendingText="Convirtiendo…">
          Importar y editar
        </SubmitButton>
      </form>
    </main>
  );
}
