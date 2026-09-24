const catalogState={data:null,filter:'all',query:''};

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function catalogMatch(row){
  const f=catalogState.filter;
  if(f==='public'&&row.visibility!=='public')return false;
  if(f==='empty'&&row.catalogStatus!=='EMPTY')return false;
  if(['SAT','VIOL','UNKNOWN'].includes(f)&&row.exactHeadWorkflow?.verdict!==f)return false;

  const q=catalogState.query.trim().toLowerCase();
  if(!q)return true;
  const hay=[
    row.name,row.repo,row.defaultBranch,row.visibility,row.catalogStatus,
    row.semanticStatus,row.scheduledScan,row.head?.title,
    ...(row.detectedSignals??[]),
    ...(row.evidenceFiles??[]).map(x=>x.path)
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function badge(value,kind=''){
  return `<span class="catalog-badge ${escapeHtml(kind)}">${escapeHtml(value)}</span>`;
}

function renderCatalog(){
  const data=catalogState.data;
  if(!data)return;
  const rows=data.repositories.filter(catalogMatch);

  $('#catalog-total').textContent=data.summary.discoveredTotal;
  $('#catalog-nonempty').textContent=data.summary.nonEmptyPublic;
  $('#catalog-public').textContent=data.summary.persistedPublic;
  $('#catalog-private').textContent=data.summary.privateOmitted;
  $('#catalog-summary-line').textContent=
    `แสดง public ${rows.length}/${data.summary.persistedPublic} · discovered ${data.summary.discoveredTotal} · private hidden ${data.summary.privateOmitted} · exact-head CI ${data.summary.exactHeadCI.SAT} SAT / ${data.summary.exactHeadCI.VIOL} VIOL / ${data.summary.exactHeadCI.UNKNOWN} UNKNOWN`;

  $('#catalog-repos').innerHTML=rows.map(row=>{
    const ci=row.exactHeadWorkflow?.verdict??'UNKNOWN';
    const repoUrl=`https://github.com/${row.repo}`;
    return `
      <article class="catalog-repo">
        <div class="catalog-repo-title">
          <div>
            <a href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener">${escapeHtml(row.name)} ↗</a>
            <small>${escapeHtml(row.defaultBranch)}</small>
          </div>
          ${badge(ci,'ci-'+ci)}
        </div>

        <div class="catalog-badges">
          ${badge(row.visibility,row.visibility)}
          ${badge(row.catalogStatus,row.catalogStatus==='EMPTY'?'empty':'')}
          ${badge(row.scheduledScan,row.scheduledScan==='MANUAL_PRIVATE'?'manual':'')}
          ${badge('semantic UNKNOWN','semantic')}
        </div>

        <div class="catalog-headline">
          <code>${row.head?.sha?escapeHtml(row.head.sha.slice(0,8)):'no commits'}</code>
          <span>${escapeHtml(row.head?.date?.slice(0,10)??'—')}</span>
        </div>
        <p>${escapeHtml(row.head?.title??'Empty repository')}</p>

        <div class="catalog-signals">
          ${(row.detectedSignals??[]).map(x=>badge(x,'signal')).join('')||'<span class="catalog-muted">no stack signal promoted</span>'}
        </div>
        <small class="catalog-files">${row.evidenceFiles?.length??0} tracked evidence files · size ${row.sizeKB??0} KB</small>
      </article>
    `;
  }).join('')||'<div class="catalog-empty">ไม่พบ repository ตามตัวกรอง</div>';
}

async function loadCatalog(){
  const status=$('#catalog-status');
  try{
    const response=await fetch('../project-brain/catalog/repositories.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    catalogState.data=await response.json();
    status.textContent='CATALOG READY';
    status.className='catalog-status ok';
    renderCatalog();
  }catch(error){
    status.textContent='LOAD FAILED';
    status.className='catalog-status bad';
    $('#catalog-repos').innerHTML=`<div class="catalog-empty">Catalog UNKNOWN · ${escapeHtml(error.message)}</div>`;
  }
}

$('#catalog-search')?.addEventListener('input',event=>{
  catalogState.query=event.target.value;
  renderCatalog();
});

$$('[data-catalog-filter]').forEach(button=>button.addEventListener('click',()=>{
  catalogState.filter=button.dataset.catalogFilter;
  $$('[data-catalog-filter]').forEach(x=>x.classList.toggle('active',x===button));
  renderCatalog();
}));

loadCatalog();
