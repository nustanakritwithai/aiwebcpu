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
let projectCatalog=null;
let capabilityInventory=null;
let projectDeepProfiles=null;
let visibleTypes=new Set();
let selectedId=null;
let focusRootId=null;
let positions=new Map();
let layoutKey='';
let transform={x:0,y:0,k:1};
let draggingStage=false;
let dragStart=null;
let showEdgeLabels=false;

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


/* Project Deep Dive V0.6.0
   Read-only composition across Catalog + Capability Inventory + canonical Graph. */
const repoKey=node=>node?.repo??'';
const catalogRow=node=>(projectCatalog?.repositories??[]).find(row=>row.id===node?.id||row.repo===repoKey(node))??null;
const inventoryRow=node=>(capabilityInventory?.repositories??[]).find(row=>row.repoId===node?.id||row.repo===repoKey(node))??null;
/* Project Deep Profile V0.6.1 */
const deepProfileRow=node=>(projectDeepProfiles?.projects??[]).find(row=>row.repoId===node?.id||row.repo===repoKey(node))??null;

function projectDeepDive(node){
  if(node?.type!=='PROJECT')return '';

  const catalog=catalogRow(node);
  const inventory=inventoryRow(node);
  const deepProfile=deepProfileRow(node);
  const activeEdges=(graph?.edges??[]).filter(temporalActive);
  const graphNodes=new Map((graph?.nodes??[]).filter(temporalActive).map(row=>[row.id,row]));
  const documentedTargets=activeEdges
    .filter(edge=>edge.from===node.id&&edge.type==='DOCUMENTS')
    .map(edge=>graphNodes.get(edge.to))
    .filter(Boolean);
  const documentedByName=new Map(documentedTargets.map(row=>[row.name,row.id]));
  const verifiedCount=activeEdges
    .filter(edge=>edge.from===node.id&&edge.type==='PROVIDES')
    .map(edge=>graphNodes.get(edge.to))
    .filter(target=>target?.type==='CAPABILITY').length;

  const capabilities=(inventory?.capabilities?.length
    ? inventory.capabilities.map(capability=>({
        label:capability.label,
        evidenceCount:(capability.evidence??[]).length,
        targetId:documentedByName.get(capability.label)??null
      }))
    : documentedTargets.map(target=>({
        label:target.name,
        evidenceCount:Number(target.evidenceCount??0),
        targetId:target.id
      }))
  );

  const ci=catalog?.exactHeadWorkflow?.verdict??'UNKNOWN';
  const ciClass=ci==='SAT'?'sat':ci==='VIOL'?'viol':'unknown';
  const head=catalog?.head??null;
  const headDate=head?.date?String(head.date).slice(0,10):'—';
  const shortSha=head?.sha?String(head.sha).slice(0,8):(node.headSha?String(node.headSha).slice(0,8):'—');
  const evidenceFiles=catalog?.evidenceFiles??[];
  const signals=catalog?.detectedSignals??[];
  const limitations=inventory?.limitations??[];
  const notes=inventory?.notes??[];
  const extraction=inventory?.extractionStatus??node.semanticStatus??'UNKNOWN';
  const repo=repoKey(node);
  const repoUrl=/^[\w.-]+\/[\w.-]+$/.test(repo)?`https://github.com/${repo}`:null;

  const capabilityRows=capabilities.map(capability=>`
    <button class="project-capability" ${capability.targetId?`data-node="${esc(capability.targetId)}"`:'disabled'}>
      <span>${esc(capability.label)}</span>
      <small>${esc(capability.evidenceCount)} evidence</small>
    </button>
  `).join('');

  const evidenceRows=evidenceFiles.map(file=>`
    <span class="project-evidence-file" title="${esc(file.sha??'')}">${esc(file.path)}</span>
  `).join('');

  const signalRows=signals.map(signal=>`<span class="project-signal">${esc(signal)}</span>`).join('');
  const cautionRows=[...limitations,...notes].map(item=>`<li>${esc(item)}</li>`).join('');


  const deepSourceAhead=Boolean(deepProfile?.sourceHead?.sha&&catalog?.head?.sha&&deepProfile.sourceHead.sha!==catalog.head.sha);
  const architectureRows=(deepProfile?.architecture??[]).map(row=>`
    <article class="project-architecture-row">
      <div><b>${esc(row.label)}</b><span>${esc(row.owner)}</span></div>
      <small class="state-${esc(String(row.state??'unknown').toLowerCase())}">${esc(row.state??'UNKNOWN')}</small>
      <p>${esc(row.detail)}</p>
      <code>${esc(row.evidence?.path??'')}</code>
    </article>
  `).join('');
  const authorityRows=(deepProfile?.authorityBoundaries??[]).map(row=>`
    <article class="project-authority-row">
      <div><b>${esc(row.domain)}</b><span>${esc(row.owner)}</span></div>
      <small class="state-${esc(String(row.state??'unknown').toLowerCase())}">${esc(row.state??'UNKNOWN')}</small>
      <p>${esc(row.detail)}</p>
      <code>${esc(row.evidence?.path??'')}</code>
    </article>
  `).join('');
  const nextGateRows=(deepProfile?.nextGates??[]).map(item=>`<li>${esc(item)}</li>`).join('');
  const deepLimitRows=(deepProfile?.limitations??[]).map(item=>`<li>${esc(item)}</li>`).join('');
  const sourceHead=deepProfile?.sourceHead??null;
  const deepCi=deepProfile?.exactHeadWorkflow?.verdict??'UNKNOWN';

  return `
    <section class="project-deep-dive" aria-label="Project Deep Dive">
      <div class="project-deep-head">
        <div>
          <small>PROJECT DEEP DIVE · V0.6.0</small>
          <h3>${esc(repo||node.name)}</h3>
        </div>
        ${repoUrl?`<a href="${esc(repoUrl)}" target="_blank" rel="noreferrer">GitHub ↗</a>`:''}
      </div>

      <div class="project-deep-badges">
        <span>${esc(catalog?.catalogStatus??node.catalogStatus??'UNKNOWN')}</span>
        <span>${esc(extraction)}</span>
        <span class="ci-${ciClass}">CI ${esc(ci)}</span>
      </div>

      <div class="project-deep-metrics">
        <article><small>DOCUMENTED</small><b>${capabilities.length}</b><span>capabilities</span></article>
        <article><small>VERIFIED</small><b>${verifiedCount}</b><span>graph capabilities</span></article>
        <article><small>EVIDENCE</small><b>${evidenceFiles.length}</b><span>catalog files</span></article>
        <article><small>SIZE</small><b>${catalog?.sizeKB??'—'}</b><span>KB</span></article>
      </div>

      <div class="project-head-signal">
        <small>HEAD · ${esc(headDate)} · ${esc(shortSha)}</small>
        <b>${esc(head?.title??'ยังไม่มี commit headline ใน catalog snapshot')}</b>
        <span>${esc(catalog?.defaultBranch??node.defaultBranch??'—')} · ${catalog?.archived?'ARCHIVED':'ACTIVE REPO'}</span>
      </div>

      <div class="project-deep-section">
        <div class="project-deep-title"><b>Capabilities</b><span>DOCUMENTED ≠ VERIFIED REUSE</span></div>
        <div class="project-capability-list">${capabilityRows||'<p class="note">ยังไม่มี semantic extraction สำหรับโปรเจกต์นี้</p>'}</div>
      </div>

      ${evidenceRows?`
        <div class="project-deep-section">
          <div class="project-deep-title"><b>Evidence files</b><span>catalog snapshot</span></div>
          <div class="project-evidence-files">${evidenceRows}</div>
        </div>
      `:''}

      ${signalRows?`
        <div class="project-deep-section">
          <div class="project-deep-title"><b>Signals</b><span>mechanical detection</span></div>
          <div class="project-signals">${signalRows}</div>
        </div>
      `:''}

      ${cautionRows?`
        <div class="project-deep-section project-cautions">
          <div class="project-deep-title"><b>Limitations / Notes</b><span>do not infer beyond evidence</span></div>
          <ul>${cautionRows}</ul>
        </div>
      `:''}

      ${deepProfile?`
        <div class="project-deep-profile">
          <div class="project-deep-title">
            <b>Source-level Deep Profile</b>
            <span>${deepSourceAhead?'SOURCE AHEAD OF CATALOG':'source snapshot aligned/unknown'}</span>
          </div>
          <div class="project-source-head">
            <small>DIRECT SOURCE HEAD · ${esc(String(sourceHead?.date??'').slice(0,10)||'—')} · ${esc(String(sourceHead?.sha??'').slice(0,8)||'—')} · CI ${esc(deepCi)}</small>
            <b>${esc(sourceHead?.title??deepProfile.currentStage??'—')}</b>
            <p>${esc(deepProfile.productVision??'')}</p>
            <span>${esc(deepProfile.currentStage??'')}</span>
          </div>
          ${architectureRows?`
            <div class="project-deep-section">
              <div class="project-deep-title"><b>Architecture</b><span>owner + authority state</span></div>
              <div class="project-architecture-list">${architectureRows}</div>
            </div>
          `:''}
          ${authorityRows?`
            <div class="project-deep-section">
              <div class="project-deep-title"><b>Authority boundaries</b><span>who writes what now</span></div>
              <div class="project-authority-list">${authorityRows}</div>
            </div>
          `:''}
          ${nextGateRows?`
            <div class="project-deep-section project-next-gates">
              <div class="project-deep-title"><b>Next gates</b><span>intentions, not proof</span></div>
              <ol>${nextGateRows}</ol>
            </div>
          `:''}
          ${deepLimitRows?`
            <div class="project-deep-section project-cautions">
              <div class="project-deep-title"><b>Deep-profile limits</b><span>UNKNOWN stays UNKNOWN</span></div>
              <ul>${deepLimitRows}</ul>
            </div>
          `:''}
        </div>
      `:''}
    </section>
  `;
}

