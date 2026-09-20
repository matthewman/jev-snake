// Drain nested response parsing and orchestration before advancing logical time.
export const flush = () => new Promise(resolve => setImmediate(resolve));
export function manualClock() {
  let time = 0, id = 0;
  const timers = new Map();
  const clock = { now: () => time, set(fn, ms) { const key = ++id; timers.set(key, { at: time + ms, fn }); return key; },
    clear(key) { timers.delete(key); }, jump(to) { time = to; },
    async next() {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) throw new Error('No pending timers');
      time = Math.max(time, next[1].at); timers.delete(next[0]); next[1].fn(); await flush();
    },
    async finish(promise) {
      let done = false, value, error;
      promise.then(v => { value = v; done = true; }, e => { error = e; done = true; });
      await flush();
      for (let count = 0; !done; count++) {
        if (count > 100000) throw new Error('Simulation did not finish');
        await clock.next();
      }
      if (error) throw error;
      return value;
    },
  };
  return clock;
}
