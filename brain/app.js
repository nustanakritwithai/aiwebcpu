const TYPE_STYLE={
  PROJECT:{label:'Project',color:'#3694ff'},
  CAPABILITY:{label:'Verified Capability',color:'#3ee68b'},
  CAPABILITY_CANDIDATE:{label:'Documented Capability',color:'#7fd8b2'},
  EVIDENCE:{label:'Evidence',color:'#ffd15c'},
  GOAL:{label:'Goal',color:'#bb75ff'},
  ISSUE:{label:'Issue',color:'#ff666f'},
  INTEGRATION:{label:'Integration',color:'#32d6ff'},
  VERSION:{label:'Version',color:'#ff9b4a'}
};

const REL_STYLE={
  PROVIDES:{color:'#3ee68b',marker:'green'},
  USED_IN:{color:'#3694ff',marker:'blue'},
  NEEDS:{color:'#bb75ff',marker:'purple'},
  DEPENDS_ON:{color:'#8fa2b5',marker:'gray',dash:'5 4'},
  VERIFIED_BY:{color:'#ffd15c',marker:'yellow'},
  BLOCKED_BY:{color:'#ff666f',marker:'red',dash:'5 4'},
  ADAPTED_FROM:{color:'#32d6ff',marker:'cyan'},
  SUPERSEDES:{color:'#ff9b4a',marker:'orange'},
  REUSE_CANDIDATE_FOR:{color:'#ff72c8',marker:'pink',dash:'4 3'},
  DOCUMENTS:{color:'#6fcda1',marker:'green',dash:'3 3'},
  DOCUMENTED_BY:{color:'#c9b66b',marker:'yellow',dash:'3 3'}
};

const svg=document.querySelector('#graph');
const viewport=document.querySelector('#viewport');
const nodeLayer=document.querySelector('#nodes');
const edgeLayer=document.querySelector('#edges');
const edgeLabelLayer=document.querySelector('#edge-label-layer');
const detail=document.querySelector('#detail');
const search=document.querySelector('#search');
const empty=document.querySelector('#empty');

let graph=null;
let visibleTypes=new Set();
let selectedId=null;
let positions=new Map();
let transform={x:0,y:0,k:1};
let draggingStage=false;
let dragStart=null;
let showEdgeLabels=true;

let temporalCheckpointId=null;

function temporalIndex(id){
  return (graph?.temporal?.checkpoints??[]).findIndex(cp=>cp.id===id);
}

function temporalActive(item){
  if(!graph?.temporal?.checkpoints?.length||!temporalCheckpointId)return true;
  const at=temporalIndex(temporalCheckpointId);
  const from=item.activeFrom?temporalIndex(item.activeFrom):0;
  const until=item.activeUntil?temporalIndex(item.activeUntil):Infinity;
  if(at<0||from<0||until===-1)return false;
  return at>=from&&at<until;
}

function temporalMaterialize(item){
  const state=(item.temporalStates??[]).find(row=>temporalActive(row));
  if(!state)return item;
  return {...item,...(state.values??{})};
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=(name,attrs={})=>{const x=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(attrs))x.setAttribute(k,v);return x};

function hash(text){
  let h=2166136261>>>0;
  for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}

function initialPosition(node,index){
  const bands={
    PROJECT:[150,260],
    CAPABILITY:[390,185],
    CAPABILITY_CANDIDATE:[390,320],
    GOAL:[650,150],
    INTEGRATION:[650,340],
    ISSUE:[730,500],
    EVIDENCE:[380,520],
    VERSION:[150,500]
  };
  const [bx,by]=bands[node.type]??[430,360];
  const h=hash(node.id);
  return {x:bx+((h%170)-85),y:by+(((h>>>8)%180)-90),vx:0,vy:0,index};
}

