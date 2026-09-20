export function validateConfig(c) {
  if(c.inputVersion!=='snake-assisted-v1'||typeof c.id!=='string'||!c.id||typeof c.model!=='string'||!c.model)throw new Error('Unsupported demo configuration');
  for(const k of ['width','height'])if(!Number.isInteger(c[k])||c[k]<6||c[k]>32)throw new Error(`Invalid ${k}`);
  for(const k of ['maxSteps','starvationSteps','tickMs','deadlineMs','maxCalls'])if(!Number.isInteger(c[k])||c[k]<1||c[k]>10000)throw new Error(`Invalid ${k}`);
  if(c.tickMs<50||!Array.isArray(c.seeds)||!c.seeds.length||c.seeds.length>50||new Set(c.seeds).size!==c.seeds.length||c.seeds.some(s=>!Number.isInteger(s)||s<1||s>0xffffffff))throw new Error('Invalid seed list or clock');
  return c;
}
