// Numeración de los TÍTULOS del .docx para el modo revisión. `informe-word` numera los
// títulos con la lista automática de Word (`numPr` en el estilo «heading N» o en el
// párrafo), así que el número no está en el texto y mammoth lo pierde. Acá se
// recalcula desde `numbering.xml` + `styles.xml` + `document.xml`, recorriendo TODOS
// los párrafos de la lista (también los que no son título, que igual avanzan el
// contador), como lo hace Word.
//
// Si el estudio deja junto al docx un `<stem>_titulos.csv` (nivel, numero, titulo),
// leído de Word con `ListFormat.ListString`, ese archivo manda: es la verdad de Word.

import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

export type TituloNumerado = { nivel: number; numero: string; titulo: string };

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
type El = Element;

const kids = (el: El | null | undefined, local: string): El[] => {
  if (!el) return [];
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (n as El).localName === local) out.push(n as El);
  return out;
};
const kid = (el: El | null | undefined, local: string): El | null => kids(el, local)[0] ?? null;
const val = (el: El | null | undefined): string | null => (el ? el.getAttributeNS(W, "val") || el.getAttribute("w:val") : null);

type NumPr = { numId: string | null; ilvl: number | null };
const readNumPr = (pPr: El | null): NumPr | null => {
  const np = kid(pPr, "numPr");
  if (!np) return null;
  const il = val(kid(np, "ilvl"));
  return { numId: val(kid(np, "numId")), ilvl: il == null ? null : Number(il) };
};

type Lvl = { start: number; fmt: string; text: string; isLgl: boolean; pStyle: string | null };

function fmtNum(n: number, fmt: string): string {
  const roman = (x: number) => {
    const t: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
    let s = ""; for (const [v, r] of t) while (x >= v) { s += r; x -= v; } return s;
  };
  const letter = (x: number) => String.fromCharCode(97 + ((x - 1) % 26)).repeat(Math.floor((x - 1) / 26) + 1);
  switch (fmt) {
    case "upperRoman": return roman(n).toUpperCase();
    case "lowerRoman": return roman(n);
    case "upperLetter": return letter(n).toUpperCase();
    case "lowerLetter": return letter(n);
    case "decimalZero": return n < 10 ? "0" + n : String(n);
    case "none": case "bullet": return "";
    default: return String(n);
  }
}

const textOf = (p: El): string => {
  const ts = p.getElementsByTagNameNS(W, "t");
  let s = ""; for (let i = 0; i < ts.length; i++) s += ts[i].textContent ?? "";
  return s.replace(/\s+/g, " ").trim();
};

