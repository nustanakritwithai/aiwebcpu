const decisionState={
  graph:null,
  inventory:null,
  verifierIndex:null,
  bundles:new Map(),
  goalId:null
};

const dq=s=>document.querySelector(s);
const dqa=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function json(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function graphNode(id){
  return decisionState.graph?.nodes?.find(x=>x.id===id)??null;
}

function outgoing(id,type){
  return (decisionState.graph?.edges??[]).filter(x=>x.from===id&&(!type||x.type===type));
}

function incoming(id,type){
  return (decisionState.graph?.edges??[]).filter(x=>x.to===id&&(!type||x.type===type));
}

function inventoryCapability(repoId,label){
  const repo=decisionState.inventory?.repositories?.find(x=>x.repoId===repoId);
  if(!repo)return null;
  const capability=repo.capabilities?.find(x=>x.label===label)??null;
  return capability?{repo,capability}:null;
}

function verifierForGoal(goalId){
  for(const bundle of decisionState.bundles.values()){
    if(bundle.contract?.goalId===goalId)return bundle;
  }
  return null;
}

function setStep(step,value,state='unknown'){
  const target=dq(`#decision-step-${step}`);
  if(target)target.textContent=value;
  const article=dq(`[data-decision-step="${step}"]`);
  if(article){
    article.dataset.state=state;
    article.classList.toggle('SAT',state==='sat');
    article.classList.toggle('VIOL',state==='viol');
    article.classList.toggle('UNKNOWN',state==='unknown');
  }
}

function canonicalCandidates(goal){
  const rows=[];
  for(const needEdge of outgoing(goal.id,'NEEDS')){
    const capability=graphNode(needEdge.to);
    if(!capability)continue;
    const providers=incoming(capability.id,'PROVIDES')
      .map(edge=>graphNode(edge.from))
      .filter(Boolean);
    for(const provider of providers){
      rows.push({
        source:'GRAPH',
        repoId:provider.id,
        repo:provider.repo??provider.name,
        capability:capability.name,
        verdict:'UNKNOWN',
        decision:'UNKNOWN',
        adaptations:[],
        evidence:[]
      });
    }
  }
  return rows;
}

function verifierCandidates(bundle){
  if(!bundle?.report)return [];
  const rows=bundle.report.candidates??bundle.report.results??[];
  return rows.map(row=>{
    const inv=inventoryCapability(row.repoId,row.capability);
    return {
      source:'VERIFIER',
      repoId:row.repoId,
      repo:row.repo??inv?.repo?.repo??row.repoId,
      capability:row.capability,
      verdict:row.verdict??'UNKNOWN',
      decision:row.decision??'UNKNOWN',
      adaptations:row.adaptations??[],
      evidence:inv?.capability?.evidence??[],
      inventoryStatus:inv?.capability?.status??'UNKNOWN'
    };
  });
}

function renderNeeds(goal){
  const holder=dq('#decision-needs');
  const needs=outgoing(goal.id,'NEEDS')
    .map(edge=>graphNode(edge.to))
    .filter(Boolean);
  holder.innerHTML=needs.length
    ? needs.map(row=>`<span class="decision-need">${esc(row.name)}<small>${esc(row.status??'')}</small></span>`).join('')
    : '<span class="decision-empty-inline">No canonical NEEDS relations</span>';
  return needs;
}

function renderCandidates(rows){
  const holder=dq('#decision-candidates');
  dq('#decision-candidate-count').textContent=String(rows.length);

  holder.innerHTML=rows.length?rows.map(row=>{
    const verdict=['SAT','VIOL','UNKNOWN'].includes(row.verdict)?row.verdict:'UNKNOWN';
    const evidence=row.evidence?.length
      ? row.evidence.map(ev=>`
          <div class="decision-candidate-evidence">
            <code>${esc(ev.path)} @ ${esc(ev.sha?.slice(0,8)??'—')}</code>
            <span>${esc(ev.claim??'')}</span>
          </div>`).join('')
      : '<div class="decision-candidate-evidence empty">No inventory evidence attached to this candidate view.</div>';

    return `
      <article class="decision-candidate">
        <div class="decision-candidate-head">
          <div>
            <span class="decision-source">${esc(row.source)}</span>
            <strong>${esc(row.capability)}</strong>
            <small>${esc(row.repo)}</small>
          </div>
          <span class="decision-verdict ${verdict}">${verdict}</span>
        </div>
        <div class="decision-candidate-meta">
          <span>Inventory <b>${esc(row.inventoryStatus??'UNKNOWN')}</b></span>
          <span>Decision <b>${esc(row.decision??'UNKNOWN')}</b></span>
        </div>
        ${(row.adaptations??[]).map(x=>`<p class="decision-adapt">ADAPT · ${esc(x)}</p>`).join('')}
        <details class="decision-evidence-detail">
          <summary>Evidence ${row.evidence?.length??0}</summary>
          ${evidence}
        </details>
      </article>`;
  }).join(''):'<div class="decision-empty">ยังไม่มี candidate จาก canonical relations หรือ verifier report</div>';
}

function renderEvidence(rows,bundle){
  const holder=dq('#decision-evidence-list');
  const documented=rows.filter(row=>row.evidence?.length>0).length;
  const total=rows.length;
  const status=dq('#decision-evidence-status');

  if(!total){
    status.textContent='UNKNOWN';
    status.className='UNKNOWN';
    holder.innerHTML='<div class="decision-side-empty">ไม่มี candidate evidence</div>';
    return {documented,total};
  }

  status.textContent=`${documented}/${total} DOC`;
  status.className=documented===total?'SAT':'UNKNOWN';
  holder.innerHTML=rows.slice(0,6).map(row=>`
    <div class="decision-evidence-row">
      <span class="decision-evidence-dot ${row.evidence?.length?'sat':'unknown'}"></span>
      <div><b>${esc(row.capability)}</b><small>${row.evidence?.[0]?.path?esc(row.evidence[0].path):'No inventory evidence in this view'}</small></div>
    </div>
  `).join('');

  if(bundle?.report?.limitations?.length){
    holder.innerHTML+=bundle.report.limitations.map(x=>`<p class="decision-limit">${esc(x)}</p>`).join('');
  }
  return {documented,total};
}

function renderGoal(goal){
  decisionState.goalId=goal.id;
  const bundle=verifierForGoal(goal.id);
  const needs=renderNeeds(goal);
  const rows=bundle?verifierCandidates(bundle):canonicalCandidates(goal);
  renderCandidates(rows);
  const evidence=renderEvidence(rows,bundle);

  dq('#decision-goal-name').textContent=goal.name;
  dq('#decision-goal-meta').textContent=`${goal.id} · graph status ${goal.status??'UNKNOWN'} · graph decision ${goal.decision??'UNKNOWN'}`;

  const verdict=bundle?.report?.overallVerdict??'UNKNOWN';
  const recommendation=bundle?.report?.recommendation??'UNKNOWN';
  const overall=dq('#decision-overall');
  overall.textContent=verdict;
  overall.className=`decision-verdict ${verdict}`;

  dq('#decision-recommendation').textContent=recommendation;
  dq('#decision-contract-status').textContent=bundle
    ? `${bundle.contract.id} · explicit verifier contract`
    : 'ยังไม่มี explicit verifier contract';

  setStep('goal','READY','sat');
  setStep('search',rows.length?'READY':'UNKNOWN',rows.length?'sat':'unknown');
  setStep('evidence',evidence.total&&evidence.documented===evidence.total?'DOCUMENTED':'UNKNOWN',
    evidence.total&&evidence.documented===evidence.total?'sat':'unknown');
  setStep('verify',verdict,verdict.toLowerCase());
  setStep('decision',recommendation,recommendation==='UNKNOWN'?'unknown':'sat');

  const next=dq('#decision-next-copy');
  if(!bundle){
    next.textContent='ยังไม่มี verifier contract สำหรับ Goal นี้ จึงห้ามสรุป REUSE / ADAPT / BUILD จาก UI.';
  }else if(verdict==='UNKNOWN'){
    next.textContent='Verifier ยังมี UNKNOWN — ตรวจ evidence/check ที่ยังไม่ resolved ก่อน.';
  }else if(verdict==='VIOL'){
    next.textContent='Contract มี VIOL — เปิด Verifier เพื่อดู check ที่ขัด contract ก่อนดำเนินการ.';
  }else{
    next.textContent=`Contract ผ่าน SAT และ recommendation = ${recommendation}. ขั้นต่อไปคือ review graph patch candidate ก่อน merge.`;
  }

  const url=new URL(location.href);
  url.searchParams.set('goal',goal.id);
  history.replaceState(null,'',url);

  document.dispatchEvent(new CustomEvent('project-brain:decision-goal-changed',{detail:{
    goalId:goal.id,
    contractId:bundle?.contract?.id??null,
    verdict,
    recommendation
  }}));
}

function selectGoal(id){
  const goal=decisionState.graph?.nodes?.find(x=>x.type==='GOAL'&&x.id===id);
  if(goal)renderGoal(goal);
}

async function loadVerifierBundles(index){
  const pairs=await Promise.all((index.reports??[]).map(async row=>{
    try{
      const [contract,report,patch]=await Promise.all([
        json(`../project-brain/verifier/${row.contract}`),
        json(`../project-brain/verifier/${row.report}`),
        json(`../project-brain/verifier/${row.patch}`)
      ]);
      return [row.id,{index:row,contract,report,patch}];
    }catch{
      return [row.id,{index:row,contract:null,report:null,patch:null}];
    }
  }));
  return new Map(pairs);
}

async function bootDecision(){
  const [graph,inventory,verifierIndex]=await Promise.all([
    json('../project-brain/graph/project-brain.json'),
    json('../project-brain/capability-inventory/repositories.json'),
    json('../project-brain/verifier/index.json')
  ]);
  decisionState.graph=graph;
  decisionState.inventory=inventory;
  decisionState.verifierIndex=verifierIndex;
  decisionState.bundles=await loadVerifierBundles(verifierIndex);

  const goals=(graph.nodes??[]).filter(x=>x.type==='GOAL');
  const select=dq('#decision-goal-select');
  select.replaceChildren();
  for(const goal of goals){
    const option=document.createElement('option');
    option.value=goal.id;
    option.textContent=goal.name;
    select.append(option);
  }

  select.addEventListener('change',()=>selectGoal(select.value));

  const requested=new URL(location.href).searchParams.get('goal');
  const initial=goals.find(x=>x.id===requested)??goals[0]??null;
  if(initial){
    select.value=initial.id;
    renderGoal(initial);
  }else{
    dq('#decision-goal-name').textContent='No goals in canonical graph';
    dq('#decision-next-copy').textContent='เพิ่ม Goal ผ่าน canonical Project Brain workflow ก่อน';
  }

  dqa('[data-decision-action]').forEach(button=>button.addEventListener('click',()=>{
    const target=button.dataset.decisionAction;
    const viewButton=dq(`[data-view-button="${target}"]`);
    viewButton?.click();
    if(target==='verifier'){
      const bundle=verifierForGoal(decisionState.goalId);
      const selectVerifier=dq('#verifier-select');
      if(bundle?.contract?.id&&selectVerifier){
        selectVerifier.value=bundle.contract.id;
        selectVerifier.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
  }));
}

bootDecision().catch(error=>{
  dq('#decision-goal-name').textContent='Decision data UNKNOWN';
  dq('#decision-goal-meta').textContent=error.message;
  setStep('goal','UNKNOWN','unknown');
  setStep('search','UNKNOWN','unknown');
  setStep('evidence','UNKNOWN','unknown');
  setStep('verify','UNKNOWN','unknown');
  setStep('decision','UNKNOWN','unknown');
});
