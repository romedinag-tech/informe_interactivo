# Re-facturacion de audio ElevenLabs del Talca original — columna vertebral de ESTA consulta

> Es la columna vertebral **local**: Claude la lee al entrar a esta carpeta y con eso ya sabe qué se
> preguntó, de qué se alimenta y cómo reproducirlo, sin cargar el motor entero.

## 0. Herencia — el motor manda

Esta consulta **cuelga** del motor Informes Interactivos, no lo reemplaza.

- Columna vertebral del motor: [`../../CLAUDE.md`](../../CLAUDE.md) — convenciones, trampas y
  cadena de cálculo. **Sus reglas rigen acá sin excepción** (privacidad del contenido ministerial,
  build con exit real antes de push, `.md` en UTF-8).
- El motor no tiene `FICHA_DOMINIO.md`: las llaves y trampas del dato están en su `CLAUDE.md` y en
  `../../BASE_DE_CONOCIMIENTO.md`.
- **Esta carpeta es de escritura; el resto del motor es de SOLO LECTURA desde acá.** No se corren sus
  builds, no se tocan sus salidas, no se despliega.
- ⚠ Regla de costo (memoria `no-gastar-creditos-audio`): **no generar audio nuevo en ElevenLabs sin
  autorización explícita de Rodrigo**. El reproductor de esta consulta es DRY-RUN: mide, no genera.

## 1. Qué se preguntó

> «Por que el informe interactivo de Talca vuelve a descargar la narracion y factura en ElevenLabs en cada reproduccion, y como dejarlo cacheado una vez»

**Fecha:** 2026-10-20 · **Territorio:** Talca (prediagnostico-talca) · **Estado:** cerrada

## 2. De qué se alimenta (sólo lectura)

| Archivo / tabla | Qué aporta | Llave |
|---|---|---|
| Neon Postgres · tabla `AudioAsset` | caché de narración (`textHash` único, `voiceId`=esquema, `bytes`, `data`) | `textHash` |
| Neon Postgres · `Report → Chapter → Section → Block` | texto de cada capítulo del que sale la narración | `slug` / `chapterId` |
| `../../src/lib/chapter-text.ts` | `chapterNarrationSegments()`: el texto exacto que se narra | — |
| `../../src/lib/elevenlabs.ts` | `VOICE_SCHEME` y `audioConfig.model`, parte de la clave de caché | — |
| `../../src/lib/pronunciation.ts` | `pronRulesHash()`: la versión del diccionario entra al hash | — |
| `../../.env.production.local` | `DATABASE_URL` de Neon (gitignored) | — |

El endpoint que sirve el audio (`../../src/app/api/reports/[slug]/audio/[chapterId]/route.ts`) calcula
`textHash = sha256(VOICE_SCHEME | model | dictVersion | texto)` y, si existe un `AudioAsset` con esa
clave, lo sirve **sin llamar a ElevenLabs** (HIT). Si no existe (MISS), genera → **factura** → cachea.

## 3. Definiciones propias de esta consulta

- **Universo:** los 3 informes cuyo slug contiene `talca` (`prediagnostico-talca`, `-completo`,
  `-ejecutivo`). Por informe, sólo los **capítulos que el reproductor sirve**: se omiten portada
  («Introducción») e índice («Índice de contenidos»), que el player filtra con `esPortadaOIndice`.
- **HIT / MISS:** un capítulo es **HIT** si existe un `AudioAsset` cuyo `textHash` reproduce el que
  calcula el endpoint con el esquema de voz **actual**. **MISS** = no existe → el endpoint factura al
  reproducir.
- **Punto ciego declarado:** esto mide la **cobertura** del caché, no el gasto histórico. Servir un
  HIT es gratis; sólo un MISS (o un cambio de voz/texto que invalida el hash) gasta créditos.

## 4. Cómo se reproduce

```bash
# desde la RAÍZ del motor (lee .env.production.local de ahí); DRY-RUN, no genera
npx tsx consultas/2026-10_re-facturacion-audio-elevenlabs-talca-original/reproducir.ts neon
```

Mide cobertura HIT/MISS por informe y los `AudioAsset` por esquema de voz. Herramienta hermana del
motor: `../../scripts/limpiar-audio-obsoleto.ts` (dry-run; con `--borrar` limpia un esquema obsoleto).

## 5. Cifras de control

Si al re-ejecutar no salen estas cifras, algo cambió —el dato o el código—: **investigar antes de publicar**.

| Cifra | Valor | Medido el |
|---|---|---|
| `prediagnostico-talca` · capítulos servidos | HIT 13 / MISS 0 | 2026-10-20 |
| `prediagnostico-talca-completo` · servidos | HIT 13 / MISS 0 | 2026-10-20 |
| `prediagnostico-talca-ejecutivo` · servidos | HIT 7 / MISS 0 | 2026-10-20 |
| Esquema de voz vigente (`VOICE_SCHEME`) | `alt-ClNi` (voz LatAm `ClNifCEVq1smkl4M3aTk`) | 2026-10-20 |
| `AudioAsset` del esquema obsoleto `alt-EXAV-JBFq` | 0 (eran 15 / 48 MB, borrados) | 2026-10-20 |

**Hallazgo (causa raíz):** al unificar la voz a LatAm el `VOICE_SCHEME` pasó de `alt-EXAV-JBFq` a
`alt-ClNi`; el Talca original sólo tenía caché del esquema viejo → **MISS 13/13**, y cada reproducción
regeneraba y facturaba. El mecanismo de caché estaba sano (sirve HIT antes de llamar); era falta de
cobertura. **Fix:** `pregenerate-audio.ts prediagnostico-talca neon` (escribe directo a Neon, sin
deploy → la facturación se detuvo al instante) y limpieza del esquema viejo.

## 6. Trampas encontradas acá

- **Cambiar `VOICE_SCHEME` o el texto de narración invalida el `textHash` → re-factura en silencio.**
  El caché viejo no calza y cada play llama a ElevenLabs. Se detecta midiendo HIT/MISS con el esquema
  actual; se sortea pre-generando cada informe existente bajo el esquema nuevo. (Subió al motor:
  `PLAYBOOK.md` trampa #20 y lección #5 de `BASE_DE_CONOCIMIENTO.md`.)
- **El pre-generador gastaba créditos en portada/índice** que el reproductor nunca sirve. Se le agregó
  el mismo filtro `esPortadaOIndice` (subió al motor: `scripts/pregenerate-audio.ts`).

## 7. Pendientes

- [ ] Ninguno bloqueante. Si a futuro se cambia la voz o se limpia el texto de narración, re-correr el
      reproductor y, con autorización de Rodrigo, pre-generar los informes que queden en MISS.
