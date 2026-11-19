import { randomUUID } from 'node:crypto';

const model = 'gemini-4-hydrogen';
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const incident = {
  failedChecks: [{ name: 'duplicate order IDs', count: 18 }, { name: 'stale records', count: 13 }],
  context: 'Synthetic orders ingestion incident. A downstream reporting refresh is pending.'
};
const textResult = field => ({
  type: 'object',
  properties: { [field]: { type: 'string' } },
  required: [field]
});

async function runWorker({ name, instruction, input, field, key, requestId }) {
  const start = performance.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: instruction + '\n' + JSON.stringify(input) }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingLevel: 'LOW' },
        responseMimeType: 'application/json',
        responseJsonSchema: textResult(field)
      }
    })
  }).catch(error => {
    throw new Error(`${name} could not reach Gemini: ${error.name}.`);
  });

  if (!response.ok) throw new Error(`${name} received HTTP ${response.status} from Gemini.`);
  const body = await response.json();
  const candidate = body.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new Error(`${name} did not finish (${candidate?.finishReason ?? 'no candidate'}).`);
  const content = candidate.content?.parts?.find(part => part.text && !part.thought)?.text;
  let result;
  try {
    result = JSON.parse(content)?.[field];
  } catch {
    throw new Error(`${name} received invalid JSON.`);
  }
  if (typeof result !== 'string' || !result.trim()) throw new Error(`${name} received an empty result.`);
  console.log(JSON.stringify({
    severity: 'INFO', requestId, worker: name, model, durationMs: Math.round(performance.now() - start)
  }));
  return result;
}

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Set GEMINI_API_KEY from the dedicated unbilled AI Studio project.');
  process.exitCode = 1;
} else {
  const requestId = randomUUID();
  try {
    const common = { key, requestId };
    const assessment = await runWorker({
      ...common,
      name: 'triage',
      instruction: 'Summarize the synthetic incident in one sentence without inventing facts.',
      input: incident,
      field: 'assessment'
    });
    await runWorker({
      ...common,
      name: 'review',
      instruction: 'Recommend one safe manual next action based on the original facts and assessment.',
      input: { incident, assessment },
      field: 'recommendation'
    });
  } catch (error) {
    console.error(JSON.stringify({ severity: 'ERROR', requestId, message: error.message }));
    process.exitCode = 1;
  }
}
