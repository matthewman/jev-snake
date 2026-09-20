import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,readFile,writeFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyRecording} from '../src/verify.mjs';
const root=new URL('../',import.meta.url);

test('own-key setup preserves settings and records unique verified sessions without exposing the key',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jev-own-key-'));
  try {
    for(const name of ['scripts','src','demo.json','.env.example'])await cp(new URL(name,root),join(dir,name),{recursive:true});
    const env={...process.env};delete env.TYPESAFE_API_KEY;
    const run=(args,extra={})=>spawnSync(process.execPath,args,{cwd:dir,env:{...env,...extra},encoding:'utf8',timeout:10000});
    const setup=run(['scripts/setup.mjs']);assert.equal(setup.status,0,setup.stderr);
    const initial=await readFile(join(dir,'.env'),'utf8');assert.match(initial,/TYPESAFE_API_KEY=/);
    // Every recorder invocation uses a fake transport: no paid or external calls.
    const mock=join(dir,'mock.mjs');
    await writeFile(mock,`globalThis.fetch=async(url,options)=>{
      if(url!=='https://api.typesafe.ai/v1/systemone'||options.headers.Authorization!=='Bearer '+process.env.EXPECTED_TEST_KEY)throw new Error('Unexpected fixture request');
      return {ok:true,json:async()=>({model:'fixture-model',answers:{move:{choice:'left'}}})};
    };`);
    const args=['--import',mock,'scripts/record.mjs','--run'];
    const missing=run(args);assert.notEqual(missing.status,0);assert.match(missing.stderr,/npm run setup/);
    await assert.rejects(readdir(join(dir,'recordings')),error=>error.code==='ENOENT');
    const secret='fixture-local-key',configured='TYPESAFE_API_KEY='+secret+'\n# Keep this comment.\n';
    await writeFile(join(dir,'.env'),configured);
    assert.equal(run(['scripts/setup.mjs']).status,0);
    assert.equal(await readFile(join(dir,'.env'),'utf8'),configured);
    const config=JSON.parse(await readFile(join(dir,'demo.json'),'utf8'));
    Object.assign(config,{maxSteps:2,tickMs:100,seeds:[7307],maxCalls:2});
    await writeFile(join(dir,'demo.json'),JSON.stringify(config));
    // First run reads .env; the next honors an exported key over the file.
    for(const extra of [{EXPECTED_TEST_KEY:secret},{TYPESAFE_API_KEY:'fixture-exported-key',EXPECTED_TEST_KEY:'fixture-exported-key'}]){
      const r=run(args,extra);assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
      assert.ok(!r.stdout.includes(secret)&&!r.stderr.includes(secret));
      assert.ok(!r.stdout.includes('fixture-exported-key')&&!r.stderr.includes('fixture-exported-key'));
    }
    const names=await readdir(join(dir,'recordings'));assert.equal(names.length,2);
    for(const name of names){
      assert.match(name,/^jev-.*\.json$/);
      const bytes=await readFile(join(dir,'recordings',name),'utf8');
      assert.ok(!bytes.includes(secret)&&!bytes.includes('fixture-exported-key'));
      const a=JSON.parse(bytes);verifyRecording(a);assert.equal(a.complete,true);
    }
    const first=join(dir,'recordings',names[0]),before=await readFile(first);
    const duplicate=run([...args,'--out',first],{EXPECTED_TEST_KEY:secret});
    assert.notEqual(duplicate.status,0);assert.deepEqual(await readFile(first),before);
  }finally{await rm(dir,{recursive:true,force:true});}
});
