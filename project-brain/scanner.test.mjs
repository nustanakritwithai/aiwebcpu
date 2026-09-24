import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  compareStates,
  buildCandidateReport,
  reportMarkdown,
  fnv1a
} from './scanner/scanner.mjs';

const config=JSON.parse(await readFile(new URL('./scanner/config.json',import.meta.url),'utf8'));
const baseline=JSON.parse(await readFile(new URL('./scanner/baseline.json',import.meta.url),'utf8'));
const changedFixture=JSON.parse(await readFile(new URL('./scanner/fixtures/changed.json',import.meta.url),'utf8'));
const changed=structuredClone(baseline);
changed.repositories['repo:simclone']=changedFixture.repositories['repo:simclone'];

test('unchanged accepted baseline produces no scanner candidates',()=>{
  assert.deepEqual(compareStates(baseline,baseline),[]);
  const report=buildCandidateReport(config,baseline,baseline);
  assert.equal(report.summary.candidates,0);
  assert.equal(report.summary.semanticVerdict,'UNKNOWN');
});

test('changed repo produces deterministic HEAD, CI and evidence-file candidates',()=>{
  const candidates=compareStates(baseline,changed);
  assert.equal(candidates.length,3);
  assert.deepEqual(
    candidates.map(x=>x.kind).sort(),
    ['CI_CHANGED','EVIDENCE_FILE_CHANGED','HEAD_CHANGED']
  );
  assert.ok(candidates.every(x=>x.verdict==='UNKNOWN'));
  assert.equal(candidates.find(x=>x.kind==='CI_CHANGED').mechanicalEvidence,'SAT');
});

test('scanner never converts successful CI into a capability PASS',()=>{
  const report=buildCandidateReport(config,baseline,changed);
  assert.equal(report.summary.mechanicalSAT,1);
  assert.equal(report.summary.semanticVerdict,'UNKNOWN');
  assert.equal(report.policy.autoGraphWrites,false);
  assert.equal(report.policy.autoMerge,false);
  assert.equal(report.policy.requireVerification,true);
});

test('candidate IDs are stable for the same mechanical change',()=>{
  const one=compareStates(baseline,changed);
  const two=compareStates(baseline,changed);
  assert.deepEqual(one.map(x=>x.id),two.map(x=>x.id));
  assert.equal(fnv1a('same'),fnv1a('same'));
});

test('scanner report states the trust boundary',()=>{
  const markdown=reportMarkdown(buildCandidateReport(config,baseline,changed));
  assert.match(markdown,/Capability meaning remains UNKNOWN until verified/);
  assert.match(markdown,/Merge accepts scanner state only after evidence review/);
});


test('scanner workflow cannot mutate canonical graph or auto-merge',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/project-brain-scan.yml',import.meta.url),'utf8');
  assert.doesNotMatch(workflow,/project-brain\/graph\/project-brain\.json/);
  assert.doesNotMatch(workflow,/gh\s+pr\s+merge/);
  assert.match(workflow,/pull-requests: write/);
  assert.match(workflow,/Candidates remain UNKNOWN/);
});

test('scanner monitors every public catalog repository',async()=>{
  const catalog=JSON.parse(await readFile(new URL('./catalog/repositories.json',import.meta.url),'utf8'));
  const auto=catalog.repositories.filter(x=>x.scheduledScan==='AUTO').map(x=>x.id).sort();
  assert.deepEqual(config.repositories.map(x=>x.id).sort(),auto);
  assert.equal(config.repositories.length,33);
});


test('self repo HEAD-only change does not create scanner churn',()=>{
  const next=structuredClone(baseline);
  next.repositories['repo:aiwebcpu'].head={
    ...next.repositories['repo:aiwebcpu'].head,
    sha:'ffffffffffffffffffffffffffffffffffffffff'
  };
  const rows=compareStates(baseline,next);
  assert.equal(rows.some(x=>x.repoId==='repo:aiwebcpu'&&x.kind==='HEAD_CHANGED'),false);
  assert.equal(rows.length,0);
});

test('self repo tracked file change still creates an UNKNOWN candidate',()=>{
  const next=structuredClone(baseline);
  const file=next.repositories['repo:aiwebcpu'].evidenceFiles.find(x=>x.path==='project-brain/scanner/scanner.mjs');
  file.sha='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const rows=compareStates(baseline,next);
  assert.equal(rows.length,1);
  assert.equal(rows[0].kind,'EVIDENCE_FILE_CHANGED');
  assert.equal(rows[0].verdict,'UNKNOWN');
});

test('self repo disables exact-head workflow tracking while other repos retain it',()=>{
  const selfConfig=config.repositories.find(x=>x.id==='repo:aiwebcpu');
  const simcloneConfig=config.repositories.find(x=>x.id==='repo:simclone');
  assert.equal(selfConfig.trackHead,false);
  assert.equal(selfConfig.trackExactHeadWorkflow,false);
  assert.notEqual(simcloneConfig.trackHead,false);
  assert.notEqual(simcloneConfig.trackExactHeadWorkflow,false);
});


test('empty repository remains a valid mechanical state',()=>{
  const row={
    id:'repo:empty',
    repo:'owner/empty',
    branch:'main',
    empty:true,
    head:{sha:null,date:null,message:''},
    exactHeadWorkflow:{verdict:'UNKNOWN',reason:'empty-repository'},
    evidenceFiles:[]
  };
  const state={schemaVersion:'0.2',repositories:{'repo:empty':row}};
  assert.deepEqual(compareStates(state,state),[]);
});

test('first commit in a formerly empty repository becomes UNKNOWN HEAD candidate',()=>{
  const before={schemaVersion:'0.2',repositories:{'repo:empty':{
    id:'repo:empty',repo:'owner/empty',branch:'main',empty:true,
    head:{sha:null,date:null,message:''},
    exactHeadWorkflow:{verdict:'UNKNOWN',reason:'empty-repository'},evidenceFiles:[]
  }}};
  const after=structuredClone(before);
  after.repositories['repo:empty'].empty=false;
  after.repositories['repo:empty'].head={sha:'abc',date:'2026-09-24',message:'first commit'};
  const rows=compareStates(before,after);
  assert.equal(rows.length,1);
  assert.equal(rows[0].kind,'HEAD_CHANGED');
  assert.equal(rows[0].verdict,'UNKNOWN');
});
