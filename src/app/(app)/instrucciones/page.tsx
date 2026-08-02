import Link from "next/link";
import { requireUser, isConsultor } from "@/lib/rbac";
import { TalcaMark } from "@/components/viewer/TalcaMark";

export const metadata = { title: "Instrucciones de uso" };

function Feature({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-lg">
          {icon}
        </span>
        <h3 className="font-serif text-lg text-ink">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}

export default async function InstruccionesPage() {
  const user = await requireUser();
  const consultor = isConsultor(user);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center gap-3">
        <TalcaMark className="h-9 w-9 text-[color:var(--accent)]" />
        <div>
          <h1 className="font-serif text-2xl text-ink">Instrucciones de uso</h1>
          <p className="text-sm text-ink-soft">
            Cómo revisar y trabajar los informes técnicos en este portal.
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent)]">
          Lectura
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Feature icon="📑" title="Índice y navegación">
            El índice lateral permite saltar a cualquier capítulo. Con el selector
            <b> N1 / N2</b> eliges ver solo capítulos o también sus secciones. Al pasar
            el cursor sobre un título largo se despliega completo.
          </Feature>
          <Feature icon="🎨" title="Temas de lectura">
            Arriba a la derecha puedes alternar entre modo <b>claro</b>, <b>sepia</b> y
            <b> oscuro</b> según tu comodidad. Una barra superior indica tu avance.
          </Feature>
          <Feature icon="💬" title="Glosario">
            Los términos técnicos (IMIV, SECTRA, EOD…) aparecen subrayados; pasa el
            cursor o haz clic para ver su definición sin perder la lectura.
          </Feature>
          <Feature icon="🎧" title="Escuchar el informe">
            El botón de audio flotante narra cada capítulo con voz profesional. Puedes
            elegir capítulo, voz (femenina/masculina), velocidad (1×–2×) y activar el
            <b> auto-scroll</b> para que el documento siga la lectura.
          </Feature>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent)]">
          Observaciones (revisores)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Feature icon="✍️" title="Anotar un fragmento">
            Selecciona cualquier texto y presiona <b>“+ Observar”</b>; escribe o
            <b> dicta por voz</b> tu observación. También puedes observar una tabla o
            gráfico completo con el botón que aparece al pasar el cursor sobre ellos.
          </Feature>
          <Feature icon="📋" title="Panel de observaciones">
            Reúne todas tus observaciones agrupadas por capítulo, junto al fragmento
            original. Desde ahí puedes <b>exportarlas a Word o PDF</b>.
          </Feature>
          <Feature icon="📤" title="Enviar al consultor">
            Cuando termines, usa <b>“Enviar al consultor”</b>. Se te pedirá confirmar
            que la revisión está completa; podrás reabrirla si necesitas ajustar algo.
          </Feature>
          <Feature icon="🔒" title="Roles">
            El <b>revisor</b> lee y comenta; el <b>consultor</b> edita el informe y
            responde cada observación con una contrapropuesta.
          </Feature>
        </div>
      </section>

      {consultor && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent)]">
            Edición (consultor)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feature icon="📥" title="Importar un informe">
              Desde el listado, <b>“Importar informe (.docx)”</b> convierte un Word en
              capítulos, secciones y bloques editables automáticamente.
            </Feature>
            <Feature icon="📊" title="Gráficos interactivos">
              En el editor puedes reemplazar cada gráfico estático del Word por uno
              interactivo pegando sus datos, y publicar el informe a revisión.
            </Feature>
          </div>
        </section>
      )}

      <div className="mt-10">
        <Link
          href="/reports"
          className="btn-primary ring-focus rounded-lg px-4 py-2 text-sm"
        >
          Ir a los informes
        </Link>
      </div>
    </main>
  );
}
