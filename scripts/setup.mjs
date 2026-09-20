import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
try {
  if(Number(process.versions.node.split('.')[0])<22)throw new Error('Use Node.js 22 or newer.');
  try {
    await writeFile(new URL('.env',root),await readFile(new URL('.env.example',root)),{flag:'wx',mode:0o600});
    console.log('Created .env. Add your TypeSafe API key to TYPESAFE_API_KEY in that file.');
  } catch(error) {
    if(error.code!=='EEXIST')throw error;
    console.log('Kept your existing .env.');
  }
  console.log('Run npm run record to collect a session, then npm start to watch it.');
  console.log('Setup makes no API calls. Use npm run plan to inspect the recording settings.');
} catch(error) {console.error(error.message);process.exitCode=1;}
