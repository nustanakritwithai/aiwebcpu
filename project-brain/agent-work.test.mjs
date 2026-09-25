import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAgentWorkQueue,workSummary,workItemById} from './query.mjs';

const queue=await loadAgentWorkQueue();

test('agent work queue has explicit UNKNOWN is not pass policy',()=>{
  assert.equal(queue.policy.unknownIsPass,false);
  assert.deepEqual(queue.policy.evidenceModel,['SAT','VIOL','UNKNOWN']);
});

test('Pocket VPS queue exposes P0 as the first READY item',()=>{
  const summary=workSummary(queue);
  assert.equal(summary.activeGoal.id,'pocket-vps-connectivity');
  assert.deepEqual(summary.ready.map(x=>x.id),['P0']);
  assert.equal(summary.work.find(x=>x.id==='P1').status,'BLOCKED');
});

test('dependent phases form P0 through P5 chain',()=>{
  assert.deepEqual(workItemById(queue,'P1').dependsOn,['P0']);
  assert.deepEqual(workItemById(queue,'P5').dependsOn,['P4']);
});

test('work lookup is case insensitive and rejects missing ids with null',()=>{
  assert.equal(workItemById(queue,'p0').id,'P0');
  assert.equal(workItemById(queue,'not-real'),null);
});
