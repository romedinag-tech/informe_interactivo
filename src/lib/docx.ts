import mammoth from "mammoth";
import { parse, type HTMLElement } from "node-html-parser";

/**
 * Convierte un documento Word (.docx) en la estructura modular del informe:
 * Capítulo → Sección → Bloque. Reglas de mapeo:
 *   h1        → nuevo Capítulo
 *   h2        → nueva Sección dentro del capítulo actual
 *   h3–h6     → bloque HEADING (subtítulo dentro de la sección)
 *   p         → bloque PARAGRAPH
 *   table     → bloque TABLE
 *   ul/ol     → un bloque PARAGRAPH por ítem (viñeta)
 *   img       → bloque IMAGE marcado como placeholder de gráfico (isChartPlaceholder)
 *
 * Las imágenes NO se incrustan (src vacío): representan los gráficos estáticos del
 * Word que el consultor reemplazará por componentes interactivos.
 */

export type ParsedBlockType =
  | "HEADING"
  | "PARAGRAPH"
  | "TABLE"
  | "IMAGE";

export type ParsedBlock = {
  type: ParsedBlockType;
  content: Record<string, unknown>;
};

export type ParsedSection = { title: string | null; blocks: ParsedBlock[] };
export type ParsedChapter = {
  title: string;
  number: string;
  sections: ParsedSection[];
};
export type ParsedDoc = {
  chapters: ParsedChapter[];
  warnings: string[];
};

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export async function parseDocx(buffer: Buffer): Promise<ParsedDoc> {
  // No incrustamos las imágenes (evita base64 pesado); sólo marcamos su posición.
  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
    }
  );

  const warnings = messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  const root = parse(html);

  const chapters: ParsedChapter[] = [];
  let chapterCount = 0;

  const ensureChapter = (): ParsedChapter => {
    if (chapters.length === 0) {
      chapterCount += 1;
      chapters.push({
        title: "Introducción",
        number: String(chapterCount),
        sections: [],
      });
    }
    return chapters[chapters.length - 1];
  };

  const ensureSection = (): ParsedSection => {
    const ch = ensureChapter();
    if (ch.sections.length === 0) {
      ch.sections.push({ title: null, blocks: [] });
    }
    return ch.sections[ch.sections.length - 1];
  };

  const pushBlock = (block: ParsedBlock) => {
    ensureSection().blocks.push(block);
  };

  const parseTable = (el: HTMLElement): ParsedBlock | null => {
    const rows = el.querySelectorAll("tr");
    if (rows.length === 0) return null;
    const headerCells = rows[0].querySelectorAll("th,td");
    const columns = headerCells.map((c) => cleanText(c.text) || " ");
    const bodyRows = rows
      .slice(1)
      .map((r) => r.querySelectorAll("td,th").map((c) => cleanText(c.text)));
    return { type: "TABLE", content: { columns, rows: bodyRows } };
  };

  for (const node of root.childNodes) {
    const el = node as HTMLElement;
    if (!el.tagName) continue; // saltar nodos de texto sueltos
    const tag = el.tagName.toLowerCase();

    // Imágenes anidadas en cualquier bloque → placeholders de gráfico.
    const imgs = el.querySelectorAll("img");

    switch (tag) {
      case "h1":
        chapterCount += 1;
        chapters.push({
          title: cleanText(el.text) || `Capítulo ${chapterCount}`,
          number: String(chapterCount),
          sections: [],
        });
        break;

      case "h2":
        ensureChapter().sections.push({
          title: cleanText(el.text) || null,
          blocks: [],
        });
        break;

      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const text = cleanText(el.text);
        if (text) pushBlock({ type: "HEADING", content: { text } });
        break;
      }

      case "table": {
        const t = parseTable(el);
        if (t) pushBlock(t);
        break;
      }

      case "ul":
      case "ol":
        for (const li of el.querySelectorAll("li")) {
          const text = cleanText(li.text);
          if (text) pushBlock({ type: "PARAGRAPH", content: { text: `• ${text}` } });
        }
        break;

      case "img":
        pushBlock({
          type: "IMAGE",
          content: { src: "", alt: el.getAttribute("alt") ?? "", isChartPlaceholder: true },
        });
        break;

      default: {
        // Párrafos (y cualquier otro bloque con texto o imágenes).
        if (imgs.length > 0) {
          for (const img of imgs) {
            pushBlock({
              type: "IMAGE",
              content: {
                src: "",
                alt: img.getAttribute("alt") ?? "",
                isChartPlaceholder: true,
              },
            });
          }
        }
        const text = cleanText(el.text);
        if (text) pushBlock({ type: "PARAGRAPH", content: { text } });
      }
    }
  }

  return { chapters, warnings };
}
