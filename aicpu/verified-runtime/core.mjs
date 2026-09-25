export const VERDICT = Object.freeze({SAT:'SAT',VIOL:'VIOL',UNKNOWN:'UNKNOWN'});

export function aggregateVerdicts(values=[]){
  const list=values.filter(Boolean);
  if(!list.length)return VERDICT.UNKNOWN;
  if(list.includes(VERDICT.VIOL))return VERDICT.VIOL;
  if(list.includes(VERDICT.UNKNOWN))return VERDICT.UNKNOWN;
  return list.every(x=>x===VERDICT.SAT)?VERDICT.SAT:VERDICT.UNKNOWN;
}

export class SessionLedger{
  constructor({sessionId='session-1',projectId='unknown-project',now=()=>new Date().toISOString()}={}){
    this.sessionId=sessionId;
    this.projectId=projectId;
    this.now=now;
    this.entries=[];
    this.headId=null;
    this.sequence=0;
  }
  append({type,parentId=this.headId,customType=null,data=null,contextVisible=true}){
    if(!type)throw new Error('session entry type is required');
    if(parentId!==null&&!this.entries.some(x=>x.id===parentId))throw new Error('unknown parentId: '+parentId);
    const id=`e-${String(++this.sequence).padStart(4,'0')}`;
    const entry={type,id,parentId,timestamp:this.now(),sessionId:this.sessionId,projectId:this.projectId,contextVisible};
    if(customType)entry.customType=customType;
    if(data!==null)entry.data=data;
    this.entries.push(entry);
    this.headId=id;
    return entry;
  }
  getBranch(headId=this.headId){
    if(headId===null)return [];
    const byId=new Map(this.entries.map(x=>[x.id,x]));
    const branch=[];
    const seen=new Set();
    let current=byId.get(headId);
    if(!current)throw new Error('unknown headId: '+headId);
    while(current){
      if(seen.has(current.id))throw new Error('session cycle detected');
      seen.add(current.id);
      branch.push(current);
      current=current.parentId===null?null:byId.get(current.parentId);
    }
    return branch.reverse();
  }
  moveHead(headId){
    if(!this.entries.some(x=>x.id===headId))throw new Error('unknown headId: '+headId);
    this.headId=headId;
  }
}

export class EvidenceStore{
  constructor(){this.rows=new Map();this.sequence=0;}
  record({kind='generic',source='runtime',verdict=VERDICT.UNKNOWN,data=null,provenance=null}={}){
    if(!Object.values(VERDICT).includes(verdict))verdict=VERDICT.UNKNOWN;
    const id=`ev-${String(++this.sequence).padStart(4,'0')}`;
    const row={id,kind,source,verdict,data,provenance};
    this.rows.set(id,row);
    return row;
  }
  get(id){return this.rows.get(id)??null;}
  many(ids=[]){return ids.map(id=>this.get(id)).filter(Boolean);}
}

export function verifyRequirement(requirement,evidenceStore){
  const ids=requirement.evidenceIds??[];
  const evidence=evidenceStore.many(ids);
  if(!ids.length||evidence.length!==ids.length){
    return {id:requirement.id,required:requirement.required!==false,verdict:VERDICT.UNKNOWN,evidenceIds:ids,reason:'Required evidence is missing.'};
  }
  const verdict=aggregateVerdicts(evidence.map(x=>x.verdict));
  return {
    id:requirement.id,
    required:requirement.required!==false,
    verdict,
    evidenceIds:ids,
    reason:verdict===VERDICT.SAT?'All attached evidence is SAT.':verdict===VERDICT.VIOL?'At least one attached evidence item is VIOL.':'Evidence is incomplete or UNKNOWN.'
  };
}

export function verifySuccessContract(contract,evidenceStore){
  const requirements=(contract.requirements??[]).map(req=>verifyRequirement(req,evidenceStore));
  const required=requirements.filter(x=>x.required!==false);
  return {
    contractId:contract.id,
    goal:contract.goal,
    overall:aggregateVerdicts(required.map(x=>x.verdict)),
    requirements,
    unknownIsPass:false
  };
}

