# Re-facturacion de audio ElevenLabs del Talca original

- **Fecha:** 2026-10
- **Pedido:** Por qué el informe interactivo de Talca vuelve a descargar la narración y factura en ElevenLabs en cada reproducción, y cómo dejarlo cacheado una vez.
- **Territorio / unidad:** los 3 informes de Talca en producción (`prediagnostico-talca`, `-completo`, `-ejecutivo`).
- **Fuente(s):** base Neon Postgres del motor (tablas `AudioAsset`, `Report/Chapter/Section/Block`) + las funciones de narración de `src/lib` (`chapter-text`, `elevenlabs`, `pronunciation`).

## Qué se entregó
- Diagnóstico de la causa raíz y corrección (ya aplicada en producción esta sesión).
- `reproducir.ts`: reproductor DRY-RUN de la cobertura HIT/MISS por informe.
- Dos aprendizajes subidos al motor: `PLAYBOOK.md` trampa #20 y filtro portada/índice en `pregenerate-audio.ts`.

## Datos reutilizables (`datos/`)
- (sin datos materializados: la consulta mide sobre la base en vivo; el reproductor es la salida)

## Cómo reproducir
- Desde la raíz del motor: `npx tsx consultas/2026-10_re-facturacion-audio-elevenlabs-talca-original/reproducir.ts neon`

## Hallazgos principales
- **Causa:** al unificar la voz a latinoamericana, `VOICE_SCHEME` cambió (`alt-EXAV-JBFq` → `alt-ClNi`); el Talca original sólo tenía caché del esquema viejo → **MISS 13/13**, y cada reproducción regeneraba y **facturaba**.
- **No era bug del caché:** el endpoint sirve HIT antes de llamar a ElevenLabs; era falta de cobertura del esquema nuevo.
- **Fix:** pre-generar el informe bajo el esquema actual (escribe directo a Neon, sin deploy) → quedó **HIT 13/13**; los otros dos ya estaban completos (13/13 y 7/7).
- **Limpieza:** 48 MB / 15 filas del esquema obsoleto `alt-EXAV-JBFq` borradas de Neon (0 restantes).

## Advertencias del dato
- La cobertura HIT/MISS mide el estado del caché, **no** el gasto histórico de créditos.
- **Cambiar la voz o el texto de narración invalida el hash** y vuelve a dejar los informes en MISS: hay que re-medir y, con autorización, re-pre-generar.
- Regla de costo vigente: no generar audio nuevo sin autorización explícita (memoria `no-gastar-creditos-audio`).

> Este README es para **leer**. La columna vertebral de la consulta —de qué se alimenta, definiciones
> propias, cómo se reproduce y cifras de control— va en su `CLAUDE.md`. Los dos son obligatorios.
