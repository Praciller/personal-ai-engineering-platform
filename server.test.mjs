import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer } from './server.mjs';

test('HTTP demo handles public traffic, runs workers in order, and correlates logs', async t => {
  const logs = [];
  const server = makeServer(entry => logs.push(entry)).listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  assert.match(await (await fetch(base)).text(), /Run demo/);
  assert.equal((await fetch(base + '/demo.js')).status, 200);
  assert.deepEqual(await (await fetch(base + '/api/health')).json(), { status: 'ok', mode: 'rules-based' });
  const response = await fetch(base + '/api/demo', { method: 'POST' });
  assert.equal(response.status, 200);
  const { requestId, steps } = await response.json();
  assert.match(requestId, /^[\da-f-]{36}$/);
  assert.deepEqual(steps.map(step => step.worker), ['triage', 'review']);
  assert.deepEqual(steps[0].result.map(check => check.name), ['duplicate order IDs', 'stale records']);
  assert.equal(steps[1].result.severity, 'high');
  assert.ok(steps.every(step => step.durationMs >= 0));
  assert.deepEqual(logs.map(({ requestId: id, worker }) => [id, worker]), [
    [requestId, 'triage'], [requestId, 'review']
  ]);

  assert.equal((await fetch(base + '/api/demo', { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await fetch(base + '/api/demo')).status, 404);
});
