# Cómo generar un informe nuevo (motor de generación)

Este documento define **cómo entregar la información** para que armar el
**segundo informe** (y los siguientes) sea un solo comando, sin raspar dashboards
ni emparejar a mano.

## Diagnóstico: qué funcionó y qué no en Talca

| Insumo | Cómo se hizo en Talca | Veredicto |
|---|---|---|
| **Texto y estructura** | Word `.docx` (H1=capítulo, H2=sección, pies "Figura X-Y") | ✅ Funciona bien — **se mantiene** |
| **Figuras estáticas** | Imágenes extraídas del `.docx`, emparejadas por número de pie | ✅ Funciona — se mantiene |
| **Gráficos interactivos** | Raspar JSON embebido de un dashboard HTML de 17 MB | ❌ Frágil, bespoke |
| **Mapas** | Raspar GeoJSON del mismo HTML + adivinar el indicador por palabra clave | ❌ Frágil (duplicó un mapa, eligió mal la variable) |

**Conclusión:** no me entregues el dashboard. Entrégame los **datos de cada gráfico
y mapa como archivos declarativos**, identificados por el **número de figura** que
ya usas en los pies del Word. Ese número es la llave universal.

## La carpeta de entrega

```
mi-informe/
  informe.json          Metadatos: título, subtítulo, slug, glosario, resumen ejecutivo
  informe.docx          El texto. H1=capítulo, H2=sección. Cada figura con su pie "Figura X-Y."
  graficos.json         Un objeto por gráfico interactivo (ver esquema abajo)
  mapas.json            Un objeto por mapa navegable
  geo/                  Los .geojson que referencia mapas.json
  figuras/              figura-3-4.png, figura-4-1.png, …  (imágenes estáticas por número)
```

Todo lo que NO tenga gráfico/mapa/imagen asociado queda como texto. Cada figura
del Word se resuelve por su número: si hay `grafico` con ese número → gráfico
interactivo; si hay `mapa` → mapa; si hay `figuras/figura-N.png` → imagen; si no,
placeholder.

Generar el informe = **un comando**:

```bash
npx tsx scripts/generar-informe.ts mi-informe          # a la base local
npx tsx scripts/generar-informe.ts mi-informe neon     # a producción (Neon)
```

---

## `informe.json`

```json
{
  "slug": "prediagnostico-curico",
  "title": "Síntesis de Prediagnóstico — Curicó",
  "subtitle": "Diagnóstico territorial y de movilidad para el Plan Maestro",
  "execSummary": "Texto del resumen ejecutivo (~1 min) para la portada…",
  "glosario": [
    { "term": "IMIV", "definition": "Informe de Mitigación de Impacto Vial…", "source": "Ley 20.958", "pronunciation": "ímiv" }
  ]
}
```

## `graficos.json` — gráficos interactivos

Un arreglo. **`numero`** es el número del pie ("Figura 9-1" → `"9-1"`). Este es
**exactamente** el formato que el visor dibuja (Recharts nativo). Sale directo de
Excel/pandas: encabezados = `labels`, columnas = `series`.

```json
[
  {
    "numero": "9-1",
    "tipo": "dona",                     // dona | barras | barras_h | barras_apiladas | linea | barras_linea
    "titulo": "Partición modal del área",
    "unidad": "%",                       // opcional, se muestra en el tooltip
    "fuente": "EOD 2022; elaboración propia",
    "labels": ["Auto", "Transporte público", "Caminata", "Bicicleta"],
    "data": [49.6, 22.9, 20.6, 5.7]      // 1 serie: usa "data"
  },
  {
    "numero": "9-2",
    "tipo": "barras_apiladas",
    "titulo": "Partición modal según quintil",
    "unidad": "%",
    "labels": ["Q1", "Q2", "Q3", "Q4", "Q5"],
    "series": [                          // varias series: usa "series"
      { "label": "Auto", "data": [20, 35, 48, 60, 72] },
      { "label": "TP",   "data": [45, 38, 30, 22, 15] },
      { "label": "No motorizado", "data": [35, 27, 22, 18, 13] }
    ]
  },
  {
    "numero": "8-1",
    "tipo": "barras_linea",             // eje doble: barra + línea
    "titulo": "Demanda hora a hora",
    "eje_izq": "Viajes", "eje_der": "% acumulado",
    "labels": ["6","7","8","9","10"],
    "serie_barra": { "label": "Viajes",  "data": [500, 1200, 3100, 2200, 1400] },
    "serie_linea": { "label": "% acum.", "data": [6, 20, 55, 78, 90] }
  }
]
```

Reglas: `dona` y `barras` (1 serie) usan `data`. `barras_h`, `barras_apiladas`,
`linea` usan `series`. `barras_linea` usa `serie_barra` + `serie_linea`.

