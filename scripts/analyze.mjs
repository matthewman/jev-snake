import {readFile} from 'node:fs/promises';
import {verifyRecording} from '../src/verify.mjs';
import {actionCandidates} from '../src/features.mjs';

// Descriptive local analysis. Payload bytes are not tokens, and gameplay samples
// do not isolate the effect of input length, request order, or provider load.
function latency(rows) {
  const values=rows.map(r=>r.latencyMs).sort((a,b)=>a-b);
  const percentile=p=>values.length?values[Math.ceil(values.length*p)-1]:null;
  return {
    count:values.length,
    meanMs:values.length?values.reduce((s,x)=>s+x,0)/values.length:null,
    p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:values.at(-1)??null,
  };
}

try {
  if(!process.argv[2])throw new Error('Supply a recording JSON path.');
  const a=JSON.parse(await readFile(process.argv[2],'utf8'));
  verifyRecording(a);
  const requests=a.episodes.flatMap(e=>e.requests),rows=[];
  for(const e of a.episodes){
    for(const r of e.requests){
      if(!['accepted','invalid'].includes(r.status)||!Number.isFinite(r.latencyMs))continue;
      const payload=e.payloads.find(p=>p.observationTick===r.observationTick);
      const state=r.observationTick?e.events[r.observationTick-1].state:e.initial;
      rows.push({latencyMs:r.latencyMs,bodyLength:state.body.length,
        payloadBytes:Buffer.byteLength(payload.body),inputTokens:r.usage?.inputTokens??null});
    }
  }
  const output={
    artifactHash:a.artifactHash,configId:a.config.id,source:a.source,
    models:[...new Set(requests.map(r=>r.resolvedModel).filter(Boolean))],
    tickMs:a.config.tickMs,maxSteps:a.config.maxSteps,
    requests:requests.length,statusCounts:requests.reduce((n,r)=>(n[r.status]=(n[r.status]??0)+1,n),{}),
    latency:{...latency(rows),atLeastOneTick:rows.filter(r=>r.latencyMs>=a.config.tickMs).length},
    payloadBytes:rows.length?{min:Math.min(...rows.map(r=>r.payloadBytes)),max:Math.max(...rows.map(r=>r.payloadBytes))}:null,
    repliesWithInputTokenUsage:rows.filter(r=>r.inputTokens!==null).length,
    byBodyLength:[[3,10],[11,20],[21,1024]].map(([min,max])=>({
      min,max,...latency(rows.filter(r=>r.bodyLength>=min&&r.bodyLength<=max)),
    })),
    episodes:a.episodes.map(e=>{
      const last=e.events.at(-1),r=last.requestId===null?null:e.requests[last.requestId];
      const state=r?(r.observationTick?e.events[r.observationTick-1].state:e.initial):null;
      const candidates=state?actionCandidates(state):null;
      return {seed:e.seed,food:e.score,moves:e.steps,durationMs:e.durationMs,reason:e.reason,
        terminalAction:last.action,terminalRequestId:last.requestId,
        terminalLatencyMs:r?.latencyMs??null,terminalStaleTicks:r?.elapsedStateVersions??null,
        safeChoicesAtTerminalObservation:candidates?.filter(c=>!c.hitsWall&&!c.hitsBody).length??null,
        terminalCandidates:candidates};
    }),
    interpretation:'Descriptive recorded client timings, not model-only compute time or a controlled latency-scaling experiment. Body length is confounded with game progress, board difficulty and request order.',
  };
  console.log(JSON.stringify(output,null,2));
} catch(error) {
  console.error(error.message);process.exitCode=1;
}
