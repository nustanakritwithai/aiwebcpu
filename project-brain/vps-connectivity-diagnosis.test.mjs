import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const diagnosis=JSON.parse(await readFile(new URL('./deep-profiles/pocket-vps-connectivity.json',import.meta.url),'utf8'));
const graph=JSON.parse(await readFile(new URL('./graph/project-brain.json',import.meta.url),'utf8'));

test('V0.6.9 records VPS connectivity as a separate blocked scope',()=>{
  assert.equal(diagnosis.version,'0.6.9');
  assert.equal(diagnosis.status,'BLOCKED');
  const verdict=id=>diagnosis.findings.find(row=>row.id===id)?.verdict;
  assert.equal(verdict('client-server-contract-parity'),'VIOL');
  assert.equal(verdict('worker-artifact-parity'),'VIOL');
  assert.equal(verdict('ingress-source-of-truth'),'VIOL');
  assert.equal(verdict('runtime-worker-binding'),'UNKNOWN');
  assert.equal(verdict('browser-authenticated-e2e'),'UNKNOWN');
  assert.equal(verdict('health-version-preflight'),'SAT');
});

test('V0.6.9 keeps private VPS repository metadata out of public diagnosis',()=>{
  const text=JSON.stringify(diagnosis);
  assert.match(text,/Private VPS repository names, paths, SHAs, credentials/);
  assert.doesNotMatch(text,/MonsterLifeServer/);
  assert.doesNotMatch(text,/codex\/pirate-vitals-economy-server/);
});

test('canonical graph exposes the VPS blocker without changing reuse decision',()=>{
  assert.equal(graph.temporal.defaultCheckpoint,'pb-2026-09-25-pocket-vps-connectivity-v069');
  const issue=graph.nodes.find(node=>node.id==='issue:pocket-vps-browser-connectivity');
  assert.equal(issue?.verdict,'VIOL');
  const integration=graph.nodes.find(node=>node.id==='integration:pocketmonster-pirate-fruit');
  assert.equal(integration?.reuseDecision,'UNKNOWN');
  assert.ok(graph.edges.some(edge=>edge.from===integration.id&&edge.to===issue.id&&edge.type==='BLOCKED_BY'));
});
