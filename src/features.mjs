import { ACTIONS, target } from './snake.mjs';
// Reports geometry for every candidate; never selects or replaces an action.
export function actionCandidates(state) {
  return ACTIONS.map(action => {
    const [x,y] = target(state, action);
    const eatsFood = Boolean(state.food && x === state.food[0] && y === state.food[1]);
    return {action, nextHead:{x,y},
      hitsWall:x < 0 || y < 0 || x >= state.width || y >= state.height,
      hitsBody:(eatsFood ? state.body : state.body.slice(0,-1)).some(p => p[0] === x && p[1] === y),
      eatsFood, foodDistanceAfterMove:state.food ? Math.abs(x-state.food[0])+Math.abs(y-state.food[1]) : null};
  });
}
export function observation(state) {
  return {...structuredClone(state), body:state.body.map(([x,y])=>({x,y})),
    food:state.food ? {x:state.food[0],y:state.food[1]} : null,
    heading:['up','right','down','left'][state.heading], actionCandidates:actionCandidates(state)};
}
