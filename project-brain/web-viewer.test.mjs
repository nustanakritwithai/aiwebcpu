import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../brain/index.html',import.meta.url),'utf8');
const js=await readFile(new URL('../brain/app.js',import.meta.url),'utf8');
const css=await readFile(new URL('../brain/style.css',import.meta.url),'utf8');

test('viewer loads the canonical Project Brain graph, not a duplicate dataset',()=>{
  assert.match(js,/fetch\('\.\.\/project-brain\/graph\/project-brain\.json'/);
  assert.doesNotMatch(js,/const graph\s*=\s*\{\s*"nodes"/);
});

test('viewer exposes node filters, search, relation labels and details',()=>{
  for(const id of ['search','type-filters','edge-labels','detail','timeline-list'])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(js,/PROVIDES/);
  assert.match(js,/VERIFIED_BY/);
  assert.match(js,/BLOCKED_BY/);
  assert.match(js,/ADAPTED_FROM/);
});

test('viewer is mobile-first and supports pan/zoom controls',()=>{
  assert.match(html,/viewport-fit=cover/);
  assert.match(js,/pointerdown/);
  assert.match(js,/zoom-in/);
  assert.match(css,/@media\(max-width:520px\)/);
});

test('viewer discloses V0.2 timeline limitation',()=>{
  assert.match(html,/historical graph replay/);
  assert.match(html,/V0\.2: event timeline/);
});
