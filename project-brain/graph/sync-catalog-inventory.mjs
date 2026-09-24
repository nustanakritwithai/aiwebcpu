import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export const GENERATED_BY='catalog-inventory-sync-v1';

export const slug=value=>
  String(value??'')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,54)||'item';

export function fnv1a(value){
  let h=2166136261>>>0;
  for(const ch of String(value??'')){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619);
  }
  return (h>>>0).toString(16).padStart(8,'0');
}

export function candidateId(repoId,label){
  return `capdoc:${repoId.slice(5)}:${slug(label)}-${fnv1a(label).slice(0,6)}`;
}

export function evidenceId(repoId,path,sha){
  const key=`${repoId}|${path}|${sha}`;
  return `evdoc:${repoId.slice(5)}:${slug(path)}-${fnv1a(key).slice(0,6)}`;
}

function ensureArrayValue(array,value){
  if(!array.includes(value))array.push(value);
}

function edgeKey(edge){
  return `${edge.from}|${edge.to}|${edge.type}`;
}

export function syncCatalogInventory(graphInput,catalog,inventory,{checkpoint}={}){
  const graph=structuredClone(graphInput);
  const activeFrom=checkpoint??graph.coverage?.activeFrom;
  if(!activeFrom)throw new Error('Graph coverage checkpoint is required');

  ensureArrayValue(graph.nodeTypes,'CAPABILITY_CANDIDATE');
  ensureArrayValue(graph.relationTypes,'DOCUMENTS');
  ensureArrayValue(graph.relationTypes,'DOCUMENTED_BY');

  graph.nodes=(graph.nodes??[]).filter(node=>node.generatedBy!==GENERATED_BY);
  graph.edges=(graph.edges??[]).filter(edge=>edge.generatedBy!==GENERATED_BY);

  const nodeIds=new Set(graph.nodes.map(node=>node.id));
  const edgeKeys=new Set(graph.edges.map(edge=>edgeKey(edge)));

  const addNode=node=>{
    if(nodeIds.has(node.id))return;
    graph.nodes.push(node);
    nodeIds.add(node.id);
  };

  const addEdge=edge=>{
    const key=edgeKey(edge);
    if(edgeKeys.has(key))return;
    graph.edges.push(edge);
    edgeKeys.add(key);
  };

  for(const row of catalog.repositories??[]){
    const existing=graph.nodes.find(node=>node.id===row.id);
    if(existing){
      existing.catalogStatus=row.catalogStatus;
      existing.semanticStatus=row.semanticStatus;
      existing.visibility=row.visibility;
      existing.defaultBranch=row.defaultBranch;
      existing.headSha=row.head?.sha??null;
      existing.cataloged=true;
    }else{
      addNode({
        id:row.id,
        type:'PROJECT',
        name:row.name,
        repo:row.repo,
        status:row.catalogStatus,
        semanticStatus:row.semanticStatus,
        visibility:row.visibility,
        defaultBranch:row.defaultBranch,
        headSha:row.head?.sha??null,
        cataloged:true,
        generatedBy:GENERATED_BY,
        activeFrom
      });
    }
  }

  const evidenceNodes=new Map();
  let documentedCapabilities=0;

  for(const repo of inventory.repositories??[]){
    for(const capability of repo.capabilities??[]){
      documentedCapabilities+=1;
      const capId=candidateId(repo.repoId,capability.label);
      addNode({
        id:capId,
        type:'CAPABILITY_CANDIDATE',
        name:capability.label,
        status:'DOCUMENTED',
        reuseDecision:'UNKNOWN',
        repoId:repo.repoId,
        repo:repo.repo,
        evidenceCount:(capability.evidence??[]).length,
        generatedBy:GENERATED_BY,
        activeFrom
      });
      addEdge({
        from:repo.repoId,
        to:capId,
        type:'DOCUMENTS',
        generatedBy:GENERATED_BY,
        activeFrom
      });

      for(const evidence of capability.evidence??[]){
        const key=`${repo.repoId}|${evidence.path}|${evidence.sha}`;
        let evNode=evidenceNodes.get(key);
        if(!evNode){
          const id=evidenceId(repo.repoId,evidence.path,evidence.sha);
          evNode={
            id,
            type:'EVIDENCE',
            name:`${repo.name} · ${evidence.path}`,
            status:'DOCUMENTED',
            verdict:'UNKNOWN',
            evidenceStatus:'DOCUMENTED',
            repoId:repo.repoId,
            repo:repo.repo,
            path:evidence.path,
            sha:evidence.sha,
            claims:[],
            generatedBy:GENERATED_BY,
            activeFrom
          };
          evidenceNodes.set(key,evNode);
          addNode(evNode);
        }
        if(!evNode.claims.includes(evidence.claim))evNode.claims.push(evidence.claim);
        addEdge({
          from:capId,
          to:evNode.id,
          type:'DOCUMENTED_BY',
          claim:evidence.claim,
          generatedBy:GENERATED_BY,
          activeFrom
        });
      }
    }
  }

  graph.coverage={
    sourceCatalog:'project-brain/catalog/repositories.json',
    sourceInventory:'project-brain/capability-inventory/repositories.json',
    syncVersion:GENERATED_BY,
    activeFrom,
    publicRepositories:(catalog.repositories??[]).length,
    documentedCapabilities,
    documentationEvidenceFiles:evidenceNodes.size,
    semanticRule:'DOCUMENTED capability candidates remain reuseDecision=UNKNOWN until a goal-specific verifier contract resolves them.'
  };

  return graph;
}

