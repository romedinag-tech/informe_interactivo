# Backlog de mejoras — Plataforma de informes interactivos

Observaciones y pedidos pendientes de atender. Esfuerzo aproximado:
🟢 rápido · 🟡 medio · 🔴 grande.

---

## 1. Apariencia / lectura "premium"

- 🔴 **Rediseño visual premium (brief completo en `mejora grafica.txt`).** Directrices:
  - **Tipografía:** pareja refinada (Plus Jakarta Sans / Inter para UI y lectura;
    serif elegante para títulos). Escala modular con H2/H3 muy diferenciados.
    Ancho de lectura central 680–720px centrado.
  - **Contenedores:** eliminar bordes gris 1px → tarjetas blancas sobre fondo sutil
    (#f8fafc), sombras muy suaves, esquinas redondeadas (12–16px).
  - **TOC:** indicador de ítem activo (línea lateral / tono), más espaciado.
  - **Paleta:** sobria y sofisticada; acento profesional (azul marino, tinto o verde
    bosque), evitar tonos planos industriales.
- 🔴 **Gráficos interactivos.** Los 48 gráficos del informe de Talca siguen como
  placeholders. Reemplazarlos por componentes interactivos (idealmente conectados
  al `Dashboard_Diagnostico_Talca.html` de origen: tooltips, zoom, filtros).
- 🟡 **Impresión general más sofisticada.** El despliegue del informe se ve básico;
  elevar la jerarquía visual, espaciados, tipografía y tratamiento de figuras para
  una impresión profesional/editorial. (Cubierto en gran parte por el brief anterior.)
- 🟡 **Cabecera compacta.** Hoy la barra superior usa dos líneas ("Informes
  Interactivos" a la izquierda + "Síntesis de Prediagnóstico" debajo) y desaprovecha
  espacio. Unificar en **un solo título centrado**, y usar el espacio liberado para
  una **foto/ícono de Talca**. Reducir la altura del header para dar más espacio al
  texto en revisión.
- 🟢 **Foto de portada de Talca** (libre de derechos de autor) en la cabecera/portada.
- 🟡 **Colores sobrios por sección** en el lector, para diferenciar visualmente las
  secciones sin recargar.

## 2. Índice lateral (TOC)

- 🟡 **Selector de profundidad de niveles.** Opción para elegir cuántas capas mostrar:
  solo nivel 1 (1, 2, 3…) o hasta nivel 2 (1.2, 2.4…), para controlar el tamaño del
  índice.
- 🟢 **Hover despliega el título completo.** Al pasar el mouse sobre un título
  truncado, mostrarlo completo (tooltip o expansión) para poder leerlo.

## 3. Narración / audio

- 🟡 **Selector de capítulos** en el reproductor, para elegir directamente qué capítulo
  escuchar (hoy solo hay anterior/siguiente).
- 🟡 **Auto-scroll al narrar.** Que el documento baje automáticamente a medida que se
  lee, **con opción para desactivarlo**.
- 🟢 **Velocidad de reproducción** 1.5× / 2.0× para escuchar más rápido.
- 🟡 **Voz neutra (no acento de España).** Elegir una voz en español neutro/
  latinoamericano, y **alternar entre voz masculina y femenina** (parte del selector
  de voz).

## 4. Flujo de revisión ministerial

- 🟡 **Botón "Enviar al consultor".** Cuando el revisor termina, un botón para
  enviar formalmente sus observaciones al consultor, **con confirmación**
  ("¿Está seguro? ¿Las observaciones están terminadas?").
- 🔴 **Exportar consolidado de observaciones.** Botón que genere:
  1. un **resumen con todas las observaciones en un solo documento**, y
  2. el **documento con cada observación** (contexto original + nota) —
  ambos exportables (Word/PDF).

## 5. Contenido / ayuda

- 🟢 **Link "Instrucciones de uso".** Página breve que explique cómo se usa el portal
  y sus principales características.
- 🟢 **Glosario: agregar "V&R Ltda"** (la consultora). *(Falta que Rodrigo indique la
  definición exacta y la pronunciación para la narración.)*

---

## Ya implementado (referencia)

- Visor libro-digital: temas claro/oscuro/sepia, TOC retráctil, barra de progreso,
  acordeones, glosario emergente.
- Anotaciones contextuales (teclado y voz) + consolidador básico.
- Narración por capítulo con ElevenLabs + caché + respaldo de voz del navegador.
- Pronunciación de siglas desde el glosario (IMIV, SECTRA, TMDA…).
- RBAC consultor/revisor. Deploy en Vercel + Neon.
