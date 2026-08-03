// Voces narradoras. Se usa la MISMA voz latinoamericana validada en toda la app
// (capítulos + resumen ejecutivo), para acento consistente y sin dejo de España.
// Para volver a alternar mujer/hombre, agrega un segundo código LatAm aquí.
// Módulo sin dependencias de servidor: seguro de importar en el cliente.
export type NarratorVoice = { id: string; label: string; gender: "F" | "M" };

export const NARRATOR_VOICES: NarratorVoice[] = [
  { id: "ClNifCEVq1smkl4M3aTk", label: "Narración", gender: "F" },
];

export const DEFAULT_VOICE_ID = NARRATOR_VOICES[0].id;
