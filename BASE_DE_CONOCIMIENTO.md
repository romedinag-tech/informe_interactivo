# BASE DE CONOCIMIENTO — Informes Interactivos

> **La capa "destilada" del segundo cerebro.** Todo lo aprendido —scripts,
> arquitectura, modelo de datos y lecciones— en una referencia única, para no
> volver a redescubrirlo. Cuando esto contradiga al código, gana el código
> (verificar antes de afirmar). Para el *contexto* del proyecto → `PROYECTO.md`;
> para *producir un informe* → `GENERACION.md`; para *depurar/desplegar y la tabla
> completa de trampas* → `PLAYBOOK.md`.

Última consolidación: 2026-09-02.

---

## 1. Arquitectura en una página

App **Next.js 15 (App Router) + React 19 + TypeScript**, base **PostgreSQL vía
Prisma**, auth **Auth.js v5** (Credentials + JWT con rol). Publica informes
técnicos como "libro digital" con narración (ElevenLabs por `fetch`), mapas
Leaflet, gráficos Recharts, observaciones ancladas (W3C), versionado por snapshots
y control de acceso por informe (RBAC).

- **Local (sin Docker):** PostgreSQL **embebido** (`embedded-postgres`) vía
  `npm run db:local`. Clúster en `~/.informes-pgdata` (ruta **ASCII** obligatoria) y
  base `informes` en **UTF-8** desde `template0`. Config en `.env`.
- **Producción:** **Neon** (Postgres, São Paulo) + **Vercel** (auto-deploy en cada
  push a `main`). Config en `.env.production.local` (gitignored).
