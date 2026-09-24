import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderReleaseEvidence} from '../brain/release-evidence.mjs';
test('release renderer separates merged code from deployment and fails closed on absent data',()=>{
  assert.equal(renderReleaseEvidence(null),'');
  assert.equal(renderReleaseEvidence({schemaVersion:'bad'}),'');
  const html=renderReleaseEvidence({schemaVersion:'1.0.0',proofs:[{label:'<script>x</script>',scope:'test',detail:'unverified host'}],fields:[],limitations:['Production UNKNOWN']});
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('UNKNOWN'));
  assert.ok(!html.includes('<script>'));
});
test('release evidence requires exact source identities and non-promoted graph verdict',async()=>{
  const release=JSON.parse(await readFile(new URL('./deep-profiles/pocket-pirate-release.json',import.meta.url),'utf8'));
  assert.equal(release.schemaVersion,'1.0.0');
  assert.equal(release.status,'MERGED_CODE');
  for(const row of Object.values(release.repositories)){
    assert.equal(row.merged,true);
    assert.match(row.head,/^[0-9a-f]{40}$/);
    assert.match(row.mergeSha,/^[0-9a-f]{40}$/);
  }
  assert.ok(release.fields.length>=8);
  for(const row of release.fields)for(const key of ['message','direction','fields','writer','validator','commit','limit'])assert.ok(row[key]);
  assert.equal(release.reuseDecision,'UNKNOWN');
  assert.ok(release.proofs.some(row=>row.label==='Authenticated gameplay host'&&row.verdict==='UNKNOWN'));
});
