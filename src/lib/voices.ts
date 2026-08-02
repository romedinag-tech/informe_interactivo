// Voces narradoras (acento neutro para español vía multilingual v2), F/M.
// Módulo sin dependencias de servidor: seguro de importar en el cliente.
export type NarratorVoice = { id: string; label: string; gender: "F" | "M" };

export const NARRATOR_VOICES: NarratorVoice[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Femenina", gender: "F" }, // Sarah
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "Masculina", gender: "M" }, // George
];

export const DEFAULT_VOICE_ID = NARRATOR_VOICES[0].id;
