import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('./catalog/repositories.json',import.meta.url),'utf8'));
const config=JSON.parse(await readFile(new URL('./scanner/config.json',import.meta.url),'utf8'));
const baseline=JSON.parse(await readFile(new URL('./scanner/baseline.json',import.meta.url),'utf8'));

test('public repository catalog persists only 33 public repositories',()=>{
  assert.equal(catalog.totalRepositoriesDiscovered,37);
  assert.equal(catalog.publicRepositoriesPersisted,33);
  assert.equal(catalog.privateRepositoriesOmitted,4);
  assert.equal(catalog.repositories.length,33);
  assert.equal(new Set(catalog.repositories.map(x=>x.repo)).size,33);
  assert.ok(catalog.repositories.every(x=>x.visibility==='public'));
});

test('private repository details are not persisted in public catalog',()=>{
  assert.equal(catalog.policy.privateRepositoryDetailsPersisted,false);
  assert.ok(!JSON.stringify(catalog).includes('"visibility": "private"'));
  assert.equal(catalog.summary.privateOmitted,4);
});

test('public catalog counts and CI evidence are exact',()=>{
  assert.deepEqual(catalog.summary,{
    discoveredTotal:37,
    persistedPublic:33,
    nonEmptyPublic:30,
    emptyPublic:3,
    privateOmitted:4,
    exactHeadCI:{SAT:16,VIOL:1,UNKNOWN:16}
  });
  const empty=catalog.repositories.filter(x=>x.catalogStatus==='EMPTY').map(x=>x.name).sort();
  assert.deepEqual(empty,['APK-Test','Empire-war','Monkey-king']);
});

test('catalog keeps every persisted semantic status UNKNOWN',()=>{
  assert.ok(catalog.repositories.every(x=>x.semanticStatus==='UNKNOWN'));
  assert.ok(catalog.repositories.some(x=>x.exactHeadWorkflow.verdict==='SAT'));
  assert.ok(catalog.repositories.some(x=>x.exactHeadWorkflow.verdict==='VIOL'));
});

test('scheduled scanner set equals persisted public catalog set',()=>{
  const expected=catalog.repositories.map(x=>x.id).sort();
  const actual=config.repositories.map(x=>x.id).sort();
  assert.deepEqual(actual,expected);
});

test('scanner baseline covers exactly every scheduled public repository',()=>{
  const expected=config.repositories.map(x=>x.id).sort();
  const actual=Object.keys(baseline.repositories).sort();
  assert.deepEqual(actual,expected);
});

test('non-empty public repositories have captured HEAD while empty ones do not',()=>{
  for(const row of catalog.repositories){
    if(row.catalogStatus==='EMPTY'){
      assert.equal(row.head.sha,null);
      assert.equal(row.exactHeadWorkflow.verdict,'UNKNOWN');
    }else{
      assert.match(row.head.sha,/^[0-9a-f]{40}$/);
      assert.ok(row.head.date);
      assert.ok(row.head.title);
    }
  }
});

test('tracked public evidence files have deterministic blob SHAs',()=>{
  for(const row of catalog.repositories){
    for(const file of row.evidenceFiles){
      assert.equal(file.status,'present');
      assert.match(file.sha,/^[0-9a-f]{40}$/);
    }
  }
});
