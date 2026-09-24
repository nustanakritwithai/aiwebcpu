import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const INVENTORY_URL=new URL('../capability-inventory/repositories.json',import.meta.url);
const CATALOG_URL=new URL('../catalog/repositories.json',import.meta.url);

export async function readJson(pathOrUrl){
  return JSON.parse(await readFile(pathOrUrl,'utf8'));
}

export function capabilityKey(repoId,label){
  return repoId+'::'+String(label).trim().toLowerCase();
}

export function indexInventory(inventory){
  const map=new Map();
  for(const repo of inventory.repositories??[]){
    for(const capability of repo.capabilities??[]){
      map.set(capabilityKey(repo.repoId,capability.label),{repo,capability});
    }
  }
  return map;
}

export function indexCatalog(catalog){
  return new Map((catalog.repositories??[]).map(row=>[row.id,row]));
}

function verdictOf(checks){
  if(checks.some(x=>x.required!==false&&x.verdict==='VIOL'))return 'VIOL';
  if(checks.some(x=>x.required!==false&&x.verdict==='UNKNOWN'))return 'UNKNOWN';
  return 'SAT';
}

function evidenceFreshnessChecks(capability,catalogRow){
  const current=new Map((catalogRow?.evidenceFiles??[]).map(x=>[x.path,x]));
  return (capability.evidence??[]).map(ev=>{
    const row=current.get(ev.path);
    if(!row){
      return {
        type:'EVIDENCE_CURRENT',
        path:ev.path,
        required:true,
        verdict:'UNKNOWN',
        reason:'Evidence path is not tracked in the current repository catalog.'
      };
    }
    if(row.status!=='present'){
      return {
        type:'EVIDENCE_CURRENT',
        path:ev.path,
        required:true,
        verdict:'VIOL',
        reason:'Evidence path is currently missing.'
      };
    }
    if(row.sha!==ev.sha){
      return {
        type:'EVIDENCE_CURRENT',
        path:ev.path,
        required:true,
        verdict:'VIOL',
        expectedSha:ev.sha,
        currentSha:row.sha,
        reason:'Inventory evidence SHA is stale relative to the accepted catalog.'
      };
    }
    return {
      type:'EVIDENCE_CURRENT',
      path:ev.path,
      required:true,
      verdict:'SAT',
      sha:row.sha,
      reason:'Inventory evidence SHA matches the accepted catalog.'
    };
  });
}

function repoCiCheck(catalogRow,policy='ignore'){
  const ci=catalogRow?.exactHeadWorkflow??{verdict:'UNKNOWN',reason:'missing-catalog-ci'};
  if(policy==='ignore'){
    return {
      type:'REPO_EXACT_HEAD_CI',
      required:false,
      verdict:ci.verdict??'UNKNOWN',
      reason:'CI is contextual repository-health evidence only for this contract.',
      evidence:ci
    };
  }
  if(policy==='prefer'){
    return {
      type:'REPO_EXACT_HEAD_CI',
      required:false,
      verdict:ci.verdict??'UNKNOWN',
      reason:'CI is preferred context but not required for capability verdict.',
      evidence:ci
    };
  }
  return {
    type:'REPO_EXACT_HEAD_CI',
    required:true,
    verdict:ci.verdict??'UNKNOWN',
    reason:ci.verdict==='SAT'
      ? 'Contract requires exact-head CI and the accepted catalog records SAT.'
      : ci.verdict==='VIOL'
        ? 'Contract requires exact-head CI and the accepted catalog records VIOL.'
        : 'Contract requires exact-head CI but no qualifying completed run is known.',
    evidence:ci
  };
}

