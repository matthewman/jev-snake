import { random } from './random.mjs';

export const ACTIONS = ['left', 'straight', 'right'];
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

export function createSnake(config, seed) {
  const next = random(seed);
  const x = Math.floor(config.width / 2), y = Math.floor(config.height / 2);
  const state = {
    width: config.width, height: config.height,
    body: [[x, y], [x - 1, y], [x - 2, y]], heading: 1,
    food: null, score: 0, step: 0, sinceFood: 0, done: false, reason: null,
  };
  function spawnFood() {
    const free = [];
    for (let row = 0; row < state.height; row++) {
      for (let col = 0; col < state.width; col++) {
        if (!state.body.some(p => same(p, [col, row]))) free.push([col, row]);
      }
    }
    state.food = free.length ? free[Math.floor(next() * free.length)] : null;
  }
  spawnFood();
  return {
    observe: () => structuredClone(state),
    step(action) {
      if (state.done) throw new Error('Episode already finished');
      if (!ACTIONS.includes(action)) throw new Error('Invalid action');
      state.heading = (state.heading + { left: 3, straight: 0, right: 1 }[action]) % 4;
      const direction = DIRECTIONS[state.heading];
      const head = [state.body[0][0] + direction[0], state.body[0][1] + direction[1]];
      const grows = same(head, state.food);
      // Moving into the tail is legal when it vacates on this tick.
      const occupied = grows ? state.body : state.body.slice(0, -1);
      state.step++;
      state.sinceFood++;
      if (head[0] < 0 || head[1] < 0 || head[0] >= state.width || head[1] >= state.height) {
        state.reason = 'wall';
      } else if (occupied.some(p => same(p, head))) {
        state.reason = 'self';
      } else {
        state.body.unshift(head);
        if (grows) {
          state.score++;
          state.sinceFood = 0;
          spawnFood();
          if (!state.food) state.reason = 'board-filled';
        } else state.body.pop();
      }
      if (!state.reason && state.sinceFood >= config.starvationSteps) state.reason = 'starvation';
      if (!state.reason && state.step >= config.maxSteps) state.reason = 'step-limit';
      state.done = state.reason !== null;
      return structuredClone(state);
    },
  };
}

export function target(state, action) {
  const heading = (state.heading + { left: 3, straight: 0, right: 1 }[action]) % 4;
  return state.body[0].map((n, i) => n + DIRECTIONS[heading][i]);
}
