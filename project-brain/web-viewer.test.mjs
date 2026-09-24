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
