import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const graph=JSON.parse(await readFile(new URL('./graph/project-brain.json',import.meta.url),'utf8'));
const readme=await readFile(new URL('./README.md',import.meta.url),'utf8');
const webReadme=await readFile(new URL('../brain/README.md',import.meta.url),'utf8');

test('Project Brain exposes one web human interface',()=>{
  assert.equal(graph.interfaces.human,'web');
  assert.equal(graph.interfaces.webPath,'/brain/');
  assert.equal(graph.interfaces.localVault,false);
  assert.equal(graph.interfaces.deviceSync,false);
  assert.equal(graph.temporal.defaultCheckpoint,'pb-2026-09-25-pocket-vps-connectivity-v069');
});

test('local vault sync executables are removed from the repository',async()=>{
  await assert.rejects(access(new URL('./install-pb-sync.sh',import.meta.url)));
  await assert.rejects(access(new URL('./sync-to-obsidian.sh',import.meta.url)));
});

test('current docs make the Web Viewer the single human interface',()=>{
  assert.match(readme,/Web Viewer เป็น Human Interface หลักเพียงตัวเดียว/);
  assert.match(readme,/ไม่ใช้ Obsidian, local Vault หรือ mobile sync/);
  assert.match(webReadme,/only human interface/);
  assert.match(webReadme,/same responsive application/);
});
