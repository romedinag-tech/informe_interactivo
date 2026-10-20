# Consultas y análisis puntuales — Informes Interactivos

Esta carpeta guarda, ordenados, los **análisis puntuales** que se hacen sobre las bases de datos de
este motor y que **no forman parte de su producto principal** (su tablero o su pipeline). Cada
consulta es autocontenida: sus datos, figuras, informe y scripts viven en su propia subcarpeta.

Se crean y se cierran con la skill `consulta-motor`
(`~/.claude/skills/consulta-motor/scripts/nueva_consulta.py`).

## Las tres reglas

1. **El motor manda.** Las convenciones y trampas del `CLAUDE.md` del motor rigen dentro de toda
   consulta, sin excepción.
2. **La consulta escribe sólo en su carpeta.** El resto del motor es de sólo lectura desde ella.
3. **La complejidad se queda abajo.** Sólo sube al motor una trampa del dato o un indicador
   reutilizable, y por decisión explícita.

## Convención

```
consultas/AAAA-MM_tema-corto/
├── CLAUDE.md ....... columna vertebral de la consulta (obligatoria)
├── README.md ....... qué se pidió y qué se entregó (obligatorio)
├── datos/ · figuras/
└── <script>.py ..... el que la reproduce
```

## Índice de consultas

| Fecha | Carpeta | Tema | Entregables | Estado |
|---|---|---|---|---|
| 2026-10 | `2026-10_re-facturacion-audio-elevenlabs-talca-original/` | Re-facturacion de audio ElevenLabs del Talca original | Diagnóstico + fix (HIT 13/13, 0 MISS); `reproducir.ts`; limpieza 48 MB; aprendizajes al motor (PLAYBOOK #20) | Cerrada |

> Al cerrar una consulta: cifras de control completas en su `CLAUDE.md`, el script que la reproduce en
> su carpeta, esta fila actualizada, y **una línea** de puntero en el `CLAUDE.md` del motor.
