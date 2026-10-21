// Genera el HTML autocontenido del VISOR DE REVISIÓN interna a partir del modelo
// parseado. Sirve para leer el informe y dejar observaciones ancladas por cita.
// Las imágenes se sirven aparte (`/img/<n>`), no se incrustan. El cliente guarda
// las observaciones vía `POST /observacion`. Sin audio (eso es la Etapa 3).

import type { ReviewDoc, ReviewBlock } from "./parse";

export type ReviewMeta = { informe: string; version: string; ronda: number };

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tableHtml(columns: string[], rows: string[][]): string {
  const head = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table class="cuadro-tabla"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function blockHtml(b: ReviewBlock, bid: string, ctx: { ch: string; sec: string }): string {
  const anchorData = `data-bid="${bid}" data-ch="${esc(ctx.ch)}" data-sec="${esc(ctx.sec)}"`;
  switch (b.type) {
    case "HEADING":
      return `<h3 class="subt" data-bid="${bid}">${esc(b.text)}</h3>`;
    case "PARAGRAPH":
      return `<p class="block texto" ${anchorData} data-tipo="texto">${esc(b.text)}</p>`;
    case "TABLE":
      return `<div class="block tabla" ${anchorData} data-tipo="texto"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar</button></div>${tableHtml(b.columns, b.rows)}</div>`;
    case "FIGURE": {
      const cap = b.rotulo ? `<figcaption><b>${esc(b.rotulo)}.</b> ${esc(b.titulo)}${b.fuente ? `<span class="fuente">${esc(b.fuente)}</span>` : ""}</figcaption>` : "";
      const img = b.image ? `<img src="/img/${b.image.index}" alt="${esc(b.rotulo || "figura")}" loading="lazy">` : "";
      return `<figure class="block figura" ${anchorData} data-tipo="figura" data-rotulo="${esc(b.rotulo)}" data-codigo="${esc(b.codigo ?? "")}" data-secarch="${esc(b.seccionArchivo ?? "")}"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar figura</button></div>${img}${cap}</figure>`;
    }
    case "CUADRO": {
      const cap = `<figcaption><b>${esc(b.rotulo)}.</b> ${esc(b.titulo)}${b.fuente ? `<span class="fuente">${esc(b.fuente)}</span>` : ""}</figcaption>`;
      return `<figure class="block cuadro" ${anchorData} data-tipo="cuadro" data-rotulo="${esc(b.rotulo)}" data-codigo="${esc(b.codigo ?? "")}" data-secarch="${esc(b.seccionArchivo ?? "")}"><div class="obs-btn-wrap"><button class="obs-btn" data-bid="${bid}">+ observar cuadro</button></div>${cap}${tableHtml(b.columns, b.rows)}</figure>`;
    }
  }
}

export function renderReviewHtml(doc: ReviewDoc, meta: ReviewMeta): string {
  const contentChapters = doc.chapters.filter((c) => !c.frontMatter);
  const toc: string[] = [];
  const body: string[] = [];

  contentChapters.forEach((ch, ci) => {
    const chId = `ch-${ci}`;
    toc.push(`<a class="toc-ch" href="#${chId}">${esc(ch.title)}</a>`);
    body.push(`<section class="chapter" id="${chId}"><h1>${esc(ch.title)}</h1>`);
    ch.sections.forEach((sec, si) => {
      const secTitle = sec.title ?? "";
      if (secTitle) body.push(`<h2 class="sec" id="${chId}-s${si}">${esc(secTitle)}</h2>`);
      sec.blocks.forEach((b, bi) => {
        body.push(blockHtml(b, `${ci}.${si}.${bi}`, { ch: ch.title, sec: secTitle }));
      });
    });
    body.push(`</section>`);
  });

  const data = { informe: meta.informe, version: meta.version, ronda: meta.ronda };

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisión · ${esc(meta.informe)} · ${esc(meta.version)}</title>
<style>
  :root{ --ink:#1b2430; --muted:#5b6774; --line:#d7dee7; --soft:#eef3f8; --navy:#0E3358; --accent:#1D4E7A; --warn:#E07B2E; --bg:#f3f5f8; --card:#fff; }
  *{box-sizing:border-box} html,body{margin:0}
  body{font:16px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}
  .wrap{display:grid;grid-template-columns:240px minmax(0,1fr) 360px;gap:0;min-height:100vh}
  nav.toc{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;padding:20px 14px;border-right:1px solid var(--line);background:var(--card)}
  nav.toc .brand{font-weight:700;color:var(--navy);font-size:13px;letter-spacing:.04em;text-transform:uppercase}
  nav.toc .ver{color:var(--muted);font-size:12px;margin:2px 0 14px}
  .toc-ch{display:block;padding:6px 8px;border-radius:7px;color:var(--ink);text-decoration:none;font-size:13.5px}
  .toc-ch:hover{background:var(--soft)}
  main{padding:34px 40px 120px;max-width:820px;min-width:0}
  main h1{font:600 26px/1.25 Georgia,serif;color:var(--navy);margin:34px 0 6px}
  main h2.sec{font:600 19px/1.3 Georgia,serif;color:var(--accent);margin:26px 0 4px}
  h3.subt{font:600 15px/1.35 Segoe UI,sans-serif;color:var(--navy);margin:18px 0 4px}
  p.texto{margin:10px 0}
  .block{position:relative}
  .block.figura,.block.cuadro,.block.tabla{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:18px 0;max-width:100%;overflow-x:auto}
  .block img{max-width:100%;height:auto;border-radius:8px;display:block;margin:0 auto}
  figcaption{font-size:13px;color:var(--muted);margin-top:8px}
  figcaption .fuente{display:block;font-style:italic;margin-top:2px}
  .cuadro-tabla{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}
  .cuadro-tabla th,.cuadro-tabla td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
  .cuadro-tabla th{background:var(--soft)}
  .obs-btn-wrap{position:absolute;top:8px;right:10px;opacity:0;transition:.12s}
  .block:hover .obs-btn-wrap{opacity:1}
  .obs-btn{font:600 12px Segoe UI;border:1px solid var(--navy);color:var(--navy);background:#fff;border-radius:999px;padding:3px 10px;cursor:pointer}
  .obs-btn:hover{background:var(--navy);color:#fff}
  .anchored{background:#fde8d4;border-bottom:2px solid var(--warn);cursor:pointer}
  /* panel */
  aside.obs{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;border-left:1px solid var(--line);background:var(--card);padding:18px 16px}
  aside.obs h2{font:700 13px Segoe UI;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 12px}
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
  /* composer */
  #composer{position:fixed;z-index:50;display:none;width:340px;left:50%;top:110px;transform:translateX(-50%);background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(14,51,88,.18);padding:12px}
  #composer .cita{font-size:12.5px;color:var(--muted);font-style:italic;border-left:3px solid var(--warn);padding-left:8px;margin-bottom:8px;max-height:84px;overflow:auto}
  #composer textarea{width:100%;min-height:72px;border:1px solid var(--line);border-radius:8px;padding:8px;font:14px inherit;resize:vertical}
  #composer .row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
  #composer button{font:600 13px Segoe UI;border-radius:8px;padding:6px 12px;cursor:pointer;border:1px solid var(--line);background:#fff}
  #composer button.save{background:var(--navy);color:#fff;border-color:var(--navy)}
  #composer .rec-row{display:flex;align-items:center;gap:8px;margin-top:8px}
  #comp-rec{font:600 13px Segoe UI;border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;cursor:pointer}
  #comp-rec.rec{background:#b3261e;color:#fff;border-color:#b3261e}
  #rec-status{font-size:12px;color:var(--muted)}
  .obs-item audio{width:100%;margin-top:6px;height:30px}
  .obs-item .voz{color:var(--warn)}
  #sel-btn{position:absolute;z-index:40;display:none;transform:translate(-50%,-120%)}
</style></head>
<body>
<div class="wrap">
  <nav class="toc">
    <div class="brand">Revisión interna</div>
    <div class="ver">${esc(meta.informe)} · ${esc(meta.version)} · ronda ${meta.ronda}</div>
    ${toc.join("\n")}
  </nav>
  <main id="doc">${body.join("\n")}</main>
  <aside class="obs"><h2>Observaciones (<span id="obs-count">0</span>)</h2><div id="obs-sum" class="obs-sum"></div><div id="obs-list"><div class="empty">Selecciona texto o usa "+ observar" para dejar una observación.</div></div></aside>
</div>
<button id="sel-btn" class="obs-btn">+ observar</button>
<div id="composer">
  <div class="cita" id="comp-cita"></div>
  <textarea id="comp-text" placeholder="Escribe o dicta tu observación…"></textarea>
  <div class="rec-row"><button id="comp-rec" type="button">🎤 Dictar</button><span id="rec-status"></span></div>
  <div class="row"><button id="comp-cancel">Cancelar</button><button class="save" id="comp-save">Guardar</button></div>
</div>
<script>const META=${JSON.stringify(data)};${CLIENT_JS}</script>
</body></html>`;
}

// ── JS del cliente (anclaje + composer + panel) ──────────────────────────────
const CLIENT_JS = String.raw`
let pending=null, observaciones=[], audioId=null, transcripcion=null, mediaRec=null, chunks=[];
const $=(s)=>document.querySelector(s);

function blockOf(node){ while(node && node.nodeType!==1) node=node.parentNode; return node? node.closest('.block'):null; }
function offsetInBlock(block, container, off){ const r=document.createRange(); r.selectNodeContents(block); r.setEnd(container, off); return r.toString().length; }

// Selección de texto → botón flotante.
document.addEventListener('mouseup',(e)=>{
  if(e.target.closest('#composer')||e.target.closest('.obs-btn')) return;
  const sel=window.getSelection(); const txt=sel.toString().trim();
  const btn=$('#sel-btn');
  if(!txt||txt.length<3){ btn.style.display='none'; return; }
  const block=blockOf(sel.anchorNode);
  if(!block||block.dataset.tipo!=='texto'){ btn.style.display='none'; return; }
  const rng=sel.getRangeAt(0); const rect=rng.getBoundingClientRect();
  btn.style.left=(rect.left+rect.width/2+window.scrollX)+'px';
  btn.style.top=(rect.top+window.scrollY)+'px';
  btn.style.display='block';
  const full=block.textContent;
  const start=offsetInBlock(block, rng.startContainer, rng.startOffset);
  pending={ tipo:'texto', ch:block.dataset.ch, sec:block.dataset.sec, rotulo:'', codigo:'', seccionArchivo:'',
    cita:txt, prefijo:full.slice(Math.max(0,start-40),start), sufijo:full.slice(start+txt.length,start+txt.length+40) };
});

$('#sel-btn').addEventListener('click',()=>{ $('#sel-btn').style.display='none'; openComposer(pending); });

// Botones "+ observar" de figura/cuadro/tabla.
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

// Dictado por voz: graba en el navegador, transcribe LOCAL en el servidor (faster-whisper).
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
