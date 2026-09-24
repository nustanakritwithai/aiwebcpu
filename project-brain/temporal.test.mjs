import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {graphAtCheckpoint} from './query.mjs';

const graph=JSON.parse(await readFile(new URL('./graph/project-brain.json',import.meta.url),'utf8'));
const checkpoints=graph.temporal?.checkpoints??[];
const index=new Map(checkpoints.map((cp,i)=>[cp.id,i]));

test('temporal graph declares knowledge-state semantics and a valid default checkpoint',()=>{
  assert.equal(graph.schemaVersion,'0.2');
  assert.equal(graph.temporal.mode,'knowledge-state');
  assert.match(graph.temporal.semantics,/do not claim/i);
  assert.ok(index.has(graph.temporal.defaultCheckpoint));
});

test('checkpoint ids are unique and ordered',()=>{
  assert.ok(checkpoints.length>=4);
  assert.equal(index.size,checkpoints.length);
  for(let i=1;i<checkpoints.length;i++){
    assert.ok(checkpoints[i].date>=checkpoints[i-1].date);
  }
});

test('all temporal node and edge intervals reference real checkpoints',()=>{
  for(const item of [...graph.nodes,...graph.edges]){
    assert.ok(item.activeFrom,`missing activeFrom: ${item.id??item.type}`);
    assert.ok(index.has(item.activeFrom),`unknown activeFrom: ${item.activeFrom}`);
    if(item.activeUntil){
      assert.ok(index.has(item.activeUntil),`unknown activeUntil: ${item.activeUntil}`);
      assert.ok(index.get(item.activeUntil)>index.get(item.activeFrom),'activeUntil must be exclusive and later than activeFrom');
    }
  }
});

test('temporal property states use valid non-overlapping checkpoint ranges',()=>{
  for(const node of graph.nodes){
    const states=node.temporalStates??[];
    let previousEnd=-1;
    for(const state of states){
      assert.ok(index.has(state.activeFrom));
      const start=index.get(state.activeFrom);
      const end=state.activeUntil?index.get(state.activeUntil):Infinity;
      assert.ok(end>start);
      assert.ok(start>=previousEnd,'temporal state ranges must not overlap');
      assert.equal(typeof state.values,'object');
      previousEnd=end;
    }
  }
});

test('default snapshot contains only current Project Brain version node',()=>{
  const current=graphAtCheckpoint(graph,graph.temporal.defaultCheckpoint);
  const versions=current.nodes.filter(n=>n.type==='VERSION').map(n=>n.id);
  assert.deepEqual(versions,['version:project-brain-v051']);
});