/** Títulos («heading 1..9») del docx en orden, con el número que les pone Word. */
export async function numerarTitulos(buffer: Buffer): Promise<TituloNumerado[]> {
  const zip = await JSZip.loadAsync(buffer);
  const read = async (p: string) => { const f = zip.file(p); return f ? f.async("string") : null; };
  const [docXml, stylesXml, numXml] = await Promise.all([read("word/document.xml"), read("word/styles.xml"), read("word/numbering.xml")]);
  if (!docXml) return [];
  const parser = new DOMParser();

  // Estilos: nombre, basedOn y numPr (heredables).
  const styles = new Map<string, { name: string; basedOn: string | null; numPr: NumPr | null }>();
  if (stylesXml) {
    const sd = parser.parseFromString(stylesXml, "text/xml");
    const ss = sd.getElementsByTagNameNS(W, "style");
    for (let i = 0; i < ss.length; i++) {
      const s = ss[i]; const id = s.getAttributeNS(W, "styleId") || s.getAttribute("w:styleId");
      if (!id) continue;
      styles.set(id, { name: (val(kid(s, "name")) ?? "").toLowerCase(), basedOn: val(kid(s, "basedOn")), numPr: readNumPr(kid(s, "pPr")) });
    }
  }
  const styleNumPr = (id: string | null): NumPr | null => {
    let numId: string | null = null, ilvl: number | null = null;
    for (let cur = id, guard = 0; cur && guard < 20; guard++) {
      const s = styles.get(cur); if (!s) break;
      if (s.numPr) { numId ??= s.numPr.numId; ilvl ??= s.numPr.ilvl; }
      cur = s.basedOn;
    }
    return numId == null && ilvl == null ? null : { numId, ilvl };
  };

  // Numeración: num → abstractNum (+ startOverride), abstractNum → niveles.
  const nums = new Map<string, { abs: string; overrides: Map<number, number> }>();
  const abstracts = new Map<string, Lvl[]>();
  if (numXml) {
    const nd = parser.parseFromString(numXml, "text/xml");
    const as = nd.getElementsByTagNameNS(W, "abstractNum");
    for (let i = 0; i < as.length; i++) {
      const a = as[i]; const id = a.getAttributeNS(W, "abstractNumId") || a.getAttribute("w:abstractNumId");
      const lv: Lvl[] = [];
      for (const l of kids(a, "lvl")) {
        const il = Number(l.getAttributeNS(W, "ilvl") || l.getAttribute("w:ilvl") || 0);
        lv[il] = { start: Number(val(kid(l, "start")) ?? 1), fmt: val(kid(l, "numFmt")) ?? "decimal", text: val(kid(l, "lvlText")) ?? "", isLgl: !!kid(l, "isLgl"), pStyle: val(kid(l, "pStyle")) };
      }
      if (id != null) abstracts.set(id, lv);
    }
    const ns = nd.getElementsByTagNameNS(W, "num");
    for (let i = 0; i < ns.length; i++) {
      const n = ns[i]; const id = n.getAttributeNS(W, "numId") || n.getAttribute("w:numId");
      const abs = val(kid(n, "abstractNumId"));
      const overrides = new Map<number, number>();
      for (const o of kids(n, "lvlOverride")) { const so = val(kid(o, "startOverride")); if (so != null) overrides.set(Number(o.getAttributeNS(W, "ilvl") || o.getAttribute("w:ilvl") || 0), Number(so)); }
      if (id && abs != null) nums.set(id, { abs, overrides });
    }
  }

  // Recorrido en orden de documento: contadores por abstractNum, como Word.
  const counters = new Map<string, (number | undefined)[]>();
  const overridden = new Set<string>();
  const out: TituloNumerado[] = [];
  const dd = parser.parseFromString(docXml, "text/xml");
  const ps = dd.getElementsByTagNameNS(W, "p");
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; const pPr = kid(p, "pPr");
    const styleId = val(kid(pPr, "pStyle"));
    const sName = styleId ? styles.get(styleId)?.name ?? "" : "";
    const hm = /^heading ([1-9])$/.exec(sName);

    const direct = readNumPr(pPr), viaStyle = styleNumPr(styleId);
    const numId = direct?.numId ?? viaStyle?.numId ?? null;
    let numero = "";
    const num = numId && numId !== "0" ? nums.get(numId) : undefined;
    const lv = num ? abstracts.get(num.abs) : undefined;
    if (num && lv) {
      let ilvl = direct?.ilvl ?? viaStyle?.ilvl ?? null;
      if (ilvl == null) { const k = lv.findIndex((l) => l && l.pStyle === styleId); ilvl = k >= 0 ? k : 0; }
      const L = lv[ilvl];
      if (L) {
        const c = counters.get(num.abs) ?? []; counters.set(num.abs, c);
        if (num.overrides.size && !overridden.has(numId!)) { overridden.add(numId!); for (const [k, v] of num.overrides) c[k] = v - 1; }
        c[ilvl] = c[ilvl] == null ? L.start : c[ilvl]! + 1;
        for (let k = ilvl + 1; k < c.length; k++) c[k] = undefined;
        numero = L.text.replace(/%([1-9])/g, (_, d: string) => {
          const k = Number(d) - 1; const lk = lv[k];
          const n = c[k] ?? lk?.start ?? 1;
          return fmtNum(n, L.isLgl ? "decimal" : lk?.fmt ?? "decimal");
        }).trim();
      }
    }
    if (hm) { const t = textOf(p); if (t) out.push({ nivel: Number(hm[1]), numero, titulo: t }); }
  }
  return out;
}

/** Lee `<stem>_titulos.csv` (nivel, numero, titulo) que el estudio saca de Word. */
export function leerTitulosCsv(text: string): TituloNumerado[] {
  const t = text.replace(/^﻿/, "");
  const rows: string[][] = []; let f = "", r: string[] = [], q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { r.push(f); f = ""; } else if (c === "\n") { r.push(f); rows.push(r); r = []; f = ""; } else if (c !== "\r") f += c; }
  if (f || r.length) { r.push(f); rows.push(r); }
  const h = rows.shift() ?? [];
  const ix = (k: string) => h.indexOf(k);
  return rows.filter((x) => x.some((v) => v.trim())).map((x) => ({ nivel: Number(x[ix("nivel")]) || 0, numero: (x[ix("numero")] ?? "").trim(), titulo: (x[ix("titulo")] ?? "").trim() }));
}

export const normTitulo = (s: string): string =>
  s.normalize("NFKC").toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 40);
