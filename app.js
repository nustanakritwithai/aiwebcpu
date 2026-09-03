(() => {
  'use strict';
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`โหลด ${src} ไม่สำเร็จ`));document.head.appendChild(s);});}
  async function boot(){
    try{
      await loadScript('./core-v01.js?v=0.1.0');
      await loadScript('./app-v01.js?v=0.1.0');
      document.title='AI CPU Web V0.1';
      document.querySelector('.brand span')?.replaceChildren(document.createTextNode('Skill Runtime V0.1'));
      const eyebrow=document.querySelector('.welcome-card .eyebrow');if(eyebrow)eyebrow.textContent='AI CPU WEB V0.1';
      const hint=document.querySelector('.composer-actions .hint');if(hint)hint.textContent='V0.1: Hardened Parser + Strong/Weak/Conflict Skill Matching';
    }catch(error){
      console.error(error);
      const box=document.getElementById('messageList');if(box)box.innerHTML=`<div class="message assistant"><div class="avatar cpu">AI</div><div class="message-body"><div class="bubble">AI CPU V0.1 boot failed: ${String(error.message||error)}</div></div></div>`;
    }
  }
  boot();
})();