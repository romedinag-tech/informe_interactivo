// Rondas de revisión: estado consolidado (uniendo mis observaciones con las
// respuestas de Talca) y re-anclaje de observaciones al pasar a una versión nueva
// del informe. "Ninguna observación se pierde en silencio": si su cita ya no está,
// se marca huérfana, no se descarta. Reusa el re-anclador W3C de `../anchor`.

import { reanchor } from "../anchor";
import type { ReviewDoc } from "./parse";

export type Estado = "pendiente" | "atendida" | "respondida";
export type Respuesta = { id: string; estado?: Estado; nota?: string; version?: string; fecha?: string };

export type ObsLike = {
  id: string; tipo: string;
  seccion_titulos: string[]; seccion_archivo: string | null;
  ancla: { cita: string; prefijo: string; sufijo: string; rotulo: string | null; codigo: string | null };
  texto: string; orphaned?: boolean; orphanedAt?: string | null;
  [k: string]: unknown;
};

// Une cada observación (mía) con su respuesta (de Talca), por id. El estado por
// defecto es "pendiente"; Talca lo cambia a "atendida"/"respondida" en respuestas.json.
export function mergeRespuestas<T extends ObsLike>(
  obs: T[], respuestas: Respuesta[]
): (T & { estado: Estado; respuesta: Respuesta | null })[] {
  const byId = new Map(respuestas.map((r) => [r.id, r]));
  return obs.map((o) => {
    const r = byId.get(o.id) ?? null;
    return { ...o, estado: (r?.estado ?? "pendiente") as Estado, respuesta: r };
  });
}

// Índice del documento nuevo para re-anclar: textos por sección + códigos presentes.
function docIndex(doc: ReviewDoc) {
  const sectionTexts: { chapter: string; section: string; text: string }[] = [];
  const codeToBlock = new Map<string, { chapter: string; section: string; rotulo: string; numero: string }>();
  for (const ch of doc.chapters) {
    if (ch.frontMatter) continue;
    for (const s of ch.sections) {
      const parts: string[] = [];
      for (const b of s.blocks) {
        if (b.type === "PARAGRAPH" || b.type === "HEADING") parts.push(b.text);
        else if ((b.type === "FIGURE" || b.type === "CUADRO") && b.codigo)
          codeToBlock.set(b.codigo, { chapter: ch.title, section: s.title ?? "", rotulo: b.rotulo, numero: b.numero });
      }
      sectionTexts.push({ chapter: ch.title, section: s.title ?? "", text: parts.join(" ") });
    }
  }
  return { sectionTexts, codeToBlock };
}

// Re-ancla las observaciones sobre un documento nuevo. Figuras/cuadros se re-anclan
// por su CÓDIGO (estable aunque el número del rótulo cambie entre versiones); el
// texto, por la cita vía la cascada de `reanchor`. Marca huérfanas, no las borra.
export function reanchorOnto<T extends ObsLike>(
  obs: T[], doc: ReviewDoc
): { obs: T[]; anchored: number; orphaned: number } {
  const idx = docIndex(doc);
  const now = new Date().toISOString();
  let anchored = 0, orphaned = 0;
  const out = obs.map((o) => {
    let ok = false;
    let seccion = o.seccion_titulos;
    let ancla = o.ancla;
    if ((o.tipo === "figura" || o.tipo === "cuadro") && o.ancla.codigo) {
      const b = idx.codeToBlock.get(o.ancla.codigo);
      if (b) { ok = true; seccion = [b.chapter, b.section].filter(Boolean); ancla = { ...o.ancla, rotulo: b.rotulo }; }
    } else if (o.ancla.cita) {
      for (const st of idx.sectionTexts) {
        if (reanchor(st.text, { quote: o.ancla.cita, prefix: o.ancla.prefijo, suffix: o.ancla.sufijo })) {
          ok = true; seccion = [st.chapter, st.section].filter(Boolean); break;
        }
      }
    }
    if (ok) { anchored++; return { ...o, seccion_titulos: seccion, ancla, orphaned: false, orphanedAt: null }; }
    orphaned++; return { ...o, orphaned: true, orphanedAt: now };
  });
  return { obs: out as T[], anchored, orphaned };
}
