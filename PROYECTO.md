# PROYECTO — Informes Interactivos

> **Punto de entrada del proyecto.** Si llegas aquí por primera vez (persona o
> Claude), lee este archivo completo: dice **qué es**, **para qué**, **qué hace**
> y **dónde vive cada cosa**. Es el índice del conocimiento, no el conocimiento:
> lo detallado está en los archivos que este mapa apunta.

---

## Qué es

**Informes Interactivos** es una plataforma web que convierte los informes
técnicos que hoy se entregan en Word/PDF en **informes interactivos en línea**:
el mismo contenido, publicado en un sitio privado donde la contraparte puede
**leer, visualizar, escuchar y observar** directamente sobre el documento.

Es **white-label** (marca configurable en un solo archivo). Hoy la provee
**Inversiones y Asesorías V&R Ltda.** y su primer mandante es el **Ministerio de
Transportes y Telecomunicaciones · SECTRA**, para la revisión de estudios de
transporte urbano.

- **En producción:** https://informe-interactivo.vercel.app
- **Repositorio:** https://github.com/romedinag-tech/informe_interactivo (rama `main`)

## Para qué / para quién

El problema: un informe técnico de nivel ministerial se revisa hoy sobre un PDF o
un Word, con observaciones dispersas por correo ("página 34, tercer párrafo"), sin
trazabilidad, sin poder escucharlo, con figuras estáticas y mapas que no se pueden
explorar.

La plataforma le da a la **contraparte técnica del mandante** una capa de lectura
y revisión sobre el propio informe, y al **consultor** una herramienta para
responder y versionar de forma ordenada. No reemplaza la entrega documental
formal: la complementa.

## Qué hace (capacidades)

- **Leer** — visor premium con temas claro/sepia/oscuro, tipografía cuidada,
  índice navegable, búsqueda, tiempo de lectura, responsive (móvil/tablet/PC).
- **Visualizar** — mapas navegables con fondo satelital (coropletas por
  indicador), gráficos interactivos (Recharts) y figuras en alta nitidez.
- **Escuchar** — narración por capítulo en **voz latinoamericana** (ElevenLabs,
  cacheada) + portada con **resumen ejecutivo de 1 minuto** y resaltado
  palabra-a-palabra.
- **Observar** — la contraparte marca un párrafo y **dicta la observación por voz
  (micrófono)**; queda **anclada** al texto exacto (anclaje robusto W3C).
- **Revisar con trazabilidad** — estados y severidad de cada observación,
  respuesta del consultor, **pronunciamiento** consolidado, **versionado con diff**
  y re-anclaje, **huérfanas** marcadas, **audit trail** inmutable, marca de agua.
- **Controlar acceso** — visibilidad por asignación explícita (`ReportAssignment`);
  panel de administración; roles ADMIN / CONSULTOR / REVISOR.

## Estado actual

- **Stack:** Next.js 15 (App Router, React 19) · TypeScript · Prisma + PostgreSQL ·
  Auth.js v5 · Tailwind v3 · Recharts · Leaflet · ElevenLabs (TTS).
- **Local:** PostgreSQL embebido (`npm run db:local`, sin Docker). **Producción:**
  Neon (São Paulo) + Vercel (auto-deploy en cada push a `main`).
- **En producción hoy:** el prediagnóstico de Talca original (referencia intacta) y
  los dos informes del paquete V&R (`-completo` y `-ejecutivo`), con mapas
  interactivos, figuras nítidas y audio LatAm pre-generado.
- **El motor de generación está maduro:** un informe nuevo se arma con **un
  comando** desde una carpeta declarativa, o desde el **paquete de entrega V&R**.

---

## El segundo cerebro de este proyecto

Un **"segundo cerebro"** (Tiago Forte, *Building a Second Brain*) es un repositorio
externo y estructurado del conocimiento, para no depender de la memoria y no
redescubrir lo ya aprendido. Su método es **CODE** —Capturar, Organizar, Destilar,
Expresar— y organiza por **accionabilidad**, no por tema.

Aquí ese segundo cerebro **no son notas sueltas: son estos archivos versionados**,
pensados para que cualquier sesión de Claude (o una persona nueva) retome el hilo
sin repasar todo de nuevo. El mapeo CODE → este repo:

| CODE | Aquí se materializa como |
|---|---|
| **Capturar** | Insumos reales y feedback quedan en la memoria de sesión y en los `.md` del repo. |
| **Organizar** | Por accionabilidad: *cómo empezar* (`CLAUDE.md`), *cómo producir* (`GENERACION.md`), *cómo se construyó y qué evitar* (`PLAYBOOK.md`). |
| **Destilar** | `BASE_DE_CONOCIMIENTO.md` condensa todos los scripts, la arquitectura y las lecciones en una referencia única. |
| **Expresar** | El producto: los informes interactivos en producción. |

### Mapa del conocimiento — dónde vive cada cosa

| Archivo | Qué contiene | Cuándo leerlo |
|---|---|---|
| **`PROYECTO.md`** (este) | Qué es, para qué, estado, mapa del conocimiento. | Primero, siempre. |
| **`CLAUDE.md`** | Arranque operativo de Claude para *esta* carpeta: qué leer primero y las reglas duras. Se carga solo. (Hereda además el `CLAUDE.md` del repo paraguas `Análisis RMG/` y el global `~/.claude/CLAUDE.md`.) | Al iniciar cualquier sesión de trabajo. |
| **`BASE_DE_CONOCIMIENTO.md`** | **Catálogo de todos los scripts**, arquitectura (`src/`), modelo de datos y **lecciones destiladas**. | Antes de tocar código o correr un script. |
| **`GENERACION.md`** | Contrato de entrada de un informe: carpeta declarativa, `graficos.json`/`mapas.json`, paquete V&R, comandos. | Al generar o corregir un informe. |
| **`PLAYBOOK.md`** | Historia del proceso (fases 0-9), **tabla de trampas** y la regla obligatoria de build antes de push. | Al depurar, desplegar o entender por qué algo es como es. |
| **Memoria de Claude** (`~/.claude/projects/…/memory/`) | Estado vivo y decisiones de fondo, punto en el tiempo. | La carga Claude sola; verificar contra el código antes de afirmar. |

### Cómo retomar el trabajo (orden de lectura)

1. `PROYECTO.md` → `CLAUDE.md` (contexto + reglas).
2. Para **producir un informe**: `GENERACION.md`.
3. Para **tocar código / correr un script**: `BASE_DE_CONOCIMIENTO.md`.
4. Para **entender una decisión o depurar**: `PLAYBOOK.md`.
5. **Antes de cada `git push`:** `npm run build` con exit 0 real (regla dura del PLAYBOOK).
