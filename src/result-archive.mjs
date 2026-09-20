import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {hash} from './artifacts.mjs';
import {verifyRecording} from './verify.mjs';
import {verifyContinuousEpisode} from './verify-continuous.mjs';

export const archiveRoot=new URL('../results/',import.meta.url);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const idPattern=/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
function checkHash(a) {
  if(a.artifactHash){const {artifactHash,...payload}=a;assert.equal(hash(payload),artifactHash,'Canonical artifact checksum mismatch');}
}
function checkTrials(a) {
  const repeats=a.plan.repeatsPerFixture??a.plan.repeats;
  const fixtures=new Map(a.fixtures.map(f=>[f.id,f]));
  assert.equal(fixtures.size,a.fixtures.length,'Duplicate fixture');
  assert.equal(a.trials.length,fixtures.size*repeats,'Incomplete trial matrix');
  const seen=new Set();
  for(const f of fixtures.values())assert.equal(sha256(f.body),f.requestBodySha256,'Request bytes changed');
  for(const t of a.trials){
    const f=fixtures.get(t.fixtureId),key=t.fixtureId+'/'+t.repeat;
    assert.ok(f && !seen.has(key) && Number.isInteger(t.repeat) && t.repeat>=0 && t.repeat<repeats,'Invalid trial identity');
    assert.equal(t.requestBodySha256,f.requestBodySha256,'Trial request hash mismatch');
    seen.add(key);
  }
  if(a.kind==='jev-decision-diagnostic'){
    for(const variant of a.plan.variants){
      const ids=new Set(a.fixtures.filter(f=>f.variant===variant).map(f=>f.id));
      const trials=a.trials.filter(t=>ids.has(t.fixtureId));
      const correct=trials.filter(t=>t.status==='ok' && t.decision.choice===fixtures.get(t.fixtureId).expected).length;
      const saved=a.accuracy.find(r=>r.variant===variant);
      assert.equal(correct,saved.correct,'Stored accuracy mismatch');
      assert.equal(trials.length,saved.attempts,'Stored attempt count mismatch');
    }
  }else assert.equal(a.kind,'jev-repeated-input-probe','Unsupported trial format');
}
export function verifyResult(a) {
  assert.equal(a.complete,true,'Incomplete artifact');
  assert.ok(!a.stopReason,'Stopped artifact');
  checkHash(a);
  if(a.kind==='jev-snake-demo'){
    verifyRecording(a);
    return {games:a.episodes.length,trials:0};
  }
  if(a.trials){checkTrials(a);return {games:0,trials:a.trials.length};}
  const bundles=a.bundles??(a.episodes?[a]:[]);
  assert.ok(bundles.length,'Unsupported result format');
  let games=0,calls=0;
  for(const b of bundles){
    checkHash(b);
    assert.ok(b.complete && !b.stopReason,'Incomplete bundle');
    let bundleCalls=0;
    for(const e of b.episodes){
      bundleCalls+=verifyContinuousEpisode(b.suite,e);games++;
      for(const p of e.payloads??[])if(p.requestBodySha256)assert.equal(sha256(p.body),p.requestBodySha256,'Payload hash mismatch');
    }
    assert.equal(bundleCalls,b.calls,'Bundle call count mismatch');calls+=bundleCalls;
  }
  if(a.calls!==undefined)assert.equal(calls,a.calls,'Artifact call count mismatch');
  return {games,trials:0};
}
export async function readResults(root=archiveRoot) {
  const files=await readdir(root,{withFileTypes:true});
  return files.filter(f=>f.isFile() && f.name.endsWith('.json')).map(f=>{
    const id=f.name.slice(0,-5);assert.match(id,idPattern,'Invalid result filename');return id;
  }).sort();
}
export async function loadArchivedResult(id,root=archiveRoot) {
  assert.match(id,idPattern,'Choose an exact result ID from npm run results');
  const bytes=await readFile(new URL(id+'.json',root));
  const artifact=JSON.parse(bytes),counts=verifyResult(artifact);
  return {bytes,artifact,counts};
}
