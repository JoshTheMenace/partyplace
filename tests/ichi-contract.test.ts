import { test } from 'node:test';
import { assertSerializable } from '../apps/party-server/src/room-server';
import { rules } from '../packages/games/ichi/src/server';
import { defaults, packs } from '../packages/games/ichi/src/types';
for (const count of [2,10]) test(`Ichi: ${count}-player projections stay serializable through timeout results`, () => {
  const players=Array.from({length:count},(_,i)=>({id:`p${i}`,name:`Player000000000${i}`,color:'#ff5748'}));
  const state=rules.create({roomId:'r',roundId:'r1',nowMs:0,seed:412,players},{...defaults,maxTurns:80,...Object.fromEntries(Object.keys(packs).map(k=>[k,true]))});
  while (!state.complete) {
    const ctx={nowMs:state.lastNow,phase:'playing' as const};
    assertSerializable(rules.publicView(state,ctx));
    for (const p of players) assertSerializable(rules.playerView(state,p.id,ctx));
    rules.tick(state,new Map(),0,state.deadline);
  }
  assertSerializable(rules.outcome(state)); assertSerializable(rules.publicView(state,{nowMs:state.lastNow,phase:'results'}));
});