function explicitChecks(contract,candidate){
  return (candidate.checks??[]).map((check,index)=>{
    if(!['SAT','VIOL','UNKNOWN'].includes(check.verdict)){
      return {
        id:check.id??'check-'+(index+1),
        type:'EXPLICIT_COMPATIBILITY',
        required:check.required!==false,
        verdict:'UNKNOWN',
        reason:'Invalid or missing explicit verdict; fail closed to UNKNOWN.'
      };
    }
    return {
      id:check.id??'check-'+(index+1),
      type:'EXPLICIT_COMPATIBILITY',
      required:check.required!==false,
      verdict:check.verdict,
      reason:check.reason??'No reason supplied.',
      evidence:check.evidence??[]
    };
  });
}

function decisionFor(candidate,verdict){
  if(verdict!=='SAT')return 'UNKNOWN';
  const requested=candidate.decision;
  if(!['REUSE','ADAPT','BUILD'].includes(requested))return 'UNKNOWN';
  if(requested==='REUSE'&&(candidate.adaptations??[]).length){
    return 'UNKNOWN';
  }
  return requested;
}

export function verifyCandidate(contract,candidate,inventory,catalog){
  const inv=indexInventory(inventory);
  const cat=indexCatalog(catalog);
  const found=inv.get(capabilityKey(candidate.repoId,candidate.capability));

  if(!found){
    return {
      id:candidate.id,
      repoId:candidate.repoId,
      capability:candidate.capability,
      verdict:'UNKNOWN',
      decision:'UNKNOWN',
      checks:[{
        type:'CAPABILITY_DOCUMENTED',
        required:true,
        verdict:'UNKNOWN',
        reason:'Capability was not found in the documented capability inventory.'
      }],
      adaptations:candidate.adaptations??[]
    };
  }

  const catalogRow=cat.get(candidate.repoId);
  const checks=[
    {
      type:'CAPABILITY_DOCUMENTED',
      required:true,
      verdict:found.capability.status==='DOCUMENTED'?'SAT':'UNKNOWN',
      reason:found.capability.status==='DOCUMENTED'
        ? 'Capability statement is backed by repository evidence in the inventory.'
        : 'Capability statement is not DOCUMENTED.'
    },
    ...evidenceFreshnessChecks(found.capability,catalogRow),
    repoCiCheck(catalogRow,candidate.ciPolicy??contract.defaults?.ciPolicy??'ignore'),
    ...explicitChecks(contract,candidate)
  ];

  for(const limitation of found.repo.limitations??[]){
    checks.push({
      type:'REPOSITORY_LIMITATION',
      required:false,
      verdict:'UNKNOWN',
      reason:limitation
    });
  }

  const verdict=verdictOf(checks);
  return {
    id:candidate.id,
    repoId:candidate.repoId,
    repo:found.repo.repo,
    capability:found.capability.label,
    verdict,
    decision:decisionFor(candidate,verdict),
    checks,
    adaptations:candidate.adaptations??[],
    sourceEvidence:found.capability.evidence??[]
  };
}

export function verifyContract(contract,inventory,catalog){
  const results=(contract.candidates??[]).map(candidate=>
    verifyCandidate(contract,candidate,inventory,catalog)
  );
  const requiredIds=new Set(contract.requiredCandidates??[]);
  const required=results.filter(x=>requiredIds.size===0||requiredIds.has(x.id));
  const overall=verdictOf(required.map(x=>({
    required:true,
    verdict:x.verdict
  })));

  const decisions=results.map(x=>x.decision).filter(x=>x!=='UNKNOWN');
  let recommendation='UNKNOWN';
  if(overall==='SAT'){
    if(decisions.includes('ADAPT'))recommendation='ADAPT';
    else if(decisions.length&&decisions.every(x=>x==='REUSE'))recommendation='REUSE';
    else if(decisions.length&&decisions.every(x=>x==='BUILD'))recommendation='BUILD';
  }

  return {
    schemaVersion:'0.1',
    contractId:contract.id,
    goal:contract.goal,
    verifiedAtKnowledgeState:{
      inventoryCapturedAt:inventory.capturedAt??null,
      catalogCapturedAt:catalog.capturedAt??null
    },
    overallVerdict:overall,
    recommendation,
    policy:{
      unknownIsPass:false,
      documentedIsVerified:false,
      ciIsSemanticProof:false,
      autoGraphWrite:false,
      autoMerge:false
    },
    results,
    unresolved:results
      .filter(x=>x.verdict!=='SAT'||x.decision==='UNKNOWN')
      .map(x=>({id:x.id,verdict:x.verdict,decision:x.decision}))
  };
}

