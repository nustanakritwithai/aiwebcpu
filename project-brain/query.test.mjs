import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadGraph,
  providersFor,
  inspectGoal,
  inspectIntegration,
  capabilitySummary
} from './query.mjs';

const graph=await loadGraph();

test('rollback capability resolves to TestGE with evidence',()=>{
  const rows=providersFor(graph,'rollback');
  assert.ok(rows.some(row=>row.provider.id==='repo:testge'));
  const testge=rows.find(row=>row.provider.id==='repo:testge');
  assert.ok(testge.evidence.some(e=>e.verdict==='SAT'));
});

test('Simclone time-travel goal resolves required capabilities',()=>{
  const [row]=inspectGoal(graph,'Simclone ย้อนเวลาได้');
  assert.ok(row);
  const ids=new Set(row.needs.map(n=>n.id));
  assert.ok(ids.has('cap:rollback'));
  assert.ok(ids.has('cap:replay'));
  assert.ok(ids.has('cap:verification'));
});

test('time-travel integration exposes confirmed blocker and VIOL evidence',()=>{
  const [row]=inspectIntegration(graph,'Simclone × TestGE Time Travel');
  assert.ok(row);
  assert.ok(row.adaptedFrom.some(n=>n.id==='cap:rollback'));
  assert.ok(row.blockers.some(b=>b.issue.id==='issue:simclone-testge-state-model-mismatch'));
  const blocker=row.blockers.find(b=>b.issue.id==='issue:simclone-testge-state-model-mismatch');
  assert.ok(blocker.evidence.some(e=>e.verdict==='VIOL'));
});

test('capability summary includes reuse candidate goal',()=>{
  const [row]=capabilitySummary(graph,'replay');
  assert.ok(row);
  assert.ok(row.reuseCandidates.some(n=>n.id==='goal:simclone-time-travel'));
});