function stableJson(value){
  return JSON.stringify(value,null,2)+'\n';
}

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){
    return Object.fromEntries(
      Object.keys(value).sort().map(key=>[key,canonical(value[key])])
    );
  }
  return value;
}

export function normalizeGraphForComparison(graphInput){
  const graph=JSON.parse(JSON.stringify(graphInput));
  graph.nodes=(graph.nodes??[]).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  graph.edges=(graph.edges??[]).slice().sort((a,b)=>{
    const ak=`${a.from}|${a.to}|${a.type}|${a.claim??''}`;
    const bk=`${b.from}|${b.to}|${b.type}|${b.claim??''}`;
    return ak.localeCompare(bk);
  });
  return canonical(graph);
}

function semanticJson(value){
  return JSON.stringify(normalizeGraphForComparison(value));
}

function parseArgs(argv){
  const args={check:false};
  for(let i=0;i<argv.length;i++){
    const token=argv[i];
    if(token==='--check'){args.check=true;continue}
    if(!token.startsWith('--'))continue;
    const key=token.slice(2);
    args[key]=argv[++i];
  }
  return args;
}

async function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv);
  const graphPath=args.graph??fileURLToPath(new URL('./project-brain.json',import.meta.url));
  const catalogPath=args.catalog??fileURLToPath(new URL('../catalog/repositories.json',import.meta.url));
  const inventoryPath=args.inventory??fileURLToPath(new URL('../capability-inventory/repositories.json',import.meta.url));

  const graph=JSON.parse(await readFile(graphPath,'utf8'));
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  const inventory=JSON.parse(await readFile(inventoryPath,'utf8'));
  const synced=syncCatalogInventory(graph,catalog,inventory,{
    checkpoint:args.checkpoint??graph.coverage?.activeFrom
  });
  const next=stableJson(synced);

  if(args.check){
    const current=JSON.parse(await readFile(graphPath,'utf8'));
    if(semanticJson(current)!==semanticJson(synced)){
      console.error('Project Brain graph coverage drift detected. Run sync-catalog-inventory.mjs and commit the graph.');
      process.exitCode=1;
      return;
    }
    console.log(JSON.stringify({ok:true,coverage:synced.coverage}));
    return;
  }

  await writeFile(graphPath,next,'utf8');
  console.log(JSON.stringify({updated:true,coverage:synced.coverage}));
}

const isCli=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isCli)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
