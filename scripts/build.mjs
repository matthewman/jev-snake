import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await rm(new URL('dist/',root),{recursive:true,force:true});
await cp(new URL('web/',root),new URL('dist/',root),{recursive:true});
await mkdir(new URL('dist/core/',root),{recursive:true});
for(const n of ['snake.mjs','random.mjs','features.mjs','controls.mjs','replay.mjs'])await cp(new URL(`src/${n}`,root),new URL(`dist/core/${n}`,root));
await mkdir(new URL('dist/recordings/',root),{recursive:true});
await writeFile(new URL('dist/recordings/index.json',root),JSON.stringify({recordings:[]}));
console.log('Built static player. No credentials or recordings included. Import a recording locally to watch it.');
