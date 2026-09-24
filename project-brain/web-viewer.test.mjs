import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../brain/index.html',import.meta.url),'utf8');
const js=await readFile(new URL('../brain/app.js',import.meta.url),'utf8');
const css=await readFile(new URL('../brain/style.css',import.meta.url),'utf8');

test('viewer loads the canonical Project Brain graph, not a duplicate dataset',()=>{
  assert.match(js,/fetch\('\.\.\/project-brain\/graph\/project-brain\.json'/);
  assert.doesNotMatch(js,/const graph\s*=\s*\{\s*"nodes"/);
});

test('viewer exposes node filters, search, relation labels and details',()=>{
  for(const id of ['search','type-filters','edge-labels','detail','timeline-list'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(js,/PROVIDES/);
  assert.match(js,/VERIFIED_BY/);
  assert.match(js,/BLOCKED_BY/);
  assert.match(js,/ADAPTED_FROM/);
});

test('viewer is mobile-first and supports pan/zoom controls',()=>{
  assert.match(html,/viewport-fit=cover/);
  assert.match(js,/pointerdown/);
  assert.match(js,/zoom-in/);
  assert.match(css,/@media\(max-width:520px\)/);
});

test('viewer discloses V0.2 timeline limitation',()=>{
  assert.match(html,/historical graph replay/);
  assert.match(html,/V0\.2: event timeline/);
});


test('UX V0.2.1 exposes quick presets, focus mode and mobile detail sheet',()=>{
  for(const id of ['metric-nodes','metric-relations','metric-evidence','focus-mode','detail-backdrop'])assert.match(html,new RegExp(`id=[\"']${id}[\"']`));
  for(const preset of ['all','core','reuse','problems','evidence'])assert.match(html,new RegExp(`data-preset=[\"']${preset}[\"']`));
  assert.match(css,/body\.detail-open \.detail/);
  assert.match(css,/\.brain-pulse/);
});

test('viewer loads a reusable UX layer with deep links and persisted presets',async()=>{
  const ux=await readFile(new URL('../brain/ux.js',import.meta.url),'utf8');
  assert.match(html,/src=[\"']\.\/ux\.js[\"']/);
  assert.match(ux,/searchParams\.get\('node'\)/);
  assert.match(ux,/localStorage\.setItem\(UX_PREF/);
  assert.match(ux,/PRESETS/);
  assert.match(ux,/fetch\('\.\.\/project-brain\/graph\/project-brain\.json'/);
});

test('focus UX reuses the graph engine dimming contract instead of rebuilding layout',async()=>{
  const ux=await readFile(new URL('../brain/ux.js',import.meta.url),'utf8');
  assert.match(css,/body\.ux-focus \.node\.dim/);
  assert.doesNotMatch(ux,/settle\(/);
});


test('Temporal V0.3 exposes a real checkpoint slider and playback controls',async()=>{
  const ux=await readFile(new URL('../brain/ux.js',import.meta.url),'utf8');
  for(const id of ['time-machine','time-slider','time-play','time-now','time-checkpoints','time-label'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(ux,/project-brain:set-checkpoint/);
  assert.match(ux,/setTemporalIndex/);
  assert.match(ux,/playTemporal/);
  assert.match(ux,/searchParams\.get\('at'\)/);
  assert.match(css,/Temporal Graph V0\.3/);
});

test('graph engine filters temporal nodes and edges, not only timeline copy',()=>{
  assert.match(js,/temporalActive\(n\)/);
  assert.match(js,/temporalActive\(e\)/);
  assert.match(js,/temporalMaterialize/);
  assert.match(js,/project-brain:set-checkpoint/);
});

test('temporal UI states that checkpoint time is knowledge-state, not guessed software creation time',()=>{
  assert.match(html,/knowledge-state/);
  assert.match(html,/ไม่ใช่การเดาวันที่ซอฟต์แวร์หรือ capability ถูกสร้างจริง/);
});


test('Scanner V0.4 is visible in the web-only interface',async()=>{
  const scanner=await readFile(new URL('../brain/scanner.js',import.meta.url),'utf8');
  for(const id of ['scanner-section','scanner-status','scanner-monitored','scanner-baseline','scanner-pending','scanner-semantic','scanner-repos','scanner-candidates'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/src=["']\.\/scanner\.js["']/);
  assert.match(scanner,/project-brain\/scanner\/baseline\.json/);
  assert.match(scanner,/automation\/project-brain-scan/);
  assert.match(scanner,/pulls\?state=open/);
});

test('scanner inbox preserves UNKNOWN on pending API failure',async()=>{
  const scanner=await readFile(new URL('../brain/scanner.js',import.meta.url),'utf8');
  assert.match(scanner,/PENDING UNKNOWN/);
  assert.match(scanner,/สถานะเป็น UNKNOWN ไม่ใช่ “ไม่มีการเปลี่ยนแปลง”/);
  assert.match(scanner,/scanner-semantic'\)\.textContent='UNKNOWN'/);
});

test('scanner UI states mechanical evidence does not equal capability verification',()=>{
  assert.match(html,/mechanical evidence เท่านั้น/);
  assert.match(html,/ต้องผ่าน Verify ก่อนเสมอ/);
});


test('Full repository catalog is exposed through the web-only interface',async()=>{
  const catalog=await readFile(new URL('../brain/catalog.js',import.meta.url),'utf8');
  for(const id of ['catalog-section','catalog-status','catalog-search','catalog-repos','catalog-total','catalog-private'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/src=["']\.\/catalog\.js["']/);
  assert.match(catalog,/project-brain\/catalog\/repositories\.json/);
  assert.match(catalog,/semanticStatus/);
});

test('catalog web layer does not embed a second 37-repository dataset',async()=>{
  const catalog=await readFile(new URL('../brain/catalog.js',import.meta.url),'utf8');
  assert.doesNotMatch(catalog,/nustanakritwithai\/PocketMonster/);
  assert.doesNotMatch(catalog,/nustanakritwithai\/Simclone/);
  assert.doesNotMatch(catalog,/const\s+repositories\s*=\s*\[/);
});

test('catalog UI keeps semantic UNKNOWN visible while showing mechanical CI',()=>{
  assert.match(html,/ทุก persisted repo ยังมี <b>semanticStatus = UNKNOWN<\/b>/);
  assert.match(css,/catalog-badge\.ci-SAT/);
  assert.match(css,/catalog-badge\.ci-VIOL/);
  assert.match(css,/catalog-badge\.semantic/);
});


test('catalog UI omits private repository filter and states private details are hidden',()=>{
  assert.doesNotMatch(html,/data-catalog-filter=["']private["']/);
  assert.match(html,/Private repository details ถูกซ่อนจาก public dataset/);
});


test('Capability inventory is exposed through the web-only interface',async()=>{
  const cap=await readFile(new URL('../brain/capabilities.js',import.meta.url),'utf8');
  for(const id of ['capability-section','capability-status','capability-search','capability-repositories','capability-count','capability-reuse'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/src=["']\.\/capabilities\.js["']/);
  assert.match(cap,/project-brain\/capability-inventory\/repositories\.json/);
});

test('capability web layer does not embed repository semantic data',async()=>{
  const cap=await readFile(new URL('../brain/capabilities.js',import.meta.url),'utf8');
  assert.doesNotMatch(cap,/Transactional authoritative world runtime/);
  assert.doesNotMatch(cap,/nustanakritwithai\/PocketMonster/);
  assert.doesNotMatch(cap,/const\s+capabilities\s*=\s*\[/);
});

test('capability UI preserves DOCUMENTED versus VERIFIED boundary',()=>{
  assert.match(html,/DOCUMENTED ≠ VERIFIED REUSE/);
  assert.match(html,/REUSE \/ ADAPT \/ BUILD ยังเป็น <b>UNKNOWN<\/b>/);
  assert.match(css,/capability-badge\.documented/);
  assert.match(css,/capability-reuse-state/);
});


test('Verifier V0.5 is exposed through the web-only interface',async()=>{
  const verifier=await readFile(new URL('../brain/verifier.js',import.meta.url),'utf8');
  for(const id of ['verifier-section','verifier-status','verifier-contract','verifier-verdict','verifier-decision','verifier-select','verifier-results','verifier-patch'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/src=["']\.\/verifier\.js["']/);
  assert.match(verifier,/project-brain\/verifier\/index\.json/);
  assert.match(verifier,/verifier\/reports/);
  assert.match(verifier,/verifier\/patches/);
});

test('Verifier UI keeps auto apply off and preserves UNKNOWN semantics',()=>{
  assert.match(html,/AUTO APPLY/);
  assert.match(html,/Graph patch เป็น candidate เท่านั้นและห้าม auto-merge/);
  assert.match(html,/UNKNOWN ไม่ใช่ PASS/);
  assert.match(css,/verifier-badge\.SAT/);
  assert.match(css,/verifier-badge\.VIOL/);
  assert.match(css,/verifier-badge\.UNKNOWN/);
});

test('Verifier web layer does not duplicate verifier engine logic',async()=>{
  const verifier=await readFile(new URL('../brain/verifier.js',import.meta.url),'utf8');
  assert.doesNotMatch(verifier,/evidenceFreshnessChecks/);
  assert.doesNotMatch(verifier,/verifyContract/);
  assert.doesNotMatch(verifier,/decisionFor/);
});


test('Command Center UX V0.5.1 exposes one-view workspace navigation',async()=>{
  const shell=await readFile(new URL('../brain/shell.js',import.meta.url),'utf8');
  for(const id of ['overview-section','global-search','global-search-results','current-view-label','rail-toggle'])assert.match(html,new RegExp(`id=["']${id}["']`));
  for(const view of ['overview','graph','repositories','capabilities','verifier','scanner','history'])assert.match(html,new RegExp(`data-view-button=["']${view}["']`));
  assert.match(shell,/data-pb-view/);
  assert.match(shell,/section\.hidden=section\.dataset\.pbView!==view/);
  assert.match(shell,/searchParams\.set\('view',view\)/);
});

test('Command Center global search reads canonical datasets instead of embedding repo data',async()=>{
  const shell=await readFile(new URL('../brain/shell.js',import.meta.url),'utf8');
  assert.match(shell,/project-brain\/graph\/project-brain\.json/);
  assert.match(shell,/project-brain\/catalog\/repositories\.json/);
  assert.match(shell,/project-brain\/capability-inventory\/repositories\.json/);
  assert.match(shell,/project-brain\/verifier\/index\.json/);
  assert.doesNotMatch(shell,/nustanakritwithai\/PocketMonster/);
  assert.doesNotMatch(shell,/Transactional authoritative world runtime/);
});

test('Overview metrics are loaded from Project Brain data, not hard-coded',async()=>{
  const shell=await readFile(new URL('../brain/shell.js',import.meta.url),'utf8');
  for(const id of ['overview-repos','overview-capabilities','overview-verdict','overview-pending','overview-decision'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(shell,/catalog\.summary/);
  assert.match(shell,/inventory\.summary/);
  assert.match(shell,/verifierReport\.overallVerdict/);
  assert.match(shell,/scanner\.summary/);
});

test('Command Center has responsive rail and reduced-motion contract',()=>{
  assert.match(css,/Command Center UX V0\.5\.1/);
  assert.match(css,/\.app-shell/);
  assert.match(css,/body\.rail-open \.app-rail/);
  assert.match(css,/\.mobile-view-nav/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});


test('Decision Workspace V0.5.2 uses canonical goals and explicit verifier contracts',async()=>{
  const decision=await readFile(new URL('../brain/decision.js',import.meta.url),'utf8');
  for(const id of ['decision-section','decision-goal-select','decision-progress','decision-candidates','decision-recommendation','decision-evidence-list'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/src=["']\.\/decision\.js["']/);
  assert.match(decision,/project-brain\/graph\/project-brain\.json/);
  assert.match(decision,/project-brain\/capability-inventory\/repositories\.json/);
  assert.match(decision,/project-brain\/verifier\/index\.json/);
  assert.match(decision,/bundle\.contract\?\.goalId===goalId/);
});

test('Decision Workspace candidates come only from verifier report or canonical relations',async()=>{
  const decision=await readFile(new URL('../brain/decision.js',import.meta.url),'utf8');
  assert.match(decision,/function canonicalCandidates/);
  assert.match(decision,/function verifierCandidates/);
  assert.match(decision,/outgoing\(goal\.id,'NEEDS'\)/);
  assert.match(decision,/incoming\(capability\.id,'PROVIDES'\)/);
  assert.doesNotMatch(decision,/similarity/i);
  assert.doesNotMatch(decision,/fuzzy/i);
  assert.doesNotMatch(decision,/keyword/i);
});

test('Decision Workspace fails closed when no verifier contract exists',async()=>{
  const decision=await readFile(new URL('../brain/decision.js',import.meta.url),'utf8');
  assert.match(decision,/ยังไม่มี verifier contract สำหรับ Goal นี้/);
  assert.match(decision,/const verdict=bundle\?\.report\?\.overallVerdict\?\?'UNKNOWN'/);
  assert.match(decision,/const recommendation=bundle\?\.report\?\.recommendation\?\?'UNKNOWN'/);
});

test('Decision Workspace is read-only and does not mutate graph or contracts',async()=>{
  const decision=await readFile(new URL('../brain/decision.js',import.meta.url),'utf8');
  assert.doesNotMatch(decision,/fetch\([^\n]+method\s*:/);
  assert.doesNotMatch(decision,/project-brain\/graph\/project-brain\.json[^\n]+POST/);
  assert.match(html,/UI นี้ไม่สร้าง verifier contract และไม่เปลี่ยน canonical graph/);
});

test('Decision view is part of reusable Command Center routing',async()=>{
  const shell=await readFile(new URL('../brain/shell.js',import.meta.url),'utf8');
  assert.match(html,/data-view-button=["']decision["']/);
  assert.match(shell,/decision:'Decision'/);
  assert.match(shell,/type:'Goal'/);
  assert.match(shell,/view:'decision'/);
});


test('Complete Graph Coverage V0.5.3 renders documented capability candidates',async()=>{
  const ux=await readFile(new URL('../brain/ux.js',import.meta.url),'utf8');
  assert.match(js,/CAPABILITY_CANDIDATE/);
  assert.match(js,/DOCUMENTS/);
  assert.match(js,/DOCUMENTED_BY/);
  assert.match(ux,/documented:\['PROJECT','CAPABILITY_CANDIDATE','EVIDENCE'\]/);
  assert.match(html,/data-preset=["']documented["']/);
});

test('large complete graph uses bounded layout iterations',()=>{
  assert.match(js,/nodes\.length>180\?130/);
  assert.match(js,/const iterations=/);
});
