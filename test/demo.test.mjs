import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSnake} from '../src/snake.mjs';
import {random} from '../src/random.mjs';
import {actionCandidates,observation} from '../src/features.mjs';
import {requestBody,createJev} from '../src/jev.mjs';
import {runContinuousEpisode} from '../src/continuous.mjs';
import {verifyRecording} from '../src/verify.mjs';
import {hash} from '../src/artifacts.mjs';
import {manualClock} from '../src/virtual-clock.mjs';
const config=JSON.parse(await readFile(new URL('../demo.json',import.meta.url),'utf8'));
const seal=a=>({...a,artifactHash:hash(a)});

test('seeded boards and RNG are portable',()=>{
  const rng=random(1);assert.deepEqual(Array.from({length:3},()=>rng()*4294967296),[270369,67634689,2647435461]);
  const a=createSnake(config,7307),b=createSnake(config,7307);
  for(const action of ['straight','left','straight','right'])assert.deepEqual(a.step(action),b.step(action));
});

test('geometry describes each engine move including the vacating tail',()=>{
  const state={width:6,height:6,body:[[5,2],[5,3],[4,3],[4,2]],heading:0,food:[5,1]};
  const facts=actionCandidates(state);
  assert.deepEqual(facts.map(f=>[f.action,f.hitsWall,f.hitsBody,f.eatsFood,f.foodDistanceAfterMove]),
    [['left',false,false,false,2],['straight',false,false,true,0],['right',true,false,false,2]]);
  const blocked=structuredClone(state);blocked.food=[4,2];assert.equal(actionCandidates(blocked)[0].hitsBody,true);
  blocked.body.push([3,2]);assert.equal(actionCandidates(blocked)[0].hitsBody,true);
  assert.ok(actionCandidates({...state,food:null}).every(f=>f.foodDistanceAfterMove===null));
});

test('observation has named coordinates and does not mutate engine state',()=>{
  const state=createSnake(config,7307).observe(),original=structuredClone(state),o=observation(state);
  assert.equal(o.heading,'right');assert.deepEqual(o.body[0],{x:6,y:6});o.body[0].x=0;assert.deepEqual(state,original);
});

test('native Choice payload is exact; returned unsafe choices are not repaired',async()=>{
  const game=createSnake(config,7307);for(let i=0;i<5;i++)game.step('straight');const state=game.observe();
  const sent=[];let calls=0;
  const agent=createJev(config,{key:'test-only',onRequest:p=>sent.push(p),fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(options.redirect,'error');
    assert.deepEqual(JSON.parse(options.body),requestBody(config,state));
    return {ok:true,json:async()=>({model:'fixture-model',answers:{move:{choice:'straight'}}})};
  }});
  const decision=await agent.decide({state,signal:new AbortController().signal});
  assert.equal(decision.action,'straight');assert.equal(game.step(decision.action).reason,'wall');
  assert.equal(calls,1);assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent).includes('test-only'));
});

test('provider token usage is retained without treating missing or invalid counts as zero',async()=>{
  for(const [usage,expected] of [
    [{input_tokens:820,output_tokens:38},{inputTokens:820,outputTokens:38}],
    [undefined,null],
    [{input_tokens:-1,output_tokens:'38'},null],
    [{input_tokens:0},{inputTokens:0,outputTokens:null}],
  ]){
    const agent=createJev(config,{key:'test-only',fetchImpl:async()=>({ok:true,json:async()=>({
      answers:{move:{choice:'left'}},model:'fixture-model',usage,
    })})});
    const result=await agent.decide({state:createSnake(config,7307).observe(),signal:new AbortController().signal});
    assert.deepEqual(result.usage,expected);
  }
});

for(const [delay,action,tick] of [[499,'left',1],[500,'left',2],[1000,'straight',null]])test(`continuous clock at ${delay}ms`,async()=>{
  const clock=manualClock(),suite={...config,tickMs:500,maxSteps:3};
  const episode=await clock.finish(runContinuousEpisode(suite,{seed:7307,repeat:0,deadlineMs:1000},
    {decide:()=>new Promise(resolve=>clock.set(()=>resolve({action:'left'}),delay))},{clock}));
  assert.equal(episode.requests[0].action,action);assert.equal(episode.requests[0].appliedTick,tick);
  assert.deepEqual(episode.events.map(e=>e.atMs),[500,1000,1500]);
});

test('payloads and timing replay; edited states and fabricated requests fail verification',async()=>{
  const c={...config,seeds:[7307],maxSteps:4},clock=manualClock(),payloads=[];
  const episode=await clock.finish(runContinuousEpisode(c,{seed:7307,repeat:0,deadlineMs:c.deadlineMs},
    {decide:async({state})=>{payloads.push({observationTick:state.step,body:JSON.stringify(requestBody(c,state))});return {action:'left',resolvedModel:'fixture-model'};}},{clock}));
  episode.payloads=payloads;
  const a={kind:'jev-snake-demo',schemaVersion:1,config:c,complete:true,stopReason:null,calls:episode.requests.length,episodes:[episode]};
  assert.equal(verifyRecording(seal(a)),true);
  const altered=structuredClone(a);altered.episodes[0].events[0].state.score=99;
  assert.throws(()=>verifyRecording(seal(altered)),/Replay/);
  const fabricated=structuredClone(a);fabricated.episodes[0].payloads[0].body='{}';
  assert.throws(()=>verifyRecording(seal(fabricated)),/payload/);
  assert.throws(()=>verifyRecording(seal({...a,complete:false})),/incomplete/);
});

test('provider errors and budget exhaustion remain incomplete',async()=>{
  for(const failed of [true,false]){
    const clock=manualClock();
    const e=await clock.finish(runContinuousEpisode(config,{seed:7307,repeat:0,deadlineMs:1000},
      {decide:async()=>{if(failed)throw new Error('private provider detail');return {action:'left'};}},{clock,maxCalls:2}));
    assert.equal(e.complete,false);assert.equal(e.stopReason,failed?'provider-error':'call-limit');
  }
});
