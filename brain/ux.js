const UX_PREF='project-brain:ux:v021';
const PRESETS={
  all:['PROJECT','CAPABILITY','EVIDENCE','GOAL','ISSUE','INTEGRATION','VERSION'],
  core:['PROJECT','CAPABILITY','GOAL','INTEGRATION'],
  reuse:['PROJECT','CAPABILITY','GOAL','INTEGRATION','EVIDENCE'],
  problems:['PROJECT','GOAL','INTEGRATION','ISSUE','EVIDENCE'],
  evidence:['PROJECT','CAPABILITY','EVIDENCE','ISSUE']
};

let graph=null;
let nodeMap=new Map();
let activePreset='all';
let focusMode=false;
let observer=null;

const qs=s=>document.querySelector(s);
const qsa=s=>[...document.querySelectorAll(s)];

function readPrefs(){
  try{return JSON.parse(localStorage.getItem(UX_PREF)||'null')||{}}catch{return {}}
}

function writePrefs(){
  try{localStorage.setItem(UX_PREF,JSON.stringify({activePreset,focusMode}))}catch{}
}

function setPreset(name,{persist=true}={}){
  const wanted=new Set(PRESETS[name]||PRESETS.all);
  activePreset=PRESETS[name]?name:'all';
  qsa('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===activePreset));
  qsa('#type-filters .filter-chip').forEach(button=>{
    const type=button.dataset.type;
    const shouldBeOn=wanted.has(type);
    const isOn=!button.classList.contains('off');
    if(shouldBeOn!==isOn)button.click();
  });
  updateFilterCount();
  if(persist)writePrefs();
}

function updateFilterCount(){
  const chips=qsa('#type-filters .filter-chip');
  const on=chips.filter(b=>!b.classList.contains('off')).length;
  const target=qs('#filter-count');
  if(target)target.textContent=chips.length?`${on}/${chips.length}`:'—';
}

function setFocus(on,{persist=true}={}){
  focusMode=Boolean(on);
  document.body.classList.toggle('ux-focus',focusMode);
  const button=qs('#focus-mode');
  if(button)button.setAttribute('aria-pressed',String(focusMode));
  if(persist)writePrefs();
}

function syncDeepLinkFromDetail(){
  const id=qs('#detail .detail-id')?.textContent?.trim();
  if(!id||!nodeMap.has(id))return;
  const url=new URL(location.href);
  if(url.searchParams.get('node')!==id){
    url.searchParams.set('node',id);
    history.replaceState(null,'',url);
  }
}

function clearDeepLink(){
  const url=new URL(location.href);
  if(url.searchParams.has('node')){
    url.searchParams.delete('node');
    history.replaceState(null,'',url);
  }
}

function openDetailSheet(){
  const detail=qs('#detail');
  if(!detail||detail.querySelector('.detail-placeholder'))return;
  document.body.classList.add('detail-open');
  const backdrop=qs('#detail-backdrop');
  if(backdrop)backdrop.hidden=false;
  if(!detail.querySelector('.detail-close')){
    const close=document.createElement('button');
    close.type='button';
    close.className='detail-close';
    close.setAttribute('aria-label','ปิดรายละเอียด');
    close.textContent='×';
    close.addEventListener('click',()=>qs('#reset-selection')?.click());
    detail.prepend(close);
  }
  enhanceDetailActions();
  syncDeepLinkFromDetail();
}

function closeDetailSheet(){
  document.body.classList.remove('detail-open');
  const backdrop=qs('#detail-backdrop');
  if(backdrop)backdrop.hidden=true;
  clearDeepLink();
}

function enhanceDetailActions(){
  const detail=qs('#detail');
  const id=detail?.querySelector('.detail-id')?.textContent?.trim();
  if(!id)return;
  const node=nodeMap.get(id);
  if(!node||detail.querySelector('.detail-actions'))return;
  const outgoing=(graph?.edges||[]).filter(e=>e.from===id);
  const incoming=(graph?.edges||[]).filter(e=>e.to===id);
  const evidence=[...outgoing,...incoming].filter(e=>e.type==='VERIFIED_BY').length;
  const actions=document.createElement('div');
  actions.className='detail-actions';
  if(node.repo){
    const a=document.createElement('a');
    a.href=`https://github.com/${node.repo}`;
    a.target='_blank';
    a.rel='noopener';
    a.textContent='เปิด Repo ↗';
    actions.append(a);
  }
  const focus=document.createElement('button');
  focus.type='button';
  focus.textContent=focusMode?'ออกจาก Focus':'โฟกัส Node นี้';
  focus.addEventListener('click',()=>{setFocus(!focusMode);focus.textContent=focusMode?'ออกจาก Focus':'โฟกัส Node นี้'});
  actions.append(focus);
  const badge=document.createElement('span');
  badge.className='detail-badge';
  badge.textContent=`${outgoing.length+incoming.length} relations${evidence?` · ${evidence} evidence`:''}`;
  actions.append(badge);
  const idLine=detail.querySelector('.detail-id');
  idLine?.after(actions);
}

function populateMetrics(){
  if(!graph)return;
  const evidence=graph.nodes.filter(n=>n.type==='EVIDENCE');
  const sat=evidence.filter(n=>n.verdict==='SAT').length;
  const goal=graph.nodes.find(n=>n.type==='GOAL');
  const values={
    '#metric-nodes':graph.nodes.length,
    '#metric-relations':graph.edges.length,
    '#metric-evidence':`${sat}/${evidence.length}`,
    '#metric-decision':goal?.decision||'—'
  };
  for(const [sel,value] of Object.entries(values)){const el=qs(sel);if(el)el.textContent=value}
}

function installSectionNav(){
  qsa('[data-scroll]').forEach(button=>button.addEventListener('click',()=>{
    qsa('[data-scroll]').forEach(x=>x.classList.toggle('active',x===button));
    document.getElementById(button.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
}

function installSearchEnter(){
  const input=qs('#search');
  input?.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    const match=qs('#nodes .node.match:not(.dim)')||qs('#nodes .node.match');
    match?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  });
}

function installGraphHooks(){
  qs('#focus-mode')?.addEventListener('click',()=>setFocus(!focusMode));
  qsa('[data-preset]').forEach(b=>b.addEventListener('click',()=>setPreset(b.dataset.preset)));
  qs('#detail-backdrop')?.addEventListener('click',()=>qs('#reset-selection')?.click());
  qs('#reset-selection')?.addEventListener('click',()=>queueMicrotask(closeDetailSheet));
  qs('#graph')?.addEventListener('click',event=>{
    const node=event.target.closest?.('.node');
    if(node){setTimeout(openDetailSheet,0);return}
    setTimeout(closeDetailSheet,0);
  },true);
  const typeFilters=qs('#type-filters');
  typeFilters?.addEventListener('click',()=>setTimeout(()=>{
    activePreset='custom';
    qsa('[data-preset]').forEach(x=>x.classList.remove('active'));
    updateFilterCount();
    writePrefs();
  },0));
}

function installDetailObserver(){
  const detail=qs('#detail');
  if(!detail)return;
  observer=new MutationObserver(()=>{
    if(detail.querySelector('.detail-placeholder'))closeDetailSheet();
    else openDetailSheet();
  });
  observer.observe(detail,{childList:true,subtree:true});
}

function openDeepLink(){
  const id=new URL(location.href).searchParams.get('node');
  if(!id)return;
  let tries=0;
  const timer=setInterval(()=>{
    const node=qsa('#nodes .node').find(el=>el.dataset.id===id);
    if(node){clearInterval(timer);node.dispatchEvent(new MouseEvent('click',{bubbles:true}));return}
    if(++tries>30)clearInterval(timer);
  },80);
}

async function bootUX(){
  try{
    const response=await fetch('../project-brain/graph/project-brain.json',{cache:'no-store'});
    if(response.ok){graph=await response.json();nodeMap=new Map(graph.nodes.map(n=>[n.id,n]));populateMetrics()}
  }catch{}
  const prefs=readPrefs();
  activePreset=PRESETS[prefs.activePreset]?prefs.activePreset:'all';
  focusMode=prefs.focusMode===true;
  installSectionNav();
  installSearchEnter();
  installGraphHooks();
  installDetailObserver();
  const wait=setInterval(()=>{
    if(!qs('#type-filters .filter-chip'))return;
    clearInterval(wait);
    setPreset(activePreset,{persist:false});
    setFocus(focusMode,{persist:false});
    updateFilterCount();
    openDeepLink();
  },60);
}

bootUX();
