import type { Prisma } from "@prisma/client";

type BlockLike = { type: string; content: Prisma.JsonValue };

// Construye el texto que se narrará para un capítulo: título + párrafos,
// subtítulos y pies de figuras/tablas (omite datos tabulares crudos).
// Segmentos narrables (título + cada párrafo/subtítulo/pie), para alternar voces.
export function chapterNarrationSegments(
  title: string,
  blocks: BlockLike[]
): string[] {
  const parts: string[] = [title];
  for (const b of blocks) {
    const c = (b.content ?? {}) as Record<string, unknown>;
    if (b.type === "PARAGRAPH" || b.type === "HEADING" || b.type === "CALLOUT") {
      if (typeof c.text === "string" && c.text.trim()) parts.push(c.text.trim());
    } else if (b.type === "TABLE" || b.type === "CHART") {
      if (typeof c.caption === "string" && c.caption.trim())
        parts.push(c.caption.trim());
    }
  }
  return parts;
}

export function chapterNarrationText(
  title: string,
  blocks: BlockLike[]
): string {
  return chapterNarrationSegments(title, blocks)
    .join(". ")
    .replace(/\.\./g, ".");
}
