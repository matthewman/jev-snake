import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runContinuousEpisode} from '../src/continuous.mjs';
import {actionCandidates} from '../src/features.mjs';
import {requestBody} from '../src/jev.mjs';
import {manualClock} from '../src/virtual-clock.mjs';
import {hash} from '../src/artifacts.mjs';
import {verifyRecording} from '../src/verify.mjs';

// Offline fixture for exploring the player. No API calls or measured latency.
try {
  const {values}=parseArgs({options:{out:{type:'string'}}});
  const config={...JSON.parse(await readFile(new URL('../demo.json',import.meta.url),'utf8')),
    id:'snake-offline-sample-v1',model:'scripted-controller (offline)',
    maxSteps:80,seeds:[7307],maxCalls:80};
  const clock=manualClock(),payloads=[],startedAt=new Date().toISOString();
  const agent={async decide({state}) {
    payloads.push({observationTick:state.step,body:JSON.stringify(requestBody(config,state))});
    const candidates=actionCandidates(state).filter(c=>!c.hitsWall&&!c.hitsBody)
      .sort((a,b)=>a.foodDistanceAfterMove-b.foodDistanceAfterMove);
    return {action:candidates[0]?.action??'straight',resolvedModel:config.model};
  }};
  const episode=await clock.finish(runContinuousEpisode(config,
    {seed:config.seeds[0],repeat:0,deadlineMs:config.deadlineMs},agent,{clock,maxCalls:config.maxCalls}));
  episode.payloads=payloads;
  const data={schemaVersion:1,kind:'jev-snake-demo',config,startedAt,finishedAt:new Date().toISOString(),
    source:{kind:'synthetic',clock:'virtual; zero response delay',node:process.version,retries:0},
    episodes:[episode],calls:episode.requests.length,complete:true,stopReason:null};
  const artifact={...data,artifactHash:hash(data)};
  verifyRecording(artifact);
  const output=resolve(values.out??fileURLToPath(new URL('../recordings/offline-sample.json',import.meta.url)));
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(artifact),{flag:'wx'});
  console.log(`Saved ${output}. Scripted controller, virtual clock, 0 API requests; not Jev gameplay.`);
} catch(error) {
  console.error(error.code==='EEXIST'?'Output already exists; choose a new --out path.':error.message);
  process.exitCode=1;
}
