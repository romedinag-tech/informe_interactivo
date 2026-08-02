// Integración con ElevenLabs (text-to-speech hiperrealista, modelos Multilingual).
// Si no hay API key configurada, el visor usa la voz del navegador como respaldo.

import { NARRATOR_VOICES, DEFAULT_VOICE_ID } from "@/lib/voices";

export const audioConfig = {
  voiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
  model: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
};

// Valida un voiceId contra la lista permitida; si no, usa el por defecto.
export function resolveVoiceId(id?: string | null): string {
  if (id && NARRATOR_VOICES.some((v) => v.id === id)) return id;
  return audioConfig.voiceId;
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

// Límite prudente de caracteres por llamada (evita costos y errores de tamaño).
const MAX_CHARS = 5000;

// Localizador de un diccionario de pronunciación (id + versión).
export type DictLocator = {
  pronunciation_dictionary_id: string;
  version_id: string;
};

export async function synthesizeSpeech(
  text: string,
  opts?: { voiceId?: string; model?: string; dictLocators?: DictLocator[] }
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_NO_CONFIGURADO");

  const voiceId = opts?.voiceId ?? audioConfig.voiceId;
  const model = opts?.model ?? audioConfig.model;
  const input = text.slice(0, MAX_CHARS);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 },
        ...(opts?.dictLocators?.length
          ? { pronunciation_dictionary_locators: opts.dictLocators }
          : {}),
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ELEVENLABS_ERROR ${res.status}: ${detail.slice(0, 300)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Identificador del esquema de voces (para la clave de caché).
export const VOICE_SCHEME =
  "alt-" + NARRATOR_VOICES.map((v) => v.id.slice(0, 4)).join("-");

// Narración con voces alternadas (segmento a segmento: mujer, hombre, mujer…).
// Cuesta lo mismo que una sola voz (mismos caracteres). Genera en paralelo para
// no exceder el tiempo de función y concatena el audio en un solo mp3.
export async function synthesizeAlternating(
  segments: string[],
  opts?: { model?: string; dictLocators?: DictLocator[] }
): Promise<Buffer> {
  const clean = segments.map((s) => s.trim()).filter(Boolean);
  const buffers = await Promise.all(
    clean.map((seg, i) =>
      synthesizeSpeech(seg, {
        voiceId: NARRATOR_VOICES[i % NARRATOR_VOICES.length].id,
        model: opts?.model,
        dictLocators: opts?.dictLocators,
      })
    )
  );
  return Buffer.concat(buffers);
}

// Crea un diccionario de pronunciación a partir de reglas de "alias" (reemplazo
// de texto: p.ej. "IMIV" -> "ímiv"). Los alias funcionan con cualquier modelo.
export async function createPronunciationDictionary(
  name: string,
  rules: { string_to_replace: string; alias: string }[]
): Promise<{ id: string; versionId: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_NO_CONFIGURADO");

  const res = await fetch(
    "https://api.elevenlabs.io/v1/pronunciation-dictionaries/add-from-rules",
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        rules: rules.map((r) => ({
          string_to_replace: r.string_to_replace,
          type: "alias",
          alias: r.alias,
        })),
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ELEVENLABS_DICT_ERROR ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id: string; version_id: string };
  return { id: data.id, versionId: data.version_id };
}
