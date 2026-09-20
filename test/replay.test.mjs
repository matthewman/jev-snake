import test from 'node:test';
import assert from 'node:assert/strict';
import {runContinuousEpisode} from '../src/continuous.mjs';
import {replayAt,responseStatsAt} from '../src/replay.mjs';
import {manualClock} from '../src/virtual-clock.mjs';
const config={width:12,height:12,tickMs:250,maxSteps:20,starvationSteps:100};
const item={seed:7307,repeat:0,deadlineMs:5000};

test('response averages follow playback time, exclude missing replies, and rewind correctly',()=>{
  const reply=(status,resolvedAtMs,latencyMs,censored=false)=>({status,resolvedAtMs,latencyMs,censored});
  const e={durationMs:1000,requests:[
    reply('accepted',100,100),reply('timeout',200,null,true),
    reply('accepted',400,300),reply('invalid',500,50),
    reply('error',600,null),reply('cancelled',700,null,true),
    reply('pending',null,null,true),reply('accepted',1100,100),
  ]};
  assert.deepEqual(responseStatsAt(e,0),{count:0,averageMs:null,lastMs:null});
  assert.deepEqual(responseStatsAt(e,99),{count:0,averageMs:null,lastMs:null});
  assert.deepEqual(responseStatsAt(e,100),{count:1,averageMs:100,lastMs:100});
  assert.deepEqual(responseStatsAt(e,399),{count:1,averageMs:100,lastMs:100});
  assert.deepEqual(responseStatsAt(e,400),{count:2,averageMs:200,lastMs:300});
  assert.deepEqual(responseStatsAt(e,500),{count:3,averageMs:150,lastMs:50});
  assert.deepEqual(responseStatsAt(e,2000),{count:3,averageMs:150,lastMs:50});
  assert.deepEqual(responseStatsAt(e,100),{count:1,averageMs:100,lastMs:100});
});

test('hung inference cannot stop the world clock; replay shows movement while pending',async()=>{
  const clock=manualClock();
  const episode=await clock.finish(runContinuousEpisode(config,item,{decide:()=>new Promise(()=>{})},{clock}));
  assert.deepEqual(episode.events.map(e=>e.atMs),[250,500,750,1000,1250,1500]);
  assert.ok(episode.events.every(e=>e.status==='continue'&&e.action==='straight'));
  assert.equal(episode.reason,'wall');assert.equal(episode.requests[0].status,'cancelled');
  const a=replayAt(episode,600),b=replayAt(episode,800);
  assert.equal(a.pending.id,0);assert.equal(b.pending.id,0);
  assert.equal(a.frame,2);assert.equal(b.frame,3);
  assert.deepEqual(a.state.body[0],[8,6]);assert.deepEqual(b.state.body[0],[9,6]);
  assert.equal(replayAt(episode,749).state,a.state);
});

test('a late response applies on a later tick; pixel replay never anticipates or delays the turn',async()=>{
  const clock=manualClock();
  const episode=await clock.finish(runContinuousEpisode({...config,maxSteps:4},item,
    {decide:()=>new Promise(resolve=>clock.set(()=>resolve({action:'left'}),600))},{clock}));
  assert.deepEqual(episode.events.map(e=>e.action),['straight','straight','left','straight']);
  assert.equal(episode.requests[0].appliedTick,3);
  assert.deepEqual(replayAt(episode,625).state.body[0],[8,6]);
  assert.deepEqual(replayAt(episode,749).state.body[0],[8,6]);
  assert.deepEqual(replayAt(episode,750).state.body[0],[8,5]);
  assert.deepEqual(replayAt(episode,875).state.body[0],[8,5]);
  const end=replayAt(episode,1500);assert.equal(end.time,1000);
  assert.deepEqual(end.state.body,episode.events.at(-1).state.body);
});
