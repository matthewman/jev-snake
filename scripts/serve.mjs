import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyRecording} from '../src/verify.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let body,type='application/json';
    if(pathname==='/recordings/index.json') {
      const names=await readdir(path.join(root,'recordings')).catch(()=>[]),recordings=[];
      for(const n of names.filter(n=>n.endsWith('.json')).sort()) {
        try {const a=JSON.parse(await readFile(path.join(root,'recordings',n),'utf8'));verifyRecording(a);recordings.push({name:n,url:`./recordings/${encodeURIComponent(n)}`,label:`${a.config.tickMs} ms/tick · ${n}`,startedAt:a.startedAt});} catch { /* In-progress or invalid runs stay off the player. */ }
      }
      recordings.sort((a,b)=>(Date.parse(b.startedAt)-Date.parse(a.startedAt))||a.name.localeCompare(b.name));
      body=JSON.stringify({recordings});
    } else if(/^\/recordings\/[^/]+\.json$/.test(pathname)) {
      const file=path.join(root,'recordings',path.basename(pathname));
      body=await readFile(file);verifyRecording(JSON.parse(body));
    } else {
      const file=path.resolve(dist,'.'+pathname,pathname.endsWith('/')?'index.html':'');
      if(!file.startsWith(dist+path.sep)||!types[path.extname(file)])throw new Error('Not found');
      body=await readFile(file);type=types[path.extname(file)];
    }
    res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4174,'127.0.0.1',()=>console.log('Jev Snake: http://127.0.0.1:4174 (local recordings only)'));
