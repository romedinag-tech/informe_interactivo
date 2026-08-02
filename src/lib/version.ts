// Versión visible de la plataforma. Convención:
//  - correcciones menores: 1.0 → 1.1 → 1.2 …
//  - cambios grandes: → 2.0, 3.0 …
export const APP_VERSION = "1.0";

// Identificador del build desplegado (los 7 primeros del commit en Vercel).
// Permite confirmar que se está viendo la última versión publicada.
export function buildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : "local";
}