async function optionalJson(path){
  try{
    const response=await fetch(path,{cache:'no-store'});
    return response.ok?await response.json():null;
  }catch{
    return null;
  }
}

function hash(text){
  let h=2166136261>>>0;
  for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}

function layoutSize(){
  const rect=document.querySelector('#svg-wrap')?.getBoundingClientRect?.()??{width:900,height:650};
  return {
    W:Math.max(760,Math.min(1500,rect.width||900)),
    H:Math.max(680,Math.min(1400,rect.height||650))
  };
}

function groupOrdinals(nodes){
  const groups=new Map();
  for(const node of nodes){
    const list=groups.get(node.type)??[];
    list.push(node);
    groups.set(node.type,list);
  }
  const result=new Map();
  for(const list of groups.values()){
    list.sort((a,b)=>String(a.name??a.id).localeCompare(String(b.name??b.id)));
    list.forEach((node,rank)=>result.set(node.id,{rank,count:list.length}));
  }
  return result;
}

function initialPosition(node,index,nodes,W,H,ordinals){
  const bands={
    PROJECT:{x:.14,y0:.10,y1:.90,cols:3},
    CAPABILITY:{x:.43,y0:.10,y1:.42,cols:2},
    CAPABILITY_CANDIDATE:{x:.46,y0:.18,y1:.78,cols:3},
    GOAL:{x:.80,y0:.10,y1:.25,cols:1},
    INTEGRATION:{x:.79,y0:.34,y1:.56,cols:1},
    ISSUE:{x:.84,y0:.64,y1:.82,cols:1},
    EVIDENCE:{x:.53,y0:.70,y1:.92,cols:3},
    VERSION:{x:.16,y0:.76,y1:.93,cols:2}
  };
  const spec=bands[node.type]??{x:.50,y0:.18,y1:.82,cols:2};
  const info=ordinals.get(node.id)??{rank:index,count:nodes.length};
  const cols=Math.max(1,Math.min(spec.cols,info.count));
  const rows=Math.max(1,Math.ceil(info.count/cols));
  const col=info.rank%cols;
  const row=Math.floor(info.rank/cols);
  const xSpread=Math.min(118,W*.085);
  const x=spec.x*W+(col-(cols-1)/2)*xSpread;
  const t=rows===1?.5:(row+.5)/rows;
  const y=(spec.y0+(spec.y1-spec.y0)*t)*H;
  const h=hash(node.id);
  const jitterX=((h%19)-9)*.9;
  const jitterY=(((h>>>8)%17)-8)*.9;
  return {x:x+jitterX,y:y+jitterY,vx:0,vy:0,index};
}

