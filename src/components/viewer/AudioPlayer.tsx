"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NARRATOR_VOICES, DEFAULT_VOICE_ID } from "@/lib/voices";

export type AudioChapter = { id: string; title: string; text: string };

type Status = "idle" | "loading" | "playing" | "paused";
type Source = "none" | "elevenlabs" | "browser";

const SPEEDS = [1, 1.5, 2] as const;

// Reproductor flotante de narración por capítulo.
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
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [autoScroll, setAutoScroll] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;

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

  // Desplaza el documento para "seguir" la narración de un capítulo.
  const scrollToChapter = (i: number) => {
    const el = document.getElementById(`ch-${chapters[i].id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const followProgress = (i: number, progress: number) => {
    if (!autoScrollRef.current) return;
    const el = document.getElementById(`ch-${chapters[i].id}`);
    if (!el) return;
    const start = el.offsetTop - 120;
    const span = Math.max(0, el.offsetHeight - window.innerHeight * 0.55);
    window.scrollTo({ top: start + progress * span, behavior: "auto" });
  };

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
        if (i >= chunks.length) return onEnd();
        const u = new SpeechSynthesisUtterance(chunks[i].trim());
        u.lang = "es-419";
        u.rate = speed;
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
    [speed]
  );

  const playChapter = useCallback(
    async (i: number, useVoice: string) => {
      cleanup();
      if (i < 0 || i >= chapters.length) return;
      setIdx(i);
      setStatus("loading");
      if (autoScrollRef.current) scrollToChapter(i);

      try {
        const res = await fetch(
          `/api/reports/${reportSlug}/audio/${chapters[i].id}?voice=${encodeURIComponent(useVoice)}`
        );
        const ct = res.headers.get("Content-Type") ?? "";
        if (ct.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          const audio = audioRef.current!;
          audio.src = url;
          audio.playbackRate = speed;
          audio.ontimeupdate = () => {
            if (audio.duration > 0) followProgress(i, audio.currentTime / audio.duration);
          };
          audio.onended = () => {
            if (i + 1 < chapters.length) playChapter(i + 1, useVoice);
            else setStatus("idle");
          };
          setSource("elevenlabs");
          await audio.play();
          setStatus("playing");
        } else {
          speakBrowser(chapters[i].text, () => {
            if (i + 1 < chapters.length) playChapter(i + 1, useVoice);
            else setStatus("idle");
          });
        }
      } catch {
        speakBrowser(chapters[i].text, () => setStatus("idle"));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapters, cleanup, reportSlug, speakBrowser, speed]
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

  // Cambiar velocidad en caliente (audio nativo).
  const changeSpeed = (s: (typeof SPEEDS)[number]) => {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  // Cambiar voz reinicia el capítulo actual con la nueva voz.
  const changeVoice = (v: string) => {
    setVoiceId(v);
    if (status === "playing" || status === "paused") playChapter(idx, v);
  };

  if (chapters.length === 0) return null;

  return (
    <>
      <audio ref={audioRef} className="hidden" />

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

      {open && (
        <div className="surface-card fixed bottom-4 right-4 z-40 w-[21rem] max-w-[calc(100vw-2rem)] p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                Narración
                {source === "browser" && (
                  <span className="ml-1 font-normal normal-case text-amber-600">
                    (voz del navegador)
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                stop();
                setOpen(false);
              }}
              className="text-ink-soft hover:text-navy"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Selector de capítulo */}
          <select
            value={idx}
            onChange={(e) => {
              const i = Number(e.target.value);
              setIdx(i);
              if (status === "playing") playChapter(i, voiceId);
              else if (autoScroll) scrollToChapter(i);
            }}
            className="mt-2 w-full truncate rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-ink"
            title={chapters[idx].title}
          >
            {chapters.map((c, i) => (
              <option key={c.id} value={i}>
                {c.title}
              </option>
            ))}
          </select>

          {/* Transporte */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => playChapter(idx - 1, voiceId)}
              disabled={idx === 0}
              className="rounded-md px-2 py-1 text-ink-soft hover:bg-gray-100 disabled:opacity-30"
              title="Anterior"
            >
              ⏮
            </button>
            {status === "idle" || status === "paused" ? (
              <button
                onClick={() =>
                  status === "paused" ? togglePause() : playChapter(idx, voiceId)
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white hover:bg-navy-700"
                title="Reproducir"
              >
                ▶
              </button>
            ) : status === "loading" ? (
              <span className="flex h-10 w-10 items-center justify-center text-navy">…</span>
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
              onClick={() => playChapter(idx + 1, voiceId)}
              disabled={idx >= chapters.length - 1}
              className="rounded-md px-2 py-1 text-ink-soft hover:bg-gray-100 disabled:opacity-30"
              title="Siguiente"
            >
              ⏭
            </button>
          </div>

          {/* Voz + velocidad */}
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <div className="flex overflow-hidden rounded-full border border-gray-200">
              {NARRATOR_VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => changeVoice(v.id)}
                  className={`px-2.5 py-1 ${voiceId === v.id ? "bg-navy text-white" : "text-ink-soft hover:bg-gray-100"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-full border border-gray-200">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`px-2 py-1 ${speed === s ? "bg-navy text-white" : "text-ink-soft hover:bg-gray-100"}`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {/* Auto-scroll */}
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Seguir la lectura (auto-scroll)
          </label>

          <div className="mt-2 text-center text-[11px] text-ink-soft">
            Capítulo {idx + 1} de {chapters.length}
          </div>
        </div>
      )}
    </>
  );
}
