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

test('scanner monitors the four V0.4 bootstrap repositories',()=>{
  assert.deepEqual(
    config.repositories.map(x=>x.id),
    ['repo:aiwebcpu','repo:testge','repo:astralife','repo:simclone']
  );
});
