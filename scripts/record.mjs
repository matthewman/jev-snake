import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadEnvFile} from 'node:process';
import {runContinuousEpisode} from '../src/continuous.mjs';
import {createJev} from '../src/jev.mjs';
import {hash} from '../src/artifacts.mjs';
import {validateConfig} from '../src/config.mjs';
import {verifyRecording} from '../src/verify.mjs';
const root=new URL('../',import.meta.url);
try {
  const {values}=parseArgs({options:{run:{type:'boolean'},config:{type:'string'},out:{type:'string'}}});
  const config=validateConfig(JSON.parse(await readFile(values.config??new URL('demo.json',root),'utf8')));
  console.log(JSON.stringify({config,maximumSeconds:config.seeds.length*config.tickMs*config.maxSteps/1000,
    note:'Assisted gameplay demo. All attempts retained. Call cap includes timed-out requests; it is not a dollar cap.'},null,2));
  if(values.run) {
    try {loadEnvFile(fileURLToPath(new URL('.env',root)));} catch(error) {if(error.code!=='ENOENT')throw error;}
    if(!process.env.TYPESAFE_API_KEY?.trim())throw new Error('Run npm run setup, add TYPESAFE_API_KEY to .env, then run npm run record. An exported TYPESAFE_API_KEY also works.');
    createJev(config); // Check credentials before reserving an output.
    const name='jev-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.json';
    const output=values.out?resolve(values.out):fileURLToPath(new URL('recordings/'+name,root));
    await mkdir(dirname(output),{recursive:true});
    const files={};for(const n of (await readdir(new URL('src/',root))).filter(n=>n.endsWith('.mjs')).sort())files[n]=await readFile(new URL(`src/${n}`,root),'utf8');
    let commit=null,dirty=null;
    try {commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();dirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim());} catch {}
    const a={schemaVersion:1,kind:'jev-snake-demo',config,startedAt:new Date().toISOString(),
      source:{hash:hash(files),commit,dirty,node:process.version,clock:'process.hrtime.bigint',retries:0},
      episodes:[],calls:0,complete:false,stopReason:null};
    await writeFile(output,JSON.stringify(a),{flag:'wx'});
    const models=new Set();let changed=false;
    for(const seed of config.seeds) {
      const payloads=[],jev=createJev(config,{onRequest:p=>payloads.push(p)});
      const agent={async decide(args){const d=await jev.decide(args);if(d.resolvedModel)models.add(d.resolvedModel);if(models.size>1){changed=true;throw new Error('Model revision changed');}return d;}};
      const e=await runContinuousEpisode(config,{seed,repeat:0,deadlineMs:config.deadlineMs},agent,{maxCalls:config.maxCalls-a.calls});
      e.payloads=payloads;a.episodes.push(e);a.calls+=e.requests.length;
      a.stopReason=changed?'model-revision-changed':e.stopReason;
      await writeFile(output,JSON.stringify(a));
      console.log(`Seed ${seed}: ${e.score} food, ${e.steps} moves, ${(e.durationMs/1000).toFixed(1)}s, ${e.reason??e.stopReason}`);
      if(a.stopReason)break;
    }
    a.complete=!a.stopReason&&a.episodes.length===config.seeds.length;a.finishedAt=new Date().toISOString();
    const artifact={...a,artifactHash:hash(a)};
    await writeFile(output,JSON.stringify(artifact));
    if(a.complete)verifyRecording(artifact);else process.exitCode=2;
    console.log(`Saved ${output}; ${a.complete?'replay verified':a.stopReason}; ${a.calls} calls.`);
    if(a.complete)console.log('Run npm start, then open http://127.0.0.1:4174 to watch this session.');
  }
} catch(e) {console.error(e.message);process.exitCode=1;}
