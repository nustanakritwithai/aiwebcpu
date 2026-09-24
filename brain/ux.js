const UX_PREF='project-brain:ux:v058';
const PRESETS={
  all:['PROJECT','CAPABILITY','CAPABILITY_CANDIDATE','EVIDENCE','GOAL','ISSUE','INTEGRATION','VERSION'],
  core:['PROJECT','CAPABILITY','GOAL','INTEGRATION'],
  documented:['PROJECT','CAPABILITY_CANDIDATE','EVIDENCE'],
  reuse:['PROJECT','CAPABILITY','CAPABILITY_CANDIDATE','GOAL','INTEGRATION','EVIDENCE'],
  problems:['PROJECT','GOAL','INTEGRATION','ISSUE','EVIDENCE'],
  evidence:['PROJECT','CAPABILITY','CAPABILITY_CANDIDATE','EVIDENCE','ISSUE']
};

let graph=null;
let nodeMap=new Map();
let activePreset='core';
let focusMode=false;
let selectedNodeId=null;
let focusRootId=null;
let navigationHistory=[];
let navigationIndex=-1;
let replayingNavigation=false;
let temporalTimer=null;
let temporalSelectedIndex=0;
let applyingPreset=false;

const qs=s=>document.querySelector(s);
const qsa=s=>[...document.querySelectorAll(s)];

function readPrefs(){
  try{return JSON.parse(localStorage.getItem(UX_PREF)||'null')||{}}catch{return {}}
}

function writePrefs(){
  try{localStorage.setItem(UX_PREF,JSON.stringify({activePreset}))}catch{}
}

