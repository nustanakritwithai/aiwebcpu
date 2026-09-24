/** Behavioral proof of real producer/relay/receiver and domain operations.
 * HTTP transport/CAS responses are injected. This is NOT live deployment proof.
 */
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [pocketArg,pirateArg]=process.argv.slice(2);
assert.ok(pocketArg&&pirateArg,'usage: runtime-pocket-pirate.mjs <pocket-root> <pirate-root>');
const pocket=resolve(pocketArg), pirate=resolve(pirateArg);
const load=path=>import(pathToFileURL(path).href);
const {build}=await load(join(pirate,'node_modules/esbuild/lib/main.js'));
const temp=await mkdtemp(join(tmpdir(),'pb-pair-'));
const results=[];
async function check(name,fn){try{await fn();results.push({name,verdict:'SAT'});console.log('PASS',name);}catch(error){results.push({name,verdict:'VIOL',error:String(error.stack||error)});console.error('FAIL',name,error);}}
try{
  const imports=[
    ['PirateVitalsAuthority','client/src/realtime/PirateVitalsAuthority.ts'],
    ['applyPirateVitalsSnapshot','client/src/realtime/PirateVitalsClientBridge.ts'],
    ['PirateVitalsEmitter','client/src/realtime/PirateVitalsEmitter.ts'],
    ['HotkeyManager','client/src/combat/HotkeyManager.ts'],
  ].map(([symbol,path])=>`export { ${symbol} } from ${JSON.stringify(join(pirate,path))};`).join('\n');
  await build({stdin:{contents:imports,resolveDir:pirate,sourcefile:'pb-runtime-native.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:join(temp,'native.mjs')});
  const {PirateVitalsAuthority,applyPirateVitalsSnapshot,PirateVitalsEmitter,HotkeyManager}=await load(join(temp,'native.mjs'));
  const {CentralWorldWorker}=await load(join(pirate,'server/dist/centralWorker.mjs'));
  const {createEconomyEngine}=await load(join(pirate,'server/dist/economy-engine.mjs'));
  const {sanitizePirateVitals,sanitizePirateOriginalWorld}=await load(join(pocket,'pirate-original-world-contract.mjs'));
  const {createPirateSnapshotMessage}=await load(join(pocket,'pirate-presence-bridge-v900.mjs'));
  const {createPirateCentralStateClient,createPirateStateOperationQueue,sanitizePirateStateOperation,pirateDocumentsFromEntries}=await load(join(pocket,'pirate-central-state-client.mjs'));
  const worker=new CentralWorldWorker(()=>10000);
  let id=0;
  const call=(op,data={})=>worker.handle({id:++id,op,now:10000,characterId:'review-player',...data});
  const fresh=async()=>structuredClone((await call('normalize-state',pirateDocumentsFromEntries({}))).state);
  const envelope=vitals=>({contract:'pirate-original-world/1',viewerId:'review-player',generation:1,sequence:1,messages:[],vitals});
  await check('real server snapshot -> Pocket relay -> native monotonic receiver',async()=>{
    const state=await fresh();state.checkpoint.hp=42;
    const {vitals}=await call('vitals-snapshot',{state,revision:1});
    const relayed=createPirateSnapshotMessage({zone:'pirate-fruit',generation:1,players:[],pirateWorld:envelope(vitals)});
    assert.ok(relayed?.payload.pirateWorld);
    const authority=new PirateVitalsAuthority();
    assert.equal(authority.apply(relayed.payload.pirateWorld.vitals),true);
    assert.equal(authority.snapshot.hp,42);
    assert.equal(authority.apply({...vitals,revision:1,hp:99}),false);
    assert.equal(authority.apply({...vitals,revision:0,hp:99}),false);
    assert.equal(authority.apply({...vitals,revision:2,hp:NaN}),false);
    assert.equal(authority.active,true);assert.equal(authority.snapshot.hp,42);
  });
  await check('malformed life and respawn fields rejected before native scene',async()=>{
    const {vitals}=await call('vitals-snapshot',{state:await fresh(),revision:1});
    for(const invalid of [{dead:true},{maxHp:0,hp:0,dead:true},{respawn:null},{respawn:[]},{respawn:false}]){
      assert.equal(sanitizePirateVitals({...vitals,...invalid}),null);
      assert.equal(sanitizePirateOriginalWorld(envelope({...vitals,...invalid})),null);
    }
  });
  await check('both HP and MP hotkeys wait for server and never debit locally',async()=>{
    for(const slot of [1,2])for(const accepted of [true,false]){
      const controller={hp:50,hpMax:100,mp:20,mpMax:100};let debits=0,requests=0;
      const inventory={quickslots:['potion-hp','potion-mp'],getQuickslot:i=>i?'potion-mp':'potion-hp',getConsumableCount:()=>2,useConsumable:()=>{debits++;return true;}};
      const manager=new HotkeyManager({consumePotion:()=>slot},controller,inventory,null,true,()=> 'idle',()=>true,async potionId=>{requests++;assert.equal(potionId,slot===1?'potion-hp':'potion-mp');return accepted;});
      manager.update(.016);manager.update(.016);await new Promise(r=>setTimeout(r,0));
      assert.equal(requests,1);assert.equal(debits,0);assert.equal(controller.hp,50);assert.equal(controller.mp,20);
    }
  });
  await check('native potion emitter -> Pocket sanitizer -> real server operation, replay once',async()=>{
    for(const potionId of ['potion-hp','potion-mp']){
      let state=await fresh();state.checkpoint.hp=20;state.checkpoint.mp=10;state.inventory.consumables[potionId]=2;
      let request;
      const emitter=new PirateVitalsEmitter({request:async raw=>{
        request=sanitizePirateStateOperation(raw);assert.ok(request);
        const result=await call('state-operation',{state,operation:request,commandId:'runtime-potion-command-01',revision:1,nextRevision:2});state=result.state;return result;
      }});
      assert.equal(await emitter.potion(potionId),true);
      assert.equal(state.inventory.consumables[potionId],1);
      assert.ok(state.checkpoint[potionId==='potion-hp'?'hp':'mp']>(potionId==='potion-hp'?20:10));
      const replay=await call('state-operation',{state,operation:request,commandId:'runtime-potion-command-01',revision:2,nextRevision:3});
      assert.deepEqual(replay.state,state);
      await assert.rejects(()=>call('state-operation',{state,operation:{...request,potionId:potionId==='potion-hp'?'potion-mp':'potion-hp'},commandId:'runtime-potion-command-01'}),/IDEMPOTENCY_KEY_REUSED/);
    }
  });
  await check('real death/respawn operation -> parent relay -> one presentation teleport',async()=>{
    const state=await fresh();state.checkpoint.hp=0;
    const result=await call('state-operation',{state,operation:{type:'vitalsRespawn',idempotencyKey:'respawn-runtime-01'},commandId:'runtime-respawn-command-01',revision:4,nextRevision:5});
    const {vitals}=await call('vitals-snapshot',{state:result.state,revision:5});
    const forwarded=sanitizePirateOriginalWorld(envelope(vitals));assert.ok(forwarded);
    let teleports=0;
    const authority=new PirateVitalsAuthority();
    const controller={setServerVitalsAuthority:()=>{},teleport:()=>{teleports++;}};
    const combat={setServerVitalsAuthority:()=>{},applyServerVitals:()=>{}};
    const spawn={setServerVitalsAuthority:()=>{},activateSpawnPoint:()=>{}};
    assert.equal(applyPirateVitalsSnapshot(authority,controller,combat,spawn,forwarded.vitals),true);
    assert.equal(applyPirateVitalsSnapshot(authority,controller,combat,spawn,forwarded.vitals),false);
    assert.equal(teleports,1);assert.equal(vitals.dead,false);assert.equal(vitals.hp,vitals.maxHp);
  });
  await check('central market uses real EconomyEngine: read-only quote, buy, replay, collision',async()=>{
    let state=await fresh();
    state=(await call('state-operation',{state,operation:{type:'boatPurchase',boatId:'training-dinghy',idempotencyKey:'boat-runtime-001'},commandId:'runtime-boat-command-01'})).state;
    state.progression.coins=10000;
    const engine=createEconomyEngine();let market={...engine.snapshot(),revision:1};
    const before=structuredClone({state,market});
    const quoteInput=sanitizePirateStateOperation({type:'tradeQuote',schemaVersion:1,action:'buy',islandId:'starter-island',commodityId:'fresh-fish',quantity:1});
    const quote=await call('state-operation',{state,market,operation:quoteInput});
    assert.ok(quote.quote.unitPrice>0);assert.deepEqual({state,market},before);
    const trade=sanitizePirateStateOperation({...quoteInput,type:'trade',idempotencyKey:'trade-runtime-001',expectedUnitPrice:quote.quote.unitPrice});
    const result=await call('state-operation',{state,market,operation:trade,commandId:'runtime-trade-command-01'});
    assert.equal(result.state.progression.coins,state.progression.coins-result.outcome.total);
    assert.equal(result.nextMarket.revision,2);
    state=result.state;market=result.nextMarket;
    const replay=await call('state-operation',{state,market,operation:trade,commandId:'runtime-trade-command-01'});
    assert.deepEqual(replay.state,state);assert.deepEqual(replay.nextMarket,market);
    assert.equal(replay.outcome.idempotentReplay,true);
    await assert.rejects(()=>call('state-operation',{state,market,operation:{...trade,quantity:2},commandId:'runtime-trade-command-01'}),/IDEMPOTENCY_KEY_REUSED/);
  });
  await check('Pocket HTTP adapter binds sessions and keeps transient input out of state queue',async()=>{
    let session='runtime-session-token';const paths=[];
    const client=createPirateCentralStateClient({config:{apiBaseUrl:'https://example.invalid/',apiVersion:'1'},getSessionToken:()=>session,
      fetchImpl:async(url,options)=>{paths.push(new URL(url).pathname);assert.equal(options.headers.Authorization,'Bearer runtime-session-token');return Response.json({ok:true,revision:7,persisted:null,outcome:{accepted:true}});}});
    const queue=createPirateStateOperationQueue({client,revision:7});
    await client.sendVitalsInput({type:'vitalsInput',contract:'pirate-vitals/1',blocking:true,mounted:false,sprinting:false});
    assert.equal(queue.pending,0);assert.equal(queue.revision,7);assert.deepEqual(paths,['/api/pirate/vitals/input']);
    session='another-session';await assert.rejects(()=>client.read(),/STALE_SESSION/);assert.equal(paths.length,1);
  });
  await check('Pocket queue transport retry reuses command identity; CAS conflict rebases once',async()=>{
    const operation={type:'boatSelection',selectedBoatId:'training-dinghy'};
    const ids=[];let calls=0;
    const queue=createPirateStateOperationQueue({revision:1,client:{commitOperation:async(revision,op,id)=>{ids.push(id);if(++calls===1)throw new TypeError('network');return {revision:2,persisted:null};}}});
    await queue.enqueue(operation);assert.equal(calls,2);assert.equal(ids[0],ids[1]);assert.equal(queue.revision,2);
    let conflicts=0,reads=0;const rebased=[];
    const retry=createPirateStateOperationQueue({revision:1,client:{read:async()=>{reads++;return {initialized:true,revision:4};},commitOperation:async(revision,op,id)=>{
      rebased.push({revision,id});if(++conflicts===1)throw Object.assign(new Error('conflict'),{status:409,code:'STATE_CONFLICT'});return {revision:5,persisted:null};}}});
    await retry.enqueue(operation);assert.equal(reads,1);assert.deepEqual(rebased.map(x=>x.revision),[1,4]);assert.notEqual(rebased[0].id,rebased[1].id);
  });
}finally{await rm(temp,{recursive:true,force:true});}
const report={verdict:results.every(r=>r.verdict==='SAT')?'SAT':'VIOL',checks:results.length,results,
  scope:'Real producer/domain/relay/receiver modules. HTTP/SQL host is injected. No live host, native bundled browser or production authorization claim.'};
if(process.env.PAIR_REPORT_PATH)await writeFile(process.env.PAIR_REPORT_PATH,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));if(report.verdict!=='SAT')process.exitCode=1;
