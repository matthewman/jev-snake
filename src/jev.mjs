import { observation } from './features.mjs';
export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export function requestBody(config,state) {
  return {model:config.model,state:{...observation(state),limits:{maxSteps:config.maxSteps,starvationSteps:config.starvationSteps}},
    questions:{move:{type:'choice',instructions:`Which action should the snake take next to stay alive and collect food? Read actionCandidates: these are engine-computed facts for each possible next move. First avoid any action with hitsWall or hitsBody true. Among safe actions, prefer eating food, otherwise prefer the smallest foodDistanceAfterMove. Choose a turn, not a description of the current motion. Coordinates are {x,y}, origin top left, x increases right and y down; body is head first. Left and right are relative 90-degree turns, straight keeps the heading. The tail vacates unless eating. The world moves every ${config.tickMs} milliseconds while you decide, continuing straight until your answer arrives. Your turn applies once on the first tick strictly after arrival. Facts describe the observation time and may become stale. Return left, straight, or right.`,
    criteria:{left:'Turn left. Prefer if safe and it eats food or leaves the shortest distance to food.',
      straight:'Go straight. Prefer only if safe and it eats food or leaves the shortest distance to food.',
      right:'Turn right. Prefer if safe and it eats food or leaves the shortest distance to food.'}}}};
}
export function createJev(config,{key=process.env.TYPESAFE_API_KEY,fetchImpl=fetch,onRequest=()=>{}}={}) {
  if(!key)throw new Error('Set TYPESAFE_API_KEY in your environment or a local env file.');
  return {async decide({state,signal}) {
    const body=JSON.stringify(requestBody(config,state));
    onRequest({observationTick:state.step,body});
    const response=await fetchImpl(ENDPOINT,{method:'POST',redirect:'error',signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body});
    if(!response.ok){await response.body?.cancel();throw new Error(`Provider HTTP ${response.status}`);}
    const data=await response.json();
    const count=value=>Number.isInteger(value)&&value>=0?value:null;
    const inputTokens=count(data.usage?.input_tokens),outputTokens=count(data.usage?.output_tokens);
    return {action:data.answers?.move?.choice,resolvedModel:typeof data.model==='string'?data.model:null,
      usage:inputTokens!==null||outputTokens!==null?{inputTokens,outputTokens}:null};
  }};
}