function setPreset(name,{persist=true}={}){
  const wanted=new Set(PRESETS[name]||PRESETS.all);
  activePreset=PRESETS[name]?name:'all';
  applyingPreset=true;
  qsa('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===activePreset));
  document.dispatchEvent(new CustomEvent('project-brain:set-visible-types',{
    detail:{types:[...wanted]}
  }));
  qsa('#type-filters .filter-chip').forEach(button=>{
    button.classList.toggle('off',!wanted.has(button.dataset.type));
  });
  applyingPreset=false;
  updateFilterCount();
  if(persist)writePrefs();
}

function updateFilterCount(){
  const chips=qsa('#type-filters .filter-chip');
  const on=chips.filter(b=>!b.classList.contains('off')).length;
  const target=qs('#filter-count');
  if(target)target.textContent=chips.length?`${on}/${chips.length}`:'—';
}

function nodeName(id){
  return nodeMap.get(id)?.name??id??'—';
}

function focusContains(id){
  if(!focusRootId||id===focusRootId)return true;
  return (graph?.edges??[]).some(edge=>
    (edge.from===focusRootId&&edge.to===id)||
    (edge.to===focusRootId&&edge.from===id)
  );
}

function updateNavigationUI(){
  const canBack=navigationIndex>0;
  const canForward=navigationIndex>=0&&navigationIndex<navigationHistory.length-1;

  for(const button of qsa('[data-inspection-action="back"], [data-detail-back]')){
    button.disabled=!canBack;
  }
  for(const button of qsa('[data-inspection-action="forward"], [data-detail-forward]')){
    button.disabled=!canForward;
  }

  const history=qs('#graph-inspection-history');
  if(history){
    history.textContent=navigationIndex>=0
      ? `${navigationIndex+1}/${navigationHistory.length}`
      : '';
  }
}

function recordNavigation(id){
  if(!id||replayingNavigation)return;
  if(navigationHistory[navigationIndex]===id){
    updateNavigationUI();
    return;
  }
  navigationHistory=navigationHistory.slice(0,navigationIndex+1);
  navigationHistory.push(id);
  if(navigationHistory.length>24)navigationHistory.shift();
  navigationIndex=navigationHistory.length-1;
  updateNavigationUI();
}

function navigateHistory(delta){
  const next=navigationIndex+delta;
  if(next<0||next>=navigationHistory.length)return false;
  navigationIndex=next;
  const id=navigationHistory[navigationIndex];
  replayingNavigation=true;
  document.dispatchEvent(new CustomEvent('project-brain:select-node',{
    detail:{id,source:'history',center:true,scale:1}
  }));
  replayingNavigation=false;
  updateNavigationUI();
  return true;
}

function resetNavigation(){
  navigationHistory=[];
  navigationIndex=-1;
  replayingNavigation=false;
  updateNavigationUI();
}

function updateInspectionUI(){
  const bar=qs('#graph-inspection');
  const topButton=qs('#focus-mode');
  const detailButton=qs('#detail [data-detail-focus]');
  const hasSelection=Boolean(selectedNodeId);
  if(bar)bar.hidden=!hasSelection;

  const nodeLabel=qs('#graph-inspection-node');
  if(nodeLabel)nodeLabel.textContent=hasSelection?nodeName(selectedNodeId):'—';

  const state=qs('#graph-inspection-state');
  if(state)state.textContent=focusMode?'FOCUS':'SELECTED';

  const focusCopy=qs('#graph-inspection-focus');
  if(focusCopy){
    focusCopy.textContent=focusMode&&focusRootId
      ? `Focus: ${nodeName(focusRootId)}`
      : 'คง selection ไว้เมื่อออกจาก Focus';
  }

  const label=focusMode?'ออกจาก Focus':'เข้า Focus';
  if(topButton){
    topButton.disabled=!hasSelection&&!focusMode;
    topButton.textContent=label;
    topButton.setAttribute('aria-pressed',String(focusMode));
  }
  if(detailButton){
    detailButton.textContent=label;
    detailButton.disabled=!hasSelection&&!focusMode;
  }
  const barButton=qs('[data-inspection-action="focus"]');
  if(barButton){
    barButton.textContent=label;
    barButton.disabled=!hasSelection&&!focusMode;
  }

  updateNavigationUI();
  document.body.classList.toggle('ux-focus',focusMode);
}

function setFocus(on,{rootId=selectedNodeId,persist=true}={}){
  const next=Boolean(on);
  if(next&&!rootId)return false;

  focusMode=next;
  focusRootId=next?rootId:null;
  document.dispatchEvent(new CustomEvent('project-brain:set-focus-root',{
    detail:{id:focusRootId}
  }));
  updateInspectionUI();

  if(persist)writePrefs();
  return true;
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
  selectedNodeId=id;
  const node=nodeMap.get(id);
  if(!node||detail.querySelector('.detail-actions')){
    updateInspectionUI();
    return;
  }
  const outgoing=(graph?.edges||[]).filter(e=>e.from===id);
  const incoming=(graph?.edges||[]).filter(e=>e.to===id);
  const evidence=[...outgoing,...incoming].filter(e=>e.type==='VERIFIED_BY'||e.type==='DOCUMENTED_BY').length;
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

  const back=document.createElement('button');
  back.type='button';
  back.dataset.detailBack='true';
  back.textContent='← ย้อน';
  back.addEventListener('click',()=>navigateHistory(-1));
  actions.append(back);

  const forward=document.createElement('button');
  forward.type='button';
  forward.dataset.detailForward='true';
  forward.textContent='ถัดไป →';
  forward.addEventListener('click',()=>navigateHistory(1));
  actions.append(forward);

  const center=document.createElement('button');
  center.type='button';
  center.dataset.detailCenter='true';
  center.textContent='จัดกึ่งกลาง';
  center.addEventListener('click',()=>{
    document.dispatchEvent(new CustomEvent('project-brain:center-node',{detail:{id:selectedNodeId,scale:1}}));
  });
  actions.append(center);

  const focus=document.createElement('button');
  focus.type='button';
  focus.dataset.detailFocus='true';
  focus.addEventListener('click',()=>setFocus(!focusMode,{rootId:selectedNodeId}));
  actions.append(focus);

  const badge=document.createElement('span');
  badge.className='detail-badge';
  badge.textContent=`${outgoing.length+incoming.length} relations${evidence?` · ${evidence} evidence`:''}`;
  actions.append(badge);

  const idLine=detail.querySelector('.detail-id');
  idLine?.after(actions);
  updateInspectionUI();
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



function temporalCheckpointIndex(id){
  return (graph?.temporal?.checkpoints??[]).findIndex(cp=>cp.id===id);
}

function temporalActiveAt(item,checkpointId){
  const at=temporalCheckpointIndex(checkpointId);
  if(at<0)return false;
  const from=item.activeFrom?temporalCheckpointIndex(item.activeFrom):0;
  const until=item.activeUntil?temporalCheckpointIndex(item.activeUntil):Infinity;
  if(from<0||until===-1)return false;
  return at>=from&&at<until;
}

function temporalMaterializeAt(item,checkpointId){
  const state=(item.temporalStates??[]).find(row=>temporalActiveAt(row,checkpointId));
  return state?{...item,...(state.values??{})}:item;
}

function temporalSnapshot(checkpointId){
  if(!graph)return {nodes:[],edges:[]};
  const nodes=graph.nodes
    .filter(n=>temporalActiveAt(n,checkpointId))
    .map(n=>temporalMaterializeAt(n,checkpointId));
  const ids=new Set(nodes.map(n=>n.id));
  const edges=graph.edges
    .filter(e=>ids.has(e.from)&&ids.has(e.to)&&temporalActiveAt(e,checkpointId));
  return {nodes,edges};
}

function updateTemporalMetrics(checkpointId){
  const snap=temporalSnapshot(checkpointId);
  const evidence=snap.nodes.filter(n=>n.type==='EVIDENCE');
  const sat=evidence.filter(n=>n.verdict==='SAT').length;
  const goal=snap.nodes.find(n=>n.type==='GOAL');
  const values={
    '#metric-nodes':snap.nodes.length,
    '#metric-relations':snap.edges.length,
    '#metric-evidence':`${sat}/${evidence.length}`,
    '#metric-decision':goal?.decision||'—'
  };
  for(const [sel,value] of Object.entries(values)){const el=qs(sel);if(el)el.textContent=value}
}

function dispatchTemporalCheckpoint(id){
  document.dispatchEvent(new CustomEvent('project-brain:set-checkpoint',{detail:{id}}));
}

function stopTemporalPlayback(){
  if(temporalTimer){clearInterval(temporalTimer);temporalTimer=null}
  const play=qs('#time-play');
  if(play){play.setAttribute('aria-pressed','false');play.textContent='▶ เล่น'}
}

function setTemporalIndex(index,{updateUrl=true,dispatch=true}={}){
  const checkpoints=graph?.temporal?.checkpoints??[];
  if(!checkpoints.length)return;
  temporalSelectedIndex=Math.max(0,Math.min(checkpoints.length-1,Number(index)||0));
  const cp=checkpoints[temporalSelectedIndex];
  const latest=graph.temporal?.defaultCheckpoint??checkpoints.at(-1)?.id;

  const slider=qs('#time-slider');
  if(slider){slider.max=String(checkpoints.length-1);slider.value=String(temporalSelectedIndex)}
  const label=qs('#time-label');if(label)label.textContent=cp.label;
  const desc=qs('#time-description');if(desc)desc.textContent=cp.description||'';
  const date=qs('#time-date');if(date)date.textContent=cp.date||'—';
  const pos=qs('#time-position');if(pos)pos.textContent=`${temporalSelectedIndex+1} / ${checkpoints.length}`;

  qsa('.time-checkpoint').forEach((button,i)=>{
    button.classList.toggle('current',i===temporalSelectedIndex);
    button.classList.toggle('past',i<temporalSelectedIndex);
    button.setAttribute('aria-current',i===temporalSelectedIndex?'step':'false');
  });

  document.body.classList.toggle('temporal-past',cp.id!==latest);
  updateTemporalMetrics(cp.id);

  if(updateUrl){
    const url=new URL(location.href);
    if(cp.id===latest)url.searchParams.delete('at');
    else url.searchParams.set('at',cp.id);
    history.replaceState(null,'',url);
  }
  if(dispatch)dispatchTemporalCheckpoint(cp.id);
}

function playTemporal(){
  const checkpoints=graph?.temporal?.checkpoints??[];
  if(!checkpoints.length)return;
  if(temporalTimer){stopTemporalPlayback();return}
  if(temporalSelectedIndex>=checkpoints.length-1)setTemporalIndex(0);
  const play=qs('#time-play');
  if(play){play.setAttribute('aria-pressed','true');play.textContent='Ⅱ หยุด'}
  temporalTimer=setInterval(()=>{
    if(temporalSelectedIndex>=checkpoints.length-1){stopTemporalPlayback();return}
    setTemporalIndex(temporalSelectedIndex+1);
  },1150);
}

function installTemporal(){
  const checkpoints=graph?.temporal?.checkpoints??[];
  const box=qs('#time-machine');
  if(!checkpoints.length){if(box)box.hidden=true;return}

  const holder=qs('#time-checkpoints');
  if(holder){
    holder.replaceChildren();
    checkpoints.forEach((cp,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='time-checkpoint';
      button.textContent=cp.label;
      button.title=`${cp.date} · ${cp.description||''}`;
      button.addEventListener('click',()=>{stopTemporalPlayback();setTemporalIndex(index)});
      holder.append(button);
    });
  }

  const slider=qs('#time-slider');
  if(slider){
    slider.min='0';slider.max=String(checkpoints.length-1);slider.step='1';
    slider.addEventListener('input',()=>{stopTemporalPlayback();setTemporalIndex(Number(slider.value))});
  }
  qs('#time-now')?.addEventListener('click',()=>{
    stopTemporalPlayback();
    const latest=graph.temporal?.defaultCheckpoint??checkpoints.at(-1)?.id;
    const index=temporalCheckpointIndex(latest);
    setTemporalIndex(index<0?checkpoints.length-1:index);
  });
  qs('#time-play')?.addEventListener('click',playTemporal);

  const requested=new URL(location.href).searchParams.get('at');
  const defaultId=graph.temporal?.defaultCheckpoint??checkpoints.at(-1)?.id;
  const requestedIndex=temporalCheckpointIndex(requested);
  const defaultIndex=temporalCheckpointIndex(defaultId);
  setTemporalIndex(requestedIndex>=0?requestedIndex:(defaultIndex>=0?defaultIndex:checkpoints.length-1),{updateUrl:false});

  document.addEventListener('project-brain:graph-ready',()=>{
    const cp=checkpoints[temporalSelectedIndex];
    if(cp)dispatchTemporalCheckpoint(cp.id);
  });
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
  qs('#focus-mode')?.addEventListener('click',()=>setFocus(!focusMode,{rootId:selectedNodeId}));

  qsa('[data-inspection-action]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.inspectionAction;
    if(action==='back'){
      navigateHistory(-1);
    }else if(action==='forward'){
      navigateHistory(1);
    }else if(action==='center'&&selectedNodeId){
      document.dispatchEvent(new CustomEvent('project-brain:center-node',{detail:{id:selectedNodeId,scale:1}}));
    }else if(action==='focus'){
      setFocus(!focusMode,{rootId:selectedNodeId});
    }else if(action==='clear'){
      qs('#reset-selection')?.click();
    }
  }));
  qsa('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    setPreset(b.dataset.preset);
    if(matchMedia('(max-width:1180px), (pointer:coarse) and (orientation:portrait)').matches){
      b.closest('.graph-options')?.removeAttribute('open');
    }
  }));
  qs('#detail-backdrop')?.addEventListener('click',()=>qs('#reset-selection')?.click());
  const typeFilters=qs('#type-filters');
  typeFilters?.addEventListener('click',()=>{
    if(applyingPreset)return;
    setTimeout(()=>{
      activePreset='custom';
      qsa('[data-preset]').forEach(x=>x.classList.remove('active'));
      updateFilterCount();
      writePrefs();
    },0);
  });
}

