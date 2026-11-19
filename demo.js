const button = document.querySelector('button');
const status = document.querySelector('[role="status"]');
const output = document.querySelector('pre');

button.addEventListener('click', async () => {
  button.disabled = true;
  output.hidden = true;
  status.textContent = 'Running workers…';

  try {
    const response = await fetch('/api/demo', { method: 'POST' });
    if (!response.ok) throw new Error('The server could not run the demo.');
    output.textContent = JSON.stringify(await response.json(), null, 2);
    output.hidden = false;
    status.textContent = 'Run completed.';
  } catch {
    status.textContent = 'The demo could not finish. Try again.';
  } finally {
    button.disabled = false;
  }
});
