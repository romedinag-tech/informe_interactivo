"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brand } from "@/lib/brand";

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

export function HeroCover({
  title,
  subtitle,
  eyebrow,
  summary,
  summaryDraft,
}: {
  title: string;
  subtitle?: string | null;
  eyebrow?: string | null;
  summary?: string | null;
  summaryDraft?: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  const hero = brand.hero ?? {};
  const hasMedia = Boolean(hero.video || hero.poster);
  const showVideo = Boolean(hero.video) && !reduce;

  // Narración del resumen con la voz del navegador + resaltado palabra a palabra.
  const spans = useMemo(() => (summary ? summary.split(/(\s+)/) : []), [summary]);
  const offsets = useMemo(() => {
    const o: number[] = [];
    let acc = 0;
    for (const s of spans) {
      o.push(acc);
      acc += s.length;
    }
    return o;
  }, [spans]);
  const [active, setActive] = useState(-1);
  const [speaking, setSpeaking] = useState(false);

  const stop = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
    setActive(-1);
  };
  useEffect(() => () => stop(), []);

  const play = () => {
    if (!summary || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(summary);
    u.lang = "es-CL";
    u.rate = 1;
    u.onboundary = (e) => {
      const ci = e.charIndex ?? 0;
      let idx = 0;
      for (let i = 0; i < offsets.length; i++) if (offsets[i] <= ci) idx = i;
      setActive(idx);
    };
    u.onend = () => {
      setSpeaking(false);
      setActive(-1);
    };
    u.onerror = () => {
      setSpeaking(false);
      setActive(-1);
    };
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  const onMedia = hasMedia; // texto claro sobre media; tokens sobre fondo estático
  const textColor = onMedia ? "#fff" : "var(--ink)";
  const softColor = onMedia ? "rgba(255,255,255,0.82)" : "var(--muted)";

  return (
    <section
      className="relative isolate mb-8 overflow-hidden rounded-2xl"
      style={{
        border: onMedia ? "none" : "1px solid var(--line)",
        background: onMedia ? "#0d131c" : "var(--surface)",
        boxShadow: "var(--shadow-card)",
      }}
      aria-label="Portada ejecutiva"
    >
      {/* Fondo: video → poster → nada (fondo estático) */}
      {showVideo ? (
        <video
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={hero.poster}
          aria-hidden
        >
          <source src={hero.video} />
        </video>
      ) : hero.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.poster} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" />
      ) : null}
      {/* Scrim para legibilidad sobre media */}
      {onMedia && (
        <div
          className="absolute inset-0 -z-10"
          aria-hidden
          style={{ background: "linear-gradient(180deg, rgba(6,10,16,0.45) 0%, rgba(6,10,16,0.78) 100%)" }}
        />
      )}

      <div className="px-6 py-10 sm:px-10 sm:py-14">
        {eyebrow && (
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: onMedia ? "rgba(255,255,255,0.9)" : "var(--accent)" }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-2 max-w-3xl font-serif text-3xl font-semibold leading-tight sm:text-4xl"
          style={{ color: textColor }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-base" style={{ color: softColor }}>
            {subtitle}
          </p>
        )}

        {summary && (
          <div
            className="mt-6 max-w-2xl rounded-xl p-4 sm:p-5"
            style={{
              background: onMedia ? "rgba(255,255,255,0.10)" : "var(--surface-2)",
              backdropFilter: onMedia ? "blur(2px)" : undefined,
            }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: softColor }}>
                Resumen ejecutivo · 1 min
              </span>
              {summaryDraft && <span className="badge badge-warn">Borrador para validar</span>}
              <button
                onClick={speaking ? stop : play}
                className="ring-focus ml-auto rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                aria-pressed={speaking}
              >
                {speaking ? "⏸ Detener" : "▶ Escuchar resumen"}
              </button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: textColor }}>
              {spans.map((s, i) => (
                <span
                  key={i}
                  style={
                    i === active
                      ? { background: "var(--highlight)", color: "var(--ink)", borderRadius: 3 }
                      : undefined
                  }
                >
                  {s}
                </span>
              ))}
            </p>
          </div>
        )}

        {hero.credit && (
          <p className="mt-4 text-[10px]" style={{ color: softColor }}>
            {hero.credit}
          </p>
        )}
      </div>
    </section>
  );
}
