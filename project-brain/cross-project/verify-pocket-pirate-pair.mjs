import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

export const POCKET_HEAD='ba1347d8537519543669273c7964d8c6079c57b2';
export const PIRATE_HEAD='f08ed860162fb27d33332c8d31d1c1f3d4cbb32d';

const [pocketArg,pirateArg]=process.argv.slice(2);
if(!pocketArg||!pirateArg)throw new Error('usage: verify-pocket-pirate-pair.mjs <pocket-root> <pirate-root>');
const pocket=resolve(pocketArg);
const pirate=resolve(pirateArg);

function head(path){
  return execFileSync('git',['-C',path,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
}
async function text(path){
  return readFile(path,'utf8');
}
function must(content,pattern,label){
  assert.match(content,pattern,label);
}

assert.equal(head(pocket),POCKET_HEAD,'Pocket checkout must match the pinned candidate head');
assert.equal(head(pirate),PIRATE_HEAD,'Pirate checkout must match the pinned candidate head');

const pocketWorld=await text(resolve(pocket,'pirate-original-world-contract.mjs'));
const pocketState=await text(resolve(pocket,'pirate-central-state-client.mjs'));
const pocketPresence=await text(resolve(pocket,'world-presence-protocol.mjs'));
const pirateVitalsAuthority=await text(resolve(pirate,'client/src/realtime/PirateVitalsAuthority.ts'));
const pirateVitalsBridge=await text(resolve(pirate,'client/src/realtime/PirateVitalsClientBridge.ts'));
const pirateVitalsRules=await text(resolve(pirate,'server/src/player/vitalsRules.ts'));
const pirateTrade=await text(resolve(pirate,'server/src/trade/centralOriginalTradeOperation.ts'));
const pirateWorker=await text(resolve(pirate,'server/src/world/centralWorker.ts'));

for(const [content,label] of [[pocketWorld,'Pocket original-world'],[pirateVitalsAuthority,'Pirate vitals receiver'],[pirateVitalsRules,'Pirate vitals server']]){
  must(content,/pirate-vitals\/1/,label+' must use pirate-vitals/1');
}
must(pocketWorld,/sanitizePirateVitals/,'Pocket must validate Pirate vitals before relay');
must(pocketWorld,/revision/,'Pocket vitals envelope must carry revision');
must(pirateVitalsAuthority,/value\.revision <= this\.lastRevision/,'Pirate receiver must reject stale vitals revisions');
must(pirateVitalsBridge,/setServerVitalsAuthority\(true\)/,'Pirate presentation must disable local vitals authority after server claim');

must(pocketState,/type === 'vitalsInput'/,'Pocket must recognize transient vitals input');
must(pocketState,/api\/pirate\/vitals\/input/,'Pocket transient vitals input must use the dedicated server endpoint');
must(pocketState,/source\.type === 'tradeQuote'/,'Pocket must validate trade quote intent');
must(pocketState,/source\.type === 'trade'/,'Pocket must validate trade mutation intent');
must(pirateTrade,/quoteCentralOriginalTradeOperation/,'Pirate server must own central quote computation');
must(pirateTrade,/applyCentralOriginalTradeOperation/,'Pirate server must own central trade execution');
must(pirateTrade,/loadBundledEconomyEngine/,'Pirate central trade must use the bundled canonical economy engine');
must(pirateTrade,/operationReceipts/,'Pirate central trade must preserve operation idempotency receipts');

must(pocketPresence,/sanitizeMonsterIntent/,'Pocket shared protocol must validate monster intent');
must(pirateWorker,/MonsterWorldService/,'Pirate central worker must compose the shared monster world service');
must(pirateWorker,/player-hit-preview/,'Pirate worker must keep player-hit preview/ack boundary');
must(pirateWorker,/vitals-snapshot/,'Pirate worker must expose canonical vitals snapshot operation');
must(pirateWorker,/economy-tick/,'Pirate worker must expose central economy tick operation');

console.log(JSON.stringify({
  ok:true,
  verdict:'SAT',
  pocketHead:POCKET_HEAD,
  pirateHead:PIRATE_HEAD,
  contracts:['pirate-vitals/1','tradeQuote/trade','monster intent','central worker composition'],
  semanticRule:'SAT proves pinned structural contract compatibility only; it does not merge or deploy either draft PR.'
}));
