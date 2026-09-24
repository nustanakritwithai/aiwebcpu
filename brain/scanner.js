const OWNER='nustanakritwithai';
const REPO='aiwebcpu';
const BOT_BRANCH='automation/project-brain-scan';

const qs=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function shortSha(sha){return sha?sha.slice(0,8):'—'}

function workflowBadge(row){
  const verdict=row?.verdict??'UNKNOWN';
  return `<span class="scanner-verdict ${esc(verdict)}">${esc(verdict)}</span>`;
}

function renderBaseline(config,baseline){
  const repos=Object.values(baseline.repositories??{});
  qs('#scanner-monitored').textContent=String(config.repositories?.length??repos.length);
  qs('#scanner-baseline').textContent=String(repos.length);
  qs('#scanner-semantic').textContent='UNKNOWN';

  qs('#scanner-repos').innerHTML=repos.map(row=>`
    <article class="scanner-repo">
      <div class="scanner-repo-top">
        <strong>${esc(row.repo)}</strong>
        ${workflowBadge(row.exactHeadWorkflow)}
      </div>
      <code>${esc(shortSha(row.head?.sha))}</code>
      <p>${esc(String(row.head?.message??'').split('\n')[0])}</p>
      <small>${row.evidenceFiles?.length??0} tracked evidence files · ${esc(row.branch??'main')}</small>
    </article>
  `).join('');
}

function renderCandidates(report,{pr=null}={}){
  const rows=report?.candidates??[];
  qs('#scanner-pending').textContent=String(rows.length);
  qs('#scanner-semantic').textContent=report?.summary?.semanticVerdict??'UNKNOWN';

  const copy=qs('#scanner-inbox-copy');
  if(!rows.length){
    copy.textContent=pr
      ? 'Scanner PR เปิดอยู่ แต่รายงานปัจจุบันไม่มี semantic candidate'
      : 'ไม่มี scanner PR ที่รอ review ในขณะนี้';
    qs('#scanner-candidates').innerHTML='<div class="scanner-empty">No pending candidate</div>';
  }else{
    copy.textContent=`${rows.length} candidate(s) รอ Verify — ยังห้ามนับเป็น capability PASS`;
    qs('#scanner-candidates').innerHTML=rows.map(item=>`
      <article class="scanner-candidate">
        <div class="scanner-candidate-top">
          <span class="scanner-kind">${esc(item.kind)}</span>
          <span class="scanner-verdict UNKNOWN">UNKNOWN</span>
        </div>
        <strong>${esc(item.repo)}</strong>
        ${item.path?`<code>${esc(item.path)}</code>`:''}
        ${item.mechanicalEvidence?`<p>Mechanical evidence: <b class="${esc(item.mechanicalEvidence)}">${esc(item.mechanicalEvidence)}</b></p>`:''}
        <p>${esc(item.reason)}</p>
      </article>
    `).join('');
  }

  const link=qs('#scanner-pr-link');
  if(pr?.html_url){
    link.href=pr.html_url;
    link.hidden=false;
  }else{
    link.hidden=true;
  }
}

async function getJson(url,options={}){
  const response=await fetch(url,{cache:'no-store',...options});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadPending(){
  const endpoint=`https://api.github.com/repos/${OWNER}/${REPO}/pulls?state=open&base=main&head=${OWNER}:${BOT_BRANCH}&per_page=1`;
  const pulls=await getJson(endpoint,{headers:{Accept:'application/vnd.github+json'}});
  const pr=pulls[0]??null;
  if(!pr){
    renderCandidates({summary:{semanticVerdict:'UNKNOWN'},candidates:[]});
    return {pending:false};
  }

  const sha=pr.head?.sha;
  if(!sha)throw new Error('Scanner PR has no head SHA');
  const raw=`https://raw.githubusercontent.com/${OWNER}/${REPO}/${encodeURIComponent(sha)}/project-brain/scanner/candidates.json`;
  const report=await getJson(raw);
  renderCandidates(report,{pr});
  return {pending:true,count:report.candidates?.length??0};
}

async function loadScanner(){
  const status=qs('#scanner-status');
  status.textContent='กำลังโหลด';
  status.className='scanner-status';

  try{
    const [config,baseline]=await Promise.all([
      getJson('../project-brain/scanner/config.json'),
      getJson('../project-brain/scanner/baseline.json')
    ]);
    renderBaseline(config,baseline);

    try{
      const pending=await loadPending();
      status.textContent=pending.pending?'REVIEW REQUIRED':'SYNCED';
      status.className='scanner-status '+(pending.pending?'warn':'ok');
    }catch(error){
      qs('#scanner-pending').textContent='?';
      qs('#scanner-semantic').textContent='UNKNOWN';
      qs('#scanner-inbox-copy').textContent='อ่าน pending scanner PR ไม่สำเร็จ — สถานะเป็น UNKNOWN ไม่ใช่ “ไม่มีการเปลี่ยนแปลง”';
      qs('#scanner-candidates').innerHTML=`<div class="scanner-empty">Pending state UNKNOWN · ${esc(error.message)}</div>`;
      status.textContent='PENDING UNKNOWN';
      status.className='scanner-status unknown';
    }
  }catch(error){
    status.textContent='LOAD FAILED';
    status.className='scanner-status bad';
    qs('#scanner-repos').innerHTML=`<div class="scanner-empty">โหลด scanner baseline ไม่สำเร็จ · ${esc(error.message)}</div>`;
    qs('#scanner-pending').textContent='?';
    qs('#scanner-semantic').textContent='UNKNOWN';
  }
}

qs('#scanner-refresh')?.addEventListener('click',loadScanner);
loadScanner();
