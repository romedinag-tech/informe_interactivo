# Plantilla de informe

Copia esta carpeta, renómbrala (p. ej. `curico/`) y rellena los archivos. Luego:

```bash
npx tsx scripts/generar-informe.ts curico          # a la base local
npx tsx scripts/generar-informe.ts curico neon     # a producción
```

Archivos:

- **`informe.json`** — metadatos, glosario y resumen ejecutivo. *(rellenar)*
- **`informe.docx`** — el texto del informe. H1 = capítulo, H2 = sección; cada
  figura con su pie `Figura X-Y.` *(faltante: pégalo aquí)*
- **`graficos.json`** — un objeto por gráfico interactivo, con el número de figura.
- **`mapas.json`** — un objeto por mapa navegable.
- **`geo/`** — los `.geojson` que referencia `mapas.json`. *(crear)*
- **`figuras/`** — `figura-3-4.png`, etc. (imágenes estáticas por número). *(crear)*

El **número de figura** del pie del Word es la llave: así se coloca cada gráfico,
mapa o imagen en su lugar exacto. Detalle completo en `../GENERACION.md`.
