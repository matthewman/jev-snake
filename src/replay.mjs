// Pure replay projection; recorded clock time drives both panels and video frames.
export function replayAt(episode,timeMs) {
  const time=Math.max(0,Math.min(timeMs,episode.durationMs));
  let frame=0;
  while(frame<episode.events.length&&episode.events[frame].atMs<=time)frame++;
  const state=frame?episode.events[frame-1].state:episode.initial;
  const pending=episode.requests.find(r=>r.dispatchedAtMs<=time&&r.resolvedAtMs>time);
  const ready=episode.requests.find(r=>r.status==='accepted'&&r.resolvedAtMs<=time
    &&r.appliedTick!==null&&r.appliedTick>frame);
  const last=episode.requests.filter(r=>r.resolvedAtMs<=time&&r.latencyMs!==null).at(-1);
  return {time,frame,state,pending,ready,last,responseStats:responseStatsAt(episode,time),
    status:state.done?`Ended · ${state.reason}`:pending?'Awaiting response':ready?`Queued · ${ready.action}`:'Moving straight'};
}

// A cumulative mean of actual replies received by this replay timestamp.
// Timeouts, cancellations and provider errors are not response-time samples.
export function responseStatsAt(episode,timeMs) {
  const time=Math.max(0,Math.min(timeMs,episode.durationMs));
  let count=0,total=0,lastMs=null,lastAt=-Infinity;
  for(const r of episode.requests) {
    if(!['accepted','invalid'].includes(r.status)||r.censored!==false
      ||!Number.isFinite(r.resolvedAtMs)||r.resolvedAtMs>time
      ||!Number.isFinite(r.latencyMs)||r.latencyMs<0)continue;
    count++;total+=r.latencyMs;
    if(r.resolvedAtMs>=lastAt){lastAt=r.resolvedAtMs;lastMs=r.latencyMs;}
  }
  return {count,averageMs:count?total/count:null,lastMs};
}
