import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {queryGraph,graphAtCheckpoint,findNodes,nodeById,outgoing,incoming,evidenceFor,
  providersFor,capabilitySummary,documentedCapabilitySummary,inspectGoal,inspectIntegration,parseQueryArguments} from './query.mjs';

// Synthetic source: no live claims or user data.
const fixture={
  temporal:{defaultCheckpoint:'current',checkpoints:[{id:'old'},{id:'current'},{id:'future'}]},
  nodes:[
    {id:'repo',name:'Provider',type:'PROJECT'},
    {id:'cap',name:'rollback',type:'CAPABILITY',temporalStates:[
      {activeFrom:'old',activeUntil:'current',values:{verdict:'SAT'}},
      {activeFrom:'current',values:{verdict:'UNKNOWN'}}]},
    {id:'retired',name:'rollback retired',type:'CAPABILITY',activeUntil:'current'},
    {id:'future',name:'rollback future',type:'CAPABILITY',activeFrom:'future'},
    {id:'proof-old',type:'EVIDENCE',verdict:'SAT',activeUntil:'current'},
    {id:'proof-current',type:'EVIDENCE',verdict:'UNKNOWN',activeFrom:'current'},
    {id:'goal',type:'GOAL'},
    {id:'integration',type:'INTEGRATION'},
    {id:'blocker',type:'ISSUE'},
    {id:'candidate',type:'CAPABILITY_CANDIDATE',reuseDecision:'UNKNOWN'}
  ],
  edges:[
    {from:'repo',to:'cap',type:'PROVIDES'},
    {from:'repo',to:'retired',type:'PROVIDES'},
    {from:'repo',to:'future',type:'PROVIDES'},
    {from:'cap',to:'proof-old',type:'VERIFIED_BY'},
    {from:'cap',to:'proof-current',type:'VERIFIED_BY'},
    {from:'cap',to:'goal',type:'REUSE_CANDIDATE_FOR',activeUntil:'current'},
    {from:'goal',to:'cap',type:'NEEDS'},
    {from:'goal',to:'retired',type:'DEPENDS_ON'},
    {from:'integration',to:'blocker',type:'BLOCKED_BY',activeUntil:'current'},
    {from:'blocker',to:'proof-old',type:'VERIFIED_BY'},
    {from:'repo',to:'candidate',type:'DOCUMENTS'},
    {from:'candidate',to:'proof-old',type:'DOCUMENTED_BY'},
    {from:'candidate',to:'proof-current',type:'DOCUMENTED_BY'}
  ]
};

test('all normal graph queries use the accepted default and remove dangling edges',()=>{
  assert.deepEqual(findNodes(fixture,'rollback').map(n=>n.id),['cap']);
  assert.equal(nodeById(fixture,'retired'),null);
  assert.equal(nodeById(fixture,'cap').verdict,'UNKNOWN');
  assert.equal(outgoing(fixture,'repo','PROVIDES').length,1);
  assert.equal(incoming(fixture,'retired').length,0);
  assert.deepEqual(evidenceFor(fixture,'cap').map(n=>n.id),['proof-current']);
  assert.equal(providersFor(fixture,'rollback').length,1);
  assert.equal(providersFor(fixture,'rollback')[0].evidence[0].verdict,'UNKNOWN');
  assert.equal(capabilitySummary(fixture,'rollback')[0].reuseCandidates.length,0);
  assert.equal(inspectGoal(fixture,'goal')[0].dependsOn.length,0);
  assert.equal(inspectGoal(fixture,'goal')[0].candidates[0].providers[0].evidence[0].verdict,'UNKNOWN');
  assert.equal(inspectIntegration(fixture,'integration')[0].blockers.length,0);
  assert.deepEqual(documentedCapabilitySummary(fixture,'candidate')[0].evidence.map(n=>n.id),['proof-current']);
  assert.equal(documentedCapabilitySummary(fixture,'candidate')[0].reuseDecision,'UNKNOWN');
});

