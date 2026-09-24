import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadGraph,
  providersFor,
  inspectGoal,
  inspectIntegration,
  capabilitySummary,
  graphAtCheckpoint,
  snapshotSummary,
  isActiveAt,
  loadVerificationReport
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


test('temporal snapshot hides compatibility decision before it exists',()=>{
  const before=graphAtCheckpoint(graph,'pb-2026-09-24-bootstrap');
  assert.ok(before.nodes.some(n=>n.id==='goal:simclone-time-travel'));
  assert.equal(before.nodes.some(n=>n.id==='integration:simclone-testge-time-travel'),false);
  assert.ok(before.edges.some(e=>e.type==='REUSE_CANDIDATE_FOR'));
});

test('compatibility checkpoint replaces reuse-candidate relation with ADAPT integration',()=>{
  const after=graphAtCheckpoint(graph,'pb-2026-09-24-compat');
  assert.ok(after.nodes.some(n=>n.id==='integration:simclone-testge-time-travel'));
  assert.ok(after.edges.some(e=>e.type==='ADAPTED_FROM'));
  assert.equal(after.edges.some(e=>e.type==='REUSE_CANDIDATE_FOR'),false);
});

test('version nodes supersede across Project Brain viewer checkpoints',()=>{
  const web=graphAtCheckpoint(graph,'pb-2026-09-24-viewer');
  assert.ok(web.nodes.some(n=>n.id==='version:project-brain-v02'));
  assert.equal(web.nodes.some(n=>n.id==='version:project-brain-v01'),false);
  const ux=graphAtCheckpoint(graph,'pb-2026-09-24-mobile-ux');
  assert.ok(ux.nodes.some(n=>n.id==='version:project-brain-v021'));
  assert.equal(ux.nodes.some(n=>n.id==='version:project-brain-v02'),false);
});

test('snapshot summary reports selected checkpoint',()=>{
  const row=snapshotSummary(graph,'pb-2026-09-24-compat');
  assert.equal(row.checkpoint.id,'pb-2026-09-24-compat');
  assert.ok(row.nodes>0);
  assert.ok(row.edges>0);
});

test('unknown checkpoint is never treated as active',()=>{
  assert.equal(isActiveAt(graph,graph.nodes[0],'not-real'),false);
  assert.throws(()=>graphAtCheckpoint(graph,'not-real'),/Unknown Project Brain checkpoint/);
});


test('goal decision changes from UNKNOWN to ADAPT across compatibility checkpoint',()=>{
  const before=graphAtCheckpoint(graph,'pb-2026-09-24-bootstrap');
  const after=graphAtCheckpoint(graph,'pb-2026-09-24-compat');
  assert.equal(before.nodes.find(n=>n.id==='goal:simclone-time-travel').decision,'UNKNOWN');
  assert.equal(after.nodes.find(n=>n.id==='goal:simclone-time-travel').decision,'ADAPT');
});


test('Agent query can load a checked-in verification report',async()=>{
  const report=await loadVerificationReport('simclone-time-travel');
  assert.equal(report.contractId,'simclone-time-travel');
  assert.equal(report.overallVerdict,'SAT');
  assert.equal(report.recommendation,'ADAPT');
  assert.equal(report.policy.autoGraphWrite,false);
});

test('verification report loader rejects path traversal',async()=>{
  await assert.rejects(()=>loadVerificationReport('../graph/project-brain'),/Invalid verification report id/);
});
