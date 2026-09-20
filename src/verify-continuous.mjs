import { createSnake, ACTIONS } from './snake.mjs';
import { hash } from './artifacts.mjs';
const check = (condition, message) => { if (!condition) throw new Error(message); };
const finite = n => Number.isFinite(n) && n >= 0;

export function verifyContinuousEpisode(suite, episode) {
  const game = createSnake(suite, episode.seed), states = [game.observe()], requests = episode.requests;
  check(Array.isArray(requests) && requests.length > 0, 'Missing continuous requests');
  check(hash(states[0]) === hash(episode.initial), 'Initial state mismatch');
  let previousObserved = 0;
  for (const event of episode.events) {
    const before = game.observe(), atMs = (before.step + 1) * suite.tickMs;
    check(event.tick === before.step && event.atMs === atMs && finite(event.observedAtMs)
      && event.observedAtMs >= atMs && event.observedAtMs >= previousObserved, 'Tick clock mismatch');
    previousObserved = event.observedAtMs;
    check(hash(before) === event.observationHash && ACTIONS.includes(event.action), 'Observation/action mismatch');
    if (event.requestId === null) {
      check(event.action === 'straight' && event.status === 'continue', 'Invalid continuation');
    } else {
      const r = requests[event.requestId];
      check(r?.status === 'accepted' && event.status === 'accepted' && r.action === event.action
        && r.appliedTick === before.step + 1 && r.resolvedAtMs < atMs, 'Invalid applied request');
    }
    const after = game.step(event.action);
    check(hash(after) === hash(event.state), 'Replay state mismatch');
    states.push(after);
  }
  const final = game.observe(), durationMs = final.step * suite.tickMs;
  check(final.done && episode.complete && !episode.stopReason && episode.score === final.score
    && episode.steps === final.step && episode.reason === final.reason && episode.durationMs === durationMs
    && finite(episode.observedDurationMs) && episode.observedDurationMs >= durationMs, 'Final score/time mismatch');
  requests.forEach((r, i) => {
    const previous = requests[i - 1];
    check(r.id === i && Number.isInteger(r.observationTick) && r.observationTick >= 0 && r.observationTick < final.step
      && hash(states[r.observationTick]) === r.observationHash, 'Request observation mismatch');
    check(finite(r.dispatchedAtMs) && r.dispatchedAtMs >= r.observationTick * suite.tickMs
      && r.dispatchedAtMs < (r.observationTick + 1) * suite.tickMs
      && r.deadlineAtMs === r.dispatchedAtMs + episode.deadlineMs, 'Request dispatch mismatch');
    check(!previous || (r.observationTick > previous.observationTick && r.dispatchedAtMs >= previous.resolvedAtMs
      && (previous.appliedTick === null || r.dispatchedAtMs >= previous.appliedTick * suite.tickMs)), 'Requests overlap');
    check(finite(r.resolvedAtMs) && r.resolvedAtMs >= r.dispatchedAtMs && finite(r.observedAtMs)
      && r.observedAtMs >= r.resolvedAtMs && r.observedMs === r.observedAtMs - r.dispatchedAtMs, 'Request resolution mismatch');
    check(['accepted', 'invalid', 'timeout', 'cancelled'].includes(r.status), 'Invalid request status');
    const appliedEvents = episode.events.filter(e => e.requestId === i);
    if (['accepted', 'invalid'].includes(r.status)) {
      check(finite(r.latencyMs) && r.latencyMs === r.resolvedAtMs - r.dispatchedAtMs
        && r.latencyMs < episode.deadlineMs && r.observedAtMs === r.resolvedAtMs && !r.censored, 'Late action accepted');
    } else {
      check(r.latencyMs === null && r.censored && r.action === 'straight', 'Invalid censoring/fallback');
      if (r.status === 'timeout') check(r.resolvedAtMs === r.deadlineAtMs, 'Invalid timeout');
      else check(r.resolvedAtMs === durationMs && r.deadlineAtMs > durationMs
        && r.cancellationReason === 'episode-end', 'Invalid cancellation');
    }
    if (r.status === 'accepted') {
      const applyTick = Math.floor(r.resolvedAtMs / suite.tickMs) + 1;
      check(ACTIONS.includes(r.action) && r.appliedTick === applyTick && appliedEvents.length === 1
        && r.observationAgeMs === applyTick * suite.tickMs - r.dispatchedAtMs
        && r.elapsedStateVersions === applyTick - 1 - r.observationTick, 'Application timing mismatch');
    } else check(r.action === 'straight' && r.appliedTick === null && appliedEvents.length === 0
      && r.observationAgeMs === null && r.elapsedStateVersions === null, 'Nonaccepted action applied');
  });
  return requests.length;
}