export function buildGraphPatchCandidate(contract,report){
  if(report.overallVerdict!=='SAT'||report.recommendation==='UNKNOWN'){
    return {
      schemaVersion:'0.1',
      contractId:contract.id,
      status:'BLOCKED',
      reason:'Graph patch requires overall SAT and a resolved REUSE/ADAPT/BUILD recommendation.',
      operations:[]
    };
  }

  return {
    schemaVersion:'0.1',
    contractId:contract.id,
    status:'CANDIDATE',
    autoApply:false,
    requiresReview:true,
    recommendation:report.recommendation,
    operations:[
      {
        operation:'UPSERT_VERIFICATION_REPORT',
        goalId:contract.goalId??null,
        verdict:report.overallVerdict,
        recommendation:report.recommendation,
        source:'project-brain/verifier/reports/'+contract.id+'.json'
      }
    ]
  };
}

export function reportMarkdown(contract,report,patch){
  const lines=[
    '# Project Brain Verification Report',
    '',
    `Contract: \`${contract.id}\``,
    `Goal: **${contract.goal}**`,
    `Overall: **${report.overallVerdict}**`,
    `Recommendation: **${report.recommendation}**`,
    '',
    '> DOCUMENTED is not VERIFIED. UNKNOWN is never PASS. CI is not semantic proof by itself.',
    ''
  ];

  for(const row of report.results){
    lines.push(
      `## ${row.repo??row.repoId} — ${row.capability}`,
      '',
      `- Verdict: **${row.verdict}**`,
      `- Decision: **${row.decision}**`,
      ...(row.adaptations?.length?[`- Adaptations: ${row.adaptations.join('; ')}`]:[]),
      '',
      ...row.checks.map(check=>
        `- [${check.verdict}] ${check.type}: ${check.reason}`
      ),
      ''
    );
  }

  lines.push(
    '## Graph Patch',
    '',
    `Status: **${patch.status}**`,
    '',
    patch.status==='CANDIDATE'
      ? 'Patch is a review candidate only. It is never auto-applied or auto-merged.'
      : `Blocked: ${patch.reason}`,
    ''
  );
  return lines.join('\n');
}

function parseArgs(argv){
  const [command='verify',...rest]=argv;
  const args={command};
  for(let i=0;i<rest.length;i++){
    const token=rest[i];
    if(!token.startsWith('--'))continue;
    const key=token.slice(2);
    const value=rest[i+1]&&!rest[i+1].startsWith('--')?rest[++i]:true;
    args[key]=value;
  }
  return args;
}

async function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv);
  if(args.command!=='verify')throw new Error('Unknown verifier command: '+args.command);
  if(!args.contract)throw new Error('--contract is required');

  const contract=await readJson(args.contract);
  const inventory=await readJson(args.inventory??INVENTORY_URL);
  const catalog=await readJson(args.catalog??CATALOG_URL);
  const report=verifyContract(contract,inventory,catalog);
  const patch=buildGraphPatchCandidate(contract,report);

  if(args.out)await writeFile(args.out,JSON.stringify(report,null,2)+'\n','utf8');
  if(args.patch)await writeFile(args.patch,JSON.stringify(patch,null,2)+'\n','utf8');
  if(args.report)await writeFile(args.report,reportMarkdown(contract,report,patch),'utf8');

  console.log(JSON.stringify({
    contractId:report.contractId,
    overallVerdict:report.overallVerdict,
    recommendation:report.recommendation,
    unresolved:report.unresolved.length
  }));
}

const isCli=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isCli)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
