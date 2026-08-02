"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioChapter = { id: string; title: string; text: string };

type Status = "idle" | "loading" | "playing" | "paused";
type Source = "none" | "elevenlabs" | "browser";

// Reproductor flotante de narración por capítulo.
// Intenta ElevenLabs (vía /api); si no está configurado o falla, usa la voz del navegador.
export function AudioPlayer({
  reportSlug,
  chapters,
}: {
  reportSlug: string;
  chapters: AudioChapter[];
}) {
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [source, setSource] = useState<Source>("none");
  const [open, setOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Lectura por navegador, troceada por oraciones (evita el corte de Chrome).
  const speakBrowser = useCallback(
    (text: string, onEnd: () => void) => {
      const synth = window.speechSynthesis;
      if (!synth) {
        setStatus("idle");
        return;
      }
      synth.cancel();
      const chunks = text.match(/[^.!?]+[.!?]*/g) ?? [text];
      let i = 0;
      const speakNext = () => {
        if (i >= chunks.length) {
          onEnd();
          return;
        }
        const u = new SpeechSynthesisUtterance(chunks[i].trim());
        u.lang = "es-CL";
        u.rate = 1;
        u.onend = () => {
          i += 1;
          speakNext();
        };
        u.onerror = () => setStatus("idle");
        synth.speak(u);
      };
      setSource("browser");
      setStatus("playing");
      speakNext();
    },
    []
  );

  const playChapter = useCallback(
    async (i: number) => {
      cleanup();
      if (i < 0 || i >= chapters.length) return;
      setIdx(i);
      setStatus("loading");

      try {
        const res = await fetch(
          `/api/reports/${reportSlug}/audio/${chapters[i].id}`
        );
        const ct = res.headers.get("Content-Type") ?? "";

        if (ct.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          const audio = audioRef.current!;
          audio.src = url;
          audio.onended = () => {
            if (i + 1 < chapters.length) playChapter(i + 1);
            else setStatus("idle");
          };
          setSource("elevenlabs");
          await audio.play();
          setStatus("playing");
        } else {
          // Respaldo: voz del navegador.
          speakBrowser(chapters[i].text, () => {
            if (i + 1 < chapters.length) playChapter(i + 1);
            else setStatus("idle");
          });
        }
      } catch {
        speakBrowser(chapters[i].text, () => setStatus("idle"));
      }
    },
    [chapters, cleanup, reportSlug, speakBrowser]
  );

  const togglePause = () => {
    if (source === "elevenlabs" && audioRef.current) {
      if (status === "playing") {
        audioRef.current.pause();
        setStatus("paused");
      } else {
        audioRef.current.play();
        setStatus("playing");
      }
    } else if (source === "browser" && window.speechSynthesis) {
      if (status === "playing") {
        window.speechSynthesis.pause();
        setStatus("paused");
      } else {
        window.speechSynthesis.resume();
        setStatus("playing");
      }
    }
  };

  const stop = () => {
    cleanup();
    setStatus("idle");
    setSource("none");
  };

  if (chapters.length === 0) return null;

  return (
    <>
      <audio ref={audioRef} className="hidden" />

      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white shadow-lg hover:bg-navy-700"
          title="Escuchar el informe"
          aria-label="Escuchar el informe"
        >
          🎧
        </button>
      )}

      {/* Panel del reproductor */}
      {open && (
        <div className="fixed bottom-4 right-4 z-40 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Narración{" "}
                {source === "browser" && (
                  <span className="font-normal normal-case text-amber-600">
                    (voz del navegador)
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-sm font-medium text-ink" title={chapters[idx].title}>
                {chapters[idx].title}
              </div>
            </div>
            <button
              onClick={() => {
                stop();
                setOpen(false);
              }}
              className="ml-2 text-ink-soft hover:text-navy"
              aria-label="Cerrar reproductor"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => playChapter(idx - 1)}
              disabled={idx === 0}
              className="rounded-md px-2 py-1 text-ink-soft hover:bg-gray-100 disabled:opacity-30"
              title="Capítulo anterior"
            >
              ⏮
            </button>

            {status === "idle" || status === "paused" ? (
              <button
                onClick={() =>
                  status === "paused" ? togglePause() : playChapter(idx)
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white hover:bg-navy-700"
                title="Reproducir"
              >
                ▶
              </button>
            ) : status === "loading" ? (
              <span className="flex h-10 w-10 items-center justify-center text-navy">
                …
              </span>
            ) : (
              <button
                onClick={togglePause}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white hover:bg-navy-700"
                title="Pausar"
              >
                ⏸
              </button>
            )}

            <button
              onClick={() => playChapter(idx + 1)}
              disabled={idx >= chapters.length - 1}
              className="rounded-md px-2 py-1 text-ink-soft hover:bg-gray-100 disabled:opacity-30"
              title="Capítulo siguiente"
            >
              ⏭
            </button>
          </div>

          <div className="mt-2 text-center text-[11px] text-ink-soft">
            Capítulo {idx + 1} de {chapters.length}
          </div>
        </div>
      )}
    </>
  );
}
