import type { Prisma } from "@prisma/client";

type BlockLike = { type: string; content: Prisma.JsonValue };

// Símbolos que el TTS vocaliza mal ("raya", deletreo…) → palabras/limpieza.
const SYMBOLS: [RegExp, string][] = [
  [/\s*→\s*/g, " a "],
  [/\s*[—–]\s*/g, ", "],
  [/\s*×\s*/g, " por "],
  [/\s*÷\s*/g, " sobre "],
  [/≤/g, " menor o igual a "],
  [/≥/g, " mayor o igual a "],
  [/±/g, " más menos "],
];

function cleanText(s: string): string {
  let out = s;
  for (const [re, rep] of SYMBOLS) out = out.replace(re, rep);
  // "Figura 11-3" → "Figura 11 3" (evita que lea "guión").
  out = out.replace(/(Figura\s+\d+)\s*[-–]\s*(\d+)/gi, "$1 $2");
  return out.replace(/\s{2,}/g, " ").trim();
}

// El título de capítulo: quita la numeración editorial inicial y, si viene en
// MAYÚSCULAS, lo pasa a mayúscula inicial (el TTS deletrea las mayúsculas).
function cleanTitle(t: string): string {
  let s = t.replace(/^\s*\d+[.)\s]+/, "").trim();
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters && letters === letters.toUpperCase()) {
    s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return cleanText(s);
}

// Construye el texto que se narrará para un capítulo: título + párrafos,
// subtítulos y pies de figuras/tablas (omite datos tabulares crudos).
export function chapterNarrationSegments(title: string, blocks: BlockLike[]): string[] {
  const parts: string[] = [cleanTitle(title)];
  for (const b of blocks) {
    const c = (b.content ?? {}) as Record<string, unknown>;
    if (b.type === "PARAGRAPH" || b.type === "HEADING" || b.type === "CALLOUT") {
      if (typeof c.text === "string" && c.text.trim()) parts.push(cleanText(c.text.trim()));
    } else if (b.type === "TABLE" || b.type === "CHART") {
      if (typeof c.caption === "string" && c.caption.trim()) parts.push(cleanText(c.caption.trim()));
    }
  }
  return parts.filter(Boolean);
}

export function chapterNarrationText(title: string, blocks: BlockLike[]): string {
  return chapterNarrationSegments(title, blocks).join(". ").replace(/\.\./g, ".");
}
