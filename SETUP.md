# Personal AI Engineering Platform

The public demo executes two rules-based workers over one synthetic data-quality incident. It requires no credentials or external APIs. The separate live Gemini workflow runs two model-backed workers manually against synthetic inputs, with no tools or automatic retries.

## Local verification

Requires Node.js 24. Use `npm test` to verify the HTTP routes, worker results, and log correlation. Use `npm start` and open `http://localhost:8080` to try the demo. The container configuration binds to the `PORT` provided by Cloud Run.

## Deployment and $0 boundary

- Google AI Studio Build is the Cloud Run deployment path for an eligible Starter Tier account. It provisions its own Google-managed project. Publish only when the UI offers Starter Tier without setting up billing or starting a trial. This archive is a portable implementation. The separate Build draft in AI Studio was generated from the same demo specification.
- Use a restricted Gemini auth key from this Free tier project only. Store the key as the GitHub Actions secret `GEMINI_API_KEY` after confirming the project still has no billing. The public service never needs this secret.
- The included GitHub Actions workflow runs CI on pushes and pull requests. Use a standard GitHub-hosted runner in a public repository for ongoing free CI. The live Gemini workflow is manual and restricted to `main`. Neither workflow provisions cloud resources. GitHub Actions cannot directly deploy to the Google-managed Starter project through custom service accounts or IAM.
- Workers run on demand. Cloud Run Starter Tier scales to zero. This setup does not include an always-on worker, scheduled workloads, or a separate observability stack.
- Each completed worker emits a JSON log with its request ID and duration. After deployment, filter Cloud Run service logs by `jsonPayload.requestId`. The private Gemini workflow logs are visible in GitHub Actions and remain separate from Cloud Run logs.

## Hosted smoke test

With a published URL, open the page in a signed-out browser, click **Run demo**, and verify both stages render. Check `GET /api/health` and `POST /api/demo` return HTTP 200 and the correct payload. In Cloud Run logs, confirm the request ID correlates both worker entries.

## Sources

- [Google Cloud Starter Tier](https://docs.cloud.google.com/docs/starter-tier)
- [Starter Tier deployment and runtime limits](https://cloud.google.com/blog/topics/developers-practitioners/the-starter-tier-for-google-ai-studio-explained)
- [Gemini API pricing](https://aistudio.google.com/docs/pricing)
- [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
