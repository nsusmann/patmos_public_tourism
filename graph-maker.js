(function(){
'use strict';

const STORAGE_KEY='patmosGraphMakerSavedV1';
const PALETTE=['#2a78d6','#1baf7a','#eb6834','#8b5cf6','#e34948','#0891b2','#ca8a04','#64748b','#db2777','#16a34a'];
let analytics=null, previewChart=null, previewConfig=null, editingId=null;
let savedGraphs=loadSaved(), galleryCharts=[];

const style=document.createElement('style');
style.textContent=`
.maker{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px}
.maker h2,.gallery-head h2{font-size:20px;margin:0 0 5px}.maker-intro,.maker-note{color:var(--muted);font-size:13px;line-height:1.5}
.maker-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}
.maker-field{display:flex;flex-direction:column;gap:5px}.maker-field.wide{grid-column:1/-1}
.maker-field label,.filter-label{font-size:12px;font-weight:650;color:#374151}
.maker input,.maker select,.saved-actions select{width:100%;font:inherit;font-size:13px;padding:8px 9px;border:1px solid var(--line);border-radius:8px;background:#fff}
.filter-list{display:grid;gap:8px}.filter-row{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center}
.secondary{background:#fff!important;color:var(--accent)!important}.danger{background:#fff!important;color:#b91c1c!important;border-color:#fca5a5!important}
.maker-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.maker button:disabled{opacity:.45;cursor:not-allowed}
.maker-status{min-height:20px;margin-top:10px;font-size:13px;color:var(--muted)}.maker-status.error{color:#b91c1c}
.maker-preview{height:410px;margin-top:14px;border:1px solid #e5e7eb;border-radius:10px;padding:10px;background:#fff}
.gallery{display:grid;gap:12px}.gallery-head{display:flex;align-items:end;justify-content:space-between;gap:12px}
.empty-gallery{border:1px dashed var(--line);border-radius:10px;padding:22px;text-align:center;color:var(--muted);font-size:13px}
.saved-card{background:#fff;border:1px solid var(--line);border-radius:11px;overflow:hidden}
.saved-summary{display:grid;grid-template-columns:180px 1fr auto;gap:16px;align-items:center;padding:12px}
.saved-thumb{height:105px;position:relative;background:#fff;border:1px solid #eef0f3;border-radius:7px;padding:4px}
.saved-title{font-weight:650;margin-bottom:4px}.saved-query{font-size:12px;color:var(--muted);line-height:1.45}
.saved-detail{display:none;border-top:1px solid var(--line);padding:16px}.saved-card.expanded .saved-detail{display:block}
.saved-chart{height:390px;position:relative}.saved-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.saved-actions select{width:auto}
@media(max-width:720px){.maker-grid{grid-template-columns:1fr}.maker-field.wide{grid-column:auto}.saved-summary{grid-template-columns:110px 1fr}.saved-summary>button{grid-column:1/-1}.filter-row{grid-template-columns:1fr}.maker-preview{height:340px}}
`;
document.head.appendChild(style);

const section=document.createElement('section');
section.className='maker';
section.id='graph-maker';
section.innerHTML=`
  <h2>Graph maker</h2>
  <div class="maker-intro">Build a chart from the coded review corpus. Filters are combined with <b>AND</b>. Render a preview, then save it to the expandable gallery below.</div>
  <div class="maker-grid">
    <div class="maker-field wide"><label for="gm-title">Graph title</label><input id="gm-title" value="Review count by site"></div>
    <div class="maker-field"><label for="gm-group">Group results by</label><select id="gm-group"></select></div>
    <div class="maker-field"><label for="gm-measure">Measure</label><select id="gm-measure"><option value="count">Review count</option><option value="percent">Percent of filtered reviews</option></select></div>
    <div class="maker-field"><label for="gm-split">Split bars by</label><select id="gm-split"><option value="">No split</option><option value="site">Site</option><option value="plat">Platform</option></select></div>
    <div class="maker-field"><label for="gm-orientation">Orientation</label><select id="gm-orientation"><option value="vertical">Vertical bars</option><option value="horizontal">Horizontal bars</option></select></div>
    <div class="maker-field wide"><span class="filter-label">Query filters</span><div id="gm-filters" class="filter-list"></div><div><button type="button" class="secondary" id="gm-add-filter">+ Add filter</button></div></div>
  </div>
  <div class="maker-actions">
    <button type="button" id="gm-render" disabled>Render graph</button>
    <button type="button" id="gm-save" disabled>Save to gallery</button>
    <select id="gm-preview-format" aria-label="Preview export format"><option value="jpeg">JPEG</option><option value="tiff">TIFF</option></select>
    <button type="button" class="secondary" id="gm-export" disabled>Export preview</button>
    <button type="button" class="secondary" id="gm-new">New graph</button>
  </div>
  <div id="gm-status" class="maker-status">Loading coded analytics data…</div>
  <div class="maker-preview"><canvas id="gm-preview" role="img" aria-label="Custom graph preview"></canvas></div>
`;
const main=document.querySelector('main');
main.insertBefore(section,main.firstChild);

const gallerySection=document.createElement('section');
gallerySection.className='gallery';
gallerySection.id='saved-graphs';
gallerySection.innerHTML='<div class="gallery-head"><div><h2>Saved graphs</h2><div class="maker-note">Saved in this browser. Expand a thumbnail to inspect, edit, or export it.</div></div><span id="gm-saved-count" class="maker-note"></span></div><div id="gm-gallery"></div>';
main.appendChild(gallerySection);

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function loadSaved(){try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
function persistSaved(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(savedGraphs));return true;}catch{return false;}}
function setStatus(text,error){const el=document.getElementById('gm-status');el.textContent=text;el.classList.toggle('error',!!error);}
function optionHtml(value,label,selected){return '<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';}

async function loadAnalytics(){
  const publicPage=/\/graphs\.html$/i.test(location.pathname);
  const candidates=publicPage?['dashboard.html','Patmos_Chapter_Dashboard.html']:['Patmos_Chapter_Dashboard.html','dashboard.html'];
  let lastError='';
  for(const name of candidates){
    try{
      const response=await fetch(name,{cache:'no-store'});
      if(!response.ok) continue;
      const text=await response.text(), prefix='window.DATA = ', start=text.indexOf(prefix);
      if(start<0) continue;
      const tail=text.slice(start+prefix.length), marker=tail.search(/;\s*\/\/ ===== Constants/);
      if(marker<0) continue;
      const parsed=JSON.parse(tail.slice(0,marker));
      if(parsed.rows&&parsed.defs) return parsed;
    }catch(err){lastError=err.message;}
  }
  throw new Error(lastError||'Could not read the dashboard data source.');
}

function fieldEntries(){
  const fixed=[['site','Site'],['plat','Platform'],['rating','Star rating']];
  const rest=Object.entries(analytics.defs).filter(([k])=>!fixed.some(x=>x[0]===k)).map(([k,d])=>[k,d.label||k]).sort((a,b)=>a[1].localeCompare(b[1]));
  return fixed.concat(rest);
}
function fieldOptions(selected,blank){
  let html=blank?'<option value="">— choose a field —</option>':'';
  fieldEntries().forEach(([k,l])=>html+=optionHtml(k,l,k===selected));
  return html;
}
function defFor(key){return analytics.defs[key]||null;}
function distinctMetadata(key){return [...new Set(analytics.rows.map(r=>String(r[key]??'')).filter(Boolean))].sort((a,b)=>key==='rating'?Number(a)-Number(b):a.localeCompare(b));}
function choicesFor(key){
  if(['site','plat','rating'].includes(key)) return distinctMetadata(key);
  const d=defFor(key); if(!d) return [];
  if(d.type==='bool'||d.type==='multi') return ['Yes','No'];
  if(d.type==='enum') return d.values||[];
  return distinctMetadata(key);
}
function displayValue(key,value){
  if(key==='site') return value==='cave'?'Cave':value==='monastery'?'Monastery':value;
  if(key==='plat') return value.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  return String(value).replace(/_/g,' ');
}
function valuesForRow(row,key){
  if(['site','plat','rating'].includes(key)) return [String(row[key]??'')];
  const d=defFor(key), codes=row.codes||{}; if(!d) return [''];
  if(d.type==='bool') return [codes[key]===1?'Yes':'No'];
  if(d.type==='enum') return [String(codes[key]!==undefined?codes[key]:(d.default||'not_addressed'))];
  if(d.type==='multi'){
    const list=codes[d.parent]||[];
    return [list.includes(d.label_value)?'Yes':'No'];
  }
  return [String(codes[key]??'')];
}

function addFilter(filter){
  const row=document.createElement('div'); row.className='filter-row';
  const field=document.createElement('select'); field.className='gm-filter-field'; field.innerHTML=fieldOptions(filter&&filter.field,true);
  const value=document.createElement('select'); value.className='gm-filter-value';
  const remove=document.createElement('button'); remove.type='button'; remove.className='danger'; remove.textContent='Remove';
  function updateValue(selected){
    const key=field.value; value.disabled=!key;
    value.innerHTML=key?choicesFor(key).map(v=>optionHtml(v,displayValue(key,v),v===selected)).join(''):'<option>Choose a field first</option>';
  }
  field.addEventListener('change',()=>updateValue('')); remove.addEventListener('click',()=>row.remove());
  row.append(field,value,remove); document.getElementById('gm-filters').appendChild(row); updateValue(filter&&filter.value);
}

function readConfig(){
  const filters=[...document.querySelectorAll('.filter-row')].map(row=>({field:row.querySelector('.gm-filter-field').value,value:row.querySelector('.gm-filter-value').value})).filter(f=>f.field);
  return {
    title:document.getElementById('gm-title').value.trim()||'Custom Patmos graph',
    group:document.getElementById('gm-group').value,
    measure:document.getElementById('gm-measure').value,
    split:document.getElementById('gm-split').value,
    orientation:document.getElementById('gm-orientation').value,
    filters
  };
}
function matchingRows(config){
  return analytics.rows.filter(row=>config.filters.every(f=>valuesForRow(row,f.field).includes(f.value)));
}
function orderedChoices(key,rows){
  const preferred=choicesFor(key), seen=new Set();
  rows.forEach(r=>valuesForRow(r,key).forEach(v=>v!==''&&seen.add(v)));
  const ordered=preferred.filter(v=>seen.has(v)); seen.forEach(v=>{if(!ordered.includes(v)) ordered.push(v);});
  return ordered;
}
function makeFigure(config){
  const rows=matchingRows(config), labelsRaw=orderedChoices(config.group,rows);
  const labels=labelsRaw.map(v=>displayValue(config.group,v));
  const splitRaw=config.split?orderedChoices(config.split,rows):[''];
  const datasets=splitRaw.map((splitValue,di)=>{
    const pool=config.split?rows.filter(r=>valuesForRow(r,config.split).includes(splitValue)):rows;
    const counts=labelsRaw.map(label=>pool.filter(r=>valuesForRow(r,config.group).includes(label)).length);
    const data=config.measure==='percent'?counts.map(n=>pool.length?Number((100*n/pool.length).toFixed(1)):0):counts;
    return {label:config.split?displayValue(config.split,splitValue):'Reviews',data,backgroundColor:PALETTE[di%PALETTE.length],borderRadius:4};
  });
  const query=config.filters.length?config.filters.map(f=>(defFor(f.field)?.label||displayValue(f.field,f.field))+' = '+displayValue(f.field,f.value)).join(' AND '):'All reviews';
  return {config,rows:rows.length,labels,datasets,query,unit:config.measure==='percent'?'%':' reviews'};
}
function chartConfig(fig,compact){
  return {
    type:'bar',
    data:{labels:fig.labels,datasets:fig.datasets},
    options:{
      indexAxis:fig.config.orientation==='horizontal'?'y':'x',responsive:true,maintainAspectRatio:false,animation:!compact,
      plugins:{
        legend:{display:fig.datasets.length>1,labels:{boxWidth:compact?8:12,font:{size:compact?8:12}}},
        title:{display:!compact,text:fig.config.title,color:'#111827',font:{size:15,weight:'600'}},
        subtitle:{display:!compact,text:fig.query+' · n = '+fig.rows,color:'#4b5563',font:{size:11}}
      },
      scales:{
        x:{beginAtZero:true,grid:{display:fig.config.orientation==='horizontal'},ticks:{display:!compact,font:{size:11}}},
        y:{beginAtZero:true,grid:{display:fig.config.orientation!=='horizontal'},ticks:{display:!compact,font:{size:11}},suggestedMax:fig.config.measure==='percent'?100:undefined}
      }
    }
  };
}
function renderPreview(){
  const config=readConfig(), fig=makeFigure(config);
  if(!fig.labels.length){setStatus('No reviews match this query, so there is nothing to graph.',true);return false;}
  if(previewChart) previewChart.destroy();
  previewChart=new Chart(document.getElementById('gm-preview').getContext('2d'),chartConfig(fig,false));
  previewConfig=config;
  document.getElementById('gm-export').disabled=false;
  setStatus('Rendered '+fig.rows+' matching reviews across '+fig.labels.length+' categories.',false);
  return true;
}
function resetMaker(){
  editingId=null; document.getElementById('gm-title').value='Review count by site'; document.getElementById('gm-group').value='site';
  document.getElementById('gm-measure').value='count'; document.getElementById('gm-split').value=''; document.getElementById('gm-orientation').value='vertical';
  document.getElementById('gm-filters').innerHTML=''; document.getElementById('gm-save').textContent='Save to gallery'; renderPreview();
}
function applyConfig(config,id){
  editingId=id||null; document.getElementById('gm-title').value=config.title; document.getElementById('gm-group').value=config.group;
  document.getElementById('gm-measure').value=config.measure; document.getElementById('gm-split').value=config.split; document.getElementById('gm-orientation').value=config.orientation;
  document.getElementById('gm-filters').innerHTML=''; (config.filters||[]).forEach(addFilter);
  document.getElementById('gm-save').textContent=editingId?'Update saved graph':'Save to gallery'; renderPreview(); section.scrollIntoView({behavior:'smooth',block:'start'});
}
function saveCurrent(){
  if(!renderPreview()) return;
  const config=JSON.parse(JSON.stringify(previewConfig));
  if(editingId){
    const found=savedGraphs.find(g=>g.id===editingId); if(found) found.config=config;
  }else{
    editingId='graph-'+Date.now()+'-'+Math.random().toString(36).slice(2,7); savedGraphs.push({id:editingId,config});
  }
  persistSaved(); document.getElementById('gm-save').textContent='Update saved graph'; renderGallery();
  setStatus('Saved “'+config.title+'” to the gallery below.',false);
}
function queryDescription(config){
  const filter=config.filters.length?config.filters.map(f=>(defFor(f.field)?.label||f.field)+' = '+displayValue(f.field,f.value)).join(' AND '):'All reviews';
  return filter+' · grouped by '+(defFor(config.group)?.label||displayValue(config.group,config.group))+' · '+(config.measure==='percent'?'percent':'count');
}
function renderGallery(){
  galleryCharts.forEach(c=>c.destroy()); galleryCharts=[];
  const root=document.getElementById('gm-gallery'); document.getElementById('gm-saved-count').textContent=savedGraphs.length+' saved';
  if(!savedGraphs.length){root.innerHTML='<div class="empty-gallery">No saved graphs yet. Render a query above and choose <b>Save to gallery</b>.</div>';return;}
  root.innerHTML='';
  savedGraphs.forEach(item=>{
    const fig=makeFigure(item.config), card=document.createElement('article'); card.className='saved-card'; card.dataset.id=item.id;
    card.innerHTML='<div class="saved-summary"><div class="saved-thumb"><canvas></canvas></div><div><div class="saved-title">'+esc(item.config.title)+'</div><div class="saved-query">'+esc(queryDescription(item.config))+' · n = '+fig.rows+'</div></div><button type="button" class="secondary expand">Expand</button></div><div class="saved-detail"><div class="saved-chart"><canvas></canvas></div><div class="saved-actions"><button type="button" class="secondary edit">Change</button><select aria-label="Export format"><option value="jpeg">JPEG</option><option value="tiff">TIFF</option></select><button type="button" class="export">Export</button><button type="button" class="danger delete">Delete</button></div></div>';
    root.appendChild(card);
    galleryCharts.push(new Chart(card.querySelector('.saved-thumb canvas').getContext('2d'),chartConfig(fig,true)));
    card.querySelector('.expand').addEventListener('click',function(){
      const open=card.classList.toggle('expanded'); this.textContent=open?'Collapse':'Expand';
      if(open&&!card._fullChart){card._fullChart=new Chart(card.querySelector('.saved-chart canvas').getContext('2d'),chartConfig(fig,false));galleryCharts.push(card._fullChart);}
    });
    card.querySelector('.edit').addEventListener('click',()=>applyConfig(item.config,item.id));
    card.querySelector('.export').addEventListener('click',()=>exportCustom(item.config,card.querySelector('.saved-actions select').value));
    card.querySelector('.delete').addEventListener('click',()=>{if(confirm('Delete this saved graph?')){savedGraphs=savedGraphs.filter(g=>g.id!==item.id);if(editingId===item.id) editingId=null;persistSaved();renderGallery();}});
  });
}
function exportCustom(config,format){
  const fig=makeFigure(config), scale=3, cvs=document.createElement('canvas'); cvs.width=2280; cvs.height=1380;
  const base=chartConfig(fig,false); base.options.responsive=false;base.options.animation=false;base.options.devicePixelRatio=1;
  base.options.plugins.title.font.size=45;base.options.plugins.subtitle.font.size=30;base.options.plugins.legend.labels.font.size=30;
  const bg={id:'customWhiteBg',beforeDraw(chart){const c=chart.ctx;c.save();c.globalCompositeOperation='destination-over';c.fillStyle='#fff';c.fillRect(0,0,chart.width,chart.height);c.restore();}};
  const chart=new Chart(cvs.getContext('2d'),{...base,plugins:[bg]}); chart.draw();
  const name=(config.title||'patmos_custom_graph').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,70)||'patmos_custom_graph';
  setTimeout(()=>{if(format==='tiff'){const img=cvs.getContext('2d').getImageData(0,0,cvs.width,cvs.height);download(new Blob([encodeTIFF(img)],{type:'image/tiff'}),name+'.tiff');chart.destroy();}else{cvs.toBlob(blob=>{download(blob,name+'.jpg');chart.destroy();},'image/jpeg',.95);}},60);
}

document.getElementById('gm-add-filter').addEventListener('click',()=>addFilter());
document.getElementById('gm-render').addEventListener('click',renderPreview);
document.getElementById('gm-save').addEventListener('click',saveCurrent);
document.getElementById('gm-export').addEventListener('click',()=>previewConfig&&exportCustom(previewConfig,document.getElementById('gm-preview-format').value));
document.getElementById('gm-new').addEventListener('click',resetMaker);

loadAnalytics().then(data=>{
  analytics=data;
  document.getElementById('gm-group').innerHTML=fieldOptions('site',false);
  document.getElementById('gm-render').disabled=false; document.getElementById('gm-save').disabled=false;
  renderPreview(); renderGallery();
}).catch(err=>setStatus('Graph maker could not load the dashboard data: '+err.message,true));
})();
