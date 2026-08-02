"use client";

import { useEffect, useRef, useState } from "react";

// Botón de dictado usando la Web Speech API nativa (SpeechRecognition).
// Va anexando el texto reconocido al valor actual mediante onAppend.
// Degrada silenciosamente si el navegador no la soporta (Firefox, algunos móviles).

// Tipos mínimos (la Web Speech API no está en lib.dom por defecto).
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
};

export function VoiceInput({
  onAppend,
  lang = "es-CL",
}: {
  onAppend: (text: string) => void;
  lang?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).webkitSpeechRecognition;

    if (!Ctor) return;
    setSupported(true);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e: SpeechResultEvent) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if (finalText.trim()) onAppend(finalText.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recognitionRef.current = rec;
    return () => rec.stop();
    // onAppend es estable via useCallback en el padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  if (!supported) return null;

  const toggle = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      rec.start();
      setListening(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Detener dictado" : "Dictar observación"}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
        listening
          ? "border-red-300 bg-red-50 text-red-700"
          : "border-gray-300 bg-white text-ink-soft hover:bg-gray-50"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          listening ? "animate-pulse bg-red-500" : "bg-gray-400"
        }`}
      />
      {listening ? "Escuchando…" : "Dictar"}
    </button>
  );
}
