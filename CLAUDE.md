# Informes Interactivos

## Propósito
Plataforma web que publica informes técnicos como **informes interactivos en línea**
(leer, visualizar, escuchar y observar por voz sobre el propio documento) para
revisión ministerial. White-label: proveedor **V&R Ltda.**, mandante **MTT · SECTRA**.

## Estado
activo
En producción: https://informe-interactivo.vercel.app (Vercel + Neon, São Paulo).
Motor de generación maduro: un informe se arma o corrige con un comando desde una
carpeta declarativa o desde el paquete de entrega V&R. En vivo: Talca original
(`prediagnostico-talca`, referencia) + paquete V&R (`-completo`, `-ejecutivo`), con
mapas interactivos, figuras nítidas y audio latinoamericano cacheado (HIT permanente).
Segundo cerebro documentado (`PROYECTO.md` + `BASE_DE_CONOCIMIENTO.md`).
Última actividad: 2026-08-03 (último commit); 6 archivos sin commitear de esta sesión
(fix de facturación de audio + docs del segundo cerebro). Sin encargos abiertos; no
registrado en el orquestador.

## Entradas y salidas
**Produce:** informes interactivos en vivo, que consume la contraparte técnica de
MTT/SECTRA para leer, escuchar y dejar observaciones ancladas.
**Consume (solo lectura):** el paquete de entrega V&R (`.docx` + `datos/` +
`secciones_relato.json`) o una carpeta declarativa (`informe.json` + `informe.docx` +
`graficos.json`/`mapas.json`/`geo/`/`figuras/`), y ElevenLabs (TTS por `fetch`).
Contrato de entrada completo en `GENERACION.md`. No hay `SALIDAS.md` (el producto es
la app en línea, no archivos en disco).

## Datos canónicos
- **Producción — Neon Postgres** 🔴: la URL vive en `.env.production.local` (gitignored).
  Contiene informes, observaciones, `AudioAsset` (caché de narración), `MapAsset`, `FigureAsset`.
- **Local — Postgres embebido** en `~/.informes-pgdata` (ruta ASCII, base UTF-8), vía `npm run db:local`.
- **Insumos reales** 🔴: `Insumos/Plan de Talca/` (docx + paquete V&R). Gitignored.
- **Marca:** `public/brand/` (isotipo/lockup/hero). El contenido ministerial es de uso restringido.
- Esquema de datos y catálogo completo de scripts: `BASE_DE_CONOCIMIENTO.md`.

## Aprendizajes
- 2026-09-19 — Cambiar la voz (`VOICE_SCHEME`) o el texto de narración **invalida el
  hash del caché de audio** → el caché viejo no calza y cada reproducción RE-FACTURA en
  ElevenLabs. Pasó con el Talca original al unificar a voz LatAm. Se arregla
  pre-generando cada informe existente bajo el esquema nuevo
  (`pregenerate-audio.ts <slug> neon`; escribe directo a Neon, sin deploy → la
  facturación se detiene al instante). Caché obsoleto se limpia con
  `limpiar-audio-obsoleto.ts` (dry-run por defecto). Detalle: `PLAYBOOK.md` #20.
- 2026-08-03 — Un `tsc`/build con pipe a `head`/`tail` **enmascara el exit code** → un
  build roto llegó a Vercel. Correr `npx tsc --noEmit` **y** `npm run build` con exit 0
  real antes de cada push; `scripts/*` cuenta para el build. Detalle: `PLAYBOOK.md` #18-19.
- 2026-08-03 — El modo CREAR de `generar-informe.ts` es **destructivo** (`deleteMany`
  por slug: borra observaciones/versiones/audio). Para corregir un informe con
  observaciones: `--actualizar`. Detalle: `PLAYBOOK.md` #13.
- Registro completo (20 trampas) en `PLAYBOOK.md`; lecciones destiladas en `BASE_DE_CONOCIMIENTO.md`.

## Cómo se ejecuta
Local: `npm run db:local` (otra terminal) → `npm run db:push && npm run db:seed`.
Informe nuevo: `npx tsx scripts/generar-informe.ts <carpeta> [neon]` (o
`generar-paquete.ts <completo|ejecutivo> <slug> [neon]`). Audio:
`npx tsx scripts/pregenerate-audio.ts <slug> [neon]`. **Antes de `git push`:**
`npx tsc --noEmit` **y** `npm run build` con exit 0 real. Deploy: push a `main`
(Vercel despliega solo). Comandos y reglas duras completas: manual abajo, `GENERACION.md`, `PLAYBOOK.md`.

<!-- columna-vertebral: ultima_actualizacion=2026-09-19 commit=c4d4ad4 -->

---

# Informes Interactivos — arranque

Plataforma web (Next.js 15 · Prisma/Postgres · Auth.js v5) que publica informes
técnicos como informes interactivos en línea (leer/visualizar/escuchar/observar)
para revisión ministerial. White-label; proveedor **V&R Ltda.**, mandante
**MTT · SECTRA**. En vivo: https://informe-interactivo.vercel.app

## Lee primero (segundo cerebro del proyecto)

1. **`PROYECTO.md`** — qué es, para qué, estado y **mapa del conocimiento**.
2. **`BASE_DE_CONOCIMIENTO.md`** — catálogo de scripts, arquitectura (`src/`),
   modelo de datos y **lecciones destiladas**. Léelo antes de tocar código o correr un script.
3. **`GENERACION.md`** — para **producir/corregir un informe** (carpeta declarativa
   o paquete V&R, comandos).
4. **`PLAYBOOK.md`** — para **depurar/desplegar**: fases y **tabla de 20 trampas**.

## Reglas duras (las que ya costaron caro)

- **Antes de cada `git push`:** `npx tsc --noEmit` **y** `npm run build` con **exit 0
  REAL** (sin pipe a `head`/`tail`, que enmascara el error). `scripts/*` cuenta para
  el build de Vercel.
- **Base de datos por script:** se elige con el argumento `neon`; leer `DATABASE_URL`
  del archivo y pasarla explícita a `new PrismaClient(...)` (`loadEnvFile` no sobrescribe).
- **Corregir un informe con observaciones:** `generar-informe.ts … --actualizar`
  (el modo CREAR es destructivo: `deleteMany` por slug).
- **Postgres local:** clúster en ruta ASCII (`~/.informes-pgdata`), base UTF-8 desde
  `template0`. Windows/es-CL: `.md` con `-Encoding utf8`; `git commit -m "…"` (no
  here-string dentro de `if {}`).
- Voz de audio: latinoamericana (`ClNifCEVq1smkl4M3aTk`), en toda la app.

## Convenciones del repo paraguas

Este proyecto vive dentro de `Análisis RMG/`; aplican también su `CLAUDE.md` y el
global `~/.claude/CLAUDE.md` (quién es Rodrigo, carpetas de solo lectura, llave
territorial `cut_com`, no inventar datos).
