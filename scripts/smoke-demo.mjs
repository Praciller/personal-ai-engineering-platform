import assert from 'node:assert/strict';

const target = new URL(process.env.DEMO_URL);
const expectedCommit = process.env.EXPECTED_COMMIT;
assert.equal(target.href, target.origin + '/', 'Provide a deployment origin without a path.');
assert.ok(
  target.protocol === 'https:' || (target.protocol === 'http:' && target.hostname === '127.0.0.1'),
  'Use HTTPS or a local loopback address.'
);
if (expectedCommit) assert.match(expectedCommit, /^[a-f0-9]{40}$/, 'Provide a full Git commit SHA.');

async function check(path, method = 'GET', verifyCommit = true) {
  const response = await fetch(new URL(path, target), {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(15_000)
  });
  assert.equal(response.status, 200, `${method} ${path} returned ${response.status}.`);
  if (expectedCommit && verifyCommit) {
    assert.equal(response.headers.get('x-deployment-commit'), expectedCommit, `${path} is serving a different commit.`);
  }
  return response;
}

const ui = await check('/', 'GET', false);
assert.match(await ui.text(), /Run synthetic demo/);
const client = await check('/demo.js', 'GET', false);
await client.body?.cancel();
const health = await check('/api/health');
assert.deepEqual(await health.json(), { status: 'ok', mode: 'rules-based' });
const demo = await check('/api/demo', 'POST');
const result = await demo.json();
assert.match(result.requestId, /^[0-9a-f-]{36}$/);
assert.deepEqual(result.steps.map(({ worker }) => worker), ['triage', 'review']);
assert.equal(result.steps[1].result.severity, 'high');
console.log('Demo smoke test passed for', target.origin, expectedCommit ?? '(no commit specified)');
