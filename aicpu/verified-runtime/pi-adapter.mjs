export function indexPiEntries(entries=[]){
  return new Map(entries.filter(x=>x&&x.id).map(x=>[x.id,x]));
}

export function projectActiveBranch(entries=[],headId=null){
  if(!entries.length)return [];
  const byId=indexPiEntries(entries);
  const resolvedHead=headId??entries.at(-1)?.id??null;
  if(!resolvedHead||!byId.has(resolvedHead))return [];
  const branch=[];
  const seen=new Set();
  let current=byId.get(resolvedHead);
  while(current){
    if(seen.has(current.id))throw new Error('Pi session cycle detected');
    seen.add(current.id);
    branch.push(current);
    current=current.parentId==null?null:byId.get(current.parentId);
  }
  return branch.reverse();
}

export function normalizePiEntry(entry,{sessionId=null,projectId=null}={}){
  if(!entry||typeof entry!=='object')throw new Error('Pi entry must be an object');
  return {
    type:String(entry.type??'unknown'),
    id:entry.id??null,
    parentId:entry.parentId??null,
    timestamp:entry.timestamp??null,
    sessionId,
    projectId,
    customType:entry.customType??null,
    data:entry.data??entry.message??null,
    contextVisible:entry.type==='custom'?false:true,
    source:'pi',
    raw:entry
  };
}

export function projectPiSession(entries=[],options={}){
  const branch=projectActiveBranch(entries,options.headId);
  return branch.map(entry=>normalizePiEntry(entry,options));
}
