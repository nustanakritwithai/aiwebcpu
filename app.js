(() => {
  'use strict';
  const STORAGE_SKILLS='aicpu-v0-skills';
  const STORAGE_EPISODES='aicpu-v0-episodes';
  const STORAGE_METRICS='aicpu-v0-metrics';

  const baseSkills=[
    {id:'AUTH_RECOVERY',name:'กู้คืนการยืนยันตัวตน',version:'0.1',keywords:['ล็อกอิน','login','401','token','โทเคน','auth'],states:['AUTH_ERROR'],goals:['LOGIN_OK'],steps:['ตรวจโทเคน','รีเฟรชโทเคนถ้าหมดอายุ','ลองล็อกอินใหม่'],tools:['TOKEN_CHECK','AUTH_REFRESH','HTTP_RETRY'],verify:'HTTP_200'},
    {id:'API_RETRY',name:'ลองเชื่อมต่อ API ใหม่',version:'0.1',keywords:['api','timeout','503','retry','เชื่อมต่อ','เซิร์ฟเวอร์ไม่ตอบ'],states:['API_ERROR'],goals:['API_OK'],steps:['ตรวจ HTTP status','รอ backoff','ลอง request ใหม่','ตรวจผลตอบกลับ'],tools:['HTTP_CLIENT','TIMER'],verify:'HTTP_200'},
    {id:'BUILD_REPAIR',name:'ซ่อม Build / Dependency',version:'0.1',keywords:['build','dependency','compile','package','npm','ติดตั้งแพ็กเกจ'],states:['BUILD_ERROR'],goals:['BUILD_PASS'],steps:['อ่าน build error','ตรวจ dependency','ปรับ config/version','รัน build ใหม่'],tools:['FILE_READ','PACKAGE_CHECK','SHELL_BUILD'],verify:'BUILD_PASS'},
    {id:'CHECK_WEBSITE',name:'ตรวจสถานะเว็บไซต์',version:'0.1',keywords:['เว็บ','website','หน้าเว็บ','http','status','ตรวจเว็บ'],states:['WEB_CHECK'],goals:['WEBSITE_OK'],steps:['ส่ง HTTP request','ตรวจ status code','ตรวจ response time','สรุปสถานะ'],tools:['HTTP_CLIENT'],verify:'HTTP_200'},
    {id:'FILE_CONVERT',name:'แปลงไฟล์ / Encoding',version:'0.1',keywords:['ไฟล์','file','csv','encoding','utf-8','convert','แปลงไฟล์'],states:['FILE_ERROR'],goals:['FILE_OK'],steps:['ตรวจประเภทไฟล์','ตรวจ encoding','แปลงเป็นรูปแบบเป้าหมาย','ตรวจไฟล์ผลลัพธ์'],tools:['FILE_READ','FILE_CONVERT'],verify:'FILE_OK'}
  ];

  const samples={
    auth:`สถานะ: ล็อกอินผิดพลาด\nอาการ: HTTP_401 token หมดอายุ\nเป้าหมาย: ล็อกอินสำเร็จ\n\nใช้สกิล: กู้คืนการยืนยันตัวตน\n\nทำงาน:\n- ตรวจโทเคน\n- รีเฟรชโทเคนถ้าหมดอายุ\n- ลองล็อกอินใหม่\n\nตรวจสอบ: HTTP_200\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`,
    api:`สถานะ: API ผิดพลาด\nอาการ: HTTP_503 และ timeout\nเป้าหมาย: API ใช้งานได้\n\nทำงาน:\n- ตรวจ HTTP status\n- รอ backoff\n- ลอง request ใหม่\n\nตรวจสอบ: HTTP_200\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`,
    build:`สถานะ: Build ผิดพลาด\nอาการ: dependency version conflict\nเป้าหมาย: Build ผ่าน\n\nทำงาน:\n- อ่าน build error\n- ตรวจ dependency\n- ปรับ version\n- รัน build ใหม่\n\nตรวจสอบ: BUILD_PASS\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`,
    unknown:`สถานะ: ระบบชำระเงินผิดพลาด\nอาการ: PAYMENT_X91 signature mismatch\nเป้าหมาย: ชำระเงินสำเร็จ\n\nทำงาน:\n- ตรวจ signature\n- ตรวจ payment session\n\nตรวจสอบ: PAYMENT_OK\n\nถ้าไม่สำเร็จ: ส่งต่อเอเจนต์`
  };

  const stateMap=[
    [/ล็อกอิน|login|401|auth|token|โทเคน/i,'AUTH_ERROR'],
    [/api|503|timeout|request/i,'API_ERROR'],
    [/build|dependency|compile|package|npm/i,'BUILD_ERROR'],
    [/website|หน้าเว็บ|ตรวจเว็บ|เว็บ.*status/i,'WEB_CHECK'],
    [/csv|encoding|utf-8|แปลงไฟล์|file/i,'FILE_ERROR']
  ];
  const goalMap=[
    [/ล็อกอินสำเร็จ|login_ok|login ok/i,'LOGIN_OK'],[/api.*ใช้งาน|api_ok|http_200/i,'API_OK'],[/build.*ผ่าน|build_pass/i,'BUILD_PASS'],[/เว็บ.*ปกติ|website_ok/i,'WEBSITE_OK'],[/ไฟล์.*ปกติ|file_ok/i,'FILE_OK']
  ];

  let skills=load(STORAGE_SKILLS,baseSkills);
  let episodes=load(STORAGE_EPISODES,[]);
  let metrics=load(STORAGE_METRICS,{cpu:0,agent:0});

  const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
  const input=$('#commandInput'), messageList=$('#messageList'), flowList=$('#flowList');

  function load(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):structuredClone(f)}catch{return structuredClone(f)}}
  function save(){localStorage.setItem(STORAGE_SKILLS,JSON.stringify(skills));localStorage.setItem(STORAGE_EPISODES,JSON.stringify(episodes));localStorage.setItem(STORAGE_METRICS,JSON.stringify(metrics))}
  function textAfter(line,label){return line.slice(label.length).trim()}
  function normalize(text,map,fallback){for(const [rx,val] of map){if(rx.test(text))return val}return fallback}

  function parseThaiCommand(raw){
    const lines=raw.split(/\r?\n/).map(x=>x.trim());
    const out={raw,stateText:'',observation:'',goalText:'',skillText:'',steps:[],verify:'',fallback:''};
    let mode='';
    for(const line of lines){
      if(!line) continue;
      if(line.startsWith('สถานะ:')){out.stateText=textAfter(line,'สถานะ:');mode='';continue}
      if(line.startsWith('อาการ:')){out.observation=textAfter(line,'อาการ:');mode='';continue}
      if(line.startsWith('เป้าหมาย:')){out.goalText=textAfter(line,'เป้าหมาย:');mode='';continue}
      if(line.startsWith('ใช้สกิล:')){out.skillText=textAfter(line,'ใช้สกิล:');mode='';continue}
      if(line.startsWith('ทำงาน:')){mode='steps';continue}
      if(line.startsWith('ตรวจสอบ:')){out.verify=textAfter(line,'ตรวจสอบ:');mode='';continue}
      if(line.startsWith('ถ้าไม่สำเร็จ:')){out.fallback=textAfter(line,'ถ้าไม่สำเร็จ:');mode='';continue}
      if(mode==='steps' && /^[-•]/.test(line)) out.steps.push(line.replace(/^[-•]\s*/,''));
    }
    const combined=[out.stateText,out.observation,out.goalText,raw].join(' ');
    out.state=normalize(out.stateText+' '+out.observation,stateMap,'UNKNOWN_STATE');
    out.goal=normalize(out.goalText,goalMap,'UNKNOWN_GOAL');
    out.normalizedText=combined.toLowerCase();
    return out;
  }

  function scoreSkill(skill,cmd){
    let score=0,reasons=[];
    if(cmd.skillText && (skill.name.includes(cmd.skillText)||cmd.skillText.includes(skill.name)||skill.id===cmd.skillText)){score+=12;reasons.push('explicit skill')}
    if(skill.states?.includes(cmd.state)){score+=6;reasons.push('state')}
    if(skill.goals?.includes(cmd.goal)){score+=5;reasons.push('goal')}
    for(const k of skill.keywords||[]){if(cmd.normalizedText.includes(String(k).toLowerCase())){score+=1;reasons.push(k)}}
    return {score,reasons};
  }
  function matchSkill(cmd){const ranked=skills.map(s=>({skill:s,...scoreSkill(s,cmd)})).sort((a,b)=>b.score-a.score);return ranked[0]&&ranked[0].score>=4?ranked[0]:null}

  function addMessage(role,text,extra=''){
    const wrap=document.createElement('div');wrap.className=`message ${role}`;
    wrap.innerHTML=`<div class="avatar ${role==='assistant'?'cpu':'user'}">${role==='assistant'?'AI':'YOU'}</div><div class="message-body"><div class="bubble"></div><div class="message-meta">${role==='assistant'?'AI CPU Runtime':'Manual Command'}</div></div>`;
    wrap.querySelector('.bubble').textContent=text;
    if(extra) wrap.querySelector('.bubble').insertAdjacentHTML('beforeend',extra);
    messageList.appendChild(wrap); $('#chatScroll').scrollTop=$('#chatScroll').scrollHeight;
  }
  function runtimeLines(items){return `<div class="runtime-block">${items.map(x=>`<div class="runtime-line ${x.kind||'ok'}">${escapeHtml(x.text)}</div>`).join('')}</div>`}
  function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

  function setStatus(type,text){const el=$('#runStatus');el.className='status-chip '+type;el.textContent=text}
  function renderFlow(cmd,match,result){
    const items=[{name:'STATE',detail:`${cmd.state} • ${cmd.observation||cmd.stateText||'-'}`,tag:'INPUT'}];
    if(match){items.push({name:'SKILL MATCH',detail:`${match.skill.id} • score ${match.score}`,tag:'CPU'});for(const step of match.skill.steps)items.push({name:'EXECUTE',detail:step,tag:'STEP'});items.push({name:'VERIFY',detail:match.skill.verify||cmd.verify||'SUCCESS',tag:'PASS'});items.push({name:'DONE',detail:result,tag:'RESULT'})}
    else{items.push({name:'NO SKILL MATCH',detail:'ไม่พบ CPU Skill ที่มั่นใจพอ',tag:'MISS'});items.push({name:'ESCALATE_AGENT',detail:'ส่งปัญหาให้ Agent ภายนอกสร้างวิธีแก้/Skill ใหม่',tag:'AGENT'})}
    flowList.innerHTML=items.map((x,i)=>`<div class="flow-step ${i===items.length-1?'success':''}"><div class="flow-num">${i+1}</div><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.detail)}</small></div><span class="step-tag">${escapeHtml(x.tag)}</span></div>`).join('');
  }
  function renderTrace(cmd,match,outcome){
    const trace={timestamp:new Date().toISOString(),state:cmd.state,observation:cmd.observation,goal:cmd.goal,match:match?{skill:match.skill.id,score:match.score,reasons:match.reasons}:null,outcome};
    $('#traceOutput').textContent=JSON.stringify(trace,null,2);$('#stateOutput').textContent=JSON.stringify(cmd,null,2)
  }

  function run(){
    const raw=input.value.trim();if(!raw){input.focus();return}
    addMessage('user',raw);const cmd=parseThaiCommand(raw);const match=matchSkill(cmd);$('#taskName').textContent=cmd.stateText||cmd.state;$('#agentCard').classList.toggle('active',!match);
    let outcome;
    if(match){outcome='DONE';metrics.cpu++;setStatus('done','DONE');renderFlow(cmd,match,`${match.skill.verify||cmd.verify||'SUCCESS'} ผ่านการจำลอง`);addMessage('assistant',`พบ CPU Skill ที่เหมาะสม: ${match.skill.name}`,runtimeLines([{text:`State: ${cmd.state} → Goal: ${cmd.goal}`},{text:`Skill: ${match.skill.id} (match score ${match.score})`},{text:`Workflow: ${match.skill.steps.join(' → ')}`},{text:`Verify: ${match.skill.verify||cmd.verify||'PASS'}`} ]));}
    else{outcome='ESCALATE_AGENT';metrics.agent++;setStatus('agent','AGENT NEEDED');renderFlow(cmd,null,outcome);addMessage('assistant','AI CPU ยังไม่มี Skill ที่รองรับปัญหานี้',runtimeLines([{text:`State: ${cmd.state} → Goal: ${cmd.goal}`,kind:'warn'},{text:'NO_SKILL_MATCH',kind:'warn'},{text:'ESCALATE_AGENT — ให้ Agent ภายนอกแก้และสร้าง CPU Skill ใหม่',kind:'warn'}]));}
    episodes.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),time:new Date().toISOString(),state:cmd.state,goal:cmd.goal,observation:cmd.observation,skill:match?.skill.id||null,score:match?.score||0,outcome});if(episodes.length>200)episodes=episodes.slice(-200);save();renderTrace(cmd,match,outcome);renderAll();input.value='';
  }

  function renderSkills(){
    $('#skillsGrid').innerHTML=skills.map(s=>`<article class="skill-card"><div class="skill-id">${escapeHtml(s.id)} · v${escapeHtml(s.version||'0.1')}</div><h3>${escapeHtml(s.name)}</h3><div class="skill-meta"><span class="mini-chip">${(s.states||[]).join(', ')||'keyword match'}</span><span class="mini-chip">${(s.goals||[]).join(', ')||'any goal'}</span></div><ol class="skill-steps">${(s.steps||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol></article>`).join('');
    $('#skillCountBadge').textContent=skills.length;$('#metricSkills').textContent=skills.length;
  }
  function renderMemory(){
    if(!episodes.length){$('#memoryTableWrap').innerHTML='<div class="empty-state">ยังไม่มี Memory — รันคำสั่งอย่างน้อย 1 ครั้ง</div>';return}
    const grouped={};for(const e of episodes){const k=`${e.state}|${e.goal}|${e.skill||'NO_SKILL'}`;grouped[k]??={state:e.state,goal:e.goal,skill:e.skill||'NO_SKILL',uses:0,done:0,agent:0};grouped[k].uses++;e.outcome==='DONE'?grouped[k].done++:grouped[k].agent++}
    $('#memoryTableWrap').innerHTML=`<table class="memory-table"><thead><tr><th>STATE</th><th>GOAL</th><th>BEST / USED SKILL</th><th>USES</th><th>SUCCESS</th></tr></thead><tbody>${Object.values(grouped).reverse().map(r=>`<tr><td>${escapeHtml(r.state)}</td><td>${escapeHtml(r.goal)}</td><td>${escapeHtml(r.skill)}</td><td>${r.uses}</td><td>${r.done}/${r.uses}</td></tr>`).join('')}</tbody></table>`;
  }
  function renderHistory(){
    $('#historyList').innerHTML=episodes.length?episodes.slice().reverse().map(e=>`<article class="history-item"><header><b>${escapeHtml(e.state)} → ${escapeHtml(e.goal)}</b><span class="mini-chip">${escapeHtml(e.outcome)}</span></header><p>${e.skill?`CPU Skill: ${escapeHtml(e.skill)} · score ${e.score}`:'NO_SKILL_MATCH → Agent Needed'}<br>${new Date(e.time).toLocaleString('th-TH')}</p></article>`).join(''):'<div class="empty-state">ยังไม่มี History</div>';
  }
  function renderTools(){const tools=[['HTTP_CLIENT','HTTP request / status'],['TOKEN_CHECK','ตรวจ token state'],['AUTH_REFRESH','จำลอง refresh token'],['PACKAGE_CHECK','ตรวจ dependency'],['SHELL_BUILD','จำลอง build command'],['FILE_CONVERT','จำลอง file conversion']];$('#toolsGrid').innerHTML=tools.map(([id,d])=>`<article class="skill-card"><div class="skill-id">${id}</div><h3>${d}</h3><div class="skill-meta"><span class="mini-chip">SIMULATION V0</span><span class="mini-chip">CPU</span></div></article>`).join('')}
  function renderMetrics(){$('#metricCpu').textContent=metrics.cpu;$('#metricAgent').textContent=metrics.agent}
  function renderAll(){renderSkills();renderMemory();renderHistory();renderTools();renderMetrics()}

  function switchView(name){$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===name));$$('.content-view').forEach(x=>x.classList.remove('active'));$(`#view-${name}`).classList.add('active');$('#workspaceTitle').textContent={chat:'AI CPU Chat',skills:'CPU Skills',memory:'Skill Memory',history:'Experience History',tools:'Tool Registry'}[name]||'AI CPU'}
  function setSample(name){input.value=samples[name]||samples.auth;switchView('chat');input.focus()}

  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $$('[data-sample]').forEach(b=>b.addEventListener('click',()=>setSample(b.dataset.sample)));
  $('#runBtn').addEventListener('click',run);input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run()}});
  $('#newTaskBtn').addEventListener('click',()=>{switchView('chat');input.value='';messageList.innerHTML='';flowList.innerHTML='<div class="flow-empty">ยังไม่มี Workflow — กด RUN เพื่อเริ่ม</div>';$('#taskName').textContent='รอคำสั่ง';setStatus('idle','IDLE');$('#traceOutput').textContent='// Trace จะปรากฏหลังรันคำสั่ง';$('#stateOutput').textContent='{\n  "state": "IDLE",\n  "goal": null\n}';$('#agentCard').classList.remove('active')});
  $('#mobileMenuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));document.addEventListener('click',e=>{if(innerWidth<=720&&!$('#sidebar').contains(e.target)&&e.target!==$('#mobileMenuBtn'))$('#sidebar').classList.remove('open')});
  $$('.canvas-tabs button').forEach(b=>b.addEventListener('click',()=>{$$('.canvas-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.canvas-pane').forEach(x=>x.classList.remove('active'));$(`#canvas-${b.dataset.canvas}`).classList.add('active')}));
  $('#openAddSkillBtn').addEventListener('click',()=>$('#addSkillDialog').showModal());
  $('#installSkillBtn').addEventListener('click',e=>{e.preventDefault();const id=$('#newSkillId').value.trim().toUpperCase().replace(/\s+/g,'_');const name=$('#newSkillName').value.trim();const keywords=$('#newSkillKeywords').value.split(',').map(x=>x.trim()).filter(Boolean);const steps=$('#newSkillSteps').value.split(/\n/).map(x=>x.trim()).filter(Boolean);if(!id||!name||!keywords.length||!steps.length)return;skills=skills.filter(s=>s.id!==id);skills.push({id,name,version:'0.1',keywords,states:[],goals:[],steps,tools:['CUSTOM_TOOL'],verify:'SUCCESS'});save();renderAll();$('#addSkillDialog').close();$('#addSkillForm').reset()});

  renderAll();setSample('auth');
})();