function settle(nodes,edges){
  positions=new Map(nodes.map((n,i)=>[n.id,initialPosition(n,i)]));
  const W=900,H=650;
  const iterations=nodes.length>180?130:nodes.length>100?220:360;
  for(let iter=0;iter<iterations;iter++){
    const alpha=(1-iter/iterations)*.9+.04;
    const list=[...positions.values()];

    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];
      let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
      if(d2<1){dx=.2;dy=.2;d2=.08}
      const dist=Math.sqrt(d2);
      const force=Math.min(1.8,5200/d2)*alpha;
      const fx=dx/dist*force,fy=dy/dist*force;
      a.vx-=fx;a.vy-=fy;b.vx+=fx;b.vy+=fy;
    }

    for(const edge of edges){
      const a=positions.get(edge.from),b=positions.get(edge.to);
      if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.max(1,Math.hypot(dx,dy));
      const ideal=edge.type==='VERIFIED_BY'?105:145;
      const force=(dist-ideal)*.008*alpha;
      const fx=dx/dist*force,fy=dy/dist*force;
      a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;
    }

    for(const node of nodes){
      const p=positions.get(node.id);
      const base=initialPosition(node,p.index);
      p.vx+=(base.x-p.x)*.0016*alpha;
      p.vy+=(base.y-p.y)*.0016*alpha;
    }

    for(const p of positions.values()){
      p.vx*=.78;p.vy*=.78;
      p.x=Math.max(35,Math.min(W-35,p.x+p.vx));
      p.y=Math.max(35,Math.min(H-35,p.y+p.vy));
    }
  }
}

function filtered(){
  const q=search.value.trim().toLocaleLowerCase();
  const nodes=graph.nodes
    .filter(n=>visibleTypes.has(n.type)&&temporalActive(n))
    .map(temporalMaterialize);
  const nodeIds=new Set(nodes.map(n=>n.id));
  const edges=graph.edges
    .filter(e=>nodeIds.has(e.from)&&nodeIds.has(e.to)&&temporalActive(e))
    .map(temporalMaterialize);
  const matches=new Set(!q?[]:nodes.filter(n=>
    [n.id,n.name,n.repo,n.status,n.decision,n.verdict,n.scope]
      .some(v=>String(v??'').toLocaleLowerCase().includes(q))
  ).map(n=>n.id));
  return {nodes,edges,matches,q};
}

function connectedSet(id,edges){
  const set=new Set([id]);
  for(const e of edges)if(e.from===id)set.add(e.to);else if(e.to===id)set.add(e.from);
  return set;
}

function renderGraph(){
  const {nodes,edges,matches,q}=filtered();
  nodeLayer.replaceChildren();edgeLayer.replaceChildren();edgeLabelLayer.replaceChildren();
  empty.hidden=nodes.length>0;
  const connected=selectedId?connectedSet(selectedId,edges):null;

  for(const edge of edges){
    const a=positions.get(edge.from),b=positions.get(edge.to);
    if(!a||!b)continue;
    const style=REL_STYLE[edge.type]??REL_STYLE.DEPENDS_ON;
    const line=el('line',{
      x1:a.x,y1:a.y,x2:b.x,y2:b.y,
      stroke:style.color,
      class:'edge'+(selectedId&&!connected.has(edge.from)&&!connected.has(edge.to)?' dim':(selectedId&&(edge.from===selectedId||edge.to===selectedId)?' active':''))
    });
    if(style.dash)line.setAttribute('stroke-dasharray',style.dash);
    line.setAttribute('marker-end',`url(#arrow-${style.marker})`);
    edgeLayer.append(line);

    if(showEdgeLabels){
      const text=el('text',{
        x:(a.x+b.x)/2,y:(a.y+b.y)/2-4,
        'text-anchor':'middle',
        class:'edge-label'+(selectedId&&!connected.has(edge.from)&&!connected.has(edge.to)?' dim':'')
      });
      text.textContent=edge.type;
      edgeLabelLayer.append(text);
    }
  }

  for(const node of nodes){
    const p=positions.get(node.id);if(!p)continue;
    const style=TYPE_STYLE[node.type]??{color:'#fff'};
    const g=el('g',{class:'node'});
    g.dataset.id=node.id;
    g.style.color=style.color;
    g.setAttribute('transform',`translate(${p.x},${p.y})`);
    if(selectedId===node.id)g.classList.add('selected');
    if(selectedId&&!connected.has(node.id))g.classList.add('dim');
    if(q&&matches.has(node.id))g.classList.add('match');
    if(q&&!matches.has(node.id)&&!selectedId)g.classList.add('dim');

    const radius=node.type==='PROJECT'?17:node.type==='GOAL'||node.type==='INTEGRATION'?15:node.type==='CAPABILITY_CANDIDATE'?11:13;
    const circle=el('circle',{r:radius,fill:style.color,'fill-opacity':'.16'});
    const title=el('title');title.textContent=`${node.name} · ${node.type}`;circle.append(title);
    g.append(circle);

    const label=el('text',{x:0,y:radius+14,'text-anchor':'middle'});
    label.textContent=node.name.length>30?node.name.slice(0,28)+'…':node.name;
    g.append(label);

    const meta=el('text',{x:0,y:radius+25,'text-anchor':'middle',class:'meta'});
    meta.textContent=node.verdict??node.decision??node.status??'';
    g.append(meta);

    g.addEventListener('click',event=>{
      event.stopPropagation();
      selectNode(node.id);
    });
    nodeLayer.append(g);
  }

  document.querySelector('#summary').textContent=`${nodes.length} nodes · ${edges.length} relations`;
  applyTransform();
}

