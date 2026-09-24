import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const DEFAULT_CONFIG=new URL('./config.json',import.meta.url);
const DEFAULT_BASELINE=new URL('./baseline.json',import.meta.url);

const stableJson=value=>JSON.stringify(value,null,2)+'\n';

export async function readJson(pathOrUrl){
  return JSON.parse(await readFile(pathOrUrl,'utf8'));
}

export async function writeJson(path,value){
  await writeFile(path,stableJson(value),'utf8');
}

export function fnv1a(text){
  let h=2166136261>>>0;
  for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16).padStart(8,'0');
}

function authHeaders(token){
  return {
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'project-brain-scanner-v0.4',
    ...(token?{Authorization:`Bearer ${token}`}:{})
  };
}

export async function githubJson(url,{token=process.env.GITHUB_TOKEN||process.env.GH_TOKEN,allow404=false,allow409=false}={}){
  const response=await fetch(url,{headers:authHeaders(token)});
  if(allow404&&response.status===404)return null;
  if(allow409&&response.status===409)return null;
  if(!response.ok)throw new Error(`GitHub API ${response.status}: ${url}`);
  return response.json();
}

export async function collectRepository(entry,{token}={}){
  const base=`https://api.github.com/repos/${entry.repo}`;
  const trackHead=entry.trackHead!==false;
  const trackExactHeadWorkflow=entry.trackExactHeadWorkflow!==false;
  const commit=await githubJson(`${base}/commits/${encodeURIComponent(entry.branch)}`,{token,allow409:true});
  const empty=!commit;
  const head=commit?{
    sha:commit.sha,
    date:commit.commit?.committer?.date??commit.commit?.author?.date??null,
    message:commit.commit?.message??''
  }:{
    sha:null,
    date:null,
    message:''
  };

  const evidenceFiles=[];
  for(const path of entry.evidencePaths??[]){
    if(empty){
      evidenceFiles.push({path,sha:null,status:'missing'});
      continue;
    }
    const data=await githubJson(
      `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(head.sha)}`,
      {token,allow404:true}
    );
    evidenceFiles.push(data
      ? {path,sha:data.sha??null,status:'present'}
      : {path,sha:null,status:'missing'});
  }

  let exactHeadWorkflow;
  if(empty){
    exactHeadWorkflow={verdict:'UNKNOWN',reason:'empty-repository'};
  }else if(!trackExactHeadWorkflow){
    exactHeadWorkflow={verdict:'UNKNOWN',reason:'exact-head-workflow-tracking-disabled-by-config'};
  }else{
    const runs=await githubJson(
      `${base}/actions/runs?branch=${encodeURIComponent(entry.branch)}&status=completed&per_page=30`,
      {token}
    );
    const exact=(runs.workflow_runs??[]).find(run=>run.head_sha===head.sha)??null;
    if(!exact){
      exactHeadWorkflow={verdict:'UNKNOWN',reason:'no-completed-workflow-run-for-head'};
    }else{
      exactHeadWorkflow={
        verdict:exact.conclusion==='success'?'SAT':'VIOL',
        conclusion:exact.conclusion,
        name:exact.name,
        runId:exact.id,
        url:exact.html_url
      };
    }
  }

  return {
    id:entry.id,
    repo:entry.repo,
    branch:entry.branch,
    empty,
    trackHead,
    trackExactHeadWorkflow,
    head,
    exactHeadWorkflow,
    evidenceFiles
  };
}

export async function collectLive(config,{token}={}){
  const repositories={};
  for(const entry of config.repositories??[]){
    repositories[entry.id]=await collectRepository(entry,{token});
  }
  return {schemaVersion:'0.1',repositories};
}

function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}

function candidateId(parts){return 'scan:'+fnv1a(parts.join('|'))}

