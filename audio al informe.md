Actúa como un Arquitecto de Software Senior, Diseñador UX/UI y Desarrollador Full-Stack experto en tecnologías web modernas (Next.js, TypeScript, Tailwind CSS y Node.js/PostgreSQL). 

Quiero desarrollar un MVP avanzado para una plataforma web de informes técnicos interactivos orientados a la revisión y fiscalización ministerial (por ejemplo, estudios de transporte y movilidad). 

El sistema se construirá combinando **dos insumos principales** que te proporcionaré:
1. **Contenido narrativo base:** El texto estructurado de un documento Word clásico (organizado en capítulos, títulos y párrafos).
2. **Fuentes de datos visuales:** Las referencias a los gráficos estáticos del Word para reemplazarlos por componentes interactivos conectados al dashboard de origen (permitiendo tooltips y dinamismo).

El desarrollo debe cumplir estrictamente con los siguientes pilares:

### 1. Experiencia Visual y de "Libro Digital Premium"
- **Tipografía y Legibilidad:** Ancho de lectura controlado, interlineado generoso y selector de modo claro/oscuro.
- **Navegación Fluida (Estilo ePub/Web):** Tabla de contenidos (TOC) lateral retráctil, barra de progreso de lectura superior y secciones colapsables (acordeones) para metodologías densas.
- **Interactividad de Datos y Glosarios:** Contenedores fluidos para gráficos y visores dinámicos, acompañados de tooltips flotantes para definir términos técnicos o normativas sobre la marcha.

### 2. Módulo de Audio Hiperrealista con ElevenLabs API
- **Reproductor de Voz Integrado:** Crear un reproductor de audio flotante en el visor del informe.
- **Integración Backend:** Configurar la conexión con la API de ElevenLabs (utilizando sus modelos avanzados *Multilingual v2/v3*) para generar locuciones con modulación y tono profesional de estudio.
- **Sistema de Caché Inteligente:** Los audios generados por capítulos deben almacenarse temporalmente en el servidor o almacenamiento en la nube (caché) para evitar llamadas duplicadas a la API y optimizar costos operativos.

### 3. Colaboración y Revisión Ministerial (Roles y Anotaciones)
- **Autenticación RBAC:** Roles diferenciados para `Consultor` (edición y resolución) y `Revisor Ministerial` (lectura y comentarios).
- **Anotaciones Contextuales:** El revisor podrá seleccionar cualquier fragmento de texto, título o gráfico interactivo para abrir una burbuja y dejar una observación (ingresada por teclado o mediante dictado por voz).
- **Panel Consolidador:** Un reporte automático que agrupe las observaciones mostrando el extracto original del informe (contexto) junto a la nota del revisor, con un flujo de resolución en 1 clic para el consultor.

Por favor, ayúdame a diseñar la estructura de carpetas inicial del proyecto, el esquema de base de datos relacional para gestionar los documentos parseados, las anotaciones y los audios en caché, y propón el código base para comenzar el desarrollo.