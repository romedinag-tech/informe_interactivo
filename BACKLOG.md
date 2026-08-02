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

## Pendiente ⏳

- 🔴 **Conectar los 48 gráficos al dashboard.** El `Dashboard_Diagnostico_Talca.html`
  usa Chart.js con los datos en una estructura minificada (los gráficos leen de
  `c.labels`/`c.data`, sin literales extraíbles de forma fiable). Recrearlos
  automáticamente arriesga datos equivocados. **Camino recomendado:** el consultor
  convierte cada placeholder en gráfico interactivo desde el **editor** (pegar los
  datos → Recharts), o una sesión dedicada con Rodrigo confirmando la
  correspondencia gráfico↔capítulo. Los títulos del dashboard mapean bien a los
  capítulos (partición modal→cap.9, población→cap.7, siniestralidad→cap.11).
- 🟢 **Foto real de Talca** (libre de derechos) en la portada, si se quiere sobre el
  emblema actual — requiere una imagen con licencia verificada.