function applyTransform(){
  viewport.setAttribute('transform',`translate(${transform.x} ${transform.y}) scale(${transform.k})`);
}

function fit(){
  const box={x:0,y:0,w:900,h:650};
  const rect=svg.getBoundingClientRect();
  const k=Math.max(.35,Math.min(1.4,Math.min(rect.width/box.w,rect.height/box.h)*.93));
  transform={x:(rect.width-box.w*k)/2,y:(rect.height-box.h*k)/2,k};
  applyTransform();
}

function selectNode(id){
  selectedId=id;
  const current=filtered();
  const node=current.nodes.find(n=>n.id===id);
  if(!node)return;
  const outgoing=current.edges.filter(e=>e.from===id);
  const incoming=current.edges.filter(e=>e.to===id);
  const nodeMap=new Map(current.nodes.map(n=>[n.id,n]));

  const properties=Object.entries(node)
    .filter(([k])=>!['name','temporalStates'].includes(k))
    .map(([k,v])=>`<div class="prop"><dt>${esc(k)}</dt><dd class="${k==='verdict'?'verdict '+esc(v):''}">${esc(Array.isArray(v)?v.join(', '):v)}</dd></div>`).join('');

  const relationRows=[...outgoing.map(e=>({edge:e,target:nodeMap.get(e.to),dir:'→'})),...incoming.map(e=>({edge:e,target:nodeMap.get(e.from),dir:'←'}))]
    .filter(x=>x.target)
    .map(({edge,target,dir})=>`<button class="relation-row" data-node="${esc(target.id)}"><span class="relation-type">${dir} ${esc(edge.type)}</span><span class="relation-target">${esc(target.name)}</span></button>`).join('');

  detail.innerHTML=`
    <span class="detail-type" style="border-color:${TYPE_STYLE[node.type]?.color??'#fff'}">${esc(node.type)}</span>
    <h2 class="detail-title">${esc(node.name)}</h2>
    <div class="detail-id">${esc(node.id)}</div>
    <dl class="properties">${properties}</dl>
    <h2>Relations</h2>
    <div class="relations">${relationRows||'<p class="note">ไม่มีความสัมพันธ์ใน graph ปัจจุบัน</p>'}</div>
  `;
  detail.querySelectorAll('[data-node]').forEach(b=>b.addEventListener('click',()=>selectNode(b.dataset.node)));
  renderGraph();
}

function setupFilters(){
  const holder=document.querySelector('#type-filters');
  const legend=document.querySelector('#legend');
  holder.replaceChildren();legend.replaceChildren();
  for(const type of graph.nodeTypes){
    visibleTypes.add(type);
    const style=TYPE_STYLE[type]??{label:type,color:'#fff'};
    const b=document.createElement('button');
    b.className='filter-chip';
    b.innerHTML=`<span class="dot" style="color:${style.color};background:${style.color}"></span>${style.label}`;
    b.dataset.type=type;
    b.addEventListener('click',()=>{
      if(visibleTypes.has(type))visibleTypes.delete(type);else visibleTypes.add(type);
      b.classList.toggle('off',!visibleTypes.has(type));
      if(selectedId&&!graph.nodes.some(n=>n.id===selectedId&&visibleTypes.has(n.type)))selectedId=null;
      renderGraph();
    });
    holder.append(b);

    const item=document.createElement('span');
    item.className='legend-chip';
    item.innerHTML=`<span class="dot" style="color:${style.color};background:${style.color}"></span>${style.label}`;
    legend.append(item);
  }
}