function normalize(value){return String(value??'').trim().toLowerCase();}

export class SkillRegistry{
  constructor(){this.skills=new Map();}
  register(descriptor,loader){
    if(!descriptor?.name)throw new Error('skill name is required');
    if(typeof loader!=='function')throw new Error('skill loader must be a function');
    this.skills.set(descriptor.name,{descriptor:{...descriptor},loader,loaded:null});
  }
  list(){return [...this.skills.values()].map(x=>({...x.descriptor}));}
  resolve(context={}){
    const keywords=(context.keywords??[]).map(normalize);
    const taskType=normalize(context.taskType);
    const extension=normalize(context.extension);
    const ranked=this.list().map(skill=>{
      let score=0;
      const reasons=[];
      const triggers=skill.triggers??{};
      if(taskType&&(triggers.taskTypes??[]).map(normalize).includes(taskType)){score+=10;reasons.push('taskType');}
      if(extension&&(triggers.extensions??[]).map(normalize).includes(extension)){score+=8;reasons.push('extension');}
      for(const kw of (triggers.keywords??[]).map(normalize)){
        if(kw&&keywords.some(x=>x.includes(kw)||kw.includes(x))){score+=2;reasons.push('keyword:'+kw);}
      }
      return {name:skill.name,score,reasons,risk:skill.risk??'unknown'};
    }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
    const top=ranked[0]??null;
    const tied=top&&ranked[1]&&top.score===ranked[1].score&&top.score>0;
    return {selected:top&&top.score>0&&!tied?top:null,classification:tied?'CONFLICT':top&&top.score>0?'MATCH':'NO_MATCH',ranked};
  }
  async load(name){
    const row=this.skills.get(name);
    if(!row)throw new Error('unknown skill: '+name);
    if(row.loaded===null)row.loaded=await row.loader();
    return row.loaded;
  }
}

export class ComputeRouter{
  route(request={}){
    const novelty=request.novelty??'low';
    if(request.deterministicAvailable&&novelty!=='high')return {tier:'DETERMINISTIC',reason:'deterministic path available'};
    if(request.localAvailable&&request.risk!=='critical'&&novelty!=='high')return {tier:'LOCAL_MODEL',reason:'local model sufficient for bounded task'};
    if(request.frontierAvailable)return {tier:'FRONTIER_MODEL',reason:'escalated for novelty/risk/uncertainty'};
    return {tier:'UNKNOWN',reason:'no eligible compute tier available'};
  }
}

export class PolicyGate{
  constructor({networkAllowlist=[]}={}){this.networkAllowlist=new Set(networkAllowlist);}
  authorize(action={}){
    const kind=action.kind??'unknown';
    if(['read','inspect','test','verify'].includes(kind))return {allowed:true,verdict:VERDICT.SAT,reason:'read/verification action'};
    if(kind==='write'){
      return action.sandbox===true
        ?{allowed:true,verdict:VERDICT.SAT,reason:'write allowed in sandbox'}
        :{allowed:false,verdict:VERDICT.VIOL,reason:'write requires sandbox'};
    }
    if(kind==='network'){
      const host=action.host??'';
      return this.networkAllowlist.has(host)
        ?{allowed:true,verdict:VERDICT.SAT,reason:'network host is allowlisted'}
        :{allowed:false,verdict:VERDICT.VIOL,reason:'network host is not allowlisted'};
    }
    if(['destructive','secret'].includes(kind))return {allowed:false,verdict:VERDICT.VIOL,reason:'high-risk action denied by default'};
    return {allowed:false,verdict:VERDICT.UNKNOWN,reason:'unknown action class fails closed'};
  }
}

export class CandidateManager{
  constructor({ledger}={}){this.ledger=ledger??new SessionLedger();this.candidates=new Map();this.sequence=0;}
  create({parentCandidateId=null,origin='initial',strategy='baseline',data={}}={}){
    const id=`cand-${String(++this.sequence).padStart(3,'0')}`;
    const parent=this.candidates.get(parentCandidateId);
    const parentEntryId=parent?.entryId??this.ledger.headId;
    const entry=this.ledger.append({type:'custom',parentId:parentEntryId,customType:'jev.vrr.candidate',data:{candidateId:id,parentCandidateId,origin,strategy,...data},contextVisible:false});
    const row={id,parentCandidateId,origin,strategy,entryId:entry.id,data};
    this.candidates.set(id,row);
    return row;
  }
  recoverySet(candidateId,verdict){
    if(verdict===VERDICT.SAT)return [];
    return [
      this.create({parentCandidateId:candidateId,origin:'repair',strategy:'repair-current'}),
      this.create({parentCandidateId:candidateId,origin:'alternative',strategy:'alternate-approach'}),
      this.create({parentCandidateId:null,origin:'new-approach',strategy:'fresh-start'})
    ];
  }
}

export function proposeMemory({scope='project',kind='experience',content,verification,evidenceIds=[]}={}){
  if(!content)return {status:'BLOCKED',reason:'memory content is required'};
  if(verification?.overall!==VERDICT.SAT)return {status:'BLOCKED',reason:'canonical memory requires SAT verification'};
  if(!evidenceIds.length)return {status:'BLOCKED',reason:'canonical memory requires evidence provenance'};
  return {status:'PROPOSED',autoCommit:false,scope,kind,content,evidenceIds:[...evidenceIds]};
}

export class VerifiedAgentRuntime{
  constructor({skills=new SkillRegistry(),compute=new ComputeRouter(),policy=new PolicyGate(),executor=async()=>({verdict:VERDICT.UNKNOWN}),now}={}){
    this.skills=skills;
    this.compute=compute;
    this.policy=policy;
    this.executor=executor;
    this.now=now;
  }
  async run({projectId='project',sessionId='session',task,contract,skillContext={},computeRequest={},action={kind:'inspect'}}){
    const ledger=new SessionLedger({projectId,sessionId,now:this.now});
    const evidence=new EvidenceStore();
    ledger.append({type:'message',parentId:null,data:{role:'user',content:task}});
    const candidates=new CandidateManager({ledger});
    const candidate=candidates.create({origin:'initial',strategy:'baseline'});

    const skillDecision=this.skills.resolve(skillContext);
    let loadedSkill=null;
    if(skillDecision.selected)loadedSkill=await this.skills.load(skillDecision.selected.name);

    const computeDecision=this.compute.route(computeRequest);
    ledger.append({type:'custom',customType:'jev.compute.route',data:computeDecision,contextVisible:false});

    const policyDecision=this.policy.authorize(action);
    const securityEvidence=evidence.record({kind:'security',source:'policy-gate',verdict:policyDecision.verdict,data:policyDecision});
    ledger.append({type:'custom',customType:'jev.security.decision',data:{...policyDecision,evidenceId:securityEvidence.id},contextVisible:false});

    let execution=null;
    let executionEvidence=null;
    if(policyDecision.allowed){
      execution=await this.executor({task,action,skill:loadedSkill,compute:computeDecision});
      executionEvidence=evidence.record({kind:'execution',source:'executor',verdict:execution?.verdict??VERDICT.UNKNOWN,data:execution});
      ledger.append({type:'custom',customType:'jev.execution.result',data:{...execution,evidenceId:executionEvidence.id},contextVisible:false});
    }

    const boundContract={...contract,requirements:(contract.requirements??[]).map(req=>{
      if(req.source==='security')return {...req,evidenceIds:[securityEvidence.id]};
      if(req.source==='execution')return {...req,evidenceIds:executionEvidence?[executionEvidence.id]:[]};
      return req;
    })};
    const verification=verifySuccessContract(boundContract,evidence);
    ledger.append({type:'custom',customType:'jev.vip.verdict',data:verification,contextVisible:false});

    const recoveryCandidates=candidates.recoverySet(candidate.id,verification.overall);
    return {
      schemaVersion:'0.1',
      task,
      sessionId,
      projectId,
      skillDecision,
      computeDecision,
      policyDecision,
      execution,
      verification,
      candidate,
      recoveryCandidates,
      activeBranch:ledger.getBranch(),
      sessionEntries:ledger.entries,
      evidence:[...evidence.rows.values()]
    };
  }
}
