import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const DEFAULT_GRAPH_URL=new URL('./graph/project-brain.json',import.meta.url);

const norm=value=>String(value??'').trim().toLocaleLowerCase();

export async function loadGraph(pathOrUrl=DEFAULT_GRAPH_URL){
  const text=await readFile(pathOrUrl,'utf8');
  const graph=JSON.parse(text);
  if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))
    throw new Error('Invalid Project Brain graph');
  return graph;
}

export function nodeById(graph,id){
  return graph.nodes.find(n=>n.id===id)??null;
}

export function checkpointById(graph,id){
  return graph.temporal?.checkpoints?.find(cp=>cp.id===id)??null;
}

export function checkpointIndex(graph,id){
  const rows=graph.temporal?.checkpoints??[];
  return rows.findIndex(cp=>cp.id===id);
}

export function isActiveAt(graph,item,checkpointId){
  const at=checkpointIndex(graph,checkpointId);
  if(at<0)return false;
  const from=item.activeFrom?checkpointIndex(graph,item.activeFrom):0;
  const until=item.activeUntil?checkpointIndex(graph,item.activeUntil):Infinity;
  if(from<0||until===-1)return false;
  return at>=from&&at<until;
}

export function graphAtCheckpoint(graph,checkpointId){
  const checkpoint=checkpointById(graph,checkpointId);
  if(!checkpoint)throw new Error('Unknown Project Brain checkpoint: '+checkpointId);
  const nodes=graph.nodes.filter(n=>isActiveAt(graph,n,checkpointId));
  const ids=new Set(nodes.map(n=>n.id));
  const edges=graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&isActiveAt(graph,e,checkpointId));
  return {
    ...graph,
    nodes,
    edges,
    temporal:{
      ...graph.temporal,
      selectedCheckpoint:checkpointId
    }
  };
}

export function snapshotSummary(graph,checkpointId){
  const snap=graphAtCheckpoint(graph,checkpointId);
  const checkpoint=checkpointById(graph,checkpointId);
  const byType=Object.fromEntries((graph.nodeTypes??[]).map(type=>[type,snap.nodes.filter(n=>n.type===type).length]));
  return {
    checkpoint,
    nodes:snap.nodes.length,
    edges:snap.edges.length,
    byType
  };
}

export function findNodes(graph,query,{type=null}={}){
  const q=norm(query);
  return graph.nodes.filter(n=>(!type||n.type===type)&&(
    norm(n.id).includes(q)||
    norm(n.name).includes(q)||
    norm(n.repo).includes(q)
  ));
}

export function outgoing(graph,id,type=null){
  return graph.edges.filter(e=>e.from===id&&(!type||e.type===type));
}

export function incoming(graph,id,type=null){
  return graph.edges.filter(e=>e.to===id&&(!type||e.type===type));
}

export function evidenceFor(graph,id){
  return outgoing(graph,id,'VERIFIED_BY').map(e=>nodeById(graph,e.to)).filter(Boolean);
}

export function providersFor(graph,capabilityQuery){
  const caps=findNodes(graph,capabilityQuery,{type:'CAPABILITY'});
  const rows=[];
  for(const cap of caps){
    for(const edge of incoming(graph,cap.id,'PROVIDES')){
      const provider=nodeById(graph,edge.from);
      if(provider)rows.push({
        capability:cap,
        provider,
        evidence:evidenceFor(graph,cap.id)
      });
    }
  }
  return rows;
}

export function inspectGoal(graph,goalQuery){
  const goals=findNodes(graph,goalQuery,{type:'GOAL'});
  return goals.map(goal=>{
    const needs=outgoing(graph,goal.id,'NEEDS').map(e=>nodeById(graph,e.to)).filter(Boolean);
    const dependsOn=outgoing(graph,goal.id,'DEPENDS_ON').map(e=>nodeById(graph,e.to)).filter(Boolean);
    const candidates=needs.map(capability=>({
      capability,
      providers:providersFor(graph,capability.id)
        .filter(x=>x.capability.id===capability.id)
        .map(x=>({provider:x.provider,evidence:x.evidence}))
    }));
    return {goal,needs,dependsOn,candidates};
  });
}

export function inspectIntegration(graph,integrationQuery){
  const integrations=findNodes(graph,integrationQuery,{type:'INTEGRATION'});
  return integrations.map(integration=>({
    integration,
    adaptedFrom:outgoing(graph,integration.id,'ADAPTED_FROM').map(e=>nodeById(graph,e.to)).filter(Boolean),
    usedIn:outgoing(graph,integration.id,'USED_IN').map(e=>nodeById(graph,e.to)).filter(Boolean),
    blockers:outgoing(graph,integration.id,'BLOCKED_BY').map(e=>{
      const issue=nodeById(graph,e.to);
      return issue?{issue,evidence:evidenceFor(graph,issue.id)}:null;
    }).filter(Boolean)
  }));
}

export function capabilitySummary(graph,query){
  return findNodes(graph,query,{type:'CAPABILITY'}).map(capability=>({
    capability,
    providers:incoming(graph,capability.id,'PROVIDES').map(e=>nodeById(graph,e.from)).filter(Boolean),
    evidence:evidenceFor(graph,capability.id),
    reuseCandidates:outgoing(graph,capability.id,'REUSE_CANDIDATE_FOR').map(e=>nodeById(graph,e.to)).filter(Boolean)
  }));
}

function compact(value){
  if(Array.isArray(value))return value.map(compact);
  if(value&&typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value)){
      if(k==='state')continue;
      out[k]=compact(v);
    }
    return out;
  }
  return value;
}

async function main(argv=process.argv.slice(2)){
  const [command,...rest]=argv;
  const graph=await loadGraph();

  if(command==='checkpoints'){
    console.log(JSON.stringify(compact(graph.temporal?.checkpoints??[]),null,2));
    return;
  }

  const query=rest.join(' ').trim();
  if(!command||!query){
    console.error('Usage: node project-brain/query.mjs <capability|providers|goal|integration|node|snapshot> <query-or-checkpoint>\n       node project-brain/query.mjs checkpoints');
    process.exitCode=2;
    return;
  }

  let result;
  if(command==='capability')result=capabilitySummary(graph,query);
  else if(command==='providers')result=providersFor(graph,query);
  else if(command==='goal')result=inspectGoal(graph,query);
  else if(command==='integration')result=inspectIntegration(graph,query);
  else if(command==='node')result=findNodes(graph,query);
  else if(command==='snapshot')result=snapshotSummary(graph,query);
  else throw new Error('Unknown command: '+command);
  console.log(JSON.stringify(compact(result),null,2));
}

const isCli=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isCli)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