function layoutSignature(nodes,edges,W,H){
  const ids=nodes.map(n=>n.id).sort().join('|');
  const edgeSig=edges.map(e=>`${e.from}>${e.to}:${e.type}`).sort().join('|');
  return `${Math.round(W/40)}x${Math.round(H/40)}|${ids}|${edgeSig}`;
}

function settle(nodes,edges){
  const {W,H}=layoutSize();
  const ordinals=groupOrdinals(nodes);
  positions=new Map(nodes.map((n,i)=>[n.id,initialPosition(n,i,nodes,W,H,ordinals)]));
  const iterations=nodes.length>180?110:nodes.length>100?170:nodes.length>60?240:320;
  const minDistance=nodes.length<=60?70:nodes.length<=120?54:38;
  const repulsion=nodes.length<=60?8800:nodes.length<=120?6800:5200;

  for(let iter=0;iter<iterations;iter++){
    const alpha=(1-iter/iterations)*.92+.035;
    const list=[...positions.values()];

    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];
      let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
      if(d2<1){dx=.2;dy=.2;d2=.08}
      const dist=Math.sqrt(d2);
      const repel=Math.min(2.8,repulsion/d2)*alpha;
      const collision=dist<minDistance?(minDistance-dist)*.045*alpha:0;
      const force=repel+collision;
      const fx=dx/dist*force,fy=dy/dist*force;
      a.vx-=fx;a.vy-=fy;b.vx+=fx;b.vy+=fy;
    }

    for(const edge of edges){
      const a=positions.get(edge.from),b=positions.get(edge.to);
      if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.max(1,Math.hypot(dx,dy));
      const ideal=edge.type==='VERIFIED_BY'||edge.type==='DOCUMENTED_BY'?125:170;
      const force=(dist-ideal)*.0065*alpha;
      const fx=dx/dist*force,fy=dy/dist*force;
      a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;
    }

    for(const node of nodes){
      const p=positions.get(node.id);
      const base=initialPosition(node,p.index,nodes,W,H,ordinals);
      p.vx+=(base.x-p.x)*.003*alpha;
      p.vy+=(base.y-p.y)*.003*alpha;
    }

    for(const p of positions.values()){
      p.vx*=.77;p.vy*=.77;
      p.x=Math.max(48,Math.min(W-48,p.x+p.vx));
      p.y=Math.max(48,Math.min(H-58,p.y+p.vy));
    }
  }

  layoutKey=layoutSignature(nodes,edges,W,H);
}