function installSelectionEvents(){
  document.addEventListener('project-brain:node-selected',event=>{
    selectedNodeId=event.detail?.id??null;
    recordNavigation(selectedNodeId);

    if(focusMode&&selectedNodeId&&!focusContains(selectedNodeId)){
      setFocus(false,{persist:false});
    }else if(!focusMode){
      focusRootId=null;
    }

    updateInspectionUI();
    openDetailSheet();
  });

  document.addEventListener('project-brain:selection-cleared',()=>{
    selectedNodeId=null;
    focusRootId=null;
    focusMode=false;
    resetNavigation();
    updateInspectionUI();
    closeDetailSheet();
  });

  document.addEventListener('project-brain:focus-root-changed',event=>{
    focusRootId=event.detail?.id??null;
    focusMode=Boolean(focusRootId);
    updateInspectionUI();
  });
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
    if(response.ok){graph=await response.json();nodeMap=new Map(graph.nodes.map(n=>[n.id,n]));populateMetrics();installTemporal()}
  }catch{}
  const prefs=readPrefs();
  activePreset=PRESETS[prefs.activePreset]?prefs.activePreset:'core';
  focusMode=false;
  focusRootId=null;
  selectedNodeId=null;
  resetNavigation();
  installSectionNav();
  installSelectionEvents();
  installSearchEnter();
  installGraphHooks();
  const wait=setInterval(()=>{
    if(!qs('#type-filters .filter-chip'))return;
    clearInterval(wait);
    setPreset(activePreset,{persist:false});
    updateInspectionUI();
    updateFilterCount();
    openDeepLink();
  },60);
}

bootUX();
