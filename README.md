# Personal AI Engineering Platform

An HTTP demo for data-quality incident triage. The Triage worker checks a fixed synthetic orders incident, then the Review worker assigns severity and recommends a response. The server logs both stages with a shared request ID.

- [Public demo](https://personal-ai-engineering-platform-seven.vercel.app) runs on Vercel Hobby.
- [GitHub Actions](https://github.com/Praciller/personal-ai-engineering-platform/actions) runs local HTTP integration checks and provides a separate public smoke test.
- [Setup and GCP limits](SETUP.md) describes the container, free-tier constraints, and manual Gemini workflow.

Run `npm test` with Node.js 24 or newer to exercise the HTTP pipeline. Run `npm start` and open `http://localhost:8080` for the local UI.

The demo has no credentials or runtime LLM calls. Vercel was deployed directly from source because the GitHub integration could not access the repository. Redeployments currently require an explicit deploy. AI Studio's Cloud Run draft is separate from the public site and its publish flow requires billing for the selected project.
