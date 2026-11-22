const button = document.querySelector('#run-demo');
const status = document.querySelector('#run-status');
const results = document.querySelector('#results');
const incidentMeta = document.querySelector('#incident-meta');
const severityBadge = document.querySelector('#severity-badge');
const workerSteps = document.querySelector('#worker-steps');
const payloadOutput = document.querySelector('#run-payload');

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validatePayload(payload) {
  if (!isRecord(payload) || typeof payload.requestId !== 'string' || !payload.requestId ||
      typeof payload.incidentId !== 'string' || !Array.isArray(payload.steps) || payload.steps.length !== 2) {
    throw new Error('The demo returned an incomplete response.');
  }

  const [triage, review] = payload.steps;
  if (!isRecord(triage) || triage.worker !== 'triage' || !Array.isArray(triage.result) ||
      !isRecord(review) || review.worker !== 'review' || !isRecord(review.result)) {
    throw new Error('The demo returned an incomplete response.');
  }

  if (!triage.result.every(check => isRecord(check) && typeof check.name === 'string' &&
      Number.isFinite(check.count) && check.count >= 0 && Number.isFinite(check.tolerance) &&
      check.tolerance >= 0 && check.count > check.tolerance) ||
      !['low', 'medium', 'high'].includes(review.result.severity) ||
      typeof review.result.recommendation !== 'string' || !review.result.recommendation.trim()) {
    throw new Error('The demo returned an invalid response.');
  }

  return { payload, triage, review };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTriage(step) {
  const item = element('li', 'worker-step');
  const heading = element('div', 'step-heading');
  heading.append(element('span', 'step-number', '01'));
  const title = element('div');
  title.append(element('h3', '', 'Triage worker'));
  title.append(element('p', 'step-description', 'Checks the incident against its configured tolerances.'));
  heading.append(title);
  item.append(heading);

  const checks = step.result;
  item.append(element('p', 'check-summary', checks.length
    ? `${checks.length} ${checks.length === 1 ? 'check' : 'checks'} exceeded tolerance`
    : 'No checks exceeded tolerance'));

  if (checks.length) {
    const list = element('ul', 'check-list');
    for (const check of checks) {
      const row = element('li', 'check-item');
      row.append(element('span', 'check-name', check.name));
      row.append(element('span', 'check-measure', `${numberFormat.format(check.count)} observed · tolerance ${numberFormat.format(check.tolerance)}`));
      list.append(row);
    }
    item.append(list);
  } else {
    item.append(element('p', 'check-clear', 'All configured checks are within tolerance.'));
  }

  return item;
}

function renderReview(step) {
  const item = element('li', 'worker-step');
  const heading = element('div', 'step-heading');
  heading.append(element('span', 'step-number', '02'));
  const title = element('div');
  title.append(element('h3', '', 'Review worker'));
  title.append(element('p', 'step-description', 'Summarizes the triage findings and suggests a response.'));
  heading.append(title);
  item.append(heading);
  item.append(element('p', 'review-label', 'Suggested next step'));
  item.append(element('p', 'review-recommendation', step.result.recommendation));
  return item;
}

function render({ payload, triage, review }) {
  const severity = review.result.severity;
  incidentMeta.textContent = `Synthetic incident: ${payload.incidentId} · Run ${payload.requestId}`;
  severityBadge.textContent = `${severity[0].toUpperCase()}${severity.slice(1)} severity`;
  severityBadge.className = `severity-badge severity-${severity}`;
  severityBadge.hidden = false;
  workerSteps.replaceChildren(renderTriage(triage), renderReview(review));
  payloadOutput.textContent = JSON.stringify(payload, null, 2);
  results.hidden = false;
  results.setAttribute('aria-busy', 'false');
}

button.addEventListener('click', async () => {
  button.disabled = true;
  results.hidden = true;
  results.setAttribute('aria-busy', 'true');
  severityBadge.hidden = true;
  incidentMeta.textContent = '';
  workerSteps.replaceChildren();
  payloadOutput.textContent = '';
  status.textContent = 'Running the rules-based workers…';

  try {
    const response = await fetch('/api/demo', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error('The server could not run the demo.');
    const data = validatePayload(await response.json());
    render(data);
    status.textContent = 'Run completed. The results below come from this synthetic scenario.';
  } catch {
    results.setAttribute('aria-busy', 'false');
    status.textContent = 'The demo could not finish. Try again; no run was saved.';
  } finally {
    button.disabled = false;
  }
});
