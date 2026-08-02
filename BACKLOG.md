# Backlog de mejoras — Plataforma de informes interactivos

Estado tras la sesión autónoma. ✅ hecho · ⏳ pendiente · esfuerzo: 🟢🟡🔴.

---

## Hecho ✅

- ✅ **Rediseño visual premium** (`mejora grafica.txt`): tipografía Inter + Source
  Serif 4, tokens sobrios (papel gris, tarjetas blancas, sombras suaves, radios
  14px, acento azul marino) para claro/oscuro/sepia.
- ✅ **Cabecera compacta**: un solo título centrado + emblema de Talca (Andes+río).
- ✅ **Colores sobrios por sección** (acento por capítulo como guía de navegación).
- ✅ **TOC**: indicador de activo, **selector de niveles N1/N2**, hover despliega el
  título completo, más espaciado.
- ✅ **Audio**: selector de capítulos, **voz femenina/masculina** (acento neutro),
  **velocidad 1×/1.5×/2×**, **auto-scroll desactivable**.
- ✅ **Pronunciación de siglas** desde el glosario (IMIV, SECTRA, TMDA… y V&R Ltda).
- ✅ **Enviar al consultor** (revisor) con confirmación + reabrir; el consultor ve el
  estado de envío de cada revisor.
- ✅ **Exportar consolidado** de observaciones a **Word (.doc)** y **PDF (imprimir)**.
- ✅ **Instrucciones de uso** (`/instrucciones`) con enlace en la cabecera.
- ✅ **Glosario: V&R Ltda** agregado (definición a confirmar por Rodrigo).
- ✅ **Placeholders de figura** rediseñados (aspecto intencional, no cajas básicas).
- ✅ **Gráficos interactivos del dashboard** (12): se extrajeron los datos agregados
  del JSON embebido en `Dashboard_Diagnostico_Talca.html` y se recrearon como
  componentes **Recharts nativos** (`DashboardChart`) con el estilo de la página,
  colocados en su capítulo (`scripts/place-dashboard-charts.mjs`).
- ✅ **Audio**: guardado permanente en base (no se regenera/no re-gasta) + voces
  **alternadas** mujer/hombre (sin selector).

## Pendiente ⏳

- ✅ **Observaciones editables**: botones **Editar** y **Eliminar** en el panel de
  observaciones (autor edita/elimina las suyas; el consultor puede eliminar).
- ✅ **Mapas temáticos**: los 10 placeholders de mapa ahora son el explorador con su
  indicador (densificación, NSE, balance, caminata, bici…) + capas de puntos
  (siniestros muestreados, colegios). Carga diferida al acercarse a la vista.
- ✅ **Editar/eliminar observaciones desde el lector** (panel lateral), no solo desde
  el botón superior.
- 🟡 **Figuras estáticas restantes (~26)**: son imágenes del Word (histogramas, etc.)
  cuya imagen se descartó al importar. Para mostrarlas hay que **re-extraer las
  imágenes del `.docx`** (mammoth con imágenes) y guardarlas como assets.
- 🟢 **Documento congelado adjunto al envío** (opcional): hoy el consultor ve las
  observaciones y descarga el Word en la plataforma; falta guardar una "foto" del
  documento exacto al momento de enviar, si se quiere.
- 🟢 **Afinar mapeo/estilo de algún gráfico** si Rodrigo detecta que uno quedó en
  un capítulo distinto al original (cada gráfico está rotulado con su título).
- 🟢 **Foto real de Talca** (libre de derechos) en la portada, si se quiere sobre el
  emblema actual — requiere una imagen con licencia verificada.
