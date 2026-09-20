import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {readResults,loadArchivedResult} from '../src/result-archive.mjs';

try {
  const [command='list',id,out,...extra]=process.argv.slice(2);
  assert.equal(extra.length,0,'Unexpected arguments');
  const ids=await readResults();
  if(command==='list'){
    assert.ok(!id && !out,'Usage: npm run results -- list');
    for(const name of ids)console.log(name);
  }else if(command==='verify'){
    assert.ok(!id && !out,'No ID or output path expected');
    let games=0,trials=0;
    for(const name of ids){
      const {counts}=await loadArchivedResult(name);games+=counts.games;trials+=counts.trials;
    }
    console.log(ids.length+' JSON files checked; '+games+' game trajectories replayed; '+trials+' static trials checked. No API calls.');
  }else if(command==='extract'||command==='replay'){
    assert.ok(ids.includes(id),'Choose an exact result ID from npm run results');
    const {bytes,artifact}=await loadArchivedResult(id);
    assert.ok(command!=='replay'||artifact.kind==='jev-snake-demo','This historical format supports JSON inspection, not the demo player.');
    const file=resolve(out??('recordings/'+id+'.json'));
    assert.ok(file.endsWith('.json'),'Output must end in .json');
    await mkdir(dirname(file),{recursive:true});
    await writeFile(file,bytes,{flag:'wx'});
    console.log('Verified JSON copied to '+file);
    if(command==='replay')console.log('Run npm start. Select this recording at http://127.0.0.1:4174.');
  }else throw new Error('Usage: npm run results -- [list|verify|extract ID [OUTPUT.json]]; npm run replay -- ID');
} catch(error) {console.error(error.message);process.exitCode=1;}
