import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  GENERATED_BY,
  syncCatalogInventory,
  candidateId,
  evidenceId,
  normalizeGraphForComparison
} from './graph/sync-catalog-inventory.mjs';

const graph=JSON.parse(await readFile(new URL('./graph/project-brain.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('./catalog/repositories.json',import.meta.url),'utf8'));
const inventory=JSON.parse(await readFile(new URL('./capability-inventory/repositories.json',import.meta.url),'utf8'));

const nodes=new Map(graph.nodes.map(x=>[x.id,x]));
const edgeKey=e=>`${e.from}|${e.to}|${e.type}`;
const edges=new Map(graph.edges.map(e=>[edgeKey(e),e]));

test('canonical graph contains every public repository from catalog',()=>{
  assert.equal(graph.coverage.publicRepositories,catalog.repositories.length);
  for(const repo of catalog.repositories){
    const node=nodes.get(repo.id);
    assert.ok(node,`missing PROJECT node: ${repo.id}`);
    assert.equal(node.type,'PROJECT');
    assert.equal(node.repo,repo.repo);
    assert.equal(node.cataloged,true);
  }
});

test('canonical graph contains every documented capability candidate exactly once',()=>{
  const expected=inventory.repositories.reduce((n,row)=>n+(row.capabilities?.length??0),0);
  const candidates=graph.nodes.filter(x=>x.type==='CAPABILITY_CANDIDATE'&&x.generatedBy===GENERATED_BY);
  assert.equal(expected,116);
  assert.equal(graph.coverage.documentedCapabilities,expected);
  assert.equal(candidates.length,expected);
  assert.equal(new Set(candidates.map(x=>x.id)).size,expected);

  for(const repo of inventory.repositories){
    for(const capability of repo.capabilities??[]){
      const id=candidateId(repo.repoId,capability.label);
      const node=nodes.get(id);
      assert.ok(node,`missing documented capability: ${repo.name} / ${capability.label}`);
      assert.equal(node.status,'DOCUMENTED');
      assert.equal(node.reuseDecision,'UNKNOWN');
      assert.equal(node.repoId,repo.repoId);
      assert.ok(edges.has(`${repo.repoId}|${id}|DOCUMENTS`));
    }
  }
});

test('documentation evidence nodes preserve file SHA while verdict remains UNKNOWN',()=>{
  const unique=new Map();
  for(const repo of inventory.repositories){
    for(const capability of repo.capabilities??[]){
      const capId=candidateId(repo.repoId,capability.label);
      for(const evidence of capability.evidence??[]){
        const key=`${repo.repoId}|${evidence.path}|${evidence.sha}`;
        unique.set(key,{repo,evidence});
        const id=evidenceId(repo.repoId,evidence.path,evidence.sha);
        const node=nodes.get(id);
        assert.ok(node,`missing documentation evidence: ${key}`);
        assert.equal(node.type,'EVIDENCE');
        assert.equal(node.evidenceStatus,'DOCUMENTED');
        assert.equal(node.verdict,'UNKNOWN');
        assert.equal(node.sha,evidence.sha);
        assert.ok(edges.has(`${capId}|${id}|DOCUMENTED_BY`));
      }
    }
  }
  assert.equal(graph.coverage.documentationEvidenceFiles,unique.size);
  assert.equal(unique.size,42);
});

test('graph schema distinguishes documented candidates from verified capabilities',()=>{
  assert.ok(graph.nodeTypes.includes('CAPABILITY'));
  assert.ok(graph.nodeTypes.includes('CAPABILITY_CANDIDATE'));
  assert.ok(graph.relationTypes.includes('DOCUMENTS'));
  assert.ok(graph.relationTypes.includes('DOCUMENTED_BY'));
  assert.ok(graph.nodes.some(x=>x.type==='CAPABILITY'&&x.status==='verified'));
  assert.ok(graph.nodes.some(x=>x.type==='CAPABILITY_CANDIDATE'&&x.status==='DOCUMENTED'));
});

test('generated graph view is deterministic and already synchronized',()=>{
  const synced=syncCatalogInventory(graph,catalog,inventory,{
    checkpoint:graph.coverage.activeFrom
  });
  assert.deepEqual(normalizeGraphForComparison(synced),normalizeGraphForComparison(graph));
});

test('generated graph layer contains no private repository details',()=>{
  assert.equal(catalog.repositories.some(x=>x.visibility==='private'),false);
  const generatedProjects=graph.nodes.filter(x=>x.type==='PROJECT'&&x.generatedBy===GENERATED_BY);
  assert.ok(generatedProjects.every(x=>x.visibility==='public'));
});
