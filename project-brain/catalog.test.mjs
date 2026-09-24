import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('./catalog/repositories.json',import.meta.url),'utf8'));
const config=JSON.parse(await readFile(new URL('./scanner/config.json',import.meta.url),'utf8'));
const baseline=JSON.parse(await readFile(new URL('./scanner/baseline.json',import.meta.url),'utf8'));

test('full repository catalog contains all 37 unique repositories',()=>{
  assert.equal(catalog.totalRepositories,37);
  assert.equal(catalog.repositories.length,37);
  assert.equal(new Set(catalog.repositories.map(x=>x.repo)).size,37);
  assert.ok(catalog.repositories.every(x=>x.repo.startsWith('nustanakritwithai/')));
});

test('catalog classifies public private non-empty and empty repositories exactly',()=>{
  assert.deepEqual(catalog.summary,{
    total:37,
    nonEmpty:34,
    empty:3,
    public:33,
    private:4,
    exactHeadCI:{SAT:16,VIOL:2,UNKNOWN:19}
  });
  const empty=catalog.repositories.filter(x=>x.catalogStatus==='EMPTY').map(x=>x.name).sort();
  assert.deepEqual(empty,['APK-Test','Empire-war','Monkey-king']);
  const privateRepos=catalog.repositories.filter(x=>x.visibility==='private').map(x=>x.name).sort();
  assert.deepEqual(privateRepos,['A2A-blackboard','Ai-game','MonsterLifeServer','MulitAgentWork']);
});

test('catalog keeps every semantic status UNKNOWN despite mechanical CI evidence',()=>{
  assert.ok(catalog.repositories.every(x=>x.semanticStatus==='UNKNOWN'));
  assert.ok(catalog.repositories.some(x=>x.exactHeadWorkflow.verdict==='SAT'));
  assert.ok(catalog.repositories.some(x=>x.exactHeadWorkflow.verdict==='VIOL'));
});

test('scheduled scanner set equals public AUTO catalog set',()=>{
  const expected=catalog.repositories.filter(x=>x.scheduledScan==='AUTO').map(x=>x.id).sort();
  const actual=config.repositories.map(x=>x.id).sort();
  assert.equal(expected.length,33);
  assert.deepEqual(actual,expected);
});

test('private repositories are cataloged but not scheduled without cross-repo credential',()=>{
  const privateRows=catalog.repositories.filter(x=>x.visibility==='private');
  assert.equal(privateRows.length,4);
  assert.ok(privateRows.every(x=>x.scheduledScan==='MANUAL_PRIVATE'));
  const scheduled=new Set(config.repositories.map(x=>x.repo));
  assert.ok(privateRows.every(x=>!scheduled.has(x.repo)));
});

test('scanner baseline covers exactly every scheduled repository',()=>{
  const expected=config.repositories.map(x=>x.id).sort();
  const actual=Object.keys(baseline.repositories).sort();
  assert.deepEqual(actual,expected);
});

test('non-empty repositories have a captured HEAD while empty repositories do not',()=>{
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

test('tracked evidence files have deterministic blob SHAs',()=>{
  for(const row of catalog.repositories){
    for(const file of row.evidenceFiles){
      assert.equal(file.status,'present');
      assert.match(file.sha,/^[0-9a-f]{40}$/);
    }
  }
});