- **Regla transversal de scripts:** cada script decide la base por el argumento
  `neon`; **lee `DATABASE_URL` del archivo y la pasa explícita** a
  `new PrismaClient({ datasources: { db: { url } } })`, porque
  `process.loadEnvFile` **no** sobrescribe variables ya definidas (trampa #6).

**Flujo de un informe:** carpeta declarativa / paquete V&R → `generar-informe.ts`
(o `generar-paquete.ts`) → estructura en BD (Capítulos/Secciones/Bloques) + figuras
(gráfico interactivo · mapa navegable · imagen estática) + glosario + resumen +
versión 1.0 → `pregenerate-audio.ts` (+ `pregenerate-intro.ts`) → `npm run build`
→ `git push` (Vercel despliega) → habilitar acceso en `/admin`.

---

## 2. Catálogo de scripts (`scripts/`)

### Motores de generación

| Script | Qué hace | Comando |
|---|---|---|
| **`generar-informe.ts`** | Motor **canónico**. Arma/actualiza un informe desde carpeta declarativa (`informe.json` + `informe.docx` + `graficos.json` + `mapas.json` + `geo/` + `figuras/`). Resuelve cada figura por su pie "Figura X-Y": gráfico · mapa (`MapAsset`) · imagen (`FigureAsset`, optimiza con **sharp**). Crea versión base 1.0. Con `--actualizar` corrige en su lugar (preserva `blockId`/observaciones, registra versión + re-ancla). | `npx tsx scripts/generar-informe.ts <carpeta> [neon]` · `… [neon] --actualizar` |
| **`generar-paquete.ts`** | Ingesta del **paquete de entrega V&R** (`.docx` + `datos/` + `secciones_relato.json`). Empareja figuras por **ORDEN** (no por pie), crea `MapAsset` compartido de 22 variables + capas de puntos, extrae imágenes del docx (mammoth). Rutas hardcodeadas al paquete de Talca. | `npx tsx scripts/generar-paquete.ts <completo\|ejecutivo> <slug> [neon]` |
| **`import-talca.ts`** | Importa el Talca **original** (`Sintesis_Prediagnostico_Talca.docx`) con glosario embebido → slug fijo `prediagnostico-talca`. Legado; referencia intacta. | `npx tsx scripts/import-talca.ts` (solo local) |

### Audio (ElevenLabs)

| Script | Qué hace | Comando |
|---|---|---|
| **`pregenerate-audio.ts`** | Pre-genera y cachea en `AudioAsset` el audio de todos los capítulos usando **las funciones reales del servidor** (mismo hash → HIT). Solo genera lo nuevo/cambiado. Crea/reutiliza el diccionario de pronunciación. | `npx tsx scripts/pregenerate-audio.ts <slug> [neon]` |
| **`pregenerate-intro.ts`** | Pre-genera el audio del **resumen ejecutivo** (portada) con marcas de tiempo por carácter (resaltado sincronizado). Voz `ELEVENLABS_INTRO_VOICE_ID`. | `npx tsx scripts/pregenerate-intro.ts <slug> [neon]` |

Requieren `ELEVENLABS_API_KEY`. El caché es durable: no re-gasta créditos tras redeploy.

### Colocación de figuras/mapas — **legado del flujo "raspado" de Talca**

> Se conservan por el Talca original. Para informes nuevos **no se usan**: el motor
> resuelve todo. `sharp`, `mammoth` y `node-html-parser` de por medio.

| Script | Qué hace | Comando |
|---|---|---|
| **`place-figures.mjs`** | Extrae imágenes del docx de Talca → `FigureAsset`, emparejadas por pie. | `node scripts/place-figures.mjs [neon]` |
| **`place-dashboard-charts.mjs`** | Extrae gráficos (JSON embebido) del dashboard HTML → CHART interactivos por keyword. Idempotente. | `node scripts/place-dashboard-charts.mjs [neon]` |
| **`place-map.mjs`** | Extrae el mapa "Explorador territorial" del dashboard → `MapAsset` (key `explorador`). | `node scripts/place-map.mjs [neon]` |
| **`place-thematic-maps.mjs`** | Agrega capas de puntos (siniestros/colegios) y resuelve placeholders de mapa por regex del pie. | `node scripts/place-thematic-maps.mjs [neon]` |
| **`reclaim-figure.mjs`** | Fuerza que una figura vuelva a imagen estática (cuando el auto-emparejamiento la volvió mapa por error). | `node scripts/reclaim-figure.mjs <figKey> [neon]` |

### Datos / mantenimiento

| Script | Qué hace | Comando |
|---|---|---|
| **`csv-a-graficos.mjs`** | Convierte CSVs (`graficos/grafico-<n>.csv` + `graficos-meta.json`) → `graficos.json`. Autodetecta separador y decimales con coma (es-CL). No toca BD. | `node scripts/csv-a-graficos.mjs <carpeta>` |
| **`set-exec-summary.mjs`** | Fija el resumen ejecutivo (borrador) de Talca. | `node scripts/set-exec-summary.mjs [neon]` |
| **`set-pronunciations.mjs`** | Actualiza pronunciaciones del glosario de Talca e invalida el hash del diccionario. | `node scripts/set-pronunciations.mjs [neon]` |
| **`create-baseline-version.mjs`** | Crea la versión base 1.0 (snapshot) si no existe. | `node scripts/create-baseline-version.mjs [neon]` |
| **`limpiar-audio-obsoleto.ts`** | Borra el audio cacheado de un esquema de voz obsoleto (tras cambiar la voz, las grabaciones viejas ya no calzan). Por defecto **dry-run**; borra solo con `--borrar`. | `npx tsx scripts/limpiar-audio-obsoleto.ts [neon] [esquema] [--borrar]` |

### Infraestructura

| Script | Qué hace | Comando |
|---|---|---|
| **`pg.mjs`** | Levanta PostgreSQL embebido (`~/.informes-pgdata`, UTF-8 desde `template0`) y lo mantiene vivo. Es `npm run db:local`. | `node scripts/pg.mjs` |
| **`migrate-neon.mjs`** | Migra a Neon: `prisma db push` → seed → `import-talca`. Lee URL de `.env.production.local`. | `node scripts/migrate-neon.mjs` |
| **`prep-brand-assets.mjs`** | Prepara `/public/brand` (isotipo/icon/lockup): fondo blanco → transparente por flood-fill desde bordes, con **sharp**. | `node scripts/prep-brand-assets.mjs` |

---

## 3. Arquitectura de `src/`

### `src/lib/` — dominio

| Módulo | Propósito |
|---|---|
| `db.ts` | Cliente Prisma singleton (evita conexiones múltiples en dev). |
| `auth.ts` | NextAuth v5 **runtime Node**: Credentials + bcrypt + Prisma + Zod; exporta `handlers/signIn/signOut/auth`. |
| `auth.config.ts` | Config **Edge-safe** (sin Prisma) para el middleware; JWT con `role`/`uid`. |
| `rbac.ts` | Autorización server-side: `currentUser`/`requireUser`/`requireRole`, `getReportAccess` (exige `ReportAssignment`; sin ella no hay acceso salvo ADMIN). |
| `audit.ts` | `logAudit(...)` append-only en `AuditEvent`; nunca interrumpe la operación si falla. |
| `brand.ts` | White-label: única fuente de identidad (nombre, logos, co-brand, legal, hero) + `pickLogo(slot,theme)`. |
| `voices.ts` | Catálogo de voces (hoy una LatAm `ClNifCEVq1smkl4M3aTk`) + `DEFAULT_VOICE_ID`. Seguro en cliente. |
| `elevenlabs.ts` | TTS por `fetch`: `synthesizeSpeech`, `synthesizeWithTimestamps`, `synthesizeAlternating` (concurrencia limitada), `createPronunciationDictionary`, `VOICE_SCHEME`. |
| `chapter-text.ts` | Texto a narrar por capítulo: limpia símbolos (→ — × ≤…), normaliza títulos MAYÚSCULA, omite tablas crudas. `chapterNarrationSegments`. |
| `pronunciation.ts` | `buildPronRules` (alias desde glosario) + `pronRulesHash` (cachea el diccionario). |
| `docx.ts` | Parser Word→estructura (**mammoth** + **node-html-parser**): h1→Cap, h2→Sección, h3-6→HEADING, p→PARAGRAPH, table→TABLE, ul/ol→viñetas, img→IMAGE placeholder. |
| `anchor.ts` | Re-anclaje W3C con cascada: posición → cita (prefix/suffix) → normalizada → núcleo difuso → huérfana. Puro. |
| `snapshot.ts` | `buildSnapshot`, `diffSnapshots` (por `blockId`), `wordDiff` (LCS) para el visor de versiones. |
| `version.ts` | `APP_VERSION` ("2.0") + `buildId()` (commit de Vercel). |

### `src/app/` — rutas

**Páginas (`(app)/`):** `reports` (listado por asignación) · `reports/importar` (importar docx) · `reports/[slug]` (**visor**: hero, TOC scrollspy, búsqueda, glosario, watermark, `AudioPlayer`) · `reports/[slug]/editar` (**editor**, consultor) · `reports/[slug]/observaciones` (**consolidador** + `ReviewToolbar` + `AuditTrail`) · `reports/[slug]/versiones` (historial + diff) · `admin` (accesos) · `instrucciones` · `login`.

**Server Actions (`app/actions/`):** `annotations.ts` (CRUD observaciones, responder, estado/severidad, veredicto) · `reports.ts` (`importDocx`, editar/mover/borrar bloque, `convertImageToChart`, status; respeta secciones bloqueadas) · `versions.ts` (`publishNewVersion` = snapshot + re-anclaje + huérfanas; `setSectionLocked`) · `admin.ts` (asignar/crear usuarios, bcrypt). Todas con RBAC + audit.

**API routes (`app/api/`):** `auth/[...nextauth]` · `reports/[slug]/audio/[chapterId]` (narración cacheada, `maxDuration=60`, fallback voz navegador) · `reports/[slug]/intro-audio` · `reports/[slug]/map/[key]` (geodata diferida) · `reports/[slug]/figure/[blockId]` (bytes de figura). Todas validan acceso.

**`middleware.ts`:** Auth.js Edge-safe; protege todo salvo `/login`, `/api/auth`, `_next`, favicon.

### `src/components/`

`report/` (`ReportViewer`, `DashboardChart`, `TerritorialMap`, `PublishVersionButton`) · `viewer/` (`AudioPlayer`, `TableOfContents`, `DocSearch`, `ReadingProgress`, `ThemeToggle`, `GlossaryTooltip`, `HeroCover`, `DraftWatermark`) · `annotations/` (`ObservationPanel`, `ReviewToolbar`, `VoiceInput` = dictado Web Speech, `AuditTrail`) · `editor/` (`ReportEditor`, `ChartForm`) · `admin/` (`AdminAccess`) · `brand/` (`BrandMark`) · raíz (`AppHeader`, `AppFooter`, `SubmitButton`).

---

## 4. Modelo de datos (`prisma/schema.prisma`)

Enums: `Role` (ADMIN/CONSULTOR/REVISOR) · `ReportStatus` · `BlockType` · `AnnotationStatus` · `AnnotationSeverity` · `ReviewVerdict`.

```
User ──< ReportAssignment >── Report ──< Chapter ──< Section ──< Block ──< Annotation ──< AnnotationReply
                                 ├─ GlossaryTerm   (término, pronunciación)
                                 ├─ MapAsset       (key, data Json — geodata diferida)
                                 ├─ FigureAsset    (blockId único, data Bytes — imagen)
                                 ├─ AudioAsset     (textHash único, data Bytes, alignment Json)
                                 ├─ ReportVersion  (number, snapshot Json inmutable)
                                 └─ AuditEvent     (append-only, actor desnormalizado)
```

Claves: `Block.anchorKey` estable (anclaje). `Annotation` ancla a `Block` + fino opcional (`quote/prefix/suffix/rangeStart/rangeEnd`) + `status/severity/orphaned`. `ReportAssignment` único `[reportId,userId]` = control de acceso. `AudioAsset.textHash` = `sha256(VOICE_SCHEME|model|dictVersion|texto)`. `generator` con `binaryTargets = ["native","rhel-openssl-3.0.x"]` (Vercel).

`prisma/seed.ts`: usuarios demo `consultor@ / revisor@ / admin@demo.cl` (clave `demo1234`) + acceso a Talca.

---

## 5. `package.json` — lo esencial

**Scripts npm:** `dev` · `build` (`prisma generate && next build`) · `start` · `lint` · `db:local` · `db:generate` · `db:migrate` · `db:push` · `db:seed` (`tsx prisma/seed.ts`) · `db:studio`.

**Deps clave:** `next ^15.5` · `react 19` · `next-auth 5.0.0-beta.25` · `@prisma/client`/`prisma ^6.2` · `bcryptjs` · `zod` · `recharts ^2.15` · `leaflet ^1.9.4` · `mammoth ^1.12` · `node-html-parser` · `nanoid`. **Dev:** `tsx`, `tailwindcss ^3.4` + typography, `embedded-postgres ^18.4`.

**⚠️ Ausencias que hay que recordar (fiel al repo):**
- **`sharp` NO está declarado** en `package.json`, pero **se importa en 5 scripts** (`generar-informe.ts`, `generar-paquete.ts`, `place-figures.mjs`, `prep-brand-assets.mjs`, `reclaim-figure.mjs`). Funciona porque está resuelto en el entorno; si se limpia `node_modules` o se corre en otra máquina, **hay que instalarlo** (`npm i sharp`) o declararlo.
- **No hay librería `docx`** en la app: la exportación a Word del consolidado de observaciones es un **Blob HTML `application/msword`** en el cliente (`ReviewToolbar`), y el PDF es `window.print()` con CSS de impresión. *(La oferta técnica en `.docx` real se generó aparte, con `docx-js` fuera del proyecto.)*
- **No hay SDK de ElevenLabs:** todo por `fetch` en `elevenlabs.ts`.

---

## 6. Lecciones destiladas (principios que ya nos costaron)

Estos son los aprendizajes convertidos en regla. La **tabla completa de 19 trampas
con síntoma/causa/solución está en `PLAYBOOK.md`**; aquí van los principios madre:

1. **Verificar el build de verdad antes de cada push.** `npx tsc --noEmit` **y**
   `npm run build`, con **exit 0 REAL**. Nunca leer `$?` tras un pipe a `head`/`tail`
   (enmascara el error). `scripts/*.ts|.mjs` **cuentan** para `next build` → un error
   ahí tumba el deploy de Vercel. (Regla dura; memoria `verificar-build-antes-de-push`.)
2. **La base de un script se elige explícitamente.** Leer `DATABASE_URL` del archivo
   y pasarla a `new PrismaClient(...)`; `loadEnvFile` no sobrescribe. Un descuido
   escribe en la base equivocada.
3. **Rutas ASCII + UTF-8 para Postgres local.** El clúster va fuera del proyecto
   (la carpeta con "Análisis" rompe `initdb`); la base se crea UTF-8 desde `template0`
   (el locale 1252 no admite `→`).
4. **Corregir ≠ recrear.** El modo CREAR hace `deleteMany` por slug (destruye
   observaciones/versiones/audio). Para corregir un informe con observaciones, **usar
   `--actualizar`** (preserva `blockId`, versiona, re-ancla). Reestructuras grandes:
   mejor por el editor web (el emparejamiento por posición deja huérfanas, marcadas no perdidas).
5. **Audio: cachear duro y no re-gastar.** Guardar el MP3 en `AudioAsset` (no en
   disco efímero de serverless); el hash incluye voz+modelo+dict; limitar concurrencia
   (429); pre-generar con **las funciones reales del servidor** (si el pre-generador
   duplica la lógica, el hash se desincroniza y todo da MISS). **Cambiar la voz
   (`VOICE_SCHEME`) o limpiar el texto de narración cambia el hash → el caché viejo
   deja de calzar y cada reproducción RE-FACTURA** (le pasó al Talca original al pasar
   a voz LatAm): hay que **pre-generar cada informe existente** bajo el esquema nuevo
   (escribe directo a la base, sin deploy) y limpiar el caché obsoleto con
   `limpiar-audio-obsoleto.ts`. El pre-generador **omite portada/índice** (mismo filtro
   que el reproductor, `esPortadaOIndice`) para no gastar créditos en audio que nadie oye.
6. **Auth.js dividido.** `auth.config.ts` Edge-safe para el middleware (Prisma no corre
   en Edge) + `auth.ts` Node. `useSearchParams()` en prod exige `<Suspense>`.
7. **Acceso por asignación explícita.** `getReportAccess` no cae al rol global: sin
   `ReportAssignment` no hay acceso (salvo ADMIN), ni por URL directa.
8. **Figuras nítidas.** PNG hasta ~2000px; JPEG (q90) **solo** para fotográficas/satélite
   pesadas (>2.5MB). JPEG en line-art/texto emborrona. Cuidar el límite ~4.5MB de
   respuesta serverless de Vercel.
9. **Criterio de figuras del usuario:** MAPAS → interactivos (satélite Esri);
   GRÁFICOS tipo histograma → estáticos (por ahora).
10. **Voz:** acento **latinoamericano** en toda la app (`ClNifCEVq1smkl4M3aTk`), no España.
11. **PowerShell/es-CL:** here-string `@'…'@` para `git commit` no va dentro de `if {}`
    (usar `-m "…"`); no leer/reescribir `.md` con `Get-Content`/`Set-Content` sin `-Encoding utf8`.

---

## 7. Índice de la documentación (no duplicar — apuntar)

| Archivo | Para qué |
|---|---|
| `PROYECTO.md` | Contexto, estado y **mapa del conocimiento** (el segundo cerebro). |
| `GENERACION.md` | **Contrato de entrada** de un informe: carpeta declarativa, esquemas `graficos.json`/`mapas.json`, paquete V&R, modo `--actualizar`. |
| `PLAYBOOK.md` | Historia del proceso (fases 0-9), **tabla de 19 trampas**, regla de build antes de push. |
| `README.md` | Puesta en marcha, credenciales demo, arquitectura. |
| `BACKLOG.md` | Mejoras hechas/pendientes. |
| `estandar del informe.md` · `insumos de partida.md` · `audio al informe.md` · `mejora grafica.txt` | Notas de insumos y estándares originales del usuario. |

### Pendientes conocidos (refinamiento, no bloquean)

Anclaje divergente `div0`/`div1` exacto en mapas · ciclovías interactiva (falta el
GeoJSON) · 2ª voz LatAm para alternancia M/F · UI del toggle de bloqueo de sección
en el editor · PDF fiel con encabezado/pie institucional (hoy print CSS) · declarar
`sharp` en `package.json`.
