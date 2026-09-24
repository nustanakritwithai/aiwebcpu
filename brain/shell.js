const VIEW_LABELS={
  overview:'Overview',
  graph:'Knowledge Graph',
  repositories:'Repositories',
  capabilities:'Capabilities',
  verifier:'Verifier',
  scanner:'Scanner',
  history:'History'
};

const shellState={
  view:'overview',
  datasets:null,
  searchTimer:null
};

const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function json(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function normalizeView(value){
  return Object.hasOwn(VIEW_LABELS,value)?value:'overview';
}

function setView(next,{updateUrl=true}={}){
  const view=normalizeView(next);
  shellState.view=view;

  qa('[data-pb-view]').forEach(section=>{
    section.hidden=section.dataset.pbView!==view;
  });

  qa('[data-view-button]').forEach(button=>{
    const active=button.dataset.viewButton===view;
    button.classList.toggle('active',active);
    button.setAttribute('aria-current',active?'page':'false');
  });

  const label=q('#current-view-label');
  if(label)label.textContent=VIEW_LABELS[view];

  document.body.dataset.activeView=view;
  document.body.classList.remove('rail-open');

  if(updateUrl){
    const url=new URL(location.href);
    if(view==='overview')url.searchParams.delete('view');
    else url.searchParams.set('view',view);
    history.replaceState(null,'',url);
  }

  q('#global-search-results')?.setAttribute('hidden','');
  document.dispatchEvent(new CustomEvent('project-brain:view-changed',{detail:{view}}));

  if(view==='graph'){
    requestAnimationFrame(()=>{
      window.dispatchEvent(new Event('resize'));
      q('#fit')?.click();
    });
  }

  scrollTo({top:0,behavior:'smooth'});
}

function renderStatusList(items){
  const holder=q('#overview-status-list');
  if(!holder)return;
  holder.innerHTML=items.map(item=>`
    <div class="overview-status-row">
      <span class="overview-status-dot ${esc(item.state)}"></span>
      <div><b>${esc(item.label)}</b><small>${esc(item.detail)}</small></div>
      <strong class="overview-status-value ${esc(item.state)}">${esc(item.value)}</strong>
    </div>
  `).join('');
}

async function loadShellData(){
  const health=q('#command-health');
  try{
    const [graph,catalog,inventory,verifierIndex,scanner]=await Promise.all([
      json('../project-brain/graph/project-brain.json'),
      json('../project-brain/catalog/repositories.json'),
      json('../project-brain/capability-inventory/repositories.json'),
      json('../project-brain/verifier/index.json'),
      json('../project-brain/scanner/candidates.json')
    ]);

    let verifierReport=null;
    const first=verifierIndex.reports?.[0];
    if(first)verifierReport=await json(`../project-brain/verifier/reports/${encodeURIComponent(first.id)}.json`);

    shellState.datasets={graph,catalog,inventory,verifierIndex,verifierReport,scanner};

    q('#overview-repos').textContent=String(catalog.summary?.public??catalog.repositories?.length??'—');
    q('#overview-capabilities').textContent=String(inventory.summary?.documentedCapabilities??'—');
    q('#overview-verdict').textContent=verifierReport?.overallVerdict??'UNKNOWN';
    q('#overview-pending').textContent=String(scanner.summary?.candidates??0);
    q('#overview-decision').textContent=verifierReport?.recommendation??'UNKNOWN';
    q('#overview-contract').textContent=verifierReport
      ? `${verifierReport.contractId} · ${verifierReport.overallVerdict}`
      : 'No verification report';

    const statusItems=[
      {
        label:'Repository Catalog',
        detail:`${catalog.repositories?.length??0} public records · ${catalog.summary?.accountTotal??catalog.summary?.total??'—'} discovered`,
        value:'READY',
        state:'sat'
      },
      {
        label:'Capability Inventory',
        detail:`${inventory.summary?.documentedRepositories??0} repos extracted`,
        value:`${inventory.summary?.documentedCapabilities??0} DOC`,
        state:'sat'
      },
      {
        label:'Verifier',
        detail:verifierReport?.contractId??'no contract',
        value:verifierReport?.overallVerdict??'UNKNOWN',
        state:(verifierReport?.overallVerdict??'UNKNOWN').toLowerCase()
      },
      {
        label:'Scanner Inbox',
        detail:'accepted candidate state',
        value:String(scanner.summary?.candidates??0),
        state:(scanner.summary?.candidates??0)>0?'unknown':'sat'
      }
    ];
    renderStatusList(statusItems);

    const system=q('#overview-system-status');
    if(system){
      system.textContent='READY';
      system.className='sat';
    }
    if(health){
      health.textContent='READY';
      health.className='command-health sat';
    }
  }catch(error){
    if(health){
      health.textContent='UNKNOWN';
      health.className='command-health unknown';
    }
    const system=q('#overview-system-status');
    if(system){
      system.textContent='UNKNOWN';
      system.className='unknown';
    }
    renderStatusList([{
      label:'Command Center',
      detail:'One or more canonical datasets could not be loaded.',
      value:'UNKNOWN',
      state:'unknown'
    }]);
  }
}

function searchItems(){
  const d=shellState.datasets;
  if(!d)return [];
  const items=[];

  for(const node of d.graph.nodes??[]){
    items.push({
      type:'Graph',
      title:node.name,
      subtitle:`${node.type} · ${node.id}`,
      view:'graph',
      query:node.name
    });
  }

  for(const repo of d.catalog.repositories??[]){
    items.push({
      type:'Repo',
      title:repo.name,
      subtitle:`${repo.defaultBranch} · ${repo.exactHeadWorkflow?.verdict??'UNKNOWN'}`,
      view:'repositories',
      query:repo.name
    });
  }

  for(const repo of d.inventory.repositories??[]){
    for(const cap of repo.capabilities??[]){
      items.push({
        type:'Capability',
        title:cap.label,
        subtitle:`${repo.name} · ${cap.status} · reuse ${cap.reuseDecision}`,
        view:'capabilities',
        query:cap.label
      });
    }
  }

  for(const report of d.verifierIndex.reports??[]){
    items.push({
      type:'Verifier',
      title:report.goal,
      subtitle:`${report.id} · ${report.overallVerdict} / ${report.recommendation}`,
      view:'verifier',
      query:report.id
    });
  }

  return items;
}

function activateSearchResult(item){
  setView(item.view);
  if(item.view==='repositories'){
    const input=q('#catalog-search');
    if(input){input.value=item.query;input.dispatchEvent(new Event('input',{bubbles:true}))}
  }else if(item.view==='capabilities'){
    const input=q('#capability-search');
    if(input){input.value=item.query;input.dispatchEvent(new Event('input',{bubbles:true}))}
  }else if(item.view==='graph'){
    const input=q('#search');
    if(input){input.value=item.query;input.dispatchEvent(new Event('input',{bubbles:true}))}
  }else if(item.view==='verifier'){
    const select=q('#verifier-select');
    if(select&&[...select.options].some(o=>o.value===item.query)){
      select.value=item.query;
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  q('#global-search')?.blur();
}

function renderGlobalSearch(value){
  const holder=q('#global-search-results');
  if(!holder)return;
  const term=String(value??'').trim().toLowerCase();
  if(term.length<2){
    holder.hidden=true;
    holder.replaceChildren();
    return;
  }

  const words=term.split(/\s+/).filter(Boolean);
  const rows=searchItems()
    .map(item=>{
      const hay=(item.title+' '+item.subtitle+' '+item.type).toLowerCase();
      const score=words.reduce((n,w)=>n+(hay.includes(w)?1:0),0)
        +(item.title.toLowerCase().startsWith(term)?3:0);
      return {...item,score};
    })
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title))
    .slice(0,12);

  holder.hidden=false;
  holder.innerHTML=rows.length?rows.map((item,index)=>`
    <button type="button" class="global-result" data-result-index="${index}">
      <span class="global-result-type">${esc(item.type)}</span>
      <span><b>${esc(item.title)}</b><small>${esc(item.subtitle)}</small></span>
      <i>↵</i>
    </button>
  `).join(''):'<div class="global-search-empty">ไม่พบข้อมูลใน Project Brain</div>';

  holder.querySelectorAll('[data-result-index]').forEach(button=>{
    button.addEventListener('click',()=>activateSearchResult(rows[Number(button.dataset.resultIndex)]));
  });
}

function installShellEvents(){
  qa('[data-view-button]').forEach(button=>
    button.addEventListener('click',()=>setView(button.dataset.viewButton))
  );

  qa('[data-jump-view]').forEach(element=>
    element.addEventListener('click',event=>{
      if(event.target.closest('button')||element.tagName==='BUTTON'||element.classList.contains('overview-card')){
        setView(element.dataset.jumpView);
      }
    })
  );

  q('#rail-toggle')?.addEventListener('click',()=>{
    document.body.classList.toggle('rail-open');
  });

  const search=q('#global-search');
  search?.addEventListener('input',event=>{
    clearTimeout(shellState.searchTimer);
    shellState.searchTimer=setTimeout(()=>renderGlobalSearch(event.target.value),80);
  });
  search?.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.currentTarget.value='';
      renderGlobalSearch('');
      event.currentTarget.blur();
    }
    if(event.key==='Enter'){
      q('#global-search-results .global-result')?.click();
    }
  });

  addEventListener('keydown',event=>{
    const target=event.target;
    const typing=target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();
      search?.focus();
      search?.select();
      return;
    }
    if(!typing&&event.key==='/'){
      event.preventDefault();
      search?.focus();
    }
  });

  document.addEventListener('click',event=>{
    if(!event.target.closest('.global-search')&&!event.target.closest('#global-search-results')){
      q('#global-search-results')?.setAttribute('hidden','');
    }
    if(document.body.classList.contains('rail-open')&&!event.target.closest('.app-rail')&&!event.target.closest('#rail-toggle')){
      document.body.classList.remove('rail-open');
    }
  });

  addEventListener('popstate',()=>{
    const view=normalizeView(new URL(location.href).searchParams.get('view')||'overview');
    setView(view,{updateUrl:false});
  });
}

function bootShell(){
  installShellEvents();
  const requested=normalizeView(new URL(location.href).searchParams.get('view')||'overview');
  setView(requested,{updateUrl:false});
  loadShellData();
}

bootShell();
