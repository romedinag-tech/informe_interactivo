// Genera el HTML OFFLINE autocontenido del visor de revisión: un solo archivo,
// imágenes como data: URI (recomprimidas por el CLI), persistencia en localStorage,
// voz grabada y guardada en base64 (se transcribe al importar), y botón de export.
// Reusa el render (CSS + bloques + composer) de viewer-html.ts.

import type { ReviewDoc } from "./parse";
import { renderBodyToc, renderPage, type ReviewMeta } from "./viewer-html";

export function renderOfflineHtml(doc: ReviewDoc, meta: ReviewMeta, dataUris: string[]): string {
  // Offline: imágenes incrustadas (sin lazy, para que se dibujen al abrir con file://).
  const tb = renderBodyToc(doc, { imgSrc: (i) => dataUris[i] ?? "", lazy: false });
  const acts = `<div class="acts"><button id="btn-export">⤓ Exportar</button><button id="btn-import">⤒ Importar</button><input id="imp-file" type="file" accept="application/json,.json" multiple hidden></div><div id="imp-status" class="imp-status"></div>`;
  const dataScript = `const META=${JSON.stringify(meta)};`;
  return renderPage(meta, tb, dataScript, OFFLINE_JS, acts, true);
}

// ── JS del cliente MODO OFFLINE (anclaje + composer + localStorage + voz base64 + export) ──
const OFFLINE_JS = String.raw`
const KEY='revobs:'+META.informe+':'+META.version+':r'+META.ronda;
let pending=null, observaciones=[], mediaRec=null, chunks=[], recB64=null;
const $=(s)=>document.querySelector(s);
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showWarn(m){ const w=$('#warnbar'); if(w){ w.textContent=m; w.style.display='block'; } }
function hideWarn(){ const w=$('#warnbar'); if(w) w.style.display='none'; }
function loadLS(){ try{ observaciones=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ observaciones=[]; showWarn('No pude leer lo guardado: '+e.message); } }
function saveLS(){ try{ localStorage.setItem(KEY, JSON.stringify(observaciones)); hideWarn(); }catch(e){ showWarn('No se pudo guardar localmente ('+e.message+'). Exporta YA para no perder nada.'); } }
function nextId(){ let n=0; for(const o of observaciones){ const m=/off-(\d+)/.exec(o.id||''); if(m) n=Math.max(n,+m[1]); } return 'off-'+String(n+1).padStart(4,'0'); }

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
function openComposer(p){ pending=p; recB64=null; resetRec();
  $('#comp-cita').textContent=(p.rotulo? p.rotulo+'. ':'')+'«'+p.cita+'»'; $('#comp-text').value='';
  $('#composer').style.display='block'; $('#comp-text').focus(); }
function resetRec(){ const b=$('#comp-rec'); b.classList.remove('rec'); b.textContent='🎤 Grabar'; $('#rec-status').textContent=''; mediaRec=null; chunks=[]; }
$('#comp-cancel').addEventListener('click',()=>{ if(mediaRec&&mediaRec.state==='recording') mediaRec.stop(); $('#composer').style.display='none'; });

// Voz OFFLINE: graba y guarda el audio en base64 dentro de la observación. La
// transcripción queda vacía: se transcribe al volver (al importar en la herramienta).
$('#comp-rec').addEventListener('click',async()=>{
  const b=$('#comp-rec');
  if(mediaRec&&mediaRec.state==='recording'){ mediaRec.stop(); return; }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ $('#rec-status').textContent='sin micrófono en este contexto; escribe la observación'; return; }
  try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRec=new MediaRecorder(stream,{mimeType:'audio/webm'}); chunks=[];
    mediaRec.ondataavailable=(e)=>{ if(e.data.size) chunks.push(e.data); };
    mediaRec.onstop=()=>{ stream.getTracks().forEach(t=>t.stop()); b.classList.remove('rec'); b.textContent='🎤 Grabar';
      const blob=new Blob(chunks,{type:'audio/webm'}); const fr=new FileReader();
      fr.onload=()=>{ recB64=fr.result; $('#rec-status').textContent='✓ audio guardado (se transcribe al volver)'; };
      fr.readAsDataURL(blob); };
    mediaRec.start(); b.classList.add('rec'); b.textContent='⏹ Detener'; $('#rec-status').textContent='grabando…';
  }catch(e){ $('#rec-status').textContent='sin micrófono: '+e.message+' — escribe la observación'; }
});

$('#comp-save').addEventListener('click',()=>{ const texto=$('#comp-text').value.trim(); if(!texto && !recB64) return;
  const p=pending;
  observaciones.push({ id:nextId(), version_revisada:META.version, tipo:p.tipo||'texto',
    seccion_titulos:[p.ch,p.sec].filter(Boolean), seccion_archivo:p.seccionArchivo||null,
    ancla:{ cita:p.cita||'', prefijo:p.prefijo||'', sufijo:p.sufijo||'', rotulo:p.rotulo||null, codigo:p.codigo||null },
    texto:texto, origen: recB64? 'voz':'escrito', audioB64: recB64||null, transcripcion:'', creada:new Date().toISOString() });
  saveLS(); $('#composer').style.display='none'; renderObs(); });

function renderObs(){ $('#obs-count').textContent=observaciones.length;
  $('#obs-sum').textContent=observaciones.length? (observaciones.length+' observación(es) · offline, en este archivo') : '';
  const L=$('#obs-list'); if(!observaciones.length){ L.innerHTML='<div class="empty">Selecciona texto o usa "+ observar" para dejar una observación. Se guardan en este archivo.</div>'; return; }
  L.innerHTML=observaciones.map(o=>'<div class="obs-item"><div><span class="tag '+o.tipo+'">'+o.tipo+'</span> <b>'+o.id+'</b>'+(o.origen==='voz'?' <span class="voz">🎤</span>':'')+'</div>'+
    '<div class="cita">'+(o.ancla.rotulo? '<b>'+esc(o.ancla.rotulo)+'</b> ':'')+'«'+esc(o.ancla.cita)+'»</div>'+
    '<div class="txt">'+esc(o.texto)+'</div>'+
    (o.audioB64? '<audio controls preload="none" src="'+o.audioB64+'"></audio>':'')+
    '<div class="meta"><span>'+esc((o.seccion_titulos.slice(-1)[0])||'')+(o.seccion_archivo? ' · '+esc(o.seccion_archivo):'')+'</span><button class="del" data-id="'+o.id+'">borrar</button></div></div>').join('');
  L.querySelectorAll('.del').forEach(b=>b.addEventListener('click',()=>{ observaciones=observaciones.filter(o=>o.id!==b.dataset.id); saveLS(); renderObs(); }));
}

function stamp(){ var d=new Date(), p=function(n){return String(n).padStart(2,'0');};
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes()); }
$('#btn-export').addEventListener('click',()=>{
  const payload={ informe:META.informe, version_revisada:META.version, ronda:META.ronda, origen:'offline', exportado:new Date().toISOString(), observaciones };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='observaciones_offline_'+META.version+'_'+stamp()+'.json'; a.click(); URL.revokeObjectURL(a.href);
});

// Importar un JSON exportado antes (seguir en otro computador): une por id, sin
// duplicar; en conflicto gana la observación más nueva (por fecha de creación).
function mergeObs(arr){ var byId={}; observaciones.forEach(function(o){ byId[o.id]=o; });
  var imp=0, ex=0, upd=0;
  (arr||[]).forEach(function(n){ if(!n||!n.id) return; var cur=byId[n.id];
    if(!cur){ byId[n.id]=n; observaciones.push(n); imp++; }
    else { var tn=Date.parse(n.creada||'')||0, tc=Date.parse(cur.creada||'')||0;
      if(tn>tc){ observaciones[observaciones.indexOf(cur)]=n; byId[n.id]=n; upd++; } else ex++; } });
  saveLS(); renderObs(); return {imp:imp,ex:ex,upd:upd}; }
$('#btn-import').addEventListener('click',()=>$('#imp-file').click());
$('#imp-file').addEventListener('change', async (e)=>{
  var files=[].slice.call(e.target.files); if(!files.length) return;
  var tot={imp:0,ex:0,upd:0};
  for(var i=0;i<files.length;i++){
    try{ var txt=await files[i].text(); var data=JSON.parse(txt); var arr=data.observaciones||data;
      var r=mergeObs(arr); tot.imp+=r.imp; tot.ex+=r.ex; tot.upd+=r.upd;
    }catch(err){ $('#imp-status').textContent='No pude leer '+files[i].name+': '+err.message; }
  }
  $('#imp-status').textContent='Importadas '+tot.imp+' · ya estaban '+tot.ex+' · actualizadas '+tot.upd+'.';
  e.target.value='';
});

loadLS(); renderObs();
`;
