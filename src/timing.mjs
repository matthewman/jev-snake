export const realClock = {
  now: () => Number(process.hrtime.bigint()) / 1e6,
  set: (fn, ms) => setTimeout(fn, ms),
  clear: handle => clearTimeout(handle),
};
