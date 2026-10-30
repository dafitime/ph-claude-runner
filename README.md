# ph-claude-runner

Runs The Prickled Herald's background Claude jobs with Claude Code on a Claude subscription, instead of the paid API.
The site queues a job and starts the `Claude job` workflow with its id; `run.mjs` fetches it, runs `claude -p` with a
JSON schema, and posts the answer back. Nothing about the jobs is stored or printed here.

Secrets: `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`), `RUNNER_KEY` (the site checks its hash).