> **Alternativa CSV (planilla):** en vez de escribir `graficos.json` a mano, deja
> un CSV por gráfico en `graficos/grafico-<numero>.csv` y un `graficos-meta.json`
> con el tipo/título de cada uno; luego corre `node scripts/csv-a-graficos.mjs <carpeta>`
> y genera el `graficos.json`. Detecta separador (`;`, `,` o tab) y decimales con
> coma (formato Excel es-CL). El CSV: 1ª fila = encabezado (1ª celda categoría,
> resto = nombres de series), filas siguientes = etiqueta + valores. Con 2 columnas
> es 1 serie (dona/barras); con más, varias series (apiladas/línea).
>
> ```
> # grafico-9-1.csv (dona)        # grafico-9-2.csv (apiladas)
> categoria;valor                 quintil;Auto;TP;No motorizado
> Auto;49,6                        Q1;20;45;35
> TP;22,9                          Q2;35;38;27
> ```
> ```json
> // graficos-meta.json
> { "9-1": { "tipo": "dona", "titulo": "Partición modal", "unidad": "%" },
>   "9-2": { "tipo": "barras_apiladas", "titulo": "Partición por quintil", "unidad": "%" } }
> ```

## `mapas.json` — mapas navegables (coropletas + capas de puntos)

Un arreglo. El GeoJSON de zonas lleva los **indicadores como propiedades** de cada
feature. Tú declaras cuáles mostrar, su etiqueta, unidad y escala de color.

```json
[
  {
    "numero": "11-2",
    "titulo": "Siniestralidad",
    "geojson": "geo/zonas.geojson",     // FeatureCollection; cada feature.properties trae los campos
    "indicadores": [
      { "campo": "gen",  "label": "Viajes generados", "unidad": "viajes", "escala": "seq" },
      { "campo": "atr_neta", "label": "Balance atracción−generación", "unidad": "%", "escala": "div" }
    ],
    "indicadorDefecto": "gen",
    "capasPunto": [                      // opcional: puntos sobre la coropleta
      { "archivo": "geo/siniestros.geojson", "label": "Siniestros" },
      { "archivo": "geo/colegios.geojson",   "label": "Colegios" }
    ]
  }
]
```

`escala`: `seq` (secuencial, 1 variable) o `div` (divergente, en torno a 0). El
fondo es satelital (Esri). Los valores `0` de una variable muy sesgada a cero se
tratan como clase propia automáticamente (no aplastan la leyenda).

## `figuras/` — imágenes estáticas

Un PNG por figura, nombrado por número: `figuras/figura-3-4.png`. El motor las
recomprime (redimensiona a 1600px; PNG line-art, JPEG fotográfico) y las sirve por
ruta autenticada. No hace falta que estén en el `.docx`.

---

## Qué hace el motor (`generar-informe.ts`)

1. Lee `informe.json` (crea/reemplaza el informe + glosario + resumen ejecutivo).
2. Importa `informe.docx` → capítulos/secciones/bloques.
3. Por cada figura (placeholder), lee su número de pie y resuelve:
   `graficos.json` → gráfico · `mapas.json` → mapa · `figuras/figura-N.png` → imagen.
4. Crea la **versión base 1.0** (snapshot) para el diff futuro.
5. Deja el informe listo. El **audio** se pre-genera aparte (cuesta créditos):
   `node scripts/pregenerate-audio.mjs <slug> [neon]`.

Determinista y reutilizable para cualquier ciudad. Cero raspado de dashboards.

---

## Corregir y re-subir un informe existente (nueva versión)

Cuando ya hay observaciones y quieres subir una **corrección** del mismo estudio,
**NO** uses el modo crear (borraría el informe y sus observaciones). Usa:

```bash
npx tsx scripts/generar-informe.ts <carpeta> [neon] --actualizar
```

Qué hace `--actualizar`:

1. Actualiza el contenido **en su lugar** (empareja por posición capítulo/sección/
   bloque y conserva el `blockId`) → **las observaciones sobreviven**.
2. **Nunca borra un bloque que tenga observaciones** (si el nuevo documento lo
   quita, lo conserva).
3. Re-resuelve gráficos/mapas/figuras por número (toma tus `graficos.json` etc.
   actualizados).
4. **Registra una versión nueva** (2.0, 3.0…): snapshot + **re-ancla** todas las
   observaciones y marca las **huérfanas** (las que su texto ancla ya no existe).
   Verás el diff en `/reports/<slug>/versiones`.
5. Regenera **solo el audio de los capítulos que cambiaron**:
   `node scripts/pregenerate-audio.mjs <slug> [neon]` (los demás quedan HIT, sin re-gasto).

⚠️ **Cuidados:**
- El emparejamiento es **por posición**. Correcciones de *contenido* (arreglar
  texto, cambiar un número, reemplazar un gráfico) preservan todo. Si **reordenas o
  insertas capítulos/secciones enteros** en medio, algunas observaciones pueden
  quedar **huérfanas** (no se pierden: quedan marcadas "Ancla perdida" en el panel).
  Para reestructuraciones grandes, conviene editar en el **editor web** (que también
  registra versión) en vez de re-subir el docx.
- Mantén el mismo **slug** en `informe.json` (así sabe qué informe actualizar).
- Corre `npm run build` antes del push si tocaste código (no hace falta si solo
  cambian datos).

**Alternativa sin re-subir docx:** editar en `/reports/<slug>/editar` y pulsar
**"Registrar nueva versión"** en `/reports/<slug>/versiones` — hace lo mismo
(snapshot + re-anclaje + versión) sobre los cambios hechos en la UI.
