// Figuras agrupadas en pestañas. El estudio deja junto al docx `<stem>_grupos_figuras.csv`
// (grupo, titulo_grupo, orden, codigo, rotulo, pestana): figuras consecutivas que son la
// misma vista con otra variable. El visor las muestra como UN bloque con una pestaña por
// figura; todas siguen en el documento (con su código y rótulo), así el anclaje no cambia.
//
// Reglas: una fila se empareja con su figura por código y, si falla, por rótulo. Un grupo
// con una fila que no calza (o con menos de dos figuras) se muestra suelto, como sin CSV.
// Si las figuras no son consecutivas en el docx, el bloque va en la posición de la primera
// y se avisa. Los avisos los imprime el CLI y el visor los repite en la consola del navegador.

import type { ReviewDoc, ReviewBlock } from "./parse";

export type FilaGrupo = { grupo: string; titulo_grupo: string; orden: number; codigo: string; rotulo: string; pestana: string };

export type MiembroGrupo = { bid: string; block: ReviewBlock; ch: string; sec: string; pestana: string };
export type GrupoFiguras = { grupo: string; titulo: string; miembros: MiembroGrupo[] };
/** `lider`: bid donde se dibuja el bloque (la figura del grupo que aparece primero); `miembros`: los demás bids, que se omiten en su lugar. */
export type PlanGrupos = { lider: Map<string, GrupoFiguras>; miembros: Set<string>; grupos: GrupoFiguras[]; avisos: string[] };

export const PLAN_VACIO: PlanGrupos = { lider: new Map(), miembros: new Set(), grupos: [], avisos: [] };

export function leerGruposCsv(text: string): FilaGrupo[] {
  const t = text.replace(/^﻿/, "");
  const rows: string[][] = []; let f = "", r: string[] = [], q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { r.push(f); f = ""; } else if (c === "\n") { r.push(f); rows.push(r); r = []; f = ""; } else if (c !== "\r") f += c; }
  if (f || r.length) { r.push(f); rows.push(r); }
  const h = (rows.shift() ?? []).map((x) => x.trim());
  const v = (x: string[], k: string) => (h.indexOf(k) >= 0 ? (x[h.indexOf(k)] ?? "").trim() : "");
  return rows.filter((x) => x.some((s) => s.trim())).map((x) => ({
    grupo: v(x, "grupo"), titulo_grupo: v(x, "titulo_grupo"), orden: Number(v(x, "orden")) || 0,
    codigo: v(x, "codigo"), rotulo: v(x, "rotulo"), pestana: v(x, "pestana"),
  }));
}

// Recorre el documento con los mismos bids que `renderBodyToc` (capítulos sin portada).
export function planGrupos(doc: ReviewDoc, filas: FilaGrupo[] | null): PlanGrupos {
  if (!filas?.length) return PLAN_VACIO;
  type Pos = { bid: string; flat: number; block: ReviewBlock; ch: string; sec: string };
  const porCodigo = new Map<string, Pos>(), porRotulo = new Map<string, Pos>();
  let flat = 0;
  doc.chapters.filter((c) => !c.frontMatter).forEach((ch, ci) => ch.sections.forEach((s, si) => s.blocks.forEach((b, bi) => {
    const p: Pos = { bid: `${ci}.${si}.${bi}`, flat: flat++, block: b, ch: ch.title, sec: s.title ?? "" };
    if (b.type !== "FIGURE") return;
    if (b.codigo && !porCodigo.has(b.codigo)) porCodigo.set(b.codigo, p);
    if (b.rotulo && !porRotulo.has(b.rotulo)) porRotulo.set(b.rotulo, p);
  })));

  const avisos: string[] = [];
  const porGrupo = new Map<string, FilaGrupo[]>();
  for (const f of filas) { if (!f.grupo) { avisos.push(`fila sin grupo (${f.codigo || f.rotulo}): ignorada`); continue; } (porGrupo.get(f.grupo) ?? porGrupo.set(f.grupo, []).get(f.grupo)!).push(f); }

  const plan: PlanGrupos = { lider: new Map(), miembros: new Set(), grupos: [], avisos };
  const usados = new Set<string>();
  for (const [g, fs] of porGrupo) {
    fs.sort((a, b) => a.orden - b.orden);
    const pos: (Pos & { pestana: string })[] = [];
    const faltan: string[] = [];
    for (const f of fs) {
      const p = (f.codigo && porCodigo.get(f.codigo)) || (f.rotulo && porRotulo.get(f.rotulo)) || null;
      if (!p) faltan.push(f.codigo || f.rotulo || "(fila vacía)");
      else if (usados.has(p.bid) || pos.some((x) => x.bid === p.bid)) faltan.push(`${f.codigo || f.rotulo} (ya está en otro grupo)`);
      else pos.push({ ...p, pestana: f.pestana || (p.block.type === "FIGURE" ? p.block.rotulo : "") });
    }
    if (faltan.length) { avisos.push(`grupo ${g}: sin figura en el docx para ${faltan.join(", ")} → figuras sueltas`); continue; }
    if (pos.length < 2) { avisos.push(`grupo ${g}: una sola figura → suelta`); continue; }
    const enDoc = [...pos].sort((a, b) => a.flat - b.flat);
    if (enDoc.some((p, i) => i > 0 && p.flat !== enDoc[i - 1].flat + 1))
      avisos.push(`grupo ${g}: figuras no consecutivas en el docx (${enDoc.map((p) => p.block.type === "FIGURE" ? p.block.rotulo : p.bid).join(", ")}) → agrupadas en la posición de la primera`);
    const grupo: GrupoFiguras = { grupo: g, titulo: fs[0].titulo_grupo, miembros: pos.map((p) => ({ bid: p.bid, block: p.block, ch: p.ch, sec: p.sec, pestana: p.pestana })) };
    plan.grupos.push(grupo);
    plan.lider.set(enDoc[0].bid, grupo);
    for (const p of enDoc.slice(1)) plan.miembros.add(p.bid);
    for (const p of pos) usados.add(p.bid);
  }
  return plan;
}