function ensureLayout(nodes,edges){
  const {W,H}=layoutSize();
  const next=layoutSignature(nodes,edges,W,H);
  if(next===layoutKey&&nodes.every(n=>positions.has(n.id)))return false;
  settle(nodes,edges);
  return true;
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
  ensureLayout(nodes,edges);
  svg.dataset.density=nodes.length<=60?'comfortable':nodes.length<=120?'compact':'dense';
  nodeLayer.replaceChildren();edgeLayer.replaceChildren();edgeLabelLayer.replaceChildren();
  empty.hidden=nodes.length>0;
  const selectedConnected=selectedId?connectedSet(selectedId,edges):null;
  const focusConnected=focusRootId?connectedSet(focusRootId,edges):null;

  for(const edge of edges){
    const a=positions.get(edge.from),b=positions.get(edge.to);
    if(!a||!b)continue;
    const style=REL_STYLE[edge.type]??REL_STYLE.DEPENDS_ON;
    const line=el('line',{
      x1:a.x,y1:a.y,x2:b.x,y2:b.y,
      stroke:style.color,
      class:'edge'
        +(focusConnected&&!focusConnected.has(edge.from)&&!focusConnected.has(edge.to)?' focus-out':'')
        +(selectedId&&selectedConnected&&!selectedConnected.has(edge.from)&&!selectedConnected.has(edge.to)?' dim':'')
        +(selectedId&&(edge.from===selectedId||edge.to===selectedId)?' active':'')
    });
    if(style.dash)line.setAttribute('stroke-dasharray',style.dash);
    line.setAttribute('marker-end',`url(#arrow-${style.marker})`);
    edgeLayer.append(line);

    if(showEdgeLabels){
      const text=el('text',{
        x:(a.x+b.x)/2,y:(a.y+b.y)/2-4,
        'text-anchor':'middle',
        class:'edge-label'
          +(focusConnected&&!focusConnected.has(edge.from)&&!focusConnected.has(edge.to)?' focus-out':'')
          +(selectedId&&selectedConnected&&!selectedConnected.has(edge.from)&&!selectedConnected.has(edge.to)?' dim':'')
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
    if(focusRootId===node.id)g.classList.add('focus-root');
    if(focusConnected&&!focusConnected.has(node.id))g.classList.add('focus-out');
    if(selectedId&&selectedConnected&&!selectedConnected.has(node.id))g.classList.add('dim');
    if(q&&matches.has(node.id))g.classList.add('match');
    if(q&&!matches.has(node.id)&&!selectedId)g.classList.add('dim');

    const radius=node.type==='PROJECT'?17:node.type==='GOAL'||node.type==='INTEGRATION'?15:node.type==='CAPABILITY_CANDIDATE'?11:13;
    const circle=el('circle',{r:radius,fill:style.color,'fill-opacity':'.16'});
    const title=el('title');title.textContent=`${node.name} · ${node.type}`;circle.append(title);
    g.append(circle);

    const label=el('text',{x:0,y:radius+14,'text-anchor':'middle'});
    const labelLimit=nodes.length<=60?22:nodes.length<=110?16:12;
    label.textContent=node.name.length>labelLimit?node.name.slice(0,labelLimit-1)+'…':node.name;
    g.append(label);

    const meta=el('text',{x:0,y:radius+25,'text-anchor':'middle',class:'meta'});
    meta.textContent=node.verdict??node.decision??node.status??'';
    g.append(meta);

    g.addEventListener('click',event=>{
      event.stopPropagation();
      selectNode(node.id,{source:'graph'});
    });
    nodeLayer.append(g);
  }

  document.querySelector('#summary').textContent=`${nodes.length} nodes · ${edges.length} relations`;
  applyTransform();
}

function applyTransform(){
  viewport.setAttribute('transform',`translate(${transform.x} ${transform.y}) scale(${transform.k})`);
}

function positionBounds(nodes){
  const list=nodes.map(node=>positions.get(node.id)).filter(Boolean);
  if(!list.length)return null;
  const padX=nodes.length<=60?72:54;
  const padTop=44;
  const padBottom=58;
  return {
    minX:Math.min(...list.map(p=>p.x))-padX,
    maxX:Math.max(...list.map(p=>p.x))+padX,
    minY:Math.min(...list.map(p=>p.y))-padTop,
    maxY:Math.max(...list.map(p=>p.y))+padBottom
  };
}

function fit(){
  const {nodes,edges}=filtered();
  ensureLayout(nodes,edges);
  const bounds=positionBounds(nodes);
  const rect=svg.getBoundingClientRect();
  if(!bounds||!rect.width||!rect.height)return;
  const margin=Math.max(18,Math.min(42,Math.min(rect.width,rect.height)*.045));
  const bw=Math.max(1,bounds.maxX-bounds.minX);
  const bh=Math.max(1,bounds.maxY-bounds.minY);
  const availableW=Math.max(1,rect.width-margin*2);
  const availableH=Math.max(1,rect.height-margin*2);
  const k=Math.max(.28,Math.min(1.55,Math.min(availableW/bw,availableH/bh)));
  transform={
    x:(rect.width-bw*k)/2-bounds.minX*k,
    y:(rect.height-bh*k)/2-bounds.minY*k,
    k
  };
  applyTransform();
}

function centerOnNode(id,{scale=null}={}){
  const p=positions.get(id);
  const rect=svg.getBoundingClientRect();
  if(!p||!rect.width||!rect.height)return false;
  const k=Math.max(.48,Math.min(1.55,scale??Math.max(.82,Math.min(1.12,transform.k||1))));
  transform={
    x:rect.width/2-p.x*k,
    y:rect.height/2-p.y*k,
    k
  };
  applyTransform();
  return true;
}

function fitNodeIds(ids){
  const {nodes,edges}=filtered();
  ensureLayout(nodes,edges);
  const wanted=new Set(ids);
  const subset=nodes.filter(node=>wanted.has(node.id));
  const bounds=positionBounds(subset);
  const rect=svg.getBoundingClientRect();
  if(!bounds||!rect.width||!rect.height)return false;
  const margin=Math.max(32,Math.min(72,Math.min(rect.width,rect.height)*.08));
  const bw=Math.max(1,bounds.maxX-bounds.minX);
  const bh=Math.max(1,bounds.maxY-bounds.minY);
  const k=Math.max(.55,Math.min(1.55,Math.min(
    Math.max(1,rect.width-margin*2)/bw,
    Math.max(1,rect.height-margin*2)/bh
  )));
  transform={
    x:(rect.width-bw*k)/2-bounds.minX*k,
    y:(rect.height-bh*k)/2-bounds.minY*k,
    k
  };
  applyTransform();
  return true;
}

function clearSelection({clearFocus=true}={}){
  const previous=selectedId;
  selectedId=null;
  if(clearFocus)focusRootId=null;
  renderGraph();
  document.dispatchEvent(new CustomEvent('project-brain:selection-cleared',{
    detail:{previousId:previous,focusCleared:clearFocus}
  }));
}

function selectNode(id,{source='direct'}={}){
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
    ${projectDeepDive(node)}
    <dl class="properties">${properties}</dl>
    <h2>Relations</h2>
    <div class="relations">${relationRows||'<p class="note">ไม่มีความสัมพันธ์ใน graph ปัจจุบัน</p>'}</div>
  `;
  detail.querySelectorAll('[data-node]').forEach(b=>b.addEventListener('click',()=>selectNode(b.dataset.node,{source:'relation'})));
  renderGraph();
  document.dispatchEvent(new CustomEvent('project-brain:node-selected',{
    detail:{id:node.id,name:node.name,type:node.type,focusRootId,source}
  }));
}

function setupFilters(){
  const holder=document.querySelector('#type-filters');
  const legend=document.querySelector('#legend');
  const defaultTypes=new Set(['PROJECT','CAPABILITY','GOAL','INTEGRATION']);
  visibleTypes=new Set();
  holder.replaceChildren();legend.replaceChildren();
  for(const type of graph.nodeTypes){
    if(defaultTypes.has(type))visibleTypes.add(type);
    const style=TYPE_STYLE[type]??{label:type,color:'#fff'};
    const b=document.createElement('button');
    b.className='filter-chip';
    b.innerHTML=`<span class="dot" style="color:${style.color};background:${style.color}"></span>${style.label}`;
    b.dataset.type=type;
    b.classList.toggle('off',!visibleTypes.has(type));
    b.addEventListener('click',()=>{
      if(visibleTypes.has(type))visibleTypes.delete(type);else visibleTypes.add(type);
      b.classList.toggle('off',!visibleTypes.has(type));
      if(selectedId&&!graph.nodes.some(n=>n.id===selectedId&&visibleTypes.has(n.type)))selectedId=null;
      layoutKey='';
      renderGraph();
      requestAnimationFrame(fit);
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
  document.querySelector('#reset-selection').addEventListener('click',()=>{
    clearSelection({clearFocus:true});
    detail.innerHTML='<div class="detail-placeholder"><span class="big-icon">◎</span><h2>เลือก Node</h2><p>แตะ node ในกราฟเพื่อดู properties, ความสัมพันธ์, evidence และ reuse context</p></div>';
  });

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
  svg.addEventListener('click',()=>clearSelection({clearFocus:true}));
  let resizeTimer=null;
  addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      layoutKey='';
      renderGraph();
      fit();
    },90);
  });
}

async function boot(){
  try{
    const [response,catalogData,inventoryData,deepProfileData]=await Promise.all([
      fetch('../project-brain/graph/project-brain.json',{cache:'no-store'}),
      optionalJson('../project-brain/catalog/repositories.json'),
      optionalJson('../project-brain/capability-inventory/repositories.json'),
      optionalJson('../project-brain/deep-profiles/projects.json')
    ]);
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    graph=await response.json();
    projectCatalog=catalogData;
    capabilityInventory=inventoryData;
    projectDeepProfiles=deepProfileData;
    const requestedCheckpoint=new URL(location.href).searchParams.get('at');
    const defaultCheckpoint=graph.temporal?.defaultCheckpoint??graph.temporal?.checkpoints?.at(-1)?.id??null;
    temporalCheckpointId=(requestedCheckpoint&&temporalIndex(requestedCheckpoint)>=0)?requestedCheckpoint:defaultCheckpoint;
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

document.addEventListener('project-brain:set-visible-types',event=>{
  const requested=Array.isArray(event.detail?.types)?event.detail.types:[];
  const next=new Set(requested.filter(type=>graph?.nodeTypes?.includes(type)));
  const changed=next.size!==visibleTypes.size||[...next].some(type=>!visibleTypes.has(type));
  visibleTypes=next;
  document.querySelectorAll('#type-filters .filter-chip').forEach(button=>{
    button.classList.toggle('off',!visibleTypes.has(button.dataset.type));
  });
  if(!changed)return;
  const selectedHidden=Boolean(selectedId&&!graph.nodes.some(n=>n.id===selectedId&&visibleTypes.has(n.type)));
  if(selectedHidden)selectedId=null;
  if(focusRootId&&!graph.nodes.some(n=>n.id===focusRootId&&visibleTypes.has(n.type)))focusRootId=null;
  layoutKey='';
  renderGraph();
  requestAnimationFrame(fit);
  if(selectedHidden){
    document.dispatchEvent(new CustomEvent('project-brain:selection-cleared',{
      detail:{previousId:null,focusCleared:!focusRootId,reason:'filtered-out'}
    }));
  }
});

document.addEventListener('project-brain:select-node',event=>{
  const id=event.detail?.id;
  if(!id)return;
  const current=filtered();
  if(!current.nodes.some(node=>node.id===id))return;
  selectNode(id,{source:event.detail?.source??'external'});
  if(event.detail?.center!==false){
    requestAnimationFrame(()=>centerOnNode(id,{scale:event.detail?.scale??1}));
  }
});

document.addEventListener('project-brain:set-focus-root',event=>{
  const id=event.detail?.id??null;
  const current=filtered();
  if(id&&!current.nodes.some(node=>node.id===id))return;
  focusRootId=id;
  renderGraph();

  if(focusRootId){
    const connected=connectedSet(focusRootId,current.edges);
    requestAnimationFrame(()=>fitNodeIds([...connected]));
  }else if(selectedId){
    requestAnimationFrame(()=>centerOnNode(selectedId,{scale:1}));
  }

  document.dispatchEvent(new CustomEvent('project-brain:focus-root-changed',{
    detail:{id:focusRootId,selectedId}
  }));
});

document.addEventListener('project-brain:center-node',event=>{
  const id=event.detail?.id??selectedId;
  if(!id)return;
  requestAnimationFrame(()=>centerOnNode(id,{scale:event.detail?.scale??null}));
});

document.addEventListener('project-brain:set-checkpoint',event=>{
  const id=event.detail?.id;
  if(!id||temporalIndex(id)<0)return;
  temporalCheckpointId=id;
  const activeIds=new Set(graph.nodes.filter(temporalActive).map(n=>n.id));
  if(selectedId&&!activeIds.has(selectedId))document.querySelector('#reset-selection')?.click();
  if(focusRootId&&!activeIds.has(focusRootId))focusRootId=null;
  layoutKey='';
  renderGraph();
  fit();
  document.dispatchEvent(new CustomEvent('project-brain:checkpoint-changed',{detail:{id}}));
});

boot();
