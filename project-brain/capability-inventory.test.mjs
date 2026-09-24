import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('./catalog/repositories.json',import.meta.url),'utf8'));
const inventory=JSON.parse(await readFile(new URL('./capability-inventory/repositories.json',import.meta.url),'utf8'));

test('capability inventory covers every public catalog repository exactly once',()=>{
  assert.equal(inventory.repositories.length,catalog.repositories.length);
  assert.deepEqual(
    inventory.repositories.map(x=>x.repo).sort(),
    catalog.repositories.map(x=>x.repo).sort()
  );
  assert.equal(new Set(inventory.repositories.map(x=>x.repoId)).size,inventory.repositories.length);
});

test('documented capability inventory does not promote reuse decisions',()=>{
  const caps=inventory.repositories.flatMap(x=>x.capabilities);
  assert.ok(caps.length>100);
  assert.ok(caps.every(x=>x.status==='DOCUMENTED'));
  assert.ok(caps.every(x=>x.reuseDecision==='UNKNOWN'));
});

test('every documented capability has repository evidence with a blob SHA',()=>{
  for(const row of inventory.repositories){
    for(const cap of row.capabilities){
      assert.ok(cap.label);
      assert.ok(cap.evidence.length>0);
      for(const ev of cap.evidence){
        assert.ok(ev.path);
        assert.match(ev.sha,/^[0-9a-f]{40}$/);
        assert.ok(ev.claim);
      }
    }
  }
});

test('empty repos and weak scaffold remain UNKNOWN instead of fabricated capabilities',()=>{
  for(const name of ['APK-Test','Empire-war','Monkey-king','News-nus']){
    const row=inventory.repositories.find(x=>x.name===name);
    assert.ok(row,name);
    assert.equal(row.extractionStatus,'UNKNOWN');
    assert.equal(row.capabilityCount,0);
  }
});

test('inventory summary is internally consistent',()=>{
  assert.equal(inventory.summary.repositories,inventory.repositories.length);
  assert.equal(inventory.summary.documentedRepositories,inventory.repositories.filter(x=>x.extractionStatus==='DOCUMENTED').length);
  assert.equal(inventory.summary.unknownRepositories,inventory.repositories.filter(x=>x.extractionStatus==='UNKNOWN').length);
  assert.equal(inventory.summary.documentedCapabilities,inventory.repositories.reduce((n,x)=>n+x.capabilityCount,0));
});
