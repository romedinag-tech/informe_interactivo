// Re-anclaje de observaciones (W3C Web Annotation): selectores redundantes y
// cascada de recuperación. Puro (sin React) para usarse en cliente Y servidor.

export type AnchorSelectors = {
  quote?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  rangeStart?: number | null;
  rangeEnd?: number | null;
};

// Normaliza para comparación tolerante (minúsculas + espacios colapsados) y
// devuelve el mapa de índices norm→original para recuperar offsets reales.
export function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      norm += " ";
      map.push(i);
      prevSpace = true;
    } else {
      norm += ch.toLowerCase();
      map.push(i);
      prevSpace = false;
    }
  }
  return { norm, map };
}

// Cascada: posición verificada → cita exacta desambiguada por contexto →
// búsqueda normalizada → núcleo difuso. Devuelve null si quedó huérfana.
export function reanchor(text: string, a: AnchorSelectors): { start: number; end: number } | null {
  const quote = a.quote ?? "";

  // 1. Posición, VERIFICADA contra la cita (si el texto cambió, no confía).
  if (a.rangeStart != null && a.rangeEnd != null && a.rangeEnd <= text.length) {
    if (!quote || text.slice(a.rangeStart, a.rangeEnd) === quote) {
      return { start: a.rangeStart, end: a.rangeEnd };
    }
  }
  if (!quote) return null;

  // 2. Cita exacta; si hay repeticiones, desambigua por prefix/suffix.
  const occ: number[] = [];
  for (let i = text.indexOf(quote); i >= 0; i = text.indexOf(quote, i + 1)) occ.push(i);
  if (occ.length === 1) return { start: occ[0], end: occ[0] + quote.length };
  if (occ.length > 1) {
    let best = occ[0];
    let bestScore = -1;
    for (const o of occ) {
      const before = text.slice(Math.max(0, o - (a.prefix?.length ?? 0)), o);
      const after = text.slice(o + quote.length, o + quote.length + (a.suffix?.length ?? 0));
      const score =
        (a.prefix && before.endsWith(a.prefix) ? 2 : 0) +
        (a.suffix && after.startsWith(a.suffix) ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return { start: best, end: best + quote.length };
  }

  // 3. Búsqueda tolerante a espacios/mayúsculas.
  const T = normalizeWithMap(text);
  const q = normalizeWithMap(quote).norm.trim();
  if (q) {
    const ni = T.norm.indexOf(q);
    if (ni >= 0) {
      const start = T.map[ni];
      const end = (T.map[ni + q.length - 1] ?? start) + 1;
      return { start, end };
    }
  }

  // 4. Núcleo difuso: primeras ~24 letras de la cita.
  const core = quote.trim().slice(0, 24);
  if (core.length >= 6) {
    const ci = text.indexOf(core);
    if (ci >= 0) return { start: ci, end: ci + core.length };
  }

  return null; // huérfana
}
