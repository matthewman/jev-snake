import {readFile} from 'node:fs/promises';
import {verifyRecording} from '../src/verify.mjs';
if(!process.argv[2])throw new Error('Supply a recording JSON path');
verifyRecording(JSON.parse(await readFile(process.argv[2],'utf8')));
console.log('Recording payloads, actions, clock rules and game states match. This is not provider attestation.');
