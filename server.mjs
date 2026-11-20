import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const incident = {
  id: 'orders-ingestion-example',
  checks: [
    { name: 'duplicate order IDs', count: 18, tolerance: 0 },
    { name: 'missing customer IDs', count: 4, tolerance: 5 },
    { name: 'stale records', count: 13, tolerance: 10 }
  ]
};

function triage() {
  return incident.checks.filter(check => check.count > check.tolerance);
}

function review(failedChecks) {
  return {
    severity: failedChecks.length >= 2 ? 'high' : failedChecks.length ? 'medium' : 'low',
    recommendation: failedChecks.length
      ? 'Hold the affected batch, inspect source partitions, and replay after the checks pass.'
      : 'Continue monitoring the next ingestion batch.'
  };
}

function runPipeline(requestId, log) {
  function runStep(worker, run) {
    const start = performance.now();
    const result = run();
    const durationMs = Number((performance.now() - start).toFixed(3));
    log({ severity: 'INFO', message: 'Worker completed', requestId, worker, durationMs });
    return { worker, durationMs, result };
  }

  const first = runStep('triage', triage);
  const second = runStep('review', () => review(first.result));
  return { requestId, incidentId: incident.id, steps: [first, second] };
}

function logEvent(entry) {
  console.log(JSON.stringify(entry));
}

export function handleRequest(request, response, url = request.url, log = logEvent) {
  const send = (status, payload, type = 'application/json') => {
    const commit = process.env.VERCEL_GIT_COMMIT_SHA;
    if (/^[a-f0-9]{40}$/.test(commit ?? '')) response.setHeader('X-Deployment-Commit', commit);
    response.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'"
    });
    response.end(type === 'application/json' ? JSON.stringify(payload) : payload);
  };
  switch (`${request.method} ${url}`) {
    case 'GET /':
      return send(200, readFileSync(new URL('./index.html', import.meta.url)), 'text/html; charset=utf-8');
    case 'GET /demo.js':
      return send(200, readFileSync(new URL('./demo.js', import.meta.url)), 'text/javascript; charset=utf-8');
    case 'GET /api/health':
      return send(200, { status: 'ok', mode: 'rules-based' });
    case 'POST /api/demo':
      if (request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) > 0) {
        return send(400, { error: 'This endpoint does not accept input.' });
      }
      return send(200, runPipeline(randomUUID(), log));
    default:
      return send(404, { error: 'Not found.' });
  }
}

export function makeServer(log = logEvent) {
  return createServer((request, response) => handleRequest(request, response, request.url, log));
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  makeServer().listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}
