import {hash} from './artifacts.mjs';
import {validateConfig} from './config.mjs';
import {verifyContinuousEpisode} from './verify-continuous.mjs';
import {requestBody} from './jev.mjs';
export function verifyRecording(a) {
  const {artifactHash,...payload}=a;
  if(hash(payload)!==artifactHash||a.kind!=='jev-snake-demo'||a.schemaVersion!==1)throw new Error('Invalid recording checksum or type');
  validateConfig(a.config);
  if(!a.complete||a.stopReason||a.episodes.length!==a.config.seeds.length)throw new Error('Recording is incomplete');
  let calls=0;
  const models=new Set();
  for(const [i,e] of a.episodes.entries()) {
    if(e.seed!==a.config.seeds[i]||e.deadlineMs!==a.config.deadlineMs||e.repeat!==0)throw new Error('Recording schedule mismatch');
    calls+=verifyContinuousEpisode(a.config,e);
    const states=[e.initial,...e.events.map(t=>t.state)];
    if(!Array.isArray(e.payloads))throw new Error('Missing request bodies');
    for(const r of e.requests) {
      if(r.resolvedModel)models.add(r.resolvedModel);
      const sent=e.payloads.filter(p=>p.observationTick===r.observationTick);
      if(sent.length===0&&r.status==='cancelled')continue;
      if(sent.length!==1||sent[0].body!==JSON.stringify(requestBody(a.config,states[r.observationTick])))throw new Error('Request payload mismatch');
    }
    if(e.payloads.some(p=>!e.requests.some(r=>r.observationTick===p.observationTick)))throw new Error('Unexpected payload');
  }
  if(calls!==a.calls||calls>a.config.maxCalls||models.size>1)throw new Error('Call count or revision mismatch');
  return true;
}