export function compareStates(baseline,latest){
  const candidates=[];
  const ids=new Set([
    ...Object.keys(baseline.repositories??{}),
    ...Object.keys(latest.repositories??{})
  ]);

  for(const id of [...ids].sort()){
    const before=baseline.repositories?.[id]??null;
    const after=latest.repositories?.[id]??null;

    if(!before&&after){
      candidates.push({
        id:candidateId([id,'REPOSITORY_ADDED',after.head?.sha]),
        repoId:id,repo:after.repo,kind:'REPOSITORY_ADDED',
        verdict:'UNKNOWN',after,
        reason:'Repository entered scanner scope; capability meaning requires verification.'
      });
      continue;
    }
    if(before&&!after){
      candidates.push({
        id:candidateId([id,'REPOSITORY_MISSING',before.head?.sha]),
        repoId:id,repo:before.repo,kind:'REPOSITORY_MISSING',
        verdict:'UNKNOWN',before,
        reason:'Repository disappeared from latest scanner state; do not infer deletion without verification.'
      });
      continue;
    }
    if(!before||!after)continue;

    if(after.trackHead!==false&&before.head?.sha!==after.head?.sha){
      candidates.push({
        id:candidateId([id,'HEAD_CHANGED',before.head?.sha,after.head?.sha]),
        repoId:id,repo:after.repo,kind:'HEAD_CHANGED',verdict:'UNKNOWN',
        before:before.head,after:after.head,
        exactHeadWorkflow:after.exactHeadWorkflow,
        reason:'Repository HEAD changed. Commit meaning is not promoted to capability knowledge automatically.'
      });
    }

    if(after.trackExactHeadWorkflow!==false&&!same(before.exactHeadWorkflow,after.exactHeadWorkflow)){
      candidates.push({
        id:candidateId([id,'CI_CHANGED',after.head?.sha,after.exactHeadWorkflow?.verdict,after.exactHeadWorkflow?.runId]),
        repoId:id,repo:after.repo,kind:'CI_CHANGED',verdict:'UNKNOWN',
        before:before.exactHeadWorkflow,after:after.exactHeadWorkflow,
        mechanicalEvidence:after.exactHeadWorkflow?.verdict??'UNKNOWN',
        reason:'Exact-head workflow evidence changed. This verifies CI state only, not project capability semantics.'
      });
    }

    const beforeFiles=new Map((before.evidenceFiles??[]).map(x=>[x.path,x]));
    const afterFiles=new Map((after.evidenceFiles??[]).map(x=>[x.path,x]));
    const paths=new Set([...beforeFiles.keys(),...afterFiles.keys()]);
    for(const path of [...paths].sort()){
      const oldFile=beforeFiles.get(path)??null;
      const newFile=afterFiles.get(path)??null;
      if(!same(oldFile,newFile)){
        candidates.push({
          id:candidateId([id,'EVIDENCE_FILE_CHANGED',path,oldFile?.sha,newFile?.sha,newFile?.status]),
          repoId:id,repo:after.repo,kind:'EVIDENCE_FILE_CHANGED',path,
          verdict:'UNKNOWN',before:oldFile,after:newFile,
          reason:'Tracked evidence file fingerprint changed. Semantic implications require verification.'
        });
      }
    }
  }
  return candidates;
}

export function buildCandidateReport(config,baseline,latest){
  const candidates=compareStates(baseline,latest);
  const changedRepos=[...new Set(candidates.map(x=>x.repoId))];
  return {
    schemaVersion:'0.1',
    policy:{
      autoGraphWrites:false,
      autoMerge:false,
      candidateVerdict:'UNKNOWN',
      requireVerification:true,
      ...(config.policy??{})
    },
    summary:{
      monitoredRepositories:config.repositories?.length??0,
      changedRepositories:changedRepos.length,
      candidates:candidates.length,
      mechanicalSAT:candidates.filter(x=>x.mechanicalEvidence==='SAT').length,
      mechanicalVIOL:candidates.filter(x=>x.mechanicalEvidence==='VIOL').length,
      semanticVerdict:'UNKNOWN'
    },
    changedRepositories:changedRepos,
    candidates
  };
}

export function reportMarkdown(report){
  const lines=[
    '# Project Brain Scanner Candidate Report',
    '',
    `Monitored repositories: **${report.summary.monitoredRepositories}**  `,
    `Changed repositories: **${report.summary.changedRepositories}**  `,
    `Candidates: **${report.summary.candidates}**  `,
    '',
    '> Scanner output is mechanical evidence. Capability meaning remains UNKNOWN until verified.',
    ''
  ];
  if(!report.candidates.length){
    lines.push('No repository changes detected against the accepted baseline.','');
    return lines.join('\n');
  }
  for(const item of report.candidates){
    lines.push(
      `## ${item.repo} — ${item.kind}`,
      '',
      `- Candidate: \`${item.id}\``,
      `- Verdict: **${item.verdict}**`,
      ...(item.path?[`- Path: \`${item.path}\``]:[]),
      ...(item.mechanicalEvidence?[`- Mechanical evidence: **${item.mechanicalEvidence}**`]:[]),
      `- Reason: ${item.reason}`,
      ''
    );
    if(item.kind==='HEAD_CHANGED'){
      lines.push(
        `- Before: \`${item.before?.sha??'—'}\``,
        `- After: \`${item.after?.sha??'—'}\``,
        `- Commit: ${String(item.after?.message??'').split('\n')[0]}`,
        ''
      );
    }
  }
  lines.push('## Acceptance rule','','Merge accepts scanner state only after evidence review. Canonical graph capability claims require a separate verified update.','');
  return lines.join('\n');
}

function parseArgs(argv){
  const [command='scan',...rest]=argv;
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
  if(args.command==='promote'){
    const latest=await readJson(args.latest);
    await writeJson(args.baseline??fileURLToPath(DEFAULT_BASELINE),latest);
    console.log(JSON.stringify({promoted:true,repositories:Object.keys(latest.repositories??{}).length}));
    return;
  }

  if(args.command!=='scan')throw new Error('Unknown scanner command: '+args.command);
  const config=await readJson(args.config??DEFAULT_CONFIG);
  const baseline=await readJson(args.baseline??DEFAULT_BASELINE);
  const latest=args.fixture
    ? await readJson(args.fixture)
    : await collectLive(config);
  const report=buildCandidateReport(config,baseline,latest);

  if(args.out)await writeJson(args.out,latest);
  if(args.candidates)await writeJson(args.candidates,report);
  if(args.report)await writeFile(args.report,reportMarkdown(report),'utf8');

  console.log(JSON.stringify(report.summary));
}

const isCli=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isCli)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
