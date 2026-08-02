// Integración con ElevenLabs (text-to-speech hiperrealista, modelos Multilingual).
// Si no hay API key configurada, el visor usa la voz del navegador como respaldo.

export const audioConfig = {
  voiceId: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
  model: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
};

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

// Límite prudente de caracteres por llamada (evita costos y errores de tamaño).
const MAX_CHARS = 5000;

export async function synthesizeSpeech(
  text: string,
  opts?: { voiceId?: string; model?: string }
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
