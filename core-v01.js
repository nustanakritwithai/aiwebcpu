(() => {
  'use strict';

  const VERSION = '0.1.0';
  const MATCH = Object.freeze({
    STRONG: 'STRONG_MATCH',
    WEAK: 'WEAK_MATCH',
    NONE: 'NO_MATCH',
    CONFLICT: 'SKILL_CONFLICT'
  });

  const STATUS = Object.freeze({
    IDLE: 'IDLE', PARSED: 'PARSED', PARSE_FAIL: 'PARSE_FAIL', MATCHING: 'MATCHING',
    STRONG_MATCH: 'STRONG_MATCH', WEAK_MATCH: 'WEAK_MATCH', NO_MATCH: 'NO_MATCH',
    SKILL_CONFLICT: 'SKILL_CONFLICT', RUNNING: 'RUNNING', VERIFYING: 'VERIFYING',
    DONE: 'DONE', FAIL: 'FAIL', AGENT_NEEDED: 'AGENT_NEEDED'
  });

  const baseSkills = [
    {id:'AUTH_RECOVERY',name:'กู้คืนการยืนยันตัวตน',version:'0.1',keywords:['ล็อกอิน','login','401','token','โทเคน','auth','session'],states:['AUTH_ERROR'],goals:['LOGIN_OK'],steps:['ตรวจโทเคน','รีเฟรชโทเคนถ้าหมดอายุ','ลองล็อกอินใหม่'],tools:['TOKEN_CHECK','AUTH_REFRESH','HTTP_RETRY'],verify:'HTTP_200'},
    {id:'API_RETRY',name:'ลองเชื่อมต่อ API ใหม่',version:'0.1',keywords:['api','timeout','503','retry','request','เชื่อมต่อ','เซิร์ฟเวอร์ไม่ตอบ'],states:['API_ERROR'],goals:['API_OK'],steps:['ตรวจ HTTP status','รอ backoff','ลอง request ใหม่','ตรวจผลตอบกลับ'],tools:['HTTP_CLIENT','TIMER'],verify:'HTTP_200'},
    {id:'BUILD_REPAIR',name:'ซ่อม Build / Dependency',version:'0.1',keywords:['build','dependency','compile','package','npm','ติดตั้งแพ็กเกจ','version conflict'],states:['BUILD_ERROR'],goals:['BUILD_PASS'],steps:['อ่าน build error','ตรวจ dependency','ปรับ config/version','รัน build ใหม่'],tools:['FILE_READ','PACKAGE_CHECK','SHELL_BUILD'],verify:'BUILD_PASS'},
    {id:'CHECK_WEBSITE',name:'ตรวจสถานะเว็บไซต์',version:'0.1',keywords:['เว็บ','website','หน้าเว็บ','http','status','ตรวจเว็บ','response time'],states:['WEB_CHECK'],goals:['WEBSITE_OK'],steps:['ส่ง HTTP request','ตรวจ status code','ตรวจ response time','สรุปสถานะ'],tools:['HTTP_CLIENT'],verify:'HTTP_200'},
    {id:'FILE_CONVERT',name:'แปลงไฟล์ / Encoding',version:'0.1',keywords:['ไฟล์','file','csv','encoding','utf-8','convert','แปลงไฟล์','import'],states:['FILE_ERROR'],goals:['FILE_OK'],steps:['ตรวจประเภทไฟล์','ตรวจ encoding','แปลงเป็นรูปแบบเป้าหมาย','ตรวจไฟล์ผลลัพธ์'],tools:['FILE_READ','FILE_CONVERT'],verify:'FILE_OK'}
  ];

  const samples = {
    auth:`สถานะ: ล็อกอินผิดพลาด\nอาการ: HTTP_401 token หมดอายุ\nเป้าหมาย: ล็อกอินสำเร็จ\n\nใช้สกิล: กู้คืนการยืนยันตัวตน\n\nทำงาน:\n- ตรวจโทเคน\n- รีเฟรชโทเคนถ้าหมดอายุ\n- ลองล็อกอินใหม่\n\nตรวจสอบ: HTTP_200\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`,
    api:`สถานะ: API ผิดพลาด\nอาการ: HTTP_503 และ timeout\nเป้าหมาย: API ใช้งานได้\n\nทำงาน:\n- ตรวจ HTTP status\n- รอ backoff\n- ลอง request ใหม่\n\nตรวจสอบ: HTTP_200\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`,
    build:`สถานะ: Build ผิดพลาด\nอาการ: dependency version conflict\nเป้าหมาย: Build ผ่าน\n\nทำงาน:\n- อ่าน build error\n- ตรวจ dependency\n- ปรับ version\n- รัน build ใหม่\n\nตรวจสอบ: BUILD_PASS\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`,
    unknown:`สถานะ: ระบบชำระเงินผิดพลาด\nอาการ: PAYMENT_X91 signature mismatch\nเป้าหมาย: ชำระเงินสำเร็จ\n\nทำงาน:\n- ตรวจ signature\n- ตรวจ payment session\n\nตรวจสอบ: PAYMENT_OK\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`,
    conflict:`สถานะ: Build ผิดพลาด\nอาการ: dependency version conflict\nเป้าหมาย: Build ผ่าน\n\nใช้สกิล: AUTH_RECOVERY\n\nทำงาน:\n- ตรวจ dependency\n\nตรวจสอบ: BUILD_PASS\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`,
    weak:`สถานะ: API ผิดพลาด\nเป้าหมาย: API ใช้งานได้`
  };

  const vocab = {
    states: [
      {value:'AUTH_ERROR', patterns:[/ล็อกอิน/i,/login/i,/\b401\b/i,/auth/i,/token/i,/โทเคน/i,/session/i]},
      {value:'API_ERROR', patterns:[/\bapi\b/i,/\b503\b/i,/timeout/i,/request/i,/endpoint/i]},
      {value:'BUILD_ERROR', patterns:[/build/i,/dependency/i,/compile/i,/package/i,/npm/i,/version conflict/i]},
      {value:'WEB_CHECK', patterns:[/ตรวจ.*เว็บ/i,/website/i,/หน้าเว็บ/i,/response time/i,/web status/i]},
      {value:'FILE_ERROR', patterns:[/\bcsv\b/i,/encoding/i,/utf-?8/i,/แปลงไฟล์/i,/file/i,/import.*ไฟล์/i]}
    ],
    goals: [
      {value:'LOGIN_OK', patterns:[/ล็อกอิน.*สำเร็จ/i,/login[_ ]?ok/i,/เข้าใช้งาน.*ได้/i]},
      {value:'API_OK', patterns:[/api.*ใช้งาน.*ได้/i,/api[_ ]?ok/i,/endpoint.*พร้อม/i]},
      {value:'BUILD_PASS', patterns:[/build.*ผ่าน/i,/build[_ ]?pass/i,/compile.*ผ่าน/i]},
      {value:'WEBSITE_OK', patterns:[/เว็บ.*ปกติ/i,/website[_ ]?ok/i,/หน้าเว็บ.*ใช้งาน.*ได้/i]},
      {value:'FILE_OK', patterns:[/ไฟล์.*ปกติ/i,/file[_ ]?ok/i,/import.*สำเร็จ/i,/แปลง.*สำเร็จ/i]}
    ]
  };

  const LABELS = [
    ['stateText', /^สถานะ\s*[:：]\s*(.*)$/i], ['observation', /^อาการ\s*[:：]\s*(.*)$/i],
    ['goalText', /^เป้าหมาย\s*[:：]\s*(.*)$/i], ['skillText', /^ใช้สกิล\s*[:：]\s*(.*)$/i],
    ['verify', /^ตรวจสอบ\s*[:：]\s*(.*)$/i], ['fallback', /^ถ้าไม่สำเร็จ\s*[:：]\s*(.*)$/i]
  ];

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function clean(value){ return String(value ?? '').trim(); }
  function lower(value){ return clean(value).toLocaleLowerCase('th'); }

  function detectVocabulary(text, entries, fallback){
    const source = clean(text), matches = [];
    for(const entry of entries){ let hits=0; for(const rx of entry.patterns){ if(rx.test(source)) hits++; } if(hits) matches.push({value:entry.value,hits}); }
    matches.sort((a,b)=>b.hits-a.hits || a.value.localeCompare(b.value));
    return {value:matches[0]?.value||fallback,candidates:matches,ambiguous:matches.length>1&&matches[0].hits===matches[1].hits};
  }

  function parseThaiCommand(raw){
    const source=String(raw??'').replace(/\r\n?/g,'\n').trim();
    const out={raw:source,stateText:'',observation:'',goalText:'',skillText:'',steps:[],verify:'',fallback:'',state:'UNKNOWN_STATE',goal:'UNKNOWN_GOAL',parse:{valid:false,errors:[],warnings:[],fields:{},quality:0},normalizedText:''};
    if(!source){out.parse.errors.push('EMPTY_COMMAND');return out;}
    let mode='';
    for(const original of source.split('\n')){
      const line=original.trim(); if(!line) continue;
      if(/^ทำงาน\s*[:：]\s*$/i.test(line)){mode='steps';continue;}
      let handled=false;
      for(const [field,rx] of LABELS){const m=line.match(rx);if(m){out[field]=clean(m[1]);mode='';handled=true;break;}}
      if(handled) continue;
      if(mode==='steps'){const step=line.replace(/^(?:[-*•]|\d+[.)])\s*/,'').trim();if(step)out.steps.push(step);continue;}
      out.parse.warnings.push(`UNRECOGNIZED_LINE:${line}`);
    }
    const stateDetected=detectVocabulary(`${out.stateText} ${out.observation}`,vocab.states,'UNKNOWN_STATE');
    const goalDetected=detectVocabulary(out.goalText,vocab.goals,'UNKNOWN_GOAL');
    out.state=stateDetected.value; out.goal=goalDetected.value;
    out.parse.fields={state:Boolean(out.stateText),observation:Boolean(out.observation),goal:Boolean(out.goalText),skill:Boolean(out.skillText),steps:out.steps.length,verify:Boolean(out.verify),fallback:Boolean(out.fallback)};
    if(!out.stateText)out.parse.errors.push('MISSING_STATE'); if(!out.goalText)out.parse.errors.push('MISSING_GOAL');
    if(out.state==='UNKNOWN_STATE')out.parse.warnings.push('UNKNOWN_STATE'); if(out.goal==='UNKNOWN_GOAL')out.parse.warnings.push('UNKNOWN_GOAL');
    if(stateDetected.ambiguous)out.parse.warnings.push('AMBIGUOUS_STATE'); if(goalDetected.ambiguous)out.parse.warnings.push('AMBIGUOUS_GOAL');
    if(!out.steps.length)out.parse.warnings.push('NO_STEPS_PROVIDED'); if(!out.verify)out.parse.warnings.push('NO_VERIFY_PROVIDED');
    let quality=0; if(out.stateText)quality+=25;if(out.observation)quality+=15;if(out.goalText)quality+=25;if(out.steps.length)quality+=15;if(out.verify)quality+=10;if(out.fallback)quality+=5;if(out.skillText)quality+=5;
    quality-=out.parse.errors.length*30;quality-=out.parse.warnings.filter(x=>x.startsWith('AMBIGUOUS_')).length*10;
    out.parse.quality=Math.max(0,Math.min(100,quality));out.parse.valid=out.parse.errors.length===0;
    out.normalizedText=lower([out.stateText,out.observation,out.goalText,out.skillText,...out.steps,out.verify].join(' '));out.detected={state:stateDetected,goal:goalDetected};return out;
  }

  function enabledSkills(skills){return (skills||[]).filter(function(s){return s&&s.enabled!==false;});}
  function findRequestedSkill(cmd,skills){
    const explicit=lower(cmd.skillText); if(!explicit) return null;
    for(const skill of skills){const id=lower(skill.id), name=lower(skill.name); if(explicit===id||explicit===name) return skill;}
    for(const skill of skills){const name=lower(skill.name); if(name&&(name.includes(explicit)||explicit.includes(name))) return skill;}
    return null;
  }
  function skillSupports(skill,cmd){
    const stateOk=!skill.states||!skill.states.length||cmd.state==="UNKNOWN_STATE"||skill.states.includes(cmd.state);
    const goalOk=!skill.goals||!skill.goals.length||cmd.goal==="UNKNOWN_GOAL"||skill.goals.includes(cmd.goal);
    return stateOk&&goalOk;
  }
  function scoreSkill(skill,cmd){
    let score=0;const reasons=[];const explicit=lower(cmd.skillText),skillId=lower(skill.id),skillName=lower(skill.name);
    const obs=lower(cmd.observation), command=cmd.normalizedText||"";
    if(explicit){if(explicit===skillId||explicit===skillName){score+=20;reasons.push({type:"EXPLICIT_SKILL_EXACT",score:20});}else if(skillName.includes(explicit)||explicit.includes(skillName)){score+=12;reasons.push({type:"EXPLICIT_SKILL_PARTIAL",score:12});}}
    if(skill.states&&skill.states.includes(cmd.state)){score+=6;reasons.push({type:"STATE",value:cmd.state,score:6});}
    if(skill.goals&&skill.goals.includes(cmd.goal)){score+=5;reasons.push({type:"GOAL",value:cmd.goal,score:5});}
    const obsHits=[], cmdHits=[];
    for(const keyword of skill.keywords||[]){const k=lower(keyword); if(!k) continue; if(obs.includes(k)) obsHits.push(keyword); if(command.includes(k)) cmdHits.push(keyword);}
    if(obsHits.length){score+=obsHits.length;reasons.push({type:"OBS_KEYWORDS",value:obsHits,score:obsHits.length});}
    if(cmdHits.length){score+=cmdHits.length;reasons.push({type:"CMD_KEYWORDS",value:cmdHits,score:cmdHits.length});}
    if(cmd.state!=="UNKNOWN_STATE"&&skill.states&&skill.states.length&&!skill.states.includes(cmd.state)){score-=8;reasons.push({type:"STATE_MISMATCH",value:cmd.state,score:-8});}
    if(cmd.goal!=="UNKNOWN_GOAL"&&skill.goals&&skill.goals.length&&!skill.goals.includes(cmd.goal)){score-=6;reasons.push({type:"GOAL_MISMATCH",value:cmd.goal,score:-6});}
    return {score,reasons};
  }
  function rankSkills(cmd,skills){return enabledSkills(skills).map(function(skill){return Object.assign({skill:skill},scoreSkill(skill,cmd));}).sort(function(a,b){return b.score-a.score||a.skill.id.localeCompare(b.skill.id);});}
  function matchSkill(cmd,skills){
    const list=enabledSkills(skills);
    if(!cmd||!cmd.parse||!cmd.parse.valid)return{classification:MATCH.NONE,selected:null,ranked:[],confidence:0,reason:"PARSE_INVALID"};
    const requested=findRequestedSkill(cmd,list);
    const ranked=rankSkills(cmd,list),first=ranked[0]||null,second=ranked[1]||null;
    if(requested&&!skillSupports(requested,cmd)){
      return{classification:MATCH.CONFLICT,selected:null,ranked:ranked,requestedSkill:requested.id,confidence:0,reason:"EXPLICIT_SKILL_STATE_GOAL_MISMATCH"};
    }
    if(!first||first.score<10)return{classification:MATCH.NONE,selected:null,ranked:ranked,confidence:0,reason:"SCORE_BELOW_MINIMUM"};
    const gap=second?first.score-second.score:first.score;
    if(second&&first.score>=10&&second.score>=10&&gap<=2)return{classification:MATCH.CONFLICT,selected:null,ranked:ranked,confidence:Math.max(0,Math.min(100,first.score*4)),reason:"TOP_CANDIDATES_TOO_CLOSE"};
    if(first.score>=15)return{classification:MATCH.STRONG,selected:first,ranked:ranked,confidence:Math.min(99,55+first.score*2),reason:"STRONG_SCORE"};
    return{classification:MATCH.WEAK,selected:first,ranked:ranked,confidence:Math.min(79,35+first.score*3),reason:"WEAK_BAND"};
  }

  function decideRuntime(cmd,match){
    const timeline=[STATUS.IDLE];
    if(!cmd.parse.valid){timeline.push(STATUS.PARSE_FAIL,STATUS.FAIL,STATUS.AGENT_NEEDED);return{status:STATUS.AGENT_NEEDED,outcome:'FAIL',timeline,reason:'PARSE_INVALID'};}
    timeline.push(STATUS.PARSED,STATUS.MATCHING);
    if(match.classification===MATCH.STRONG){timeline.push(STATUS.STRONG_MATCH,STATUS.RUNNING,STATUS.VERIFYING,STATUS.DONE);return{status:STATUS.DONE,outcome:'DONE',timeline,reason:'KNOWN_SKILL'};}
    if(match.classification===MATCH.CONFLICT){timeline.push(STATUS.SKILL_CONFLICT,STATUS.AGENT_NEEDED);return{status:STATUS.AGENT_NEEDED,outcome:'AGENT_NEEDED',timeline,reason:'SKILL_CONFLICT'};}
    if(match.classification===MATCH.WEAK){timeline.push(STATUS.WEAK_MATCH,STATUS.AGENT_NEEDED);return{status:STATUS.AGENT_NEEDED,outcome:'AGENT_NEEDED',timeline,reason:'WEAK_MATCH'};}
    timeline.push(STATUS.NO_MATCH,STATUS.AGENT_NEEDED);return{status:STATUS.AGENT_NEEDED,outcome:'AGENT_NEEDED',timeline,reason:'NO_MATCH'};
  }

  function createEpisode(cmd,match,runtime){return{schemaVersion:'0.1',time:new Date().toISOString(),state:cmd.state,goal:cmd.goal,observation:cmd.observation,parseQuality:cmd.parse.quality,parseWarnings:clone(cmd.parse.warnings),matchClass:match.classification,skill:match.selected?.skill?.id||null,score:match.selected?.score??match.ranked?.[0]?.score??0,confidence:match.confidence,candidates:(match.ranked||[]).slice(0,3).map(x=>({skill:x.skill.id,score:x.score})),runtimeStatus:runtime.status,runtimeReason:runtime.reason,outcome:runtime.outcome};}

  window.AICPUCoreV01=Object.freeze({VERSION,MATCH,STATUS,baseSkills,samples,vocab,parseThaiCommand,scoreSkill,rankSkills,matchSkill,decideRuntime,createEpisode,clone});
})();