// Render del VISOR DE REVISIÓN interna (estructura + estilos + anclaje). Piezas
// COMPARTIDAS por el modo servidor (`renderReviewHtml`, imágenes servidas en `/img/N`,
// persistencia vía POST) y el modo OFFLINE (`offline-html.ts`, imágenes como data: URI,
// persistencia en localStorage). Lo único que cambia entre modos es la fuente de las
// imágenes y el script de cliente; todo lo demás (CSS, bloques, composer) se reusa.

import type { ReviewDoc, ReviewBlock } from "./parse";

export type ReviewMeta = { informe: string; version: string; ronda: number };
export type ImgOpts = { imgSrc: (index: number) => string; lazy: boolean };

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tableHtml(columns: string[], rows: string[][]): string {
  const head = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table class="cuadro-tabla"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function blockHtml(b: ReviewBlock, bid: string, ctx: { ch: string; sec: string }, io: ImgOpts): string {
  const anchorData = `data-bid="${bid}" data-ch="${esc(ctx.ch)}" data-sec="${esc(ctx.sec)}"`;
  const lazy = io.lazy ? ' loading="lazy"' : "";
  switch (b.type) {
    case "HEADING":
      return `<h3 class="subt" id="h-${bid.replace(/\./g, "-")}" data-bid="${bid}">${esc(b.text)}</h3>`;
    case "PARAGRAPH":
      return `<p class="block texto" ${anchorData} data-tipo="texto">${esc(b.text)}</p>`;
    case "TABLE":
      return `<div class="block tabla" ${anchorData} data-tipo="texto"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar</button></div>${tableHtml(b.columns, b.rows)}</div>`;
    case "FIGURE": {
      const cap = b.rotulo ? `<figcaption><b>${esc(b.rotulo)}.</b> ${esc(b.titulo)}${b.fuente ? `<span class="fuente">${esc(b.fuente)}</span>` : ""}</figcaption>` : "";
      const img = b.image ? `<img src="${io.imgSrc(b.image.index)}" alt="${esc(b.rotulo || "figura")}"${lazy}>` : "";
      return `<figure class="block figura" ${anchorData} data-tipo="figura" data-rotulo="${esc(b.rotulo)}" data-codigo="${esc(b.codigo ?? "")}" data-secarch="${esc(b.seccionArchivo ?? "")}"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar figura</button></div>${img}${cap}</figure>`;
    }
    case "CUADRO": {
      const cap = `<figcaption><b>${esc(b.rotulo)}.</b> ${esc(b.titulo)}${b.fuente ? `<span class="fuente">${esc(b.fuente)}</span>` : ""}</figcaption>`;
      return `<figure class="block cuadro" ${anchorData} data-tipo="cuadro" data-rotulo="${esc(b.rotulo)}" data-codigo="${esc(b.codigo ?? "")}" data-secarch="${esc(b.seccionArchivo ?? "")}"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar cuadro</button></div>${cap}${tableHtml(b.columns, b.rows)}</figure>`;
    }
  }
}

// Construye el índice (TOC) y el cuerpo del documento (capítulos de contenido).
export function renderBodyToc(doc: ReviewDoc, io: ImgOpts): { toc: string; body: string } {
  const toc: string[] = [];
  const body: string[] = [];
  const tocEntry = (lvl: number, id: string, text: string) =>
    toc.push(`<a class="toc-ch toc-l${lvl}" data-lvl="${lvl}" href="#${id}">${esc(text)}</a>`);
  doc.chapters.filter((c) => !c.frontMatter).forEach((ch, ci) => {
    const chId = `ch-${ci}`;
    tocEntry(1, chId, ch.title);
    body.push(`<section class="chapter" id="${chId}"><h1>${esc(ch.title)}</h1>`);
    ch.sections.forEach((sec, si) => {
      const secTitle = sec.title ?? "";
      if (secTitle) { body.push(`<h2 class="sec" id="${chId}-s${si}">${esc(secTitle)}</h2>`); tocEntry(2, `${chId}-s${si}`, secTitle); }
      sec.blocks.forEach((b, bi) => {
        const bid = `${ci}.${si}.${bi}`;
        if (b.type === "HEADING") tocEntry(Math.min(b.level, 4), `h-${ci}-${si}-${bi}`, b.text);
        body.push(blockHtml(b, bid, { ch: ch.title, sec: secTitle }, io));
      });
    });
    body.push(`</section>`);
  });
  return { toc: toc.join("\n"), body: body.join("\n") };
}

export const STYLES = `
  :root{ --bg:#f1f4f8; --card:#fff; --soft:#eef2f7; --line:#dbe1ea; --line-2:#c3ccda; --ink:#16202f; --muted:#4a5a70; --faint:#7c8aa0; --navy:#16365a; --accent:#1e4d88; --accent-soft:#e9f0f9; --warn:#C55A11;
    --r:14px; --sh-sm:0 1px 2px rgba(14,35,56,.05); --sh:0 1px 3px rgba(14,35,56,.05),0 10px 26px rgba(14,35,56,.07);
    --font-display:'Source Serif 4',Georgia,serif; --font-ui:Inter,-apple-system,'Segoe UI',Roboto,sans-serif; }
  :root[data-theme="sepia"]{ --bg:#e9dec5; --card:#f8f3e8; --soft:#f1e8d6; --line:#dccfb2; --line-2:#cbb98f; --ink:#362f1f; --muted:#6b5e45; --faint:#8a7c60; --navy:#5f4120; --accent:#7a542a; --accent-soft:#efe6d2; --warn:#9c5a1e;
    --sh:0 1px 3px rgba(54,47,31,.06),0 10px 26px rgba(54,47,31,.08); }
  :root[data-theme="dark"]{ --bg:#0a0d13; --card:#151c27; --soft:#1a212c; --line:#232c3a; --line-2:#2b3547; --ink:#e9eef5; --muted:#8a93a5; --faint:#6b7382; --navy:#ff6a1a; --accent:#ff7a2e; --accent-soft:rgba(255,106,26,.15); --warn:#ff9d2f;
    --sh-sm:0 1px 2px rgba(0,0,0,.5); --sh:0 10px 26px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.5); }
  *{box-sizing:border-box} html,body{margin:0}
  body{font:16px/1.65 var(--font-ui);color:var(--ink);background:var(--bg)}
  .wrap{display:grid;grid-template-columns:240px minmax(0,1fr) 360px;gap:0;min-height:100vh}
  nav.toc{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;padding:20px 14px;border-right:1px solid var(--line);background:var(--card)}
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
  .toc-ch.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
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
  aside.obs{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;border-left:1px solid var(--line);background:var(--card);padding:18px 16px}
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
  #sel-btn{position:absolute;z-index:40;display:none;transform:translate(-50%,-120%)}`;

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
<div class="wrap">
  <nav class="toc">
    <div class="brand">Revisión interna</div>
    <div class="ver">${esc(meta.informe)} · ${esc(meta.version)} · ronda ${meta.ronda}</div>
    <div class="theme-toggle"><button data-theme-set="claro" title="Claro">☀</button><button data-theme-set="sepia" title="Sepia">📖</button><button data-theme-set="dark" title="Oscuro">🌙</button></div>
    <div class="toc-levels"><span>Índice</span><button data-setlvl="1">1</button><button data-setlvl="2">2</button><button data-setlvl="3">3</button><button data-setlvl="4">4</button></div>
    ${tb.toc}
  </nav>
  <main id="doc">${tb.body}</main>
  <aside class="obs"><h2>Observaciones (<span id="obs-count">0</span>)</h2>${warnbar ? '<div class="warnbar" id="warnbar"></div>' : ""}${acts}<div id="obs-sum" class="obs-sum"></div><div id="obs-list"><div class="empty">Selecciona texto o usa "+ observar" para dejar una observación.</div></div></aside>
</div>
<button id="sel-btn" class="obs-btn">+ observar</button>
<div id="composer">
  <div class="cita" id="comp-cita"></div>
  <textarea id="comp-text" placeholder="Escribe o dicta tu observación…"></textarea>
  <div class="rec-row"><button id="comp-rec" type="button">🎤 Dictar</button><span id="rec-status"></span></div>
  <div class="row"><button id="comp-cancel">Cancelar</button><button class="save" id="comp-save">Guardar</button></div>
</div>
<div id="readlabel"></div>
<script>${dataScript}${UI_JS}${clientScript}</script>
</body></html>`;
}

// UI compartida por ambos modos (sólo toca el DOM): selector de nivel del índice,
// selector de tema (claro/sepia/oscuro, persistido) y marcador de lectura (barra
// de progreso + índice activo + etiqueta flotante del capítulo en curso).
const UI_JS = String.raw`(function(){
  var nav=document.querySelector('nav.toc'); if(!nav) return;
  // Índice por niveles
  var lv=nav.querySelectorAll('.toc-levels button');
  function setLvl(mx){ nav.querySelectorAll('.toc-ch').forEach(function(a){ a.style.display=(+a.dataset.lvl<=mx)?'block':'none'; }); lv.forEach(function(b){ b.classList.toggle('on',+b.dataset.setlvl===mx); }); }
  lv.forEach(function(b){ b.addEventListener('click',function(){ setLvl(+b.dataset.setlvl); }); }); setLvl(2);
  // Tema claro/sepia/oscuro
  var tg=nav.querySelectorAll('.theme-toggle button');
  function paint(t){ tg.forEach(function(b){ b.classList.toggle('on', b.dataset.themeSet===t); }); }
  function setTheme(t){ if(t==='claro') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',t); try{ localStorage.setItem('revtheme',t); }catch(e){} paint(t); }
  tg.forEach(function(b){ b.addEventListener('click',function(){ setTheme(b.dataset.themeSet); }); });
  var cur=document.documentElement.getAttribute('data-theme')||'claro'; paint(cur);
  // Marcador de lectura: barra de progreso + índice activo + etiqueta flotante
  var bar=document.getElementById('readbar'), label=document.getElementById('readlabel');
  var chs=[].slice.call(document.querySelectorAll('main .chapter'));
  var tocByCh={}; nav.querySelectorAll('.toc-ch.toc-l1').forEach(function(a,i){ tocByCh[i]=a; });
  var hideT;
  function onScroll(){
    var h=document.documentElement; var max=h.scrollHeight-h.clientHeight;
    var p=max>0? (h.scrollTop/max):0; if(bar) bar.style.width=Math.round(p*100)+'%';
    var y=h.scrollTop+120, idx=0;
    for(var i=0;i<chs.length;i++){ if(chs[i].offsetTop<=y) idx=i; }
    nav.querySelectorAll('.toc-ch').forEach(function(a){ a.classList.remove('active'); });
    if(tocByCh[idx]) tocByCh[idx].classList.add('active');
    if(label && chs[idx]){ var t=chs[idx].querySelector('h1'); label.innerHTML='<b>Vas en</b>'+(t?t.textContent:''); label.style.opacity='1'; clearTimeout(hideT); hideT=setTimeout(function(){ label.style.opacity='0'; },1800); }
  }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
})();`;

export function renderReviewHtml(doc: ReviewDoc, meta: ReviewMeta): string {
  const tb = renderBodyToc(doc, { imgSrc: (i) => `/img/${i}`, lazy: true });
  return renderPage(meta, tb, `const META=${JSON.stringify(meta)};`, SERVER_JS);
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
  const L=$('#obs-list'); if(!observaciones.length){ L.innerHTML='<div class="empty">Selecciona texto o usa "+ observar" para dejar una observación.</div>'; return; }
  L.innerHTML=observaciones.map(o=>'<div class="obs-item'+(o.orphaned?' orphan':'')+'"><div><span class="tag '+o.tipo+'">'+o.tipo+'</span> <b>'+(o.id)+'</b> <span class="estado '+(o.estado||'pendiente')+'">'+(o.estado||'pendiente')+'</span>'+(o.orphaned?' <span class="orphan-tag">⚠ ancla perdida</span>':'')+'</div>'+
    '<div class="cita">'+ (o.ancla.rotulo? '<b>'+esc(o.ancla.rotulo)+'</b> ':'') +'«'+esc(o.ancla.cita)+'»</div>'+
    '<div class="txt">'+esc(o.texto)+'</div>'+
    (o.audio? '<div class="voz">🎤 voz</div><audio controls preload="none" src="/'+o.audio+'"></audio>':'')+
    (o.respuesta&&o.respuesta.nota? '<div class="resp">↳ '+esc(o.respuesta.nota)+(o.respuesta.version?' <i>('+esc(o.respuesta.version)+')</i>':'')+'</div>':'')+
    '<div class="meta"><span>'+esc(o.seccion_titulos.slice(-1)[0]||'')+(o.seccion_archivo? ' · '+esc(o.seccion_archivo):'')+'</span><button class="del" data-id="'+o.id+'">borrar</button></div></div>').join('');
  L.querySelectorAll('.del').forEach(b=>b.addEventListener('click',async()=>{ observaciones=await (await fetch('/observacion/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.id})})).json(); renderObs(); }));
}
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
load();
`;
