import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const files=[];
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=resolve(dir,entry.name);
    if(entry.isDirectory())await walk(path);else files.push(path);
  }
}
await walk(root);
assert.deepEqual(JSON.parse(await readFile(resolve(root,'recordings/index.json'),'utf8')),{recordings:[]});
const expected=new Set(['index.html','style.css','app.js','icon.svg','recordings/index.json',
  'core/snake.mjs','core/random.mjs','core/features.mjs','core/controls.mjs','core/replay.mjs']);
assert.deepEqual(new Set(files.map(path=>relative(root,path))),expected,'Unexpected or missing build asset');
for(const path of files.filter(p=>/\.(?:html|js|mjs)$/.test(p))){
  const source=await readFile(path,'utf8');
  const patterns=path.endsWith('.html')?[/\b(?:src|href)="(\.\/[^"#?]+)"/g]:[/\bfrom\s+['"](\.[^'"]+)['"]/g];
  for(const pattern of patterns)for(const match of source.matchAll(pattern)){
    const target=resolve(dirname(path),match[1]);
    assert.ok(files.includes(target),`Broken local reference: ${relative(root,path)} -> ${match[1]}`);
  }
}
console.log('Static assets and imports verified. Build contains no recordings, credentials, or server modules.');
