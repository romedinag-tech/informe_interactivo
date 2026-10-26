// Parser del MODO REVISIÓN interna. Convierte el .docx que produce `informe-word`
// (marca sectra_consorcio / formato Bonilla) en un modelo de datos para el visor
// local: Capítulo → Sección → Bloque, con las figuras y cuadros etiquetados por su
// rótulo («Figura 2-3. Título» / «Cuadro 3-5. Título», con punto, sin «N°») y
// resueltos a su código y archivo de sección vía el mapa del ensamblador.
//
// A diferencia del parser de generación (`src/lib/docx.ts`), acá:
//  - las imágenes SÍ se extraen (para mostrarlas), no se dejan como placeholder;
//  - un rótulo sólo cuenta si está ADYACENTE a una imagen/tabla → excluye las
//    líneas del índice de ilustraciones (estilo «table of figures»), que tienen el
//    mismo texto que los rótulos reales (aviso de la sesión de Talca).

import mammoth from "mammoth";
import { parse, type HTMLElement } from "node-html-parser";
import { numerarTitulos, normTitulo, type TituloNumerado } from "./numbering";

export type MapaRotulo = {
  codigo: string;
  rotulo: string; // "Figura 2-3" | "Cuadro 2-1"
  seccionArchivo: string;
  titulo: string;
};

export type ImageRef = { index: number; contentType: string; bytes: number };

export type ReviewBlock =
  | { type: "HEADING"; level: number; text: string; numero: string }
  | { type: "PARAGRAPH"; text: string }
  | { type: "TABLE"; columns: string[]; rows: string[][] }
  | {
      type: "FIGURE";
      rotulo: string; numero: string; titulo: string;
      codigo: string | null; seccionArchivo: string | null;
      image: ImageRef | null; fuente: string | null;
    }
  | {
      type: "CUADRO";
      rotulo: string; numero: string; titulo: string;
      codigo: string | null; seccionArchivo: string | null;
      columns: string[]; rows: string[][]; fuente: string | null;
    };

// `numero`: el número que Word le pone al título con su lista automática («2.5»), "" si no lleva.
export type ReviewSection = { title: string | null; numero: string; blocks: ReviewBlock[] };
export type ReviewChapter = { number: string; numero: string; title: string; sections: ReviewSection[]; frontMatter: boolean };
export type ReviewDoc = {
  chapters: ReviewChapter[];
  images: ImageRef[];
  /** Bytes de cada imagen, indexados por `ImageRef.index` (para servirlas). */
  imageBuffers: Buffer[];
  stats: { figuras: number; cuadros: number; tablas: number; rotulosNoAdyacentes: number };
  /** Títulos numerados: cuántos llevaron número y de dónde salió («docx» calculado o «csv» de Word). */
  titulos: { total: number; numerados: number; fuente: "docx" | "csv" };
  mapa: { total: number; emparejados: number; sinEmparejar: string[] };
  warnings: string[];
};

const ROTULO_RE = /^(Figura|Cuadro)\s+(\d+-\d+)\.\s*(.*)$/;
const FUENTE_RE = /^Fuente\s*:/i;

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Bloques "crudos" antes de fusionar rótulo + elemento.
type Raw =
  | { k: "heading"; level: number; text: string; numero: string }
  | { k: "paragraph"; text: string }
  | { k: "table"; columns: string[]; rows: string[][] }
  | { k: "image"; ref: ImageRef };

