import {VERDICT,SkillRegistry,PolicyGate,VerifiedAgentRuntime} from './core.mjs';

const skills=new SkillRegistry();
skills.register(
  {name:'web-health-check',risk:'low',triggers:{taskTypes:['health-check'],keywords:['http','website']}},
  async()=>({name:'web-health-check',mode:'deterministic'})
);

const runtime=new VerifiedAgentRuntime({
  skills,
  policy:new PolicyGate({networkAllowlist:['example.com']}),
  executor:async({action})=>({
    verdict:VERDICT.SAT,
    simulated:true,
    target:action.host??null,
    resultState:'WEB_ONLINE'
  })
});

const result=await runtime.run({
  projectId:'aiwebcpu',
  sessionId:'demo-verified-runtime',
  task:'Check example.com health',
  contract:{
    id:'demo-web-health',
    goal:'Website health is verified',
    requirements:[
      {id:'security-authorized',source:'security'},
      {id:'execution-result',source:'execution'}
    ]
  },
  skillContext:{taskType:'health-check',keywords:['http','website']},
  computeRequest:{deterministicAvailable:true,localAvailable:true,frontierAvailable:true},
  action:{kind:'network',host:'example.com'}
});

console.log(JSON.stringify({
  skill:result.skillDecision.selected?.name??null,
  compute:result.computeDecision.tier,
  policy:result.policyDecision.verdict,
  verification:result.verification.overall,
  recoveryCandidates:result.recoveryCandidates.length
},null,2));
