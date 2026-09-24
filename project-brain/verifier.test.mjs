import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  verifyContract,
  verifyCandidate,
  buildGraphPatchCandidate,
  capabilityKey,
  indexInventory
} from './verifier/verifier.mjs';

const inventory=JSON.parse(await readFile(new URL('./capability-inventory/repositories.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('./catalog/repositories.json',import.meta.url),'utf8'));
const contract=JSON.parse(await readFile(new URL('./verifier/contracts/simclone-time-travel.json',import.meta.url),'utf8'));

test('Verifier V0.5 resolves the known Simclone time-travel contract to SAT / ADAPT',()=>{
  const report=verifyContract(contract,inventory,catalog);
  assert.equal(report.overallVerdict,'SAT');
  assert.equal(report.recommendation,'ADAPT');
  assert.equal(report.results.length,3);
  assert.ok(report.results.every(x=>x.verdict==='SAT'));
  assert.ok(report.results.every(x=>x.decision==='ADAPT'));
  assert.deepEqual(report.unresolved,[]);
});

test('Verifier does not treat documented capability or CI alone as semantic proof',()=>{
  const report=verifyContract(contract,inventory,catalog);
  assert.equal(report.policy.documentedIsVerified,false);
  assert.equal(report.policy.ciIsSemanticProof,false);
  assert.equal(report.policy.unknownIsPass,false);
  for(const row of report.results){
    const ci=row.checks.find(x=>x.type==='REPO_EXACT_HEAD_CI');
    assert.ok(ci);
    assert.equal(ci.required,false);
  }
});

test('stale evidence SHA fails closed to VIOL',()=>{
  const stale=structuredClone(inventory);
  const row=stale.repositories.find(x=>x.repoId==='repo:testge');
  const cap=row.capabilities.find(x=>x.label==='Checkpoint rollback replay and time travel');
  cap.evidence[0].sha='0000000000000000000000000000000000000000';
  const report=verifyContract(contract,stale,catalog);
  const candidate=report.results.find(x=>x.id==='testge-rollback');
  assert.equal(candidate.verdict,'VIOL');
  assert.equal(candidate.decision,'UNKNOWN');
  assert.ok(candidate.checks.some(x=>x.type==='EVIDENCE_CURRENT'&&x.verdict==='VIOL'));
});

test('missing capability remains UNKNOWN and never becomes BUILD automatically',()=>{
  const candidate={
    id:'missing',
    repoId:'repo:testge',
    capability:'Capability That Does Not Exist',
    decision:'BUILD',
    checks:[]
  };
  const row=verifyCandidate({defaults:{ciPolicy:'ignore'}},candidate,inventory,catalog);
  assert.equal(row.verdict,'UNKNOWN');
  assert.equal(row.decision,'UNKNOWN');
});

test('required unknown CI keeps a candidate UNKNOWN',()=>{
  const modified=structuredClone(contract);
  const candidate=modified.candidates.find(x=>x.id==='testge-rollback');
  candidate.ciPolicy='required';

  const catalogUnknown=structuredClone(catalog);
  const row=catalogUnknown.repositories.find(x=>x.id==='repo:testge');
  row.exactHeadWorkflow={verdict:'UNKNOWN',reason:'fixture'};
  const report=verifyContract(modified,inventory,catalogUnknown);
  const result=report.results.find(x=>x.id==='testge-rollback');
  assert.equal(result.verdict,'UNKNOWN');
  assert.equal(result.decision,'UNKNOWN');
});

test('REUSE with declared adaptations is rejected to UNKNOWN decision',()=>{
  const modified=structuredClone(contract);
  const candidate=modified.candidates.find(x=>x.id==='testge-rollback');
  candidate.decision='REUSE';
  const report=verifyContract(modified,inventory,catalog);
  const result=report.results.find(x=>x.id==='testge-rollback');
  assert.equal(result.verdict,'SAT');
  assert.equal(result.decision,'UNKNOWN');
  assert.equal(report.recommendation,'ADAPT');
});

test('required compatibility VIOL makes overall contract VIOL',()=>{
  const modified=structuredClone(contract);
  const candidate=modified.candidates.find(x=>x.id==='simclone-deterministic-engine');
  candidate.checks.push({
    id:'required-failure',
    required:true,
    verdict:'VIOL',
    reason:'fixture required incompatibility'
  });
  const report=verifyContract(modified,inventory,catalog);
  assert.equal(report.overallVerdict,'VIOL');
  assert.equal(report.recommendation,'UNKNOWN');
});

test('graph patch candidate requires SAT plus resolved recommendation',()=>{
  const report=verifyContract(contract,inventory,catalog);
  const patch=buildGraphPatchCandidate(contract,report);
  assert.equal(patch.status,'CANDIDATE');
  assert.equal(patch.autoApply,false);
  assert.equal(patch.requiresReview,true);
  assert.equal(patch.recommendation,'ADAPT');

  const blocked=buildGraphPatchCandidate(contract,{...report,overallVerdict:'UNKNOWN',recommendation:'UNKNOWN'});
  assert.equal(blocked.status,'BLOCKED');
  assert.deepEqual(blocked.operations,[]);
});

test('inventory index uses repo plus normalized label and does not keyword-match',()=>{
  const index=indexInventory(inventory);
  assert.ok(index.has(capabilityKey('repo:testge','Checkpoint rollback replay and time travel')));
  assert.equal(index.has(capabilityKey('repo:testge','rollback')),false);
});