export async function parseReviewDocx(
  buffer: Buffer,
  mapa: MapaRotulo[] = [],
  titulosCsv: TituloNumerado[] | null = null
): Promise<ReviewDoc> {
  const images: ImageRef[] = [];
  const imageBuffers: Buffer[] = [];
  const convertImage = mammoth.images.imgElement(async (image) => {
    const b64 = await image.read("base64");
    const buf = Buffer.from(b64, "base64");
    const ref: ImageRef = { index: images.length, contentType: image.contentType, bytes: buf.length };
    images.push(ref);
    imageBuffers.push(buf);
    return { src: "" }; // el orden del <img> en el HTML == orden en images[]
  });

  const { value: html, messages } = await mammoth.convertToHtml({ buffer }, { convertImage });
  const warnings = [...new Set(messages.filter((m) => m.type === "warning").map((m) => m.message))];
  const root = parse(html);

  // Números de los títulos: el CSV del estudio (leído en Word) si viene; si no, calculados
  // del docx. Se emparejan en orden con los h1..h6 de mammoth por texto normalizado.
  const numerados = titulosCsv ?? await numerarTitulos(buffer);
  let numCursor = 0, numerados_ok = 0, totalTitulos = 0;
  const numeroDe = (text: string): string => {
    totalTitulos++;
    const k = normTitulo(text);
    for (let j = numCursor; j < Math.min(numerados.length, numCursor + 6); j++) {
      if (normTitulo(numerados[j].titulo) === k) { numCursor = j + 1; if (numerados[j].numero) numerados_ok++; return numerados[j].numero; }
    }
    return "";
  };

  const byRotulo = new Map(mapa.map((m) => [m.rotulo, m]));
  const emparejados = new Set<string>();

  const chapters: ReviewChapter[] = [];
  let chapterCount = 0;
  let imgCursor = 0;

  const ensureChapter = (): ReviewChapter => {
    // Capítulo auto-creado por contenido ANTES del primer h1 = portada/TOC/índices.
    if (chapters.length === 0) { chapterCount++; chapters.push({ number: String(chapterCount), numero: "", title: "Portada e índices", sections: [], frontMatter: true }); }
    return chapters[chapters.length - 1];
  };
  const ensureSection = (): ReviewSection => {
    const ch = ensureChapter();
    if (ch.sections.length === 0) ch.sections.push({ title: null, numero: "", blocks: [] });
    return ch.sections[ch.sections.length - 1];
  };
  // Acumulamos los bloques crudos por sección (clave "ci:si") y los fusionamos
  // (rótulo + elemento) al final.
  const raws = new Map<string, Raw[]>();
  const keyOf = () => `${chapters.length - 1}:${chapters[chapters.length - 1].sections.length - 1}`;
  const add = (r: Raw) => { ensureSection(); const k = keyOf(); (raws.get(k) ?? raws.set(k, []).get(k)!).push(r); };

  const parseTable = (el: HTMLElement): { columns: string[]; rows: string[][] } | null => {
    const trs = el.querySelectorAll("tr");
    if (!trs.length) return null;
    const columns = trs[0].querySelectorAll("th,td").map((c) => clean(c.text) || " ");
    const rows = trs.slice(1).map((r) => r.querySelectorAll("td,th").map((c) => clean(c.text)));
    return { columns, rows };
  };

  const takeImages = (el: HTMLElement): ImageRef[] => {
    const out: ImageRef[] = [];
    for (let i = 0; i < el.querySelectorAll("img").length; i++) { if (imgCursor < images.length) out.push(images[imgCursor++]); }
    return out;
  };

  for (const node of root.childNodes) {
    const el = node as HTMLElement;
    if (!el.tagName) continue;
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "h1": { chapterCount++; const t = clean(el.text); chapters.push({ number: String(chapterCount), numero: t ? numeroDe(t) : "", title: t || `Capítulo ${chapterCount}`, sections: [], frontMatter: false }); break; }
      case "h2": { const t = clean(el.text); ensureChapter().sections.push({ title: t || null, numero: t ? numeroDe(t) : "", blocks: [] }); break; }
      case "h3": case "h4": case "h5": case "h6": { const t = clean(el.text); if (t) add({ k: "heading", level: Number(tag[1]), text: t, numero: numeroDe(t) }); break; }
      case "table": { const t = parseTable(el); for (const ref of takeImages(el)) add({ k: "image", ref }); if (t) add({ k: "table", ...t }); break; }
      case "ul": case "ol": for (const li of el.querySelectorAll("li")) { const t = clean(li.text); if (t) add({ k: "paragraph", text: `• ${t}` }); break; }
      case "img": if (imgCursor < images.length) add({ k: "image", ref: images[imgCursor++] }); break;
      default: {
        for (const ref of takeImages(el)) add({ k: "image", ref });
        const t = clean(el.text); if (t) add({ k: "paragraph", text: t });
      }
    }
  }

  // Fusión rótulo + elemento, por sección.
  let figuras = 0, cuadros = 0, tablas = 0, rotulosNoAdyacentes = 0;
  for (const ch of chapters) {
    for (let si = 0; si < ch.sections.length; si++) {
      const list = raws.get(`${chapters.indexOf(ch)}:${si}`) ?? [];
      const used = new Set<number>();
      const blocks: ReviewBlock[] = [];

      const nearest = (i: number, want: "image" | "table"): number => {
        for (const j of [i + 1, i - 1, i + 2, i - 2]) {
          if (j < 0 || j >= list.length || used.has(j)) continue;
          if (list[j].k === want) return j;
        }
        return -1;
      };
      const fuenteAfter = (i: number): string | null => {
        const j = i + 1 < list.length ? i + 1 : -1;
        if (j >= 0 && !used.has(j) && list[j].k === "paragraph" && FUENTE_RE.test((list[j] as { text: string }).text)) { used.add(j); return (list[j] as { text: string }).text; }
        return null;
      };

      for (let i = 0; i < list.length; i++) {
        if (used.has(i)) continue;
        const r = list[i];
        if (r.k === "paragraph") {
          const m = ROTULO_RE.exec(r.text);
          if (m) {
            const [, kind, numero, titulo] = m;
            const rotulo = `${kind} ${numero}`;
            const info = byRotulo.get(rotulo);
            if (info) emparejados.add(rotulo);
            if (kind === "Figura") {
              const j = nearest(i, "image");
              if (j >= 0) { used.add(i); used.add(j); figuras++; const fuente = fuenteAfter(Math.max(i, j));
                blocks.push({ type: "FIGURE", rotulo, numero, titulo: info?.titulo || titulo, codigo: info?.codigo || null, seccionArchivo: info?.seccionArchivo || null, image: (list[j] as { ref: ImageRef }).ref, fuente }); continue; }
            } else {
              const j = nearest(i, "table");
              if (j >= 0) { used.add(i); used.add(j); cuadros++; const t = list[j] as { columns: string[]; rows: string[][] }; const fuente = fuenteAfter(Math.max(i, j));
                blocks.push({ type: "CUADRO", rotulo, numero, titulo: info?.titulo || titulo, codigo: info?.codigo || null, seccionArchivo: info?.seccionArchivo || null, columns: t.columns, rows: t.rows, fuente }); continue; }
            }
            rotulosNoAdyacentes++; // rótulo sin elemento adyacente (índice de ilustraciones) → queda como párrafo
          }
          blocks.push({ type: "PARAGRAPH", text: r.text });
        } else if (r.k === "heading") {
          blocks.push({ type: "HEADING", level: r.level, text: r.text, numero: r.numero });
        } else if (r.k === "table") {
          used.add(i); tablas++; blocks.push({ type: "TABLE", columns: r.columns, rows: r.rows });
        } else if (r.k === "image") {
          // imagen suelta sin rótulo reconocido: la conservamos como figura sin número
          figuras++; blocks.push({ type: "FIGURE", rotulo: "", numero: "", titulo: "", codigo: null, seccionArchivo: null, image: r.ref, fuente: null });
        }
      }
      ch.sections[si].blocks = blocks;
    }
  }

  const sinEmparejar = mapa.map((m) => m.rotulo).filter((r) => !emparejados.has(r));
  return {
    chapters, images, imageBuffers,
    stats: { figuras, cuadros, tablas, rotulosNoAdyacentes },
    titulos: { total: totalTitulos, numerados: numerados_ok, fuente: titulosCsv ? "csv" : "docx" },
    mapa: { total: mapa.length, emparejados: emparejados.size, sinEmparejar },
    warnings,
  };
}
