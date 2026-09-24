const verifierState={index:null,selected:null};

const vq=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function getJson(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function verdictClass(value){
  return ['SAT','VIOL','UNKNOWN'].includes(value)?value:'UNKNOWN';
}

function renderReport(report,patch){
  vq('#verifier-contract').textContent=report.contractId??'—';
  vq('#verifier-verdict').textContent=report.overallVerdict??'UNKNOWN';
  vq('#verifier-verdict').className='verifier-'+verdictClass(report.overallVerdict);
  vq('#verifier-decision').textContent=report.recommendation??'UNKNOWN';
  vq('#verifier-goal').textContent=report.goal??'—';

  const rows=report.candidates??report.results??[];
  vq('#verifier-results').innerHTML=rows.map(row=>`
    <article class="verifier-result">
      <div class="verifier-result-head">
        <div>
          <strong>${esc(row.capability)}</strong>
          <small>${esc(row.repo??row.repoId??'')}</small>
        </div>
        <span class="verifier-badge ${verdictClass(row.verdict)}">${esc(row.verdict??'UNKNOWN')}</span>
      </div>
      <div class="verifier-decision-line">Decision: <b>${esc(row.decision??'UNKNOWN')}</b></div>
      ${(row.adaptations??[]).map(x=>`<p class="verifier-adaptation">ADAPT: ${esc(x)}</p>`).join('')}
    </article>
  `).join('')||'<div class="verifier-empty">No candidate results</div>';

  const patchBox=vq('#verifier-patch');
  patchBox.innerHTML=`
    <h3>Graph Patch Candidate</h3>
    <div class="verifier-patch-row">
      <span>Status</span><b>${esc(patch.status??'UNKNOWN')}</b>
      <span>Recommendation</span><b>${esc(patch.recommendation??'UNKNOWN')}</b>
      <span>Auto apply</span><b>${patch.autoApply===false?'OFF':'UNKNOWN'}</b>
      <span>Review</span><b>${patch.requiresReview===true?'REQUIRED':'UNKNOWN'}</b>
    </div>
  `;
}

async function loadSelected(){
  const id=vq('#verifier-select')?.value;
  if(!id)return;
  verifierState.selected=id;
  const status=vq('#verifier-status');
  status.textContent='กำลังตรวจ';
  status.className='verifier-status';
  try{
    const [report,patch]=await Promise.all([
      getJson(`../project-brain/verifier/reports/${encodeURIComponent(id)}.json`),
      getJson(`../project-brain/verifier/patches/${encodeURIComponent(id)}.json`)
    ]);
    renderReport(report,patch);
    status.textContent='REPORT READY';
    status.className='verifier-status ok';
  }catch(error){
    status.textContent='UNKNOWN';
    status.className='verifier-status unknown';
    vq('#verifier-results').innerHTML=`<div class="verifier-empty">Verification state UNKNOWN · ${esc(error.message)}</div>`;
    vq('#verifier-verdict').textContent='UNKNOWN';
    vq('#verifier-decision').textContent='UNKNOWN';
  }
}

async function bootVerifier(){
  const status=vq('#verifier-status');
  try{
    const index=await getJson('../project-brain/verifier/index.json');
    verifierState.index=index;
    const select=vq('#verifier-select');
    select.replaceChildren();
    for(const row of index.reports??[]){
      const option=document.createElement('option');
      option.value=row.id;
      option.textContent=`${row.id} · ${row.overallVerdict} / ${row.recommendation}`;
      select.append(option);
    }
    select.addEventListener('change',loadSelected);
    vq('#verifier-refresh')?.addEventListener('click',loadSelected);
    if(select.options.length)await loadSelected();
    else{
      status.textContent='NO CONTRACTS';
      status.className='verifier-status unknown';
    }
  }catch(error){
    status.textContent='LOAD FAILED';
    status.className='verifier-status bad';
    vq('#verifier-results').innerHTML=`<div class="verifier-empty">Verifier index UNKNOWN · ${esc(error.message)}</div>`;
  }
}

bootVerifier();
