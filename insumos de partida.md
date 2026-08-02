Actúa como un Ingeniero de Software Full-Key y Especialista en Transformación Digital Documental. 

Quiero construir la versión interactiva y web de un informe técnico a partir de dos insumos principales que te proporcionaré:
1. **El contenido narrativo base:** El texto estructurado de un documento Word clásico (con sus títulos, subtítulos, párrafos y el orden de los capítulos).
2. **Las fuentes de datos visuales:** Las referencias a los gráficos estáticos del Word que deben ser reemplazados o mejorados por componentes interactivos conectados al dashboard de origen (permitiendo tooltips, filtros o visualización dinámica).

El proyecto debe desarrollarse con la siguiente arquitectura y requerimientos:

1. **Estructura del Visor Web (Estilo Libro Digital / ePub Moderno):**
   - Panel de navegación lateral persistente (Tabla de Contenidos TOC) basada en los títulos del Word original.
   - Tipografía limpia, ancho de lectura optimizado y selector de modo claro/oscuro.
   - Secciones colapsables (acordeones) para metodologías o anexos densos.

2. **Sistema de Anotaciones Contextuales para el Ministerio:**
   - Base de datos y lógica para que los revisores ministeriales (con login por roles) puedan seleccionar cualquier fragmento de texto, subtítulo o gráfico interactivo y dejar una observación (por teclado o dictado por voz).
   - Un panel consolidador automático que extraiga la observación junto al fragmento exacto del informe al que hace referencia para facilitarme la corrección.

Por favor, ayúdame a estructurar la arquitectura inicial del proyecto, define cómo parsear el contenido narrativo del documento Word para adaptarlo a componentes modulares de la web, y genera la base de código inicial para arrancar.