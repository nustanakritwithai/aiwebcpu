import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERDICT,aggregateVerdicts,SessionLedger,EvidenceStore,verifySuccessContract,
  SkillRegistry,ComputeRouter,PolicyGate,CandidateManager,proposeMemory,VerifiedAgentRuntime
} from './core.mjs';
import {projectActiveBranch,projectPiSession} from './pi-adapter.mjs';

test('VIP aggregation keeps UNKNOWN distinct from SAT',()=>{
  assert.equal(aggregateVerdicts([VERDICT.SAT,VERDICT.UNKNOWN]),VERDICT.UNKNOWN);
  assert.equal(aggregateVerdicts([VERDICT.SAT,VERDICT.VIOL]),VERDICT.VIOL);
  assert.equal(aggregateVerdicts([VERDICT.SAT,VERDICT.SAT]),VERDICT.SAT);
  assert.equal(aggregateVerdicts([]),VERDICT.UNKNOWN);
});

test('session ledger keeps parent-linked branch history',()=>{
  const ledger=new SessionLedger({now:()=> '2026-09-25T00:00:00.000Z'});
  const root=ledger.append({type:'message',parentId:null,data:{role:'user'}});
  const a=ledger.append({type:'message',data:{role:'assistant',candidate:'A'}});
  ledger.moveHead(root.id);
  const b=ledger.append({type:'message',data:{role:'assistant',candidate:'B'}});
  assert.deepEqual(ledger.getBranch(a.id).map(x=>x.id),[root.id,a.id]);
  assert.deepEqual(ledger.getBranch(b.id).map(x=>x.id),[root.id,b.id]);
});

test('contract verification requires evidence and fails closed',()=>{
  const store=new EvidenceStore();
  const sat=store.record({verdict:VERDICT.SAT});
  const unknown=store.record({verdict:VERDICT.UNKNOWN});
  const contract={id:'c1',goal:'prove',requirements:[
    {id:'r1',evidenceIds:[sat.id]},
    {id:'r2',evidenceIds:[unknown.id]}
  ]};
  const result=verifySuccessContract(contract,store);
  assert.equal(result.overall,VERDICT.UNKNOWN);
  assert.equal(result.unknownIsPass,false);
});

test('skill registry resolves metadata before lazy loading body',async()=>{
  let loads=0;
  const skills=new SkillRegistry();
  skills.register({name:'verify-typescript',triggers:{extensions:['.ts'],taskTypes:['verify']},risk:'low'},async()=>{loads++;return {instructions:'run tests'};});
  const decision=skills.resolve({extension:'.ts',taskType:'verify'});
  assert.equal(decision.classification,'MATCH');
  assert.equal(loads,0);
  const body=await skills.load(decision.selected.name);
  assert.equal(body.instructions,'run tests');
  assert.equal(loads,1);
  await skills.load(decision.selected.name);
  assert.equal(loads,1);
});

test('compute router prefers deterministic then local then frontier',()=>{
  const router=new ComputeRouter();
  assert.equal(router.route({deterministicAvailable:true,localAvailable:true,frontierAvailable:true}).tier,'DETERMINISTIC');
  assert.equal(router.route({deterministicAvailable:false,localAvailable:true,frontierAvailable:true}).tier,'LOCAL_MODEL');
  assert.equal(router.route({deterministicAvailable:false,localAvailable:true,frontierAvailable:true,novelty:'high'}).tier,'FRONTIER_MODEL');
});

test('policy gate fails closed for unknown and requires sandbox for writes',()=>{
  const gate=new PolicyGate({networkAllowlist:['example.com']});
  assert.equal(gate.authorize({kind:'read'}).allowed,true);
  assert.equal(gate.authorize({kind:'write'}).allowed,false);
  assert.equal(gate.authorize({kind:'write',sandbox:true}).allowed,true);
  assert.equal(gate.authorize({kind:'network',host:'example.com'}).allowed,true);
  assert.equal(gate.authorize({kind:'network',host:'evil.test'}).allowed,false);
  const unknown=gate.authorize({kind:'mystery'});
  assert.equal(unknown.allowed,false);
  assert.equal(unknown.verdict,VERDICT.UNKNOWN);
});

test('VRR creates candidate lineage only when result is not SAT',()=>{
  const ledger=new SessionLedger();
  ledger.append({type:'message',parentId:null,data:{role:'user'}});
  const manager=new CandidateManager({ledger});
  const a=manager.create();
  assert.equal(manager.recoverySet(a.id,VERDICT.SAT).length,0);
  const recovery=manager.recoverySet(a.id,VERDICT.VIOL);
  assert.equal(recovery.length,3);
  assert.deepEqual(recovery.map(x=>x.origin),['repair','alternative','new-approach']);
});

test('canonical memory proposal requires SAT plus provenance',()=>{
  assert.equal(proposeMemory({content:'x',verification:{overall:VERDICT.UNKNOWN},evidenceIds:['ev-1']}).status,'BLOCKED');
  assert.equal(proposeMemory({content:'x',verification:{overall:VERDICT.SAT},evidenceIds:[]}).status,'BLOCKED');
  const ok=proposeMemory({content:'x',verification:{overall:VERDICT.SAT},evidenceIds:['ev-1']});
  assert.equal(ok.status,'PROPOSED');
  assert.equal(ok.autoCommit,false);
});

test('Pi adapter reconstructs only active branch',()=>{
  const entries=[
    {type:'message',id:'a',parentId:null,timestamp:'t1'},
    {type:'message',id:'b',parentId:'a',timestamp:'t2'},
    {type:'message',id:'c',parentId:'a',timestamp:'t3'}
  ];
  assert.deepEqual(projectActiveBranch(entries,'c').map(x=>x.id),['a','c']);
  assert.deepEqual(projectPiSession(entries,{headId:'c',sessionId:'s1',projectId:'p1'}).map(x=>x.id),['a','c']);
});

test('verified runtime performs policy -> execution -> evidence -> VIP -> no VRR on SAT',async()=>{
  const skills=new SkillRegistry();
  skills.register({name:'health-check',triggers:{taskTypes:['health-check']}},async()=>({name:'health-check'}));
  const runtime=new VerifiedAgentRuntime({
    skills,
    executor:async()=>({verdict:VERDICT.SAT,resultState:'OK'}),
    now:()=> '2026-09-25T00:00:00.000Z'
  });
  const result=await runtime.run({
    projectId:'aiwebcpu',sessionId:'s1',task:'health check',
    contract:{id:'contract-health',goal:'verified health',requirements:[
      {id:'security',source:'security'},
      {id:'execution',source:'execution'}
    ]},
    skillContext:{taskType:'health-check'},
    computeRequest:{deterministicAvailable:true},
    action:{kind:'read'}
  });
  assert.equal(result.verification.overall,VERDICT.SAT);
  assert.equal(result.recoveryCandidates.length,0);
  assert.equal(result.skillDecision.selected.name,'health-check');
  assert.equal(result.computeDecision.tier,'DETERMINISTIC');
  assert.equal(result.evidence.length,2);
});

test('verified runtime creates VRR recovery set when policy blocks action',async()=>{
  const runtime=new VerifiedAgentRuntime({executor:async()=>({verdict:VERDICT.SAT})});
  const result=await runtime.run({
    task:'unsafe write',
    contract:{id:'c',goal:'safe change',requirements:[{id:'security',source:'security'},{id:'execution',source:'execution'}]},
    action:{kind:'write',sandbox:false}
  });
  assert.equal(result.policyDecision.allowed,false);
  assert.equal(result.verification.overall,VERDICT.VIOL);
  assert.equal(result.recoveryCandidates.length,3);
});
