import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { makeServer } from './server.mjs';

test('HTTP demo handles public traffic, runs workers in order, and correlates logs', async t => {
  const logs = [];
  const server = makeServer(entry => logs.push(entry)).listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const html = await (await fetch(base)).text();
  assert.match(html, /Run synthetic demo/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /id="worker-steps"/);
  assert.match(html, /Inspect full run payload/);
  assert.match(html, /no sign-in/);
  const script = await fetch(base + '/demo.js');
  assert.equal(script.status, 200);
  assert.match(await script.text(), /validatePayload/);
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

test('deployment smoke test validates the SHA served by the demo API', async t => {
  const commit = 'a'.repeat(40);
  const previousCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  process.env.VERCEL_GIT_COMMIT_SHA = commit;
  t.after(() => {
    if (previousCommit === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previousCommit;
  });

  const server = makeServer(() => {}).listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const script = fileURLToPath(new URL('./scripts/smoke-demo.mjs', import.meta.url));
  const run = expectedCommit => promisify(execFile)(process.execPath, [script], {
    env: {
      ...process.env,
      DEMO_URL: `http://127.0.0.1:${server.address().port}`,
      EXPECTED_COMMIT: expectedCommit
    },
    timeout: 10_000
  });

  assert.match((await run(commit)).stdout, /Demo smoke test passed/);
  await assert.rejects(run('b'.repeat(40)), error => (
    error.code === 1 && /serving a different commit/.test(error.stderr)
  ));
});
