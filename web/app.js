import {replayAt} from './core/replay.mjs';
import {arrowChoices,DIRECTIONS} from './core/controls.mjs';
import {target as moveTarget} from './core/snake.mjs';
const $=id=>document.getElementById(id),canvas=$('screen'),ctx=canvas.getContext('2d');
if(matchMedia('(max-width:650px)').matches)$('format').value='portrait';
let recording=null,take=0,time=0,playing=false,raf=0,media=null,videoURL=null,loadToken=0;
const fixed=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
const episode=()=>recording?.episodes[take];
const duration=()=>episode()?.durationMs??0;
const endLabel=r=>({self:'Hit own body',wall:'Hit wall',starvation:'Food-wait limit', 'step-limit':'Move limit reached','board-filled':'Board filled'}[r]??r);
function text(value,x,y,size=20,color='#f2f0e6',family='Avenir Next, sans-serif'){
  ctx.fillStyle=color;ctx.font=`${size}px ${family}`;ctx.fillText(value,x,y);
}
function clearVideo(){if(videoURL)URL.revokeObjectURL(videoURL);videoURL=null;$('download').hidden=true;$('download').removeAttribute('href');}
function pause(){playing=false;cancelAnimationFrame(raf);$('play').textContent='Play';}
function paint(){
  const portrait=$('format').value==='portrait';
  const w=portrait?720:1280,h=portrait?1280:720;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  canvas.classList.toggle('portrait',portrait);
  ctx.fillStyle='#182b24';ctx.fillRect(0,0,w,h);
  const bx=portrait?56:40,by=portrait?156:100,size=portrait?608:584;
  text('Snake',bx,portrait?60:56,30,'#f2f0e6','Georgia, serif');
  if(!episode()){
    text('Open a recording to play.',bx,220,26,'#bfccb4');return;
  }
  const e=episode(),c=recording.config,f=replayAt(e,time),s=f.state;
  const cell=size/s.width,ch=size/s.height;
  ctx.textAlign='right';text(`${fixed(f.time/1000)} s`,bx+size,portrait?60:56,20,'#bfccb4','Menlo, monospace');ctx.textAlign='left';
  const x=portrait?56:680,pw=portrait?608:560;
  text(`${s.score} food`,x,portrait?124:67,portrait?32:40,'#d2ef81');
  ctx.textAlign='right';text(`${f.frame} / ${c.maxSteps} moves`,x+pw,portrait?124:65,18,'#bfccb4','Menlo, monospace');ctx.textAlign='left';
  ctx.fillStyle='#dce5cb';ctx.fillRect(bx,by,size,size);
  ctx.strokeStyle='#c5d2b4';ctx.lineWidth=1;
  for(let j=1;j<s.width;j++){ctx.beginPath();ctx.moveTo(bx+j*cell,by);ctx.lineTo(bx+j*cell,by+size);ctx.stroke();}
  for(let j=1;j<s.height;j++){ctx.beginPath();ctx.moveTo(bx,by+j*ch);ctx.lineTo(bx+size,by+j*ch);ctx.stroke();}
  s.body.forEach(([x,y],i)=>{
    ctx.fillStyle=i?'#5a885b':'#214e39';
    const left=Math.round(bx+x*cell)+2,top=Math.round(by+y*ch)+2;
    ctx.fillRect(left,top,Math.round(bx+(x+1)*cell)-2-left,Math.round(by+(y+1)*ch)-2-top);
  });
  if(s.food){
    const foodSize=Math.round(Math.min(cell,ch)*.54);ctx.fillStyle='#bc502e';
    ctx.fillRect(Math.round(bx+(s.food[0]+.5)*cell-foodSize/2),Math.round(by+(s.food[1]+.5)*ch-foodSize/2),foodSize,foodSize);
  }
  const [hx,hy]=s.body[0],v=[[0,-1],[1,0],[0,1],[-1,0]][s.heading];
  const eyeSize=Math.max(3,Math.round(Math.min(cell,ch)*.14));ctx.fillStyle='#f2f0e6';
  ctx.fillRect(Math.round(bx+(hx+.5+v[0]*.22)*cell-eyeSize/2),Math.round(by+(hy+.5+v[1]*.22)*ch-eyeSize/2),eyeSize,eyeSize);
  if(s.done&&['wall','self'].includes(s.reason)){
    const last=e.events[f.frame-1],before=f.frame>1?e.events[f.frame-2].state:e.initial,hit=moveTarget(before,last.action);
    const hitX=bx+Math.max(0,Math.min(s.width,hit[0]+.5))*cell,hitY=by+Math.max(0,Math.min(s.height,hit[1]+.5))*ch;
    ctx.strokeStyle='#df4937';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(bx+(hx+.5)*cell,by+(hy+.5)*ch);ctx.lineTo(hitX,hitY);ctx.moveTo(hitX-9,hitY-9);ctx.lineTo(hitX+9,hitY+9);ctx.moveTo(hitX+9,hitY-9);ctx.lineTo(hitX-9,hitY+9);ctx.stroke();
  }
  const r=f.pending??f.ready??f.last;
  const source=r?(r.observationTick?e.events[r.observationTick-1].state:e.initial):e.initial;
  const selected=r&&r.resolvedAtMs<=time&&r.status==='accepted'?r.action:null;
  const choices=arrowChoices(source),choice=choices.find(d=>!d.disabled&&d.action===selected);
  const status=s.done?endLabel(s.reason):f.pending?'Thinking…':choice?`${choice.arrow} ${choice.label}`:`${DIRECTIONS[s.heading].arrow} ${DIRECTIONS[s.heading].label}`;
  text(status,x,portrait?819:128,26,s.done?'#f3ae94':'#f2f0e6');
  const keyY=portrait?850:166,keyW=portrait?84:80,keyH=portrait?84:76,gap=12;
  for(const direction of choices){
    const left=x+direction.column*(keyW+gap),top=keyY+direction.row*(keyH+gap);
    const chosen=!direction.disabled&&selected===direction.action;
    ctx.fillStyle=direction.disabled?'#20332a':chosen?'#d2ef81':'#273e32';ctx.fillRect(left,top,keyW,keyH);
    ctx.textAlign='center';text(direction.arrow,left+keyW/2,top+keyH/2+14,42,direction.disabled?'#637869':chosen?'#182b24':'#f2f0e6','Menlo, monospace');ctx.textAlign='left';
  }
  const stats=f.responseStats,sx=portrait?408:1002,sy=portrait?873:190;
  text('Last response',sx,sy,18,'#bfccb4');
  text(`${fixed(stats.lastMs,0)} ms`,sx,sy+42,34);
  text('Avg response',sx,sy+106,18,'#bfccb4');
  text(`${fixed(stats.averageMs,0)} ms`,sx,sy+148,34,'#d2ef81');
  const ruleY=portrait?1080:414;
  ctx.fillStyle='#3c5343';ctx.fillRect(x,ruleY,pw,1);
  const model=e.requests.find(r=>r.resolvedModel)?.resolvedModel??c.model;
  text('MODEL',x,ruleY+39,13,'#bfccb4','Menlo, monospace');
  ctx.fillStyle='#f2f0e6';ctx.font='28px Menlo, monospace';ctx.fillText(model,x,ruleY+78,pw);
  text(`${c.tickMs} ms/move`,x,ruleY+128,24,'#d2ef81','Menlo, monospace');
  text(`${s.width} × ${s.height} · ${c.maxSteps} move limit · Seed ${e.seed}`,x,ruleY+169,16,'#bfccb4','Menlo, monospace');
  $('time').textContent=`${fixed(time/1000)} / ${fixed(duration()/1000)} s`;$('scrub').value=time;
  const desc=`Seed ${e.seed}: ${s.score} food, ${f.frame} moves. ${status}. Last response ${fixed(stats.lastMs,0)} ms. Average response ${fixed(stats.averageMs,0)} ms from ${stats.count} replies. ${c.tickMs} ms/move.`;
  canvas.setAttribute('aria-label',desc);$('decision').textContent=desc;
}
function configuration(){
  const e=episode(),c=recording.config;
  const model=e.requests.find(r=>r.resolvedModel)?.resolvedModel??c.model;
  const entries=[['Model',model],['Movement',`${c.tickMs} ms/move`],['Board',`${c.width} × ${c.height}`],['Move limit',c.maxSteps],['Seed',e.seed],['Response deadline',`${c.deadlineMs} ms`]];
  $('configuration').replaceChildren(...entries.map(([label,value])=>{
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=label;dd.textContent=value;row.append(dt,dd);return row;
  }));
}
function controls(disabled){
  for(const id of ['session','file','take','format','play','restart','scrub','range','record'])$(id).disabled=disabled;
  for(const b of $('attempts').children)b.disabled=disabled;
  if(!supported)$('record').disabled=true;
}
function choose(i){
  pause();clearVideo();take=i;time=0;$('take').value=i;$('scrub').max=duration();
  for(const [j,b] of [...$('attempts').children].entries())b.classList.toggle('selected',j===i);
  $('export-status').textContent='';configuration();paint();
}
function show(a,origin){
  // The local server verifies full traces. Imported files get basic shape checks here;
  // the CLI verifier is the authority for timings, payloads and complete replays.
  if(a.kind!=='jev-snake-demo'||!a.complete||!a.episodes?.length||a.episodes.length>50||a.config?.inputVersion!=='snake-assisted-v1')throw new Error('Unsupported or incomplete recording');
  for(const e of a.episodes){
    if(!Array.isArray(e.events)||!e.events.length||e.events.length>10000||!Array.isArray(e.requests)||!Number.isFinite(e.durationMs)||e.durationMs<=0)throw new Error('Invalid episode');
    for(const s of [e.initial,...e.events.map(t=>t.state)])if(!s||!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width<6||s.width>32||s.height<6||s.height>32||!Array.isArray(s.body)||!s.body.length||s.body.length>s.width*s.height||!s.body.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||!Number.isInteger(s.heading)||s.heading<0||s.heading>3||(s.food!==null&&(!Array.isArray(s.food)||s.food.length!==2||!s.food.every(Number.isFinite))))throw new Error('Invalid board');
    if(e.requests.some(r=>!Number.isInteger(r.observationTick)||r.observationTick<0||r.observationTick>=e.events.length))throw new Error('Invalid request');
  }
  recording=a;$('take').replaceChildren(...a.episodes.map((e,i)=>new Option(`${i+1} · Seed ${e.seed}`,i)));
  $('attempts').replaceChildren(...a.episodes.map((e,i)=>{
    const b=document.createElement('button');b.className='attempt';b.setAttribute('aria-label',`Watch take ${i+1}, seed ${e.seed}`);
    const name=document.createElement('small');name.textContent=`Take ${i+1} · Seed ${e.seed}`;
    const score=document.createElement('strong');score.textContent=`${e.score} food`;
    const detail=document.createElement('small');detail.textContent=`${fixed(e.durationMs/1000)}s · ${e.steps} moves · ${endLabel(e.reason)}`;
    b.append(name,score,detail);b.onclick=()=>choose(i);return b;
  }));
  $('take-count').textContent=`${a.episodes.length} takes`;
  $('status').textContent='';
  $('provenance').textContent=`${origin}. Recorded ${a.startedAt??'unknown date'} · Source ${a.source?.commit?.slice(0,7)??'unknown'} · Artifact ${a.artifactHash?.slice(0,16)??'unknown'}. Built with Codex.`;
  controls(false);choose(0);
}
function play(end=duration(),done=()=>{}){
  if(!episode())return;
  if(time>=end)time=0;
  const base=time,start=performance.now();playing=true;$('play').textContent='Pause';
  function step(now){if(!playing)return;time=Math.min(end,base+now-start);paint();if(time>=end){pause();done();}else raf=requestAnimationFrame(step);}
  raf=requestAnimationFrame(step);
}
async function load(url){
  const token=++loadToken;pause();clearVideo();controls(true);$('status').textContent='Loading local recording…';
  try{const response=await fetch(url);if(!response.ok)throw new Error();const a=await response.json();if(token!==loadToken)return;show(a,'Replay verified by local server');}
  catch{if(token===loadToken){$('status').textContent='Could not load that recording. Try another session or open a local JSON file.';controls(false);if(!recording)for(const id of ['play','restart','scrub','record','take'])$(id).disabled=true;}}
}
$('play').onclick=()=>playing?pause():play();$('restart').onclick=()=>choose(take);
$('take').onchange=()=>choose(Number($('take').value));
$('scrub').oninput=()=>{pause();time=Number($('scrub').value);paint();};
$('format').onchange=()=>{clearVideo();paint();};
$('file').onchange=async()=>{
  const file=$('file').files[0];if(!file)return;
  const token=++loadToken;pause();clearVideo();
  try{if(file.size>50*1024*1024)throw new Error();const a=JSON.parse(await file.text());if(token!==loadToken)return;show(a,'Imported locally; use npm run verify to audit this file');}
  catch{if(token===loadToken)$('status').textContent='That file could not be opened. Choose a complete Jev Snake demo recording (up to 50 MB).';}
  $('file').value='';
};
const supported=typeof MediaRecorder!=='undefined'&&typeof canvas.captureStream==='function';
$('record').onclick=()=>{
  if(!episode())return;pause();clearVideo();
  if($('range').value==='full'||time>=duration())time=0;
  const clipStart=time,clipEnd=$('range').value==='full'?duration():Math.min(duration(),time+30000);
  let stream,active,cancelled=false;const chunks=[];
  try{
    const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime)throw new Error();paint();stream=canvas.captureStream(30);
    active=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000});media=active;controls(true);
    active.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    active.onerror=()=>{cancelled=true;if(active.state!=='inactive')active.stop();};
    active.onstop=()=>{
      pause();stream.getTracks().forEach(t=>t.stop());media=null;controls(false);paint();
      if(cancelled||document.hidden||time<clipEnd){$('export-status').textContent='Recording interrupted. Keep the page visible and try again; no partial clip was exported.';return;}
      const blob=new Blob(chunks,{type:active.mimeType});if(!blob.size){$('export-status').textContent='The browser returned an empty recording. Please try again.';return;}
      videoURL=URL.createObjectURL(blob);const link=$('download');link.href=videoURL;
      link.download=`jev-snake-${episode().seed}-${Math.floor(clipStart)}-${Math.floor(clipEnd)}ms-${$('format').value}.${active.mimeType.includes('mp4')?'mp4':'webm'}`;
      link.textContent=`Save video (${(blob.size/1024/1024).toFixed(1)} MB)`;link.hidden=false;
      $('export-status').textContent=`Clip ready: ${fixed(clipStart/1000)}–${fixed(clipEnd/1000)} seconds · Take ${take+1}.`;
    };
    active.start();$('export-status').textContent=`Recording ${fixed((clipEnd-clipStart)/1000)} seconds at 1×. Keep this page visible.`;
    play(clipEnd,()=>setTimeout(()=>{if(active.state==='recording')active.stop();},300));
  }catch{stream?.getTracks().forEach(t=>t.stop());media=null;controls(false);$('export-status').textContent='Video export is unavailable in this browser. Try a browser with canvas recording support.';}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(media?.state==='recording')media.stop();}});
paint();
try{
  const response=await fetch('./recordings/index.json');if(!response.ok)throw new Error();const index=await response.json();
  $('session').replaceChildren(...index.recordings.map(r=>new Option(r.label??r.name,r.url)));
  if(index.recordings.length){$('session').onchange=()=>load($('session').value);await load(index.recordings[0].url);}
  else{$('session').replaceChildren(new Option('No recordings yet',''));$('status').textContent='No recordings yet. Open a local recording to begin.';}
}catch{$('status').textContent='Open a local recording to begin.';}
if(!supported)$('export-status').textContent='Video export is unavailable in this browser. Replays still work.';