function renderTimeline(){
  const target=document.querySelector('#timeline-list');
  target.innerHTML=(graph.timeline??[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).map(row=>`
    <article class="timeline-item">
      <time>${esc(row.date)}</time>
      <p>${esc(row.event)}</p>
      <small>${esc(row.source)}</small>
    </article>
  `).join('');
}

function setupInteraction(){
  search.addEventListener('input',renderGraph);
  document.querySelector('#edge-labels').addEventListener('change',e=>{showEdgeLabels=e.target.checked;renderGraph()});
  document.querySelector('#fit').addEventListener('click',fit);
  document.querySelector('#zoom-in').addEventListener('click',()=>{transform.k=Math.min(2.5,transform.k*1.18);applyTransform()});
  document.querySelector('#zoom-out').addEventListener('click',()=>{transform.k=Math.max(.25,transform.k/1.18);applyTransform()});
  document.querySelector('#reset-selection').addEventListener('click',()=>{selectedId=null;detail.innerHTML='<div class="detail-placeholder"><span class="big-icon">◎</span><h2>เลือก Node</h2><p>แตะ node ในกราฟเพื่อดู properties, ความสัมพันธ์, evidence และ reuse context</p></div>';renderGraph()});

  const wrap=document.querySelector('#svg-wrap');
  wrap.addEventListener('pointerdown',e=>{
    if(e.target.closest?.('.node'))return;
    draggingStage=true;
    dragStart={x:e.clientX,y:e.clientY,tx:transform.x,ty:transform.y};
    wrap.setPointerCapture?.(e.pointerId);
  });
  wrap.addEventListener('pointermove',e=>{
    if(!draggingStage||!dragStart)return;
    transform.x=dragStart.tx+(e.clientX-dragStart.x);
    transform.y=dragStart.ty+(e.clientY-dragStart.y);
    applyTransform();
  });
  const stop=()=>{draggingStage=false;dragStart=null};
  wrap.addEventListener('pointerup',stop);
  wrap.addEventListener('pointercancel',stop);
  wrap.addEventListener('wheel',e=>{
    e.preventDefault();
    const scale=e.deltaY<0?1.1:1/1.1;
    transform.k=Math.max(.25,Math.min(2.5,transform.k*scale));
    applyTransform();
  },{passive:false});
  svg.addEventListener('click',()=>{selectedId=null;renderGraph()});
  addEventListener('resize',fit);
}

async function boot(){
  try{
    const response=await fetch('../project-brain/graph/project-brain.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    graph=await response.json();
    const requestedCheckpoint=new URL(location.href).searchParams.get('at');
    const defaultCheckpoint=graph.temporal?.defaultCheckpoint??graph.temporal?.checkpoints?.at(-1)?.id??null;
    temporalCheckpointId=(requestedCheckpoint&&temporalIndex(requestedCheckpoint)>=0)?requestedCheckpoint:defaultCheckpoint;
    settle(graph.nodes,graph.edges);
    setupFilters();
    renderTimeline();
    setupInteraction();
    renderGraph();
    fit();
    document.querySelector('#graph-status').textContent='LIVE GRAPH';
    document.querySelector('#graph-status').classList.add('ok');
    document.querySelector('#graph-updated').textContent=`updated ${graph.updated??'—'}`;
    document.dispatchEvent(new CustomEvent('project-brain:graph-ready',{detail:{temporal:graph.temporal??null}}));
  }catch(error){
    document.querySelector('#graph-status').textContent='LOAD FAILED';
    document.querySelector('#detail').innerHTML=`<div class="detail-placeholder"><h2>โหลดกราฟไม่ได้</h2><p>${esc(error.message)}</p></div>`;
  }
}

document.addEventListener('project-brain:set-checkpoint',event=>{
  const id=event.detail?.id;
  if(!id||temporalIndex(id)<0)return;
  temporalCheckpointId=id;
  const activeIds=new Set(graph.nodes.filter(temporalActive).map(n=>n.id));
  if(selectedId&&!activeIds.has(selectedId))document.querySelector('#reset-selection')?.click();
  renderGraph();
  fit();
  document.dispatchEvent(new CustomEvent('project-brain:checkpoint-changed',{detail:{id}}));
});

boot();
