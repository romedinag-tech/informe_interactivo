// Render del VISOR DE REVISIÓN interna (estructura + estilos + anclaje). Piezas
// COMPARTIDAS por el modo servidor (`renderReviewHtml`, imágenes servidas en `/img/N`,
// persistencia vía POST) y el modo OFFLINE (`offline-html.ts`, imágenes como data: URI,
// persistencia en localStorage). Lo único que cambia entre modos es la fuente de las
// imágenes y el script de cliente; todo lo demás (CSS, bloques, composer) se reusa.

import type { ReviewDoc, ReviewBlock } from "./parse";
import { PLAN_VACIO, type PlanGrupos, type GrupoFiguras } from "./grupos";

// `informe` es la llave de las observaciones guardadas (no cambiarla entre corridas);
// `estudio` y `titulo` son los textos del encabezado, que vienen de parámetros.
export type ReviewMeta = { informe: string; version: string; ronda: number; estudio?: string; titulo?: string };
export type ImgOpts = { imgSrc: (index: number) => string; lazy: boolean };

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tableHtml(columns: string[], rows: string[][]): string {
  const head = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table class="cuadro-tabla"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

// `extra`: clases y atributos de la figura cuando va como pestaña de un grupo.
function blockHtml(b: ReviewBlock, bid: string, ctx: { ch: string; sec: string }, io: ImgOpts, extra = ""): string {
  const anchorData = `data-bid="${bid}" data-ch="${esc(ctx.ch)}" data-sec="${esc(ctx.sec)}"${extra}`;
  const lazy = io.lazy ? ' loading="lazy"' : "";
  switch (b.type) {
    case "HEADING":
      return `<h3 class="subt" id="h-${bid.replace(/\./g, "-")}" data-bid="${bid}">${numHtml(b.numero)}${esc(b.text)}</h3>`;
    case "PARAGRAPH":
      return `<p class="block texto" ${anchorData} data-tipo="texto">${esc(b.text)}</p>`;
    case "TABLE":
      return `<div class="block tabla" ${anchorData} data-tipo="texto"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar</button></div>${tableHtml(b.columns, b.rows)}</div>`;
    case "FIGURE": {
      const cap = b.rotulo ? `<figcaption><b>${esc(b.rotulo)}.</b> ${esc(b.titulo)}${b.fuente ? `<span class="fuente">${esc(b.fuente)}</span>` : ""}</figcaption>` : "";
      const img = b.image ? `<img src="${io.imgSrc(b.image.index)}" alt="${esc(b.rotulo || "figura")}"${lazy}>` : "";
      return `<figure class="block figura${extra ? " fg-pane" : ""}" ${anchorData} data-tipo="figura" data-rotulo="${esc(b.rotulo)}" data-codigo="${esc(b.codigo ?? "")}" data-secarch="${esc(b.seccionArchivo ?? "")}"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar figura</button></div>${img}${cap}</figure>`;
    }
    case "CUADRO": {
      const cap = `<figcaption><b>${esc(b.rotulo)}.</b> ${esc(b.titulo)}${b.fuente ? `<span class="fuente">${esc(b.fuente)}</span>` : ""}</figcaption>`;
      return `<figure class="block cuadro" ${anchorData} data-tipo="cuadro" data-rotulo="${esc(b.rotulo)}" data-codigo="${esc(b.codigo ?? "")}" data-secarch="${esc(b.seccionArchivo ?? "")}"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar cuadro</button></div>${cap}${tableHtml(b.columns, b.rows)}</figure>`;
    }
  }
}

// Número del título (el de la lista de Word), aparte del texto: el anclaje usa sólo el texto.
const numHtml = (n: string): string => (n ? `<span class="num">${esc(n)}</span>` : "");

// Figuras agrupadas: un bloque con una pestaña por figura, en la posición de la primera.
// Cada figura conserva su <figure class="block figura"> (código, rótulo, botón de observar);
// las no activas sólo se ocultan (`hidden`), así el anclaje y el resaltado no cambian.
function grupoHtml(g: GrupoFiguras, io: ImgOpts): string {
  const tabs = g.miembros.map((m, i) => `<button type="button" role="tab" data-fgi="${i}"${i ? "" : ' class="on"'} title="${esc(m.block.type === "FIGURE" ? m.block.rotulo : "")}">${esc(m.pestana)}</button>`).join("");
  const panes = g.miembros.map((m, i) => blockHtml(m.block, m.bid, { ch: m.ch, sec: m.sec }, io, ` data-fgi="${i}"${i ? " hidden" : ""}`)).join("");
  return `<div class="fig-grupo" data-grupo="${esc(g.grupo)}">${g.titulo ? `<div class="fg-titulo">${esc(g.titulo)}</div>` : ""}<div class="fg-tabs" role="tablist">${tabs}</div>${panes}</div>`;
}

// Construye el índice (TOC) y el cuerpo del documento (capítulos de contenido).
export function renderBodyToc(doc: ReviewDoc, io: ImgOpts, grupos: PlanGrupos = PLAN_VACIO): { toc: string; body: string } {
  const toc: string[] = [];
  const body: string[] = [];
  const tocEntry = (lvl: number, id: string, text: string, numero: string) =>
    toc.push(`<a class="toc-ch toc-l${lvl}" data-lvl="${lvl}" href="#${id}">${numHtml(numero)}<span class="t">${esc(text)}</span></a>`);
  doc.chapters.filter((c) => !c.frontMatter).forEach((ch, ci) => {
    const chId = `ch-${ci}`;
    tocEntry(1, chId, ch.title, ch.numero);
    body.push(`<section class="chapter" id="${chId}"><h1>${numHtml(ch.numero)}${esc(ch.title)}</h1>`);
    ch.sections.forEach((sec, si) => {
      const secTitle = sec.title ?? "";
      if (secTitle) { body.push(`<h2 class="sec" id="${chId}-s${si}">${numHtml(sec.numero)}${esc(secTitle)}</h2>`); tocEntry(2, `${chId}-s${si}`, secTitle, sec.numero); }
      sec.blocks.forEach((b, bi) => {
        const bid = `${ci}.${si}.${bi}`;
        if (b.type === "HEADING") tocEntry(Math.min(b.level, 4), `h-${ci}-${si}-${bi}`, b.text, b.numero);
        const g = grupos.lider.get(bid);
        if (g) body.push(grupoHtml(g, io));
        else if (!grupos.miembros.has(bid)) body.push(blockHtml(b, bid, { ch: ch.title, sec: secTitle }, io));
      });
    });
    body.push(`</section>`);
  });
  return { toc: toc.join("\n"), body: body.join("\n") };
}

export const STYLES = `
  :root{ --bg:#f1f4f8; --card:#fff; --soft:#eef2f7; --line:#dbe1ea; --line-2:#c3ccda; --ink:#16202f; --muted:#4a5a70; --faint:#7c8aa0; --navy:#16365a; --accent:#1e4d88; --accent-soft:#e9f0f9; --warn:#C55A11;
    --r:14px; --sh-sm:0 1px 2px rgba(14,35,56,.05); --sh:0 1px 3px rgba(14,35,56,.05),0 10px 26px rgba(14,35,56,.07);
    --font-display:'Source Serif 4',Georgia,serif; --font-ui:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;
    --paper:#fbfcfe; --grad:linear-gradient(135deg,#0E2338 0%,#16365a 60%,#21507F 100%); }
  :root[data-theme="sepia"]{ --bg:#e9dec5; --card:#f8f3e8; --soft:#f1e8d6; --line:#dccfb2; --line-2:#cbb98f; --ink:#362f1f; --muted:#6b5e45; --faint:#8a7c60; --navy:#5f4120; --accent:#7a542a; --accent-soft:#efe6d2; --warn:#9c5a1e;
    --sh:0 1px 3px rgba(54,47,31,.06),0 10px 26px rgba(54,47,31,.08); --paper:#f4ecdb; --grad:linear-gradient(135deg,#3a2812 0%,#5f4120 60%,#7a542a 100%); }
  :root[data-theme="dark"]{ --bg:#0a0d13; --card:#151c27; --soft:#1a212c; --line:#232c3a; --line-2:#2b3547; --ink:#e9eef5; --muted:#8a93a5; --faint:#6b7382; --navy:#ff6a1a; --accent:#ff7a2e; --accent-soft:rgba(255,106,26,.15); --warn:#ff9d2f;
    --sh-sm:0 1px 2px rgba(0,0,0,.5); --sh:0 10px 26px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.5); --paper:#10161f; --grad:linear-gradient(135deg,#12161f 0%,#0d1119 60%,#161d28 100%); }
  *{box-sizing:border-box} html,body{margin:0}
  body{font:16px/1.65 var(--font-ui);color:var(--ink);background:var(--bg)}
  .page{max-width:1280px;margin:0 auto;padding:18px clamp(16px,2.5vw,32px) 28px}
  .apphead{position:relative;text-align:center;padding:26px 26px 22px;background:var(--grad);color:#fff;border-radius:18px;margin:0 0 16px;box-shadow:var(--sh);overflow:hidden}
  .apphead .estudio{font:700 clamp(1.3rem,2.1vw,1.95rem)/1.18 var(--font-display);letter-spacing:-.01em;max-width:960px;margin:0 auto}
  .apphead .inf{font:600 .8rem/1.3 var(--font-ui);text-transform:uppercase;letter-spacing:.6px;opacity:.88;margin-top:9px}
  .apphead .rev{display:inline-block;margin-top:10px;font:600 .7rem/1.3 var(--font-ui);text-transform:uppercase;letter-spacing:.5px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.26);border-radius:999px;padding:3px 12px}
  .wrap{display:grid;grid-template-columns:250px minmax(0,1fr) 330px;gap:0;min-height:100vh;background:var(--paper);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh)}
  nav.toc{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;padding:18px 12px;border-right:1px solid var(--line);background:var(--card);border-radius:var(--r) 0 0 var(--r)}
  nav.toc .brand{font-weight:700;color:var(--navy);font-size:13px;letter-spacing:.04em;text-transform:uppercase}
  nav.toc .ver{color:var(--muted);font-size:12px;margin:2px 0 14px}
  .toc-ch{display:block;padding:5px 8px;border-radius:7px;color:var(--ink);text-decoration:none;font-size:13.5px}
  .toc-ch:hover{background:var(--soft)}
  .toc-ch.toc-l1{font-weight:600;color:var(--navy);margin-top:6px}
  .toc-ch.toc-l2{padding-left:18px;font-size:12.5px}
  .toc-ch.toc-l3{padding-left:30px;font-size:12px;color:var(--muted)}
  .toc-ch.toc-l4{padding-left:42px;font-size:11.5px;color:var(--muted)}
  .toc-levels{display:flex;gap:4px;margin:4px 0 12px;align-items:center}
  .toc-levels span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-right:2px}
  .toc-levels button{font:600 11px Segoe UI;border:1px solid var(--line);background:var(--card);border-radius:6px;padding:2px 7px;cursor:pointer;color:var(--muted)}
  .toc-levels button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
  .theme-toggle{display:flex;gap:4px;margin:10px 0 2px}
  .theme-toggle button{flex:1;font-size:15px;border:1px solid var(--line);background:var(--card);border-radius:8px;padding:4px 0;cursor:pointer;color:var(--muted)}
  .theme-toggle button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
  .toc-ch .num{font-variant-numeric:tabular-nums;color:var(--faint);font-weight:600;margin-right:6px}
  .toc-ch.active{background:var(--accent-soft);color:var(--accent);font-weight:700;box-shadow:inset 3px 0 0 var(--accent);border-radius:0 7px 7px 0}
  .toc-ch.active .num{color:var(--accent)}
  main .num{color:var(--accent);margin-right:.45em;font-variant-numeric:tabular-nums}
  main h1,main h2.sec,h3.subt{scroll-margin-top:14px}
  #readbar{position:fixed;top:0;left:0;height:3px;width:0;background:var(--accent);z-index:60;transition:width .12s ease-out}
  #readlabel{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:55;background:var(--card);border:1px solid var(--line);box-shadow:var(--sh);border-radius:999px;padding:6px 16px;font:600 12.5px var(--font-ui);color:var(--ink);max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0;transition:opacity .25s;pointer-events:none}
  #readlabel b{color:var(--accent);font-weight:700;margin-right:7px;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
  main{padding:34px 40px 120px;max-width:820px;min-width:0}
  main h1{font:700 27px/1.2 var(--font-display);color:var(--ink);margin:38px 0 8px;letter-spacing:-.01em}
  main h2.sec{font:600 19px/1.3 var(--font-display);color:var(--ink);margin:28px 0 6px;border-left:3px solid var(--accent);padding-left:12px}
  h3.subt{font:600 15px/1.35 var(--font-ui);color:var(--navy);margin:18px 0 4px}
  p.texto{margin:10px 0}
  .block{position:relative}
  .block.figura,.block.cuadro,.block.tabla{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px;margin:20px 0;max-width:100%;overflow-x:auto;box-shadow:var(--sh-sm)}
  .block img{max-width:100%;height:auto;border-radius:8px;display:block;margin:0 auto}
  figcaption{font-size:13px;color:var(--muted);margin-top:8px}
  figcaption .fuente{display:block;font-style:italic;margin-top:2px}
  .cuadro-tabla{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}
  .cuadro-tabla th,.cuadro-tabla td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
  .cuadro-tabla th{background:var(--soft)}
  .obs-btn-wrap{position:absolute;top:8px;right:10px;opacity:0;transition:.12s}
  .block:hover .obs-btn-wrap{opacity:1}
  .obs-btn{font:600 12px Segoe UI;border:1px solid var(--navy);color:var(--navy);background:var(--card);border-radius:999px;padding:3px 10px;cursor:pointer}
  .obs-btn:hover{background:var(--navy);color:#fff}
  .anchored{background:#fde8d4;border-bottom:2px solid var(--warn);cursor:pointer}
  aside.obs{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;border-left:1px solid var(--line);background:var(--card);padding:18px 16px;border-radius:0 var(--r) var(--r) 0}
  aside.obs h2{font:700 13px Segoe UI;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 12px}
  aside.obs .acts{display:flex;gap:8px;margin:0 0 12px}
  aside.obs .acts button{font:600 12px Segoe UI;border:1px solid var(--navy);color:var(--navy);background:var(--card);border-radius:8px;padding:5px 10px;cursor:pointer}
  aside.obs .acts button:hover{background:var(--accent-soft)}
  aside.obs .imp-status{font-size:11px;color:var(--muted);margin:-6px 0 10px;min-height:1px}
  aside.obs .warnbar{font-size:12px;color:#b3261e;background:#fdeceb;border:1px solid #f3c2bd;border-radius:8px;padding:6px 8px;margin-bottom:10px;display:none}
  .obs-item{border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:10px}
  .obs-item .tag{font:600 10.5px Segoe UI;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:var(--accent);border-radius:6px;padding:1px 7px}
  .obs-item .tag.figura{background:var(--warn)} .obs-item .tag.cuadro{background:#2d7d5a}
  .obs-item .cita{font-size:12.5px;color:var(--muted);font-style:italic;margin:6px 0;border-left:3px solid var(--line);padding-left:8px}
  .obs-item .txt{font-size:13.5px;white-space:pre-wrap}
  .obs-item .meta{font-size:11px;color:var(--muted);margin-top:6px;display:flex;justify-content:space-between;align-items:center}
  .obs-item .del{color:#b3261e;cursor:pointer;border:none;background:none;font-size:11px}
  .obs-sum{font-size:11.5px;color:var(--muted);margin:-6px 0 12px}
  .estado{font:600 10px Segoe UI;text-transform:uppercase;letter-spacing:.03em;border-radius:5px;padding:1px 6px;border:1px solid var(--line);color:var(--muted)}
  .estado.atendida{color:#1D4E7A;border-color:#1D4E7A} .estado.respondida{color:#2d7d5a;border-color:#2d7d5a}
  .obs-item.orphan{border-color:var(--warn);background:#fff7ef}
  .orphan-tag{font:600 10px Segoe UI;color:var(--warn)}
  .obs-item .resp{font-size:12.5px;color:#2d7d5a;border-left:3px solid #2d7d5a;padding-left:8px;margin:6px 0}
  .empty{color:var(--muted);font-size:13px}
  #composer{position:fixed;z-index:50;display:none;width:340px;left:50%;top:110px;transform:translateX(-50%);background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(14,51,88,.18);padding:12px}
  #composer .cita{font-size:12.5px;color:var(--muted);font-style:italic;border-left:3px solid var(--warn);padding-left:8px;margin-bottom:8px;max-height:84px;overflow:auto}
  #composer textarea{width:100%;min-height:72px;border:1px solid var(--line);border-radius:8px;padding:8px;font:14px inherit;resize:vertical}
  #composer .row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
  #composer button{font:600 13px Segoe UI;border-radius:8px;padding:6px 12px;cursor:pointer;border:1px solid var(--line);background:var(--card)}
  #composer button.save{background:var(--navy);color:#fff;border-color:var(--navy)}
  #composer .rec-row{display:flex;align-items:center;gap:8px;margin-top:8px}
  #comp-rec{font:600 13px Segoe UI;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:5px 12px;cursor:pointer}
  #comp-rec.rec{background:#b3261e;color:#fff;border-color:#b3261e}
  #rec-status{font-size:12px;color:var(--muted)}
  .obs-item audio{width:100%;margin-top:6px;height:30px}
  .obs-item .voz{color:var(--warn)}
  #sel-btn{position:absolute;z-index:40;display:none;transform:translate(-50%,-120%)}
  /* Texto observado: resaltado tipo marcador (o tachado, alternativo); figuras y cuadros con contorno. */
  mark.obs-mark{background:#fff07a;color:inherit;border-radius:2px;cursor:pointer;padding:0}
  mark.obs-mark mark.obs-mark{background:#ffd84a}
  :root[data-theme="dark"] mark.obs-mark{background:rgba(255,214,0,.30)} :root[data-theme="dark"] mark.obs-mark mark.obs-mark{background:rgba(255,214,0,.52)}
  body.marca-tachado mark.obs-mark{background:transparent;text-decoration:line-through;text-decoration-color:#e6b800;text-decoration-thickness:2px}
  .block.obs-fig{outline:3px solid #f2c200;outline-offset:2px}
  .block.obs-fig figcaption b{background:#fff07a;color:var(--ink);cursor:pointer;border-radius:2px}
  mark.obs-mark.flash,.block.obs-fig.flash{box-shadow:0 0 0 3px var(--accent)}
  .obs-item.focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft);z-index:3}
  .obs-item[data-oid]{cursor:pointer;background:var(--card)}
  .obs-head{background:var(--card)}
  .obs-vista{display:flex;gap:4px;margin:0 0 10px;align-items:center;flex-wrap:wrap}
  .obs-vista span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-right:2px}
  .obs-vista button{font:600 11px Segoe UI;border:1px solid var(--line);background:var(--card);border-radius:6px;padding:2px 7px;cursor:pointer;color:var(--muted)}
  .obs-vista button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
  /* Vista al margen (como Word): el panel crece con el documento y cada comentario va a la altura de su texto. */
  body.margen aside.obs{position:relative;height:auto;overflow:visible;align-self:stretch}
  body.margen .obs-head{position:sticky;top:0;z-index:5;padding-bottom:6px;border-bottom:1px solid var(--line);margin-bottom:8px}
  body.margen #obs-list{position:relative}
  body.margen #obs-list .obs-item{position:absolute;left:0;right:0;margin:0}
  /* Figuras agrupadas: un bloque, una pestaña por figura. */
  .fig-grupo{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 16px 16px;margin:20px 0;box-shadow:var(--sh-sm)}
  .fig-grupo .fg-titulo{font:600 13.5px/1.35 var(--font-ui);color:var(--navy);margin:0 0 8px}
  .fg-tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--line);margin:0 0 12px}
  .fg-tabs button{font:600 12px var(--font-ui);border:1px solid var(--line);border-bottom:none;background:var(--soft);color:var(--muted);border-radius:8px 8px 0 0;padding:5px 12px;cursor:pointer;margin-bottom:-1px}
  .fg-tabs button.on{background:var(--card);color:var(--accent);border-color:var(--line-2);box-shadow:inset 0 2px 0 var(--accent)}
  .fg-tabs button.tiene-obs::after{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#f2c200;margin-left:6px;vertical-align:middle}
  .fig-grupo .block.figura{border:none;box-shadow:none;margin:0;padding:0;background:transparent}
  .fig-grupo .block.figura[hidden]{display:none}
  /* Contador de observaciones pendientes por título (sección y subsecciones). */
  .obs-cnt{color:#c62828;font-weight:700;margin-left:.4em;font-variant-numeric:tabular-nums;white-space:nowrap}
  :root[data-theme="dark"] .obs-cnt{color:#ff6b6b}
  .toc-ch .obs-cnt{font-size:11.5px}`;

// Esqueleto de página compartido. `acts` son botones extra del panel (export offline),
// `dataScript` las constantes inline, `clientScript` la lógica del modo.
export function renderPage(meta: ReviewMeta, tb: { toc: string; body: string }, dataScript: string, clientScript: string, acts = "", warnbar = false): string {
  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisión · ${esc(meta.informe)} · ${esc(meta.version)}</title>
<style>${STYLES}</style>
<script>try{var _t=localStorage.getItem('revtheme');if(_t)document.documentElement.setAttribute('data-theme',_t);}catch(e){}</script></head>
<body>
<div id="readbar"></div>
<div class="page">
<header class="apphead">
  <div class="estudio">${esc(meta.estudio || meta.informe)}</div>
  ${meta.estudio ? `<div class="inf">${esc(meta.titulo || meta.informe)}</div>` : ""}
  <div class="rev">Revisión interna N° ${String(meta.ronda).padStart(2, "0")} · versión ${esc(meta.version)}</div>
</header>
<div class="wrap">
  <nav class="toc">
    <div class="theme-toggle"><button data-theme-set="claro" title="Claro">☀</button><button data-theme-set="sepia" title="Sepia">📖</button><button data-theme-set="dark" title="Oscuro">🌙</button></div>
    <div class="toc-levels"><span>Índice</span><button data-setlvl="1">1</button><button data-setlvl="2">2</button><button data-setlvl="3">3</button><button data-setlvl="4">4</button></div>
    ${tb.toc}
  </nav>
  <main id="doc">${tb.body}</main>
  <aside class="obs"><div class="obs-head"><h2>Observaciones (<span id="obs-count">0</span>)</h2>${warnbar ? '<div class="warnbar" id="warnbar"></div>' : ""}${acts}<div class="obs-vista"><span>Vista</span><button data-vista="margen" title="Cada comentario a la altura de su texto">Al margen</button><button data-vista="lista" title="Lista corrida">Lista</button><span style="margin-left:6px">Marca</span><button data-marca="resaltado">Resaltado</button><button data-marca="tachado">Tachado</button></div><div id="obs-sum" class="obs-sum"></div></div><div id="obs-list"><div class="empty">Selecciona texto o usa "+ observar" para dejar una observación.</div></div></aside>
</div>
</div>
<button id="sel-btn" class="obs-btn">+ observar</button>
<div id="composer">
  <div class="cita" id="comp-cita"></div>
  <textarea id="comp-text" placeholder="Escribe o dicta tu observación…"></textarea>
  <div class="rec-row"><button id="comp-rec" type="button">🎤 Dictar</button><span id="rec-status"></span></div>
  <div class="row"><button id="comp-cancel">Cancelar</button><button class="save" id="comp-save">Guardar</button></div>
</div>
<div id="readlabel"></div>
<script>${dataScript}${UI_JS}${MARGIN_JS}${clientScript}</script>
</body></html>`;
}

// UI compartida por ambos modos (sólo toca el DOM): selector de nivel del índice,
// selector de tema (claro/sepia/oscuro, persistido) y marcador de lectura (barra
// de progreso + índice activo + etiqueta flotante del capítulo en curso).
const UI_JS = String.raw`(function(){
  var nav=document.querySelector('nav.toc'); if(!nav) return;
  // Entradas del índice en orden de documento, cada una con su título en el cuerpo.
  var entries=[].slice.call(nav.querySelectorAll('.toc-ch')).map(function(a){
    return { a:a, lvl:+a.dataset.lvl, el:document.getElementById(a.getAttribute('href').slice(1)) };
  }).filter(function(e){ return e.el; });
  var maxLvl=2, curAct=null;
  // Índice por niveles: al cambiar el nivel, el destacado se recalcula al instante.
  var lv=nav.querySelectorAll('.toc-levels button');
  function setLvl(mx){ maxLvl=mx; entries.forEach(function(e){ e.a.style.display=(e.lvl<=mx)?'block':'none'; }); lv.forEach(function(b){ b.classList.toggle('on',+b.dataset.setlvl===mx); }); if(curAct) curAct.a.classList.remove('active'); curAct=null; spy(); }
  lv.forEach(function(b){ b.addEventListener('click',function(){ setLvl(+b.dataset.setlvl); }); });
  // Tema claro/sepia/oscuro
  var tg=nav.querySelectorAll('.theme-toggle button');
  function paint(t){ tg.forEach(function(b){ b.classList.toggle('on', b.dataset.themeSet===t); }); }
  function setTheme(t){ if(t==='claro') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',t); try{ localStorage.setItem('revtheme',t); }catch(e){} paint(t); }
  tg.forEach(function(b){ b.addEventListener('click',function(){ setTheme(b.dataset.themeSet); }); });
  var cur=document.documentElement.getAttribute('data-theme')||'claro'; paint(cur);
  // Marcador de lectura: barra de progreso + índice activo (scroll-spy) + etiqueta flotante.
  // La posición de lectura es el último título que pasó la línea de lectura (110 px bajo el
  // borde superior). Se destaca el título más profundo, dentro del nivel elegido, que la
  // contiene: recorriendo hacia atrás, la primera entrada con nivel <= N es ese ancestro.
  var bar=document.getElementById('readbar'), label=document.getElementById('readlabel');
  var hideT, lastPos=-2, ticking=false;
  function spy(){
    ticking=false;
    var h=document.documentElement; var max=h.scrollHeight-h.clientHeight;
    var p=max>0? (h.scrollTop/max):0; if(bar) bar.style.width=Math.round(p*100)+'%';
    var pos=-1;
    for(var k=0;k<entries.length;k++){ if(entries[k].el.getBoundingClientRect().top<=110) pos=k; else break; }
    var act=null;
    for(var j=pos;j>=0;j--){ if(entries[j].lvl<=maxLvl){ act=entries[j]; break; } }
    if(!act && entries.length) act=entries[0];
    if(act!==curAct){
      if(curAct) curAct.a.classList.remove('active');
      curAct=act;
      if(act){ act.a.classList.add('active');
        // el índice se desplaza solo para mantener visible la entrada activa
        var nr=nav.getBoundingClientRect(), ar=act.a.getBoundingClientRect();
        if(ar.top<nr.top+70||ar.bottom>nr.bottom-24) nav.scrollTop+=(ar.top-nr.top)-nr.height/3; }
    }
    if(label && pos!==lastPos && pos>=0){ lastPos=pos; var ea=entries[pos].a, n=ea.querySelector('.num'), t=ea.querySelector('.t'); label.textContent=(n?n.textContent+' ':'')+(t?t.textContent:ea.textContent); label.insertAdjacentHTML('afterbegin','<b>Vas en</b>'); label.style.opacity='1'; clearTimeout(hideT); hideT=setTimeout(function(){ label.style.opacity='0'; },1800); }
  }
  function onScroll(){ if(!ticking){ ticking=true; requestAnimationFrame(spy); } }
  window.addEventListener('scroll',onScroll,{passive:true}); window.addEventListener('resize',onScroll);
  setLvl(2);
})();`;

// Resaltado y comentarios al margen, compartido por ambos modos. Cada modo llama
// `revPaint(observaciones)` al final de su renderObs: se borran las marcas, se
// reconstruyen desde el ancla (cita + prefijo + sufijo; figura/cuadro por código o
// rótulo) y, en la vista «al margen», cada comentario se ubica a la altura de su
// marca, empujando hacia abajo el que choque. Ancla perdida o cita no hallada: sin
// marca, y el comentario va al final (en la lista) con su aviso.
const MARGIN_JS = String.raw`
var revObs=[], revPos={};
function revLS(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function revUnpaint(){
  var ps=[]; document.querySelectorAll('#doc mark.obs-mark').forEach(function(m){ var p=m.parentNode; while(m.firstChild) p.insertBefore(m.firstChild,m); p.removeChild(m); ps.push(p); });
  ps.forEach(function(p){ if(p.isConnected) p.normalize(); });
  document.querySelectorAll('#doc .obs-fig').forEach(function(b){ b.classList.remove('obs-fig'); delete b.dataset.oids; });
}
// Prefijo/sufijo en común con el contexto guardado: desempata citas repetidas.
function revCtx(full,i,a){ var s=0, pre=a.prefijo||'', suf=a.sufijo||'', k;
  for(k=1;k<=pre.length&&i-k>=0&&full[i-k]===pre[pre.length-k];k++) s++;
  var j=i+a.cita.length; for(k=0;k<suf.length&&j+k<full.length&&full[j+k]===suf[k];k++) s++;
  return s; }
function revFind(o){
  var a=o.ancla||{}, cita=a.cita||''; if(!cita) return null;
  var best=null, ch=(o.seccion_titulos||[])[0]||'';
  document.querySelectorAll('#doc .block[data-tipo="texto"]').forEach(function(b){
    var full=b.textContent, i=full.indexOf(cita);
    while(i>=0){ var s=revCtx(full,i,a)+(b.dataset.ch===ch?1000:0);
      if(!best||s>best.s) best={b:b,i:i,s:s}; i=full.indexOf(cita,i+1); }
  });
  return best;
}
// Envuelve [start,end) del bloque en <mark>, nodo de texto por nodo de texto: con
// citas que se solapan quedan marcas anidadas, sin romper el párrafo.
function revWrap(block,start,end,oid){
  var tw=document.createTreeWalker(block,NodeFilter.SHOW_TEXT), pos=0, n, segs=[];
  while((n=tw.nextNode())){ var L=n.data.length, s=Math.max(start,pos), e=Math.min(end,pos+L);
    if(s<e && !(n.parentNode.closest&&n.parentNode.closest('.obs-btn-wrap'))) segs.push([n,s-pos,e-pos]);
    pos+=L; if(pos>=end) break; }
  var first=null;
  segs.forEach(function(g){ var t=g[0]; if(g[1]>0) t=t.splitText(g[1]); if(g[2]-g[1]<t.data.length) t.splitText(g[2]-g[1]);
    var m=document.createElement('mark'); m.className='obs-mark'; m.dataset.oid=oid; t.parentNode.insertBefore(m,t); m.appendChild(t); if(!first) first=m; });
  return first;
}
function revFig(o){ var a=o.ancla||{}, bs=document.querySelectorAll('#doc .block.figura,#doc .block.cuadro'), i;
  if(a.codigo) for(i=0;i<bs.length;i++) if(bs[i].dataset.codigo===a.codigo) return bs[i];
  if(a.rotulo) for(i=0;i<bs.length;i++) if(bs[i].dataset.rotulo===a.rotulo) return bs[i];
  return null; }
function revPaint(obs){
  revObs=obs||[]; revPos={}; revUnpaint();
  revObs.forEach(function(o){ if(o.orphaned) return; var el=null;
    if(o.tipo==='figura'||o.tipo==='cuadro'){ el=revFig(o); if(el){ el.classList.add('obs-fig'); el.dataset.oids=((el.dataset.oids||'')+' '+o.id).trim(); } }
    else { var f=revFind(o); if(f) el=revWrap(f.b,f.i,f.i+o.ancla.cita.length,o.id); }
    if(el) revPos[o.id]=el; });
  document.querySelectorAll('#obs-list .obs-item[data-oid]').forEach(function(it){
    if(!revPos[it.dataset.oid]){ it.classList.add('sin-ubicar'); if(!it.querySelector('.orphan-tag')) it.firstChild.insertAdjacentHTML('beforeend',' <span class="orphan-tag">⚠ sin ubicar en esta versión</span>'); } });
  document.querySelectorAll('#doc .fig-grupo .fg-pane').forEach(function(p){ var b=p.closest('.fig-grupo').querySelector('.fg-tabs button[data-fgi="'+p.dataset.fgi+'"]'); if(b) b.classList.toggle('tiene-obs',p.classList.contains('obs-fig')); });
  revCount(revObs);
  revLayout();
}
// Figuras agrupadas: la pestaña i muestra su figura y oculta las demás del bloque.
function revTab(g,i){ g.querySelectorAll('.fg-pane').forEach(function(p){ p.hidden=(+p.dataset.fgi!==i); });
  g.querySelectorAll('.fg-tabs button').forEach(function(b){ b.classList.toggle('on',+b.dataset.fgi===i); }); revRelayout(); }
document.querySelectorAll('#doc .fig-grupo .fg-tabs button').forEach(function(b){ b.addEventListener('click',function(){ revTab(b.closest('.fig-grupo'),+b.dataset.fgi); }); });
// Lo que se ve de un ancla: una figura en una pestaña oculta se ubica por su bloque.
function revShown(el){ return el.hidden? (el.closest('.fig-grupo')||el) : el; }
// Contador rojo de observaciones PENDIENTES por título, sumando sus subsecciones. Pendiente
// = sin respuesta o con estado distinto de atendida/respondida (servidor: o.estado; offline:
// RESP, las respuestas que traía el HTML al exportarse). La observación se ubica por su marca
// en el documento; la que no tiene marca (ancla perdida, cita no hallada), por seccion_titulos.
var revHeads=null, REV_HECHO={atendida:1,respondida:1};
function revHeadList(){ if(revHeads) return revHeads;
  revHeads=[].slice.call(document.querySelectorAll('nav.toc .toc-ch')).map(function(a){ var t=a.querySelector('.t');
    return { a:a, lvl:+a.dataset.lvl, el:document.getElementById(a.getAttribute('href').slice(1)), t:t?t.textContent:'' }; }).filter(function(h){ return h.el; });
  return revHeads; }
function revHeadBefore(el){ var hs=revHeadList(), pos=-1;
  for(var k=0;k<hs.length;k++){ if(hs[k].el.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING) pos=k; else break; }
  return pos; }
function revHeadBySec(st){ var hs=revHeadList(), ch=(st||[])[0], sec=(st||[])[1], c=-1, i;
  for(i=0;i<hs.length;i++) if(hs[i].lvl===1&&hs[i].t===ch){ c=i; break; }
  if(c<0||!sec) return c;
  for(i=c+1;i<hs.length&&hs[i].lvl>1;i++) if(hs[i].lvl===2&&hs[i].t===sec) return i;
  return c; }
function revEstado(o){ return o.estado||(typeof RESP!=='undefined'&&RESP[o.id])||'pendiente'; }
function revCount(obs){
  var hs=revHeadList(), n=hs.map(function(){ return 0; });
  (obs||[]).forEach(function(o){ if(REV_HECHO[revEstado(o)]) return;
    var el=revPos[o.id], pos=el? revHeadBefore(el) : revHeadBySec(o.seccion_titulos), lv=99;
    for(var k=pos;k>=0&&lv>1;k--) if(hs[k].lvl<lv){ n[k]++; lv=hs[k].lvl; } });
  document.querySelectorAll('.obs-cnt').forEach(function(s){ s.remove(); });
  hs.forEach(function(h,k){ if(!n[k]) return; var s='<span class="obs-cnt" title="observaciones pendientes">('+n[k]+')</span>', t=h.a.querySelector('.t');
    var hd=h.el.tagName==='SECTION'? (h.el.querySelector('h1')||h.el) : h.el; // el capítulo se indexa por su <section>
    hd.insertAdjacentHTML('beforeend',s); if(t) t.insertAdjacentHTML('afterend',s); else h.a.insertAdjacentHTML('beforeend',s); });
}
function revVista(){ return document.body.classList.contains('margen'); }
function revLayout(){
  var L=document.getElementById('obs-list'); if(!L) return;
  var items=[].slice.call(L.querySelectorAll('.obs-item[data-oid]'));
  if(!revVista()){ items.forEach(function(it){ it.style.top=''; }); L.style.height=''; return; }
  var base=L.getBoundingClientRect().top, placed=[], loose=[];
  items.forEach(function(it){ var el=revPos[it.dataset.oid]; if(el) placed.push({it:it,y:revShown(el).getBoundingClientRect().top-base}); else loose.push(it); });
  placed.sort(function(a,b){ return a.y-b.y; });
  var bottom=0;
  placed.forEach(function(p){ var y=Math.max(p.y,bottom); p.it.style.top=y+'px'; bottom=y+p.it.offsetHeight+8; });
  loose.forEach(function(it){ it.style.top=bottom+'px'; bottom+=it.offsetHeight+8; });
  L.style.height=bottom+'px';
}
var revRaf=0; function revRelayout(){ if(!revRaf) revRaf=requestAnimationFrame(function(){ revRaf=0; revLayout(); }); }
function revFocus(oid,scrollDoc){
  document.querySelectorAll('#obs-list .obs-item.focus').forEach(function(x){ x.classList.remove('focus'); });
  var it=document.querySelector('#obs-list .obs-item[data-oid="'+oid+'"]'); if(it){ it.classList.add('focus'); if(!revVista()) it.scrollIntoView({block:'nearest',behavior:'smooth'}); }
  var el=revPos[oid]; if(el&&el.hidden) revTab(el.closest('.fig-grupo'),+el.dataset.fgi);
  if(el){ if(scrollDoc) el.scrollIntoView({block:'center',behavior:'smooth'});
    el.classList.add('flash'); setTimeout(function(){ el.classList.remove('flash'); },1200); }
}
document.getElementById('doc').addEventListener('click',function(e){
  if(window.getSelection&&String(window.getSelection()).trim()) return;
  var m=e.target.closest('mark.obs-mark'); if(m){ revFocus(m.dataset.oid,false); return; }
  var c=e.target.closest('.block.obs-fig figcaption'); if(c){ var b=c.closest('.block'); revFocus(b.dataset.oids.split(' ')[0],false); }
});
document.getElementById('obs-list').addEventListener('click',function(e){
  if(e.target.closest('button,audio,a')) return; var it=e.target.closest('.obs-item[data-oid]'); if(it) revFocus(it.dataset.oid,true);
});
// Vista (al margen / lista) y estilo de marca (resaltado / tachado), recordados por navegador.
// En pantallas angostas la vista al margen no cabe: se usa la lista.
function revSetVista(v){ var ok=v==='margen'&&window.innerWidth>=1100; document.body.classList.toggle('margen',ok);
  document.querySelectorAll('.obs-vista [data-vista]').forEach(function(b){ b.classList.toggle('on',b.dataset.vista===(ok?'margen':'lista')); }); revLayout(); }
function revSetMarca(m){ document.body.classList.toggle('marca-tachado',m==='tachado');
  document.querySelectorAll('.obs-vista [data-marca]').forEach(function(b){ b.classList.toggle('on',b.dataset.marca===m); }); }
var revVistaPref=revLS('revvista')||'margen';
document.querySelectorAll('.obs-vista [data-vista]').forEach(function(b){ b.addEventListener('click',function(){ revVistaPref=b.dataset.vista; revLS('revvista',revVistaPref); revSetVista(revVistaPref); }); });
document.querySelectorAll('.obs-vista [data-marca]').forEach(function(b){ b.addEventListener('click',function(){ revLS('revmarca',b.dataset.marca); revSetMarca(b.dataset.marca); }); });
revSetVista(revVistaPref); revSetMarca(revLS('revmarca')||'resaltado');
window.addEventListener('resize',function(){ revSetVista(revVistaPref); });
// El cuerpo cambia de alto al cargar imágenes (lazy) o fuentes: re-ubicar.
if(window.ResizeObserver) new ResizeObserver(revRelayout).observe(document.getElementById('doc'));
window.addEventListener('load',revRelayout);
`;

// Los avisos del agrupamiento de figuras se repiten en la consola del navegador.
export const avisosJs = (g: PlanGrupos): string =>
  g.avisos.map((a) => `console.warn(${JSON.stringify("[grupos de figuras] " + a).replace(/</g, "\\u003c")});`).join("");

export function renderReviewHtml(doc: ReviewDoc, meta: ReviewMeta, grupos: PlanGrupos = PLAN_VACIO): string {
  const tb = renderBodyToc(doc, { imgSrc: (i) => `/img/${i}`, lazy: true }, grupos);
  return renderPage(meta, tb, `const META=${JSON.stringify(meta)};${avisosJs(grupos)}`, SERVER_JS);
}

// ── JS del cliente MODO SERVIDOR (anclaje + composer + panel + fetch) ─────────
const SERVER_JS = String.raw`
let pending=null, observaciones=[], audioId=null, transcripcion=null, mediaRec=null, chunks=[];
const $=(s)=>document.querySelector(s);
function blockOf(node){ while(node && node.nodeType!==1) node=node.parentNode; return node? node.closest('.block'):null; }
function offsetInBlock(block, container, off){ const r=document.createRange(); r.selectNodeContents(block); r.setEnd(container, off); return r.toString().length; }
document.addEventListener('mouseup',(e)=>{
  if(e.target.closest('#composer')||e.target.closest('.obs-btn')) return;
  const sel=window.getSelection(); const txt=sel.toString().trim(); const btn=$('#sel-btn');
  if(!txt||txt.length<3){ btn.style.display='none'; return; }
  const block=blockOf(sel.anchorNode);
  if(!block||block.dataset.tipo!=='texto'){ btn.style.display='none'; return; }
  const rng=sel.getRangeAt(0); const rect=rng.getBoundingClientRect();
  btn.style.left=(rect.left+rect.width/2+window.scrollX)+'px'; btn.style.top=(rect.top+window.scrollY)+'px'; btn.style.display='block';
  const full=block.textContent; const start=offsetInBlock(block, rng.startContainer, rng.startOffset);
  pending={ tipo:'texto', ch:block.dataset.ch, sec:block.dataset.sec, rotulo:'', codigo:'', seccionArchivo:'',
    cita:txt, prefijo:full.slice(Math.max(0,start-40),start), sufijo:full.slice(start+txt.length,start+txt.length+40) };
});
$('#sel-btn').addEventListener('click',()=>{ $('#sel-btn').style.display='none'; openComposer(pending); });
document.querySelectorAll('.obs-btn[data-bid]').forEach(b=>b.addEventListener('click',()=>{
  const block=b.closest('.block'); const tipo=block.dataset.tipo;
  const cita = tipo==='texto' ? block.textContent.trim().slice(0,160) : (block.dataset.rotulo||'');
  openComposer({ tipo, ch:block.dataset.ch, sec:block.dataset.sec, rotulo:block.dataset.rotulo||'', codigo:block.dataset.codigo||'', seccionArchivo:block.dataset.secarch||'', cita, prefijo:'', sufijo:'' });
}));
function openComposer(p){ pending=p; audioId=null; transcripcion=null; resetRec();
  $('#comp-cita').textContent=(p.rotulo? p.rotulo+'. ':'')+'«'+p.cita+'»'; $('#comp-text').value='';
  $('#composer').style.display='block'; $('#comp-text').focus(); }
function resetRec(){ const b=$('#comp-rec'); b.classList.remove('rec'); b.textContent='🎤 Dictar'; $('#rec-status').textContent=''; mediaRec=null; chunks=[]; }
$('#comp-cancel').addEventListener('click',()=>{ if(mediaRec&&mediaRec.state==='recording') mediaRec.stop(); $('#composer').style.display='none'; });
$('#comp-rec').addEventListener('click',async()=>{
  const b=$('#comp-rec');
  if(mediaRec&&mediaRec.state==='recording'){ mediaRec.stop(); return; }
  try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRec=new MediaRecorder(stream,{mimeType:'audio/webm'}); chunks=[];
    mediaRec.ondataavailable=(e)=>{ if(e.data.size) chunks.push(e.data); };
    mediaRec.onstop=async()=>{ stream.getTracks().forEach(t=>t.stop()); b.classList.remove('rec'); b.textContent='🎤 Dictar';
      $('#rec-status').textContent='transcribiendo…';
      const blob=new Blob(chunks,{type:'audio/webm'});
      const r=await fetch('/transcribe',{method:'POST',headers:{'Content-Type':'audio/webm'},body:blob});
      const j=await r.json(); audioId=j.audioId; transcripcion=j.transcript||'';
      const t=$('#comp-text'); t.value=(t.value? t.value+' ':'')+transcripcion; $('#rec-status').textContent='✓ transcrito (audio guardado)'; };
    mediaRec.start(); b.classList.add('rec'); b.textContent='⏹ Detener'; $('#rec-status').textContent='grabando…';
  }catch(e){ $('#rec-status').textContent='sin micrófono: '+e.message; }
});
$('#comp-save').addEventListener('click',async()=>{ const texto=$('#comp-text').value.trim(); if(!texto) return;
  const obs={...pending, texto, origen: audioId? 'voz':'escrito', audioId, transcripcion};
  const r=await fetch('/observacion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obs)});
  observaciones=await r.json(); $('#composer').style.display='none'; renderObs(); });
async function load(){ observaciones=await (await fetch('/observaciones')).json(); renderObs(); }
function renderObs(){ $('#obs-count').textContent=observaciones.length;
  const by=(e)=>observaciones.filter(o=>(o.estado||'pendiente')===e).length;
  $('#obs-sum').textContent=observaciones.length? (by('pendiente')+' pendientes · '+by('atendida')+' atendidas · '+by('respondida')+' respondidas') : '';
  const L=$('#obs-list'); if(!observaciones.length){ L.innerHTML='<div class="empty">Selecciona texto o usa "+ observar" para dejar una observación.</div>'; revPaint([]); return; }
  L.innerHTML=observaciones.map(o=>'<div class="obs-item'+(o.orphaned?' orphan':'')+'" data-oid="'+o.id+'"><div><span class="tag '+o.tipo+'">'+o.tipo+'</span> <b>'+(o.id)+'</b> <span class="estado '+(o.estado||'pendiente')+'">'+(o.estado||'pendiente')+'</span>'+(o.orphaned?' <span class="orphan-tag">⚠ ancla perdida</span>':'')+'</div>'+
    '<div class="cita">'+ (o.ancla.rotulo? '<b>'+esc(o.ancla.rotulo)+'</b> ':'') +'«'+esc(o.ancla.cita)+'»</div>'+
    '<div class="txt">'+esc(o.texto)+'</div>'+
    (o.audio? '<div class="voz">🎤 voz</div><audio controls preload="none" src="/'+o.audio+'"></audio>':'')+
    (o.respuesta&&o.respuesta.nota? '<div class="resp">↳ '+esc(o.respuesta.nota)+(o.respuesta.version?' <i>('+esc(o.respuesta.version)+')</i>':'')+'</div>':'')+
    '<div class="meta"><span>'+esc(o.seccion_titulos.slice(-1)[0]||'')+(o.seccion_archivo? ' · '+esc(o.seccion_archivo):'')+'</span><button class="del" data-id="'+o.id+'">borrar</button></div></div>').join('');
  L.querySelectorAll('.del').forEach(b=>b.addEventListener('click',async()=>{ observaciones=await (await fetch('/observacion/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.id})})).json(); renderObs(); }));
  revPaint(observaciones);
}
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
load();
`;
