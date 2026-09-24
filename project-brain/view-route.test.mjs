import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProjectBrainView} from '../brain/view-route.mjs';
const views={overview:'Overview',graph:'Graph',history:'History'};
test('node deep links open the graph without overriding an explicit valid view',()=>{
  for(const [query,expected] of [
    ['', 'overview'], ['node=integration:pocketmonster-pirate-fruit','graph'],
    ['node=repo:pocketmonster','graph'], ['node=','overview'],
    ['view=history&node=repo:pocketmonster','history'],
    ['view=overview&node=repo:pocketmonster','overview'],
    ['view=unknown&node=repo:pocketmonster','graph'],
    ['view=unknown','overview'], ['view=graph','graph'],
  ]) assert.equal(initialProjectBrainView(new URLSearchParams(query),views),expected,query);
});
