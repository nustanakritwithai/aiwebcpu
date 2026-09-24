/** Capture bounded public merge/CI evidence, then update the read-only Project Brain view.
 * Does not merge game PRs, deploy servers, enable flags or promote reuse decisions.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {syncCatalogInventory} from '../graph/sync-catalog-inventory.mjs';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const put=async(path,value)=>writeFile(path,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
if(process.env.GITHUB_ACTIONS&&process.env.RELEASE_FIXTURE)throw new Error('Release fixtures must never be published by Actions');
const fixture=process.env.RELEASE_FIXTURE?await read(process.env.RELEASE_FIXTURE):null;
async function api(repo,path){
  const response=await fetch(`https://api.github.com/repos/nustanakritwithai/${repo}/${path}`,{headers:{Accept:'application/vnd.github+json',...(process.env.GH_TOKEN?{Authorization:`Bearer ${process.env.GH_TOKEN}`}:{})},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`${repo}/${path}: HTTP ${response.status}`);
  return response.json();
}
const verdict=item=>item?.status==='completed'?(item.conclusion==='success'?'SAT':'VIOL'):'UNKNOWN';
const expected={PocketMonster:'94ab7ba4cdae44da5cd23ad38369eb6a045fa53e','Pirate-fruit-':'c8c725e8a12e6723a8015e74566965ae18218ff2'};
const repositories={};
const proofs=[];
for(const [repo,number] of [['PocketMonster',632],['Pirate-fruit-',168]]){
  const pr=fixture?.[repo]??await api(repo,`pulls/${number}`);
  assert.equal(pr.merged,true,`${repo} must actually be merged`);
  assert.equal(pr.head.sha,expected[repo],`${repo} reviewed head moved`);
  const runs=fixture?.[`${repo}:runs`]??(await api(repo,`actions/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`)).workflow_runs;
  const names=repo==='PocketMonster'?['Monster controls integration','Studio character live integration CI','World warp character continuity CI','Studio real browser acceptance']:['Client and server gates','Audio A1 browser smoke','Pirate owned monster renderer'];
  const gates=names.map(name=>runs.find(run=>run.name===name));
  assert.ok(gates.every(run=>verdict(run)==='SAT'),`${repo} exact-head CI is not complete/SAT`);
  const mergedRuns=fixture?.[`${repo}:mergedRuns`]??(await api(repo,`actions/runs?head_sha=${pr.merge_commit_sha}&event=push&per_page=20`)).workflow_runs;
  const mergedRun=mergedRuns.find(run=>run.name===(repo==='PocketMonster'?'Deploy PocketMonster game assets to GitHub Pages':'Client and server gates'));
  const key=repo==='PocketMonster'?'pocket':'pirate';
  repositories[key]={repo:`nustanakritwithai/${repo}`,pr:number,head:pr.head.sha,mergeSha:pr.merge_commit_sha,merged:true,mergedAt:pr.merged_at,branch:pr.base.ref,title:pr.title,mergedGate:mergedRun?{name:mergedRun.name,runId:mergedRun.id,verdict:verdict(mergedRun),conclusion:mergedRun.conclusion}:{verdict:'UNKNOWN'},gates:gates.map(run=>({name:run.name,runId:run.id,verdict:verdict(run)}))};
  proofs.push({label:`${repo} merged code`,scope:`PR #${number} · ${pr.merge_commit_sha.slice(0,8)}`,verdict:'SAT',runId:gates[0].id,detail:'Merge confirmed; every selected current-head PR gate passed. This is not proof of external server activation.'});
}
const pairRuns=fixture?.pairRuns??(await api('aiwebcpu','actions/runs?head_sha=cb2c891874e660bf10ddf202b3c0cf45661a8865&per_page=10')).workflow_runs;
const pair=pairRuns.find(run=>run.name==='Pocket Pirate Behavioral Pair Gate');
assert.ok(pair,'runtime pair run missing');
const jobs=fixture?.pairJobs??(await api('aiwebcpu',`actions/runs/${pair.id}/jobs`)).jobs;
assert.equal(verdict(jobs.find(job=>job.name==='runtime-pair')),'SAT','behavioral and native artifact pair not SAT');
proofs.push({label:'Behavioral + native artifact pair',scope:'Pinned 94ab7ba4 × c8c725e8',verdict:'SAT',runId:pair.id,detail:'8 real-module behavior groups, native entry hash, full parent checks, Pirate player chain, V9.1 combat and deployment artifact gates passed. HTTP/SQL transaction host remains injected.'});
proofs.push({label:'Backend health/version preflight',scope:'Read-only inherited compatibility check',verdict:verdict(jobs.find(job=>job.name==='backend-preflight')),runId:pair.id,detail:'This checks the configured backend health/version contract only, not authenticated gameplay writes.'});
const deployRuns=fixture?.deployRuns??(await api('PocketMonster',`actions/runs?head_sha=${repositories.pocket.mergeSha}&event=push&per_page=20`)).workflow_runs;
const deployment=deployRuns.find(run=>run.name==='Deploy PocketMonster game assets to GitHub Pages');
const deployJobs=fixture?.deployJobs??(deployment?(await api('PocketMonster',`actions/runs/${deployment.id}/jobs`)).jobs:[]);
for(const [label,match] of [['Pocket GitHub Pages',job=>job.name==='deploy'],['Firebase launcher',job=>job.name.includes('deploy-firebase')]])proofs.push({label,scope:'Exact merged-release deployment job',verdict:verdict(deployJobs.find(match)),...(deployment?{runId:deployment.id}:{}),detail:'Recorded deployment job status; unrelated historical deployments are not reused.'});
proofs.push({label:'Authenticated gameplay host',scope:'Live account / SQL / server activation',verdict:'UNKNOWN',detail:'No authenticated production game-session test was run by this review. No server feature flags, credentials or database settings were changed.'});
const fields=[
  {message:'pirate-vitals/1',direction:'Server → Pocket parent → Pirate scene',fields:['revision','serverTimeMs','hp','maxHp','guard','guardMax','guardBroken','hitstunUntil','energy','maxEnergy','mp','maxMp','dead'],writer:'Pirate canonical vitals rules',validator:'Pocket lifecycle/bounds validation; native monotonic-revision receiver',commit:'Authoritative host persists state; scene updates presentation only',limit:'A relay ACK is not permission for a local HP/MP or inventory debit.'},
  {message:'respawn',direction:'Server result → scene presentation',fields:['spawnId','islandId','x','y','z','heading','atRevision'],writer:'Pirate server respawn operation',validator:'Nonempty identities, finite coordinates, atRevision ≤ snapshot revision',commit:'Server owns resource reset; receiver applies one teleport per new respawn revision',limit:'Malformed or old snapshots never restore a local authority writer.'},
  {message:'vitalsInput',direction:'Native scene → session-bound parent → server',fields:['contract','blocking','mounted','sprinting'],writer:'Client authors input intentions, not canonical vitals',validator:'Pocket allowlist/boolean validation and session binding',commit:'Dedicated transient input route, outside save-operation queue',limit:'Input flags are not proof that the server accepted movement or granted resources.'},
  {message:'vitalsPotion / vitalsSkill / vitalsBuff',direction:'Scene → parent → domain operation',fields:['type','potionId or skillId','idempotencyKey'],writer:'Client requests; Pirate server computes costs and effects',validator:'Pocket bounded request; Pirate trusted catalog, entitlement and cooldown',commit:'Canonical state plus receipt is returned for authoritative persistence',limit:'Retries replay the same receipt; neither HP nor MP quickslots consume locally under server authority.'},
  {message:'pirate-original-state/1',direction:'Parent → authenticated API host',fields:['commandId','expectedRevision','operation'],writer:'Parent binds command identity and observed revision',validator:'Active session, operation allowlist, bounds and server revision/receipt checks',commit:'Outer authenticated transaction host; Pirate worker provides domain transitions',limit:'The standalone worker and injected HTTP/CAS tests do not prove a deployed SQL transaction.'},
  {message:'tradeQuote',direction:'Scene → Pocket → Pirate EconomyEngine',fields:['schemaVersion','action','islandId','commodityId','quantity','quote','marketRevision'],writer:'Server computes unitPrice, stock and fee from canonical market',validator:'Pocket request shape; Pirate quote parser and real economy engine',commit:'Read-only quote; player and market unchanged',limit:'pirate-fruit is a transport zone, not a trade IslandId; use the actual island.'},
  {message:'trade',direction:'Scene intent → canonical player/market transaction',fields:['idempotencyKey','expectedUnitPrice','quantity','coins','cargo','nextMarket','revision'],writer:'Server owns prices, stock, cargo and canonical coin results',validator:'Trusted quote, active boat capacity, funds, stock and duplicate receipt checks',commit:'Player aggregate and nextMarket must commit together in the outer host',limit:'expectedUnitPrice is a tolerance hint, not a client-authored price. Replay must not debit twice.'},
  {message:'monster intent / original-world result',direction:'Client intent upstream; server world snapshot downstream',fields:['intentId','sequence','zone','kind','category','spawnIds','generation','messages'],writer:'Client authors intent; Pirate central worker authors monster outcomes',validator:'Bounded schemas, server combat/range rules and generation/sequence checks',commit:'World authority mutates monster state; parent only relays results',limit:'Do not conflate visual presence, transport zone and gameplay damage/HP authority.'},
  {message:'player-hit-preview / player-hit-ack',direction:'Server internal IPC only',fields:['characterId','hitKey','state','resolved hit-frame'],writer:'Server monster hit queue and canonical damage adapter',validator:'Known hit, owner binding and frozen hit-frame context',commit:'ACK follows successful outer SQL/CAS commit',limit:'This ACK is not a public client operation and is not evidence of a live host deployment.'}
];
const release={schemaVersion:'1.0.0',version:'0.6.8',status:'MERGED_CODE',capturedAt:new Date().toISOString(),reuseDecision:'UNKNOWN',repositories,proofs,fields,nativeArtifact:{source:expected['Pirate-fruit-'],path:'pirate-fruit-offline/assets/index-D3UrpAn_.js',sha256:'1e79f3e0dae4c2b8865aae6393e30f43517ffe5982dd125d77beb4f2a9703f4e'},limitations:['Merged source, per-repository CI, behavioral pair and deployment have separate evidence scopes.','Generic V9.1 federation contracts are not automatically production-enabled by this release.','Other goals require their own verifier; reuseDecision remains UNKNOWN.']};
const profiles=await read('project-brain/deep-profiles/projects.json');
for(const key of ['pocket','pirate']){
  const profile=profiles.projects.find(row=>row.repoId===`repo:${key==='pocket'?'pocketmonster':'pirate-fruit'}`);
  const integration=profile.crossProjectIntegration;
  integration.status='MERGED_CODE';
  integration.historicalStructuralVerification??=structuredClone(integration.pairedVerification);
  integration.releaseEvidence=release;
  for(const side of ['pocket','pirate'])Object.assign(integration[side],{head:repositories[side].head,draft:false,merged:true,mergeSha:repositories[side].mergeSha,gateVerdict:'SAT',blocker:'Previous branch blockers resolved; see separately scoped release evidence.'});
  integration.rule='Both PRs are merged with current-head CI and paired runtime evidence. Merge does not prove authenticated production gameplay; deployment and reuse remain separately scoped.';
  integration.mergedBaseline={pocketHead:repositories.pocket.mergeSha,pirateHead:repositories.pirate.mergeSha};
  for(const contract of integration.contracts??[])if(contract.state==='CANDIDATE_PAIR')contract.state='MERGED_CODE';
  for(const row of [...profile.architecture,...profile.authorityBoundaries]){
    const reviewed=(row.label??'').startsWith('PR #632')||(row.label??'').startsWith('PR #168')||['Pirate player HP / guard / energy / MP','Pirate player vitals','Pirate central market mutation'].includes(row.domain);
    if(reviewed&&(row.state==='VIOL'||row.state==='CANDIDATE'))row.state='MERGED_CODE';
    row.detail=row.detail.replace(/Exact-head[^.]*red[^.]*\./g,'Historical blocker resolved; current proof is in Release Evidence.').replace(/Exact-head[^.]*fails TypeScript build\./g,'Historical TypeScript blocker resolved.');
  }
  profile.currentStage=`Pocket PR #632 and Pirate PR #168 merged. Native source ${release.nativeArtifact.source.slice(0,8)} shipped in the reviewed artifact. See Release Evidence for runtime, deployment and live-host limits.`;
  profile.sourceRef=repositories[key].branch;
  profile.sourceHead={sha:repositories[key].mergeSha,date:repositories[key].mergedAt,title:repositories[key].title};
  profile.exactHeadWorkflow={...repositories[key].mergedGate};
  profile.nextGates=[...(profile.nextGates??[]).filter(text=>!text.includes('PR #632')&&!text.includes('PR #168')&&!text.includes('Pair Pocket #632')&&!text.includes('candidate heads')), 'Run an authenticated production gameplay session on the external host before claiming live vitals/market writes.','Do not enable generic write flags or promote unrelated reuse decisions from CI/merge alone.'];
  profile.limitations=[...(profile.limitations??[]).filter(text=>!text.includes('currently unmerged')&&!text.includes('draft with exact-head CI')), ...release.limitations];
}
await put('project-brain/deep-profiles/pocket-pirate-release.json',release);
await put('project-brain/deep-profiles/projects.json',profiles);
let app=await readFile('brain/app.js','utf8');
if(!app.includes("import {renderReleaseEvidence}"))app="import {renderReleaseEvidence} from './release-evidence.mjs';\n"+app;
if(!app.includes('${renderReleaseEvidence(crossIntegration?.releaseEvidence)}')){
  const anchor='          ${crossIntegrationHtml}';assert.ok(app.includes(anchor));
  app=app.replace(anchor,anchor+'\n          ${renderReleaseEvidence(crossIntegration?.releaseEvidence)}');
}
const guard="  if(node?.type!=='PROJECT')return '';";
if(!app.includes("node?.id==='integration:pocketmonster-pirate-fruit'")){
  assert.ok(app.includes(guard));
  app=app.replace(guard,"  if(node?.id==='integration:pocketmonster-pirate-fruit')return renderReleaseEvidence(projectDeepProfiles?.projects?.find(row=>row.repoId==='repo:pocketmonster')?.crossProjectIntegration?.releaseEvidence);\n"+guard);
}
await put('brain/app.js',app);
const graph=await read('project-brain/graph/project-brain.json');
const checkpoint='pb-2026-09-25-pocket-pirate-release-v068';
if(!graph.temporal.checkpoints.some(row=>row.id===checkpoint))graph.temporal.checkpoints.push({id:checkpoint,date:'2026-09-25',label:'Pocket × Pirate Release Evidence V0.6.8',description:'Merged code and scoped runtime/native/deployment evidence; no automatic reuse promotion.',source:'project-brain/deep-profiles/pocket-pirate-release.json'});
graph.temporal.defaultCheckpoint=checkpoint;graph.updated='2026-09-25';
const previous=graph.nodes.find(row=>row.id==='version:project-brain-v058');previous.activeUntil=checkpoint;previous.status='superseded';
const content=await readFile('project-brain/deep-profiles/pocket-pirate-release.json');
const blob=createHash('sha1').update(Buffer.from(`blob ${content.length}\0`)).update(content).digest('hex');
const newNodes=[{id:'version:project-brain-v068',type:'VERSION',name:'Project Brain Release Evidence V0.6.8',status:'current',activeFrom:checkpoint},
{id:'integration:pocketmonster-pirate-fruit',type:'INTEGRATION',name:'PocketMonster × Pirate Fruit',status:'MERGED_CODE',decision:'UNKNOWN',reuseDecision:'UNKNOWN',activeFrom:checkpoint},
{id:'evidence:pocket-pirate-release',type:'EVIDENCE',name:'Pocket × Pirate scoped release evidence',status:'DOCUMENTED',verdict:'UNKNOWN',path:'project-brain/deep-profiles/pocket-pirate-release.json',sha:blob,activeFrom:checkpoint}];
for(const node of newNodes){graph.nodes=graph.nodes.filter(row=>row.id!==node.id);graph.nodes.push(node);}
for(const [from,to,type] of [['integration:pocketmonster-pirate-fruit','repo:pocketmonster','DEPENDS_ON'],['integration:pocketmonster-pirate-fruit','repo:pirate-fruit','DEPENDS_ON'],['integration:pocketmonster-pirate-fruit','evidence:pocket-pirate-release','DOCUMENTED_BY'],['version:project-brain-v068','version:project-brain-v058','SUPERSEDES']])if(!graph.edges.some(row=>row.from===from&&row.to===to&&row.type===type))graph.edges.push({from,to,type,activeFrom:checkpoint});
await put('project-brain/graph/project-brain.json',syncCatalogInventory(graph,await read('project-brain/catalog/repositories.json'),await read('project-brain/capability-inventory/repositories.json')));
for(const [file,oldValue,newValue] of [['project-brain/temporal.test.mjs',"['version:project-brain-v058']","['version:project-brain-v068']"],['project-brain/web-only.test.mjs',"graph.temporal.defaultCheckpoint,'pb-2026-09-25-graph-exploration-v058'","graph.temporal.defaultCheckpoint,'pb-2026-09-25-pocket-pirate-release-v068'"]]){const text=await readFile(file,'utf8');assert.ok(text.includes(oldValue)||text.includes(newValue));await put(file,text.replace(oldValue,newValue));}
let test=await readFile('project-brain/web-viewer.test.mjs','utf8');
test=test.replaceAll("row.state==='CANDIDATE_PAIR'","row.state==='MERGED_CODE'")
.replace("test('paired SAT remains candidate until merge'","test('merge evidence remains separate from runtime activation'")
.replaceAll("crossProjectIntegration.status,'CANDIDATE_PAIRED_SAT'","crossProjectIntegration.status,'MERGED_CODE'")
.replaceAll("crossProjectIntegration.pocket.draft,true","crossProjectIntegration.pocket.draft,false")
.replaceAll("crossProjectIntegration.pirate.draft,true","crossProjectIntegration.pirate.draft,false");
await put('project-brain/web-viewer.test.mjs',test);
let css=await readFile('brain/style.css','utf8');
if(!css.includes('/* Release Evidence V0.6.8 */'))css+='\n/* Release Evidence V0.6.8 */\n.release-evidence{font-size:.78rem;line-height:1.55}.release-evidence summary{cursor:pointer;overflow-wrap:anywhere}.release-evidence h3{font-size:.9rem}.release-evidence .state-sat{color:#76e2aa;border-color:#276b4d}.release-evidence .state-unknown{color:#f3cb75;border-color:#715b27}.cross-candidate-card .state-sat{color:#76e2aa;border-color:#276b4d}\n';
await put('brain/style.css',css);
let readme=await readFile('project-brain/README.md','utf8');
if(!readme.includes('## Release Evidence V0.6.8'))readme+='\n## Release Evidence V0.6.8\n\nPocket × Pirate now has a canonical integration node and a nine-message field map. The Release Evidence panel separates merged code, exact-head CI, behavioral/native artifact verification, Pages/Firebase deployment and the untested authenticated production host. Historical structural proof is retained with its original pins; no reuse verdict is promoted.\n';
await put('project-brain/README.md',readme);
console.log(JSON.stringify({status:release.status,repositories,proofs,fieldGroups:fields.length,checkpoint}));
await writeFile('project-brain/release-evidence.test.mjs',await readFile('project-brain/cross-project/release-evidence.test.template','utf8'));
