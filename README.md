# Informes Interactivos — Plataforma de revisión ministerial

MVP de una plataforma web para **informes técnicos interactivos** con anotaciones
contextuales, roles (RBAC) y un consolidador de observaciones para el flujo
consultor ↔ revisor ministerial.

## Stack

- **Next.js 15** (App Router, React 19) + **TypeScript**
- **PostgreSQL** + **Prisma** (ORM tipado, migraciones)
- **Auth.js (NextAuth v5)** — credenciales + JWT con rol embebido
- **Tailwind CSS** + `@tailwindcss/typography`
- **Recharts** para gráficos interactivos
- **Web Speech API** para dictado por voz

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Entorno (.env con DATABASE_URL local y un AUTH_SECRET)
#    Ya viene un .env de desarrollo; para regenerar el secreto: npx auth secret
```

### Base de datos — opción A: Postgres local embebido (sin Docker)

Levanta un PostgreSQL real en espacio de usuario. **Deja esta terminal abierta**
(el proceso mantiene la base viva):

```bash
npm run db:local
```

> El clúster se guarda en `~/.informes-pgdata` (fuera del proyecto: la ruta con
> "Análisis" rompe `initdb`). La base `informes` se crea en **UTF-8** desde
> `template0` para admitir caracteres como `→`. Se puede cambiar la ubicación con
> la variable `PGDATA_DIR`.

### Base de datos — opción B: Docker (cuando esté disponible)

```bash
docker compose up -d
```

Ambas exponen la base en `localhost:5432` con el mismo `DATABASE_URL`, así que
el resto no cambia.

### Esquema, datos y app

```bash
npm run db:push     # crea el esquema
npm run db:generate # genera el cliente Prisma
npm run db:seed     # usuarios + informe de ejemplo
npm run dev         # http://localhost:3000
```

### Credenciales de demo

| Rol       | Correo               | Clave      |
|-----------|----------------------|------------|
| Consultor | consultor@demo.cl    | demo1234   |
| Revisor   | revisor@demo.cl      | demo1234   |

## Arquitectura (resumen)

```
src/
├─ app/
│  ├─ (app)/                 # área autenticada (layout con cabecera)
│  │  └─ reports/
│  │     ├─ page.tsx                     # listado de informes
│  │     └─ [slug]/
│  │        ├─ page.tsx                  # VISOR del informe
│  │        └─ observaciones/page.tsx    # CONSOLIDADOR de observaciones
│  ├─ actions/annotations.ts # Server Actions (crear/responder/estado) con RBAC
│  ├─ api/auth/[...nextauth]/route.ts    # endpoints Auth.js
│  ├─ login/                 # login (Server Action + formulario)
│  └─ layout.tsx / page.tsx / globals.css
├─ components/
│  ├─ report/               # ReportViewer, ChartBlock (render + selección)
│  └─ annotations/          # VoiceInput, ObservationPanel
├─ lib/                     # db (Prisma), auth (NextAuth), rbac (permisos)
├─ types/                   # tipos de contenido y de sesión
└─ middleware.ts            # protección de rutas
prisma/
├─ schema.prisma            # modelo relacional
└─ seed.ts                  # datos de demo
```

### Modelo de datos

`User → Report → Chapter → Section → Block` (contenido estructurado). Cada `Block`
tiene un `anchorKey` estable. Las `Annotation` se anclan a un `Block` y,
opcionalmente, a un rango de texto (`rangeStart`/`rangeEnd` + `quote` para
re-anclar si el contenido cambia). `AnnotationReply` modela el hilo de
contrapropuestas. `ReportAssignment` controla el acceso por informe.

### Anclaje de observaciones

- **Texto**: el revisor selecciona un fragmento → se calcula el offset dentro del
  bloque y se guarda la cita textual. Al re-renderizar, el fragmento se resalta.
- **Tabla / gráfico / imagen**: botón «Observar» ancla la observación al bloque
  completo.

## Editor: importación desde Word

El consultor crea informes **importando un `.docx`** (`/reports/importar`):

- `src/lib/docx.ts` usa **mammoth** (docx→HTML) + **node-html-parser** y mapea:
  `h1`→Capítulo · `h2`→Sección · `h3-h6`→bloque HEADING · `p`→PARAGRAPH ·
  `table`→TABLE · `ul/ol`→viñetas · `img`→IMAGE (placeholder de gráfico, sin
  incrustar bytes).
- Tras importar se abre el editor (`/reports/[slug]/editar`): editar textos y
  tablas, reordenar/eliminar bloques, y **reemplazar cada gráfico estático por
  uno interactivo** pegando los datos (CSV → Recharts). Botón *Publicar a
  revisión* cambia el estado a `IN_REVIEW`.
- Mutaciones en `src/app/actions/reports.ts`, todas con RBAC de consultor.

## Visor premium (estilo libro digital)

El visor (`/reports/[slug]`) — diseño editorial sobrio (Inter + Source Serif 4,
tarjetas blancas con sombras suaves, acento azul marino):

- **Modo claro / oscuro / sepia** con selector y persistencia (sin parpadeo).
- **Cabecera compacta**: un solo título centrado + emblema de Talca.
- **TOC** con scrollspy, **selector de niveles N1/N2**, hover que despliega el
  título completo e indicador de capítulo activo.
- **Barra de progreso** de lectura; **secciones colapsables**; **acento sobrio por
  capítulo** para diferenciar secciones.
- **Glosario emergente** (`GlossaryTerm`) e **anotaciones** (teclado y voz), con
  panel *bottom-sheet* en móvil.

## Módulo de audio (ElevenLabs + respaldo del navegador)

Reproductor flotante 🎧 que narra el informe por capítulo:

- Voz hiperrealista (`eleven_multilingual_v2`) con **pronunciación de siglas** vía
  diccionario de ElevenLabs generado desde el glosario.
- **Controles**: selector de capítulos, **voz femenina/masculina**, **velocidad
  1×/1.5×/2×**, **auto-scroll** que sigue la lectura (desactivable).
- **Caché** en `AudioAsset` + disco temporal. Sin clave, usa la voz del navegador.

## Revisión y exportación

- **Enviar al consultor** (revisor) con confirmación; el consultor ve el estado
  (`ReportAssignment.submittedAt`).
- **Exportar** el consolidado de observaciones a **Word (.doc)** y **PDF**.
- **Instrucciones de uso** en `/instrucciones`.

## Datos de ejemplo

El seed crea un informe demo; además, `npx tsx scripts/import-talca.ts` importa
el informe real **Síntesis de Prediagnóstico — Talca** (`/reports/prediagnostico-talca`,
15 capítulos) con su glosario.

## Próximos pasos sugeridos

- Conectar los 48 gráficos estáticos del informe de Talca al dashboard de origen
  (`Dashboard_Diagnostico_Talca.html`) — ver `BACKLOG.md`.
- Chunking + concatenación de audio para capítulos largos (>5000 caracteres).
- Foto real (con licencia) de Talca en la portada sobre el emblema actual.
