import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyHealth, watchCollection } from '../.github/scripts/watch-collection.mjs';

const healthy = classifyHealth(200, { healthy: true, sources: [{ id: 'cse', stale: false }] });
const stale = classifyHealth(503, { healthy: false, sources: [{ id: 'cse', stale: true }] });
const unavailable = classifyHealth(503, { healthy: false, reason: 'database_unavailable' });

function scenario(statuses, existing = false) {
  let elapsed = 0;
  let dispatched = 0;
  let checkedRuns = 0;
  const results = [...statuses];
  const outcome = watchCollection({
    probe: async () => results.shift() ?? statuses.at(-1),
    activeScrape: () => { checkedRuns++; return existing; },
    dispatch: () => { dispatched++; },
    report: () => {},
    wait: async ms => { elapsed += ms; },
    now: () => elapsed,
    recoveryWaitMs: 60_000,
  });
  return { outcome, counts: () => [dispatched, checkedRuns] };
}

test('HTTP 503 with delayed sources succeeds only after collection recovery', async () => {
  assert.equal(stale.kind, 'stale');
  const run = scenario([stale, stale, healthy]);
  await run.outcome;
  assert.deepEqual(run.counts(), [1, 1]);
});

test('an already scheduled scrape is reused without dispatching a duplicate', async () => {
  const run = scenario([stale, healthy], true);
  await run.outcome;
  assert.deepEqual(run.counts(), [0, 1]);
});

test('a failed health lookup cannot be mistaken for stale collection', async () => {
  assert.equal(classifyHealth(200, { healthy: true, sources: [] }).kind, 'unavailable');
  assert.equal(classifyHealth(503, null).kind, 'unavailable');
  const failed = scenario([unavailable]);
  await assert.rejects(failed.outcome, /상태를 확인할 수 없습니다/);
  assert.deepEqual(failed.counts(), [0, 0]);
  const recovered = scenario([unavailable, healthy]);
  await recovered.outcome;
  assert.deepEqual(recovered.counts(), [0, 0]);
});

test('unresolved stale collection still fails after a single recovery request', async () => {
  const run = scenario([stale]);
  await assert.rejects(run.outcome, /수집 지연이 남아 있습니다 — cse/);
  assert.deepEqual(run.counts(), [1, 1]);
});
