import { createSnake, ACTIONS } from './snake.mjs';
import { realClock } from './timing.mjs';
import { hash } from './artifacts.mjs';

// Logical ticks and request expirations are ordered independently of timer delivery.
// Responses can only affect a strictly later tick. No retroactive dispatch on catch-up.
export function runContinuousEpisode(suite, item, agent, { clock = realClock, maxCalls = Infinity } = {}) {
  const game = createSnake(suite, item.seed), initial = game.observe();
  const requests = [], events = [], epoch = clock.now();
  let pending = null, ready = null, timer, finished = false;
  let resolveEpisode;
  const result = new Promise(resolve => { resolveEpisode = resolve; });
  const elapsed = () => clock.now() - epoch;

  function settle(request, status, effectiveAtMs, observedAtMs, extra = {}) {
    Object.assign(request.record, { status, resolvedAtMs: effectiveAtMs, observedAtMs,
      observedMs: observedAtMs - request.record.dispatchedAtMs, ...extra });
    pending = null;
    request.controller.abort();
  }
  function finish(stopReason = null, observedAtMs = elapsed()) {
    if (finished) return;
    finished = true; clock.clear(timer);
    const final = game.observe();
    if (pending) settle(pending, 'cancelled', final.done ? final.step * suite.tickMs : observedAtMs, observedAtMs,
      { cancellationReason: stopReason ?? 'episode-end' });
    resolveEpisode({ ...item, initial, events, requests, score: final.score, steps: final.step,
      reason: final.reason, complete: final.done && !stopReason, stopReason,
      durationMs: final.step * suite.tickMs, observedDurationMs: observedAtMs });
  }
  function advance(now) {
    let ticked = false;
    while (!finished) {
      const tickAt = (game.observe().step + 1) * suite.tickMs;
      const expiresAt = pending?.record.deadlineAtMs ?? Infinity;
      if (Math.min(tickAt, expiresAt) > now) break;
      // At equal timestamps the request expires before the world advances.
      if (expiresAt <= tickAt) {
        settle(pending, 'timeout', expiresAt, now);
        continue;
      }
      const before = game.observe();
      const applied = ready && ready.resolvedAtMs < tickAt ? ready : null;
      const action = applied?.action ?? 'straight';
      if (applied) {
        applied.appliedTick = before.step + 1;
        applied.observationAgeMs = tickAt - applied.dispatchedAtMs;
        applied.elapsedStateVersions = before.step - applied.observationTick;
        ready = null;
      }
      const state = game.step(action);
      events.push({ tick: before.step, atMs: tickAt, observedAtMs: now,
        action, status: applied ? 'accepted' : 'continue', requestId: applied?.id ?? null,
        observationHash: hash(before), state });
      ticked = true;
      if (state.done) finish(null, now);
    }
    return ticked;
  }
  function arm() {
    if (finished) return;
    clock.clear(timer);
    const next = Math.min((game.observe().step + 1) * suite.tickMs, pending?.record.deadlineAtMs ?? Infinity);
    timer = clock.set(() => {
      const ticked = advance(elapsed());
      if (ticked && !finished) dispatch();
      arm();
    }, Math.max(0, next - elapsed()));
  }
  function dispatch() {
    if (finished || pending || ready) return;
    const dispatchedAtMs = elapsed();
    advance(dispatchedAtMs);
    if (finished) return;
    if (requests.length >= maxCalls) { finish('call-limit'); return; }
    const state = game.observe();
    const record = { id: requests.length, observationTick: state.step, observationHash: hash(state),
      dispatchedAtMs, deadlineAtMs: dispatchedAtMs + item.deadlineMs,
      status: 'pending', action: 'straight', latencyMs: null, censored: true,
      resolvedAtMs: null, observedAtMs: null, observedMs: null, appliedTick: null,
      observationAgeMs: null, elapsedStateVersions: null, resolvedModel: null, usage: null };
    const request = { record, controller: new AbortController() };
    requests.push(record); pending = request;
    Promise.resolve().then(() => {
      if (finished || pending !== request) return null;
      return agent.decide({ state: structuredClone(state), signal: request.controller.signal });
    }).then(response => {
      if (finished || pending !== request) return;
      const now = elapsed(), ticked = advance(now);
      if (!finished && pending === request) {
        const valid = ACTIONS.includes(response?.action);
        settle(request, valid ? 'accepted' : 'invalid', now, now, {
          action: valid ? response.action : 'straight', latencyMs: now - dispatchedAtMs, censored: false,
          resolvedModel: typeof response?.resolvedModel === 'string' ? response.resolvedModel : null,
          usage: response?.usage ?? null,
        });
        if (valid) ready = record;
      }
      if (ticked && !finished) dispatch();
      arm();
    }, () => {
      if (finished || pending !== request) return;
      const now = elapsed(), ticked = advance(now);
      if (!finished && pending === request) {
        settle(request, 'error', now, now, { censored: false });
        finish('provider-error', now);
      }
      if (ticked && !finished) dispatch();
      arm();
    });
  }
  dispatch(); arm();
  return result;
}
