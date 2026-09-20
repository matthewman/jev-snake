import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {readResults,loadArchivedResult,sha256,verifyResult} from '../src/result-archive.mjs';

const cwd=fileURLToPath(new URL('../',import.meta.url));
test('plain JSON results retain the original bytes and reject changed artifact contents',async()=>{
  const expected=JSON.parse(await readFile(new URL('fixtures/result-checksums.json',import.meta.url),'utf8'));
  const ids=await readResults();assert.deepEqual(ids.map(id=>id+'.json'),Object.keys(expected).sort());
  for(const id of ids){
    const {bytes,artifact}=await loadArchivedResult(id);
    assert.equal(sha256(bytes),expected[id+'.json'],'Original JSON bytes changed');
    if(artifact.artifactHash){
      artifact.finishedAt='edited';assert.throws(()=>verifyResult(artifact),/checksum mismatch/);
    }
  }
});
test('extraction preserves exact original bytes and refuses overwrite',async()=>{
  const [id]=await readResults();
  const {bytes}=await loadArchivedResult(id);
  const dir=await mkdtemp(join(tmpdir(),'jev-archive-test-'));
  try{
    const output=join(dir,'result.json');
    const run=()=>spawnSync(process.execPath,['scripts/results.mjs','extract',id,output],{cwd,encoding:'utf8'});
    const first=run();assert.equal(first.status,0,first.stderr);
    assert.deepEqual(await readFile(output),bytes);
    await writeFile(output,'existing user file');
    const second=run();assert.notEqual(second.status,0);
    assert.equal(await readFile(output,'utf8'),'existing user file');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('replay refuses unsupported historical formats and unknown IDs',async()=>{
  for(const id of ['2026-09-19-consistency-v1','../../outside']){
    const r=spawnSync(process.execPath,['scripts/results.mjs','replay',id],{cwd,encoding:'utf8'});
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/historical format|exact result ID/);
  }
});