test('explicit history preserves its original scoped verdict and exclusive end boundary',()=>{
  const old={at:'old'};
  assert.equal(nodeById(fixture,'cap',old).verdict,'SAT');
  assert.ok(nodeById(fixture,'retired',old));
  assert.equal(providersFor(fixture,'rollback',old).length,2);
  assert.deepEqual(evidenceFor(fixture,'cap',old).map(n=>n.id),['proof-old']);
  assert.equal(capabilitySummary(fixture,'rollback',old)[0].reuseCandidates[0].id,'goal');
  assert.equal(inspectIntegration(fixture,'integration',old)[0].blockers[0].evidence[0].verdict,'SAT');
  assert.equal(findNodes(fixture,'rollback',{at:'future'}).length,2);
});

test('preselected snapshots remain selected and cannot manufacture another checkpoint',()=>{
  const before=JSON.stringify(fixture);
  const selected=graphAtCheckpoint(fixture,'old');
  assert.equal(queryGraph(selected),selected);
  assert.equal(capabilitySummary(selected,'rollback')[0].capability.verdict,'SAT');
  assert.throws(()=>queryGraph(selected,{at:'current'}),/canonical graph first/);
  assert.throws(()=>graphAtCheckpoint(selected,'current'),/canonical graph first/);
  assert.equal(JSON.stringify(fixture),before);
});

test('legacy graph remains supported; malformed and unknown checkpoints fail closed',()=>{
  const legacy={nodes:[{id:'legacy'}],edges:[]};
  assert.equal(queryGraph(legacy),legacy);
  assert.equal(findNodes(legacy,'legacy').length,1);
  assert.throws(()=>queryGraph(legacy,{at:'old'}),/Unknown Project Brain checkpoint/);
  assert.throws(()=>queryGraph({...fixture,temporal:{checkpoints:fixture.temporal.checkpoints}}),/no default checkpoint/);
  assert.throws(()=>queryGraph(fixture,{at:'missing'}),/Unknown Project Brain checkpoint/);
});

test('checkpoint CLI options are explicit and reject ambiguous requests',()=>{
  assert.deepEqual(parseQueryArguments(['--at','old','goal','a','b']),{command:'goal',rest:['a','b'],at:'old'});
  assert.equal(parseQueryArguments(['goal','a','--at=old']).at,'old');
  assert.deepEqual(parseQueryArguments(['node','--','--at']),{command:'node',rest:['--at'],at:undefined});
  for(const argv of [['node','a','--at'],['node','a','--at='],['node','a','--at','--bad'],
    ['node','a','--at','old','--at','current'],['node','a','--bad'],['snapshot','old','--at','current'],
    ['work','--at','old'],['verification','x','--at','old'],['checkpoints','--at','old']]){
    assert.throws(()=>parseQueryArguments(argv));
  }
});

const cli=fileURLToPath(new URL('./query.mjs',import.meta.url));
const run=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8'}));
test('real CLI keeps JSON array shape and excludes superseded reuse by default',()=>{
  assert.equal(run('capability','replay')[0].reuseCandidates.length,0);
  assert.ok(run('capability','replay','--at','pb-2026-09-24-bootstrap')[0].reuseCandidates.length>0);
  assert.deepEqual(run('node','version:project-brain').map(n=>n.id),['version:project-brain-v069']);
  assert.ok(Array.isArray(run('checkpoints')));
  assert.equal(run('snapshot','pb-2026-09-24-bootstrap').checkpoint.id,'pb-2026-09-24-bootstrap');
  const invalid=spawnSync(process.execPath,[cli,'providers','rollback','--at','missing'],{encoding:'utf8'});
  assert.equal(invalid.status,1);
  assert.equal(invalid.stdout,'');
  assert.match(invalid.stderr,/Unknown Project Brain checkpoint/);
});
