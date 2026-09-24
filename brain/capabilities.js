const capabilityState={data:null,filter:'all',query:''};

const qs=s=>document.querySelector(s);
const qsa=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function matchesRepo(row){
  const filter=capabilityState.filter;
  if(filter==='DOCUMENTED'&&row.extractionStatus!=='DOCUMENTED')return false;
  if(filter==='UNKNOWN'&&row.extractionStatus!=='UNKNOWN')return false;
  const q=capabilityState.query.trim().toLowerCase();
  if(!q)return true;
  return [
    row.name,row.repo,row.extractionStatus,
    ...(row.capabilities??[]).flatMap(cap=>[
      cap.label,cap.status,cap.reuseDecision,
      ...(cap.evidence??[]).flatMap(ev=>[ev.path,ev.claim])
    ]),
    ...(row.limitations??[]),
    ...(row.notes??[])
  ].join(' ').toLowerCase().includes(q);
}

function renderCapabilityInventory(){
  const data=capabilityState.data;
  if(!data)return;
  const rows=data.repositories.filter(matchesRepo);
  qs('#capability-repos').textContent=String(data.summary.repositories);
  qs('#capability-documented').textContent=String(data.summary.documentedRepositories);
  qs('#capability-count').textContent=String(data.summary.documentedCapabilities);
  qs('#capability-reuse').textContent='UNKNOWN';
  qs('#capability-summary-line').textContent=
    `แสดง ${rows.length}/${data.summary.repositories} repos · ${data.summary.documentedCapabilities} documented capability candidates`;

  qs('#capability-repositories').innerHTML=rows.map(row=>{
    const caps=(row.capabilities??[]).map(cap=>{
      const evidence=(cap.evidence??[]).map(ev=>`
        <div class="capability-evidence">
          <code>${esc(ev.path)} @ ${esc(ev.sha.slice(0,8))}</code>
          <p>${esc(ev.claim)}</p>
        </div>`
      ).join('');
      return `
        <article class="capability-card">
          <div class="capability-card-head">
            <strong>${esc(cap.label)}</strong>
            <span class="capability-badge documented">DOCUMENTED</span>
          </div>
          <div class="capability-reuse-state">reuse: <b>UNKNOWN</b></div>
          ${evidence}
        </article>`;
    }).join('');

    const fallback=row.extractionStatus==='UNKNOWN'
      ? `<div class="capability-empty">No sufficiently strong reusable capability extracted yet.</div>`
      : '';

    return `
      <section class="capability-repo">
        <div class="capability-repo-head">
          <div>
            <a href="https://github.com/${esc(row.repo)}" target="_blank" rel="noopener">${esc(row.name)} ↗</a>
            <small>${row.capabilityCount} capabilities</small>
          </div>
          <span class="capability-badge ${row.extractionStatus==='DOCUMENTED'?'documented':'unknown'}">${esc(row.extractionStatus)}</span>
        </div>
        ${caps||fallback}
        ${(row.limitations??[]).map(x=>`<p class="capability-limit">Limit: ${esc(x)}</p>`).join('')}
        ${(row.notes??[]).map(x=>`<p class="capability-note">${esc(x)}</p>`).join('')}
      </section>`;
  }).join('')||'<div class="capability-empty">ไม่พบ capability ตามตัวกรอง</div>';
}

async function loadCapabilities(){
  const status=qs('#capability-status');
  try{
    const response=await fetch('../project-brain/capability-inventory/repositories.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    capabilityState.data=await response.json();
    status.textContent='INVENTORY READY';
    status.className='capability-status ok';
    renderCapabilityInventory();
  }catch(error){
    status.textContent='LOAD FAILED';
    status.className='capability-status bad';
    qs('#capability-repositories').innerHTML=`<div class="capability-empty">Capability inventory UNKNOWN · ${esc(error.message)}</div>`;
  }
}

qs('#capability-search')?.addEventListener('input',event=>{
  capabilityState.query=event.target.value;
  renderCapabilityInventory();
});

qsa('[data-capability-filter]').forEach(button=>button.addEventListener('click',()=>{
  capabilityState.filter=button.dataset.capabilityFilter;
  qsa('[data-capability-filter]').forEach(x=>x.classList.toggle('active',x===button));
  renderCapabilityInventory();
}));

loadCapabilities();
