# Venture Advisor OS

Venture Advisor OS is a Telegram-controlled, multi-agent startup opportunity evaluation system. A user submits an idea, the system runs a gated research and review workflow, and only ideas that survive Judge review move on to downstream deliverables such as an approved business summary, a business plan, a PRD, and a POC specification.

The runtime is local-first:

- `apps/telegram-bot` handles Telegram webhook intake and command responses.
- `apps/gateway-api` exposes the case lifecycle HTTP API and runtime model controls.
- `apps/worker` runs the asynchronous workflow, agent execution, routing, validation, and artifact generation.
- PostgreSQL stores case state and history.
- Redis backs BullMQ workflow queues.
- `storage/` holds generated artifacts per case.

## What The System Does

For each case, the standard path is:

1. `FactResearcher` gathers evidence, pain points, workflow gaps, and competitor context.
2. `OpportunityStrategist` turns the evidence into concrete software opportunities and recommends an entry point.
3. `VCCritic` stress-tests the idea from a venture perspective.
4. `Judge` decides `PASS`, `REVISE`, `PIVOT`, or `REJECT`.
5. If the case reaches `PASS`, downstream agents can produce a PRD and POC build plan.

The workflow is intentionally gated. PRD and POC generation are blocked unless the latest Judge decision is `PASS`.

## Repository Layout

```text
apps/
  gateway-api/      HTTP API and health/metrics endpoints
  telegram-bot/     Telegram webhook server and command handling
  worker/           BullMQ processors, orchestration, runtime integration
packages/
  agent-specs/      Prompt registry and prompt renderer
  persistence/      PostgreSQL repositories and storage adapters
  report-renderer/  Markdown and JSON artifact rendering
  shared-types/     Shared schemas, DTOs, env loading, enums
  workflow-core/    Agent execution, routing, retries, queue planning
docs/
  agent-specs/      Source-of-truth prompt YAML files
  orchestrator-rules.md
  prd.md
  task.md
  technical-spec.md
scripts/
  bootstrap-dev.mjs
  check-env.mjs
  postinstall.mjs
  seed-dev.mjs
  setup-dev.mjs
compose.yaml
```

## Prerequisites

- Node.js `>=24`
- npm `>=11`
- Docker Desktop or another Docker runtime for local PostgreSQL and Redis
- A Telegram bot token if you want to use Telegram
- GitHub Copilot authentication if you want live model-backed execution with `copilot-sdk`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and update the values you need.

3. Run the full local bootstrap:

```bash
npm run setup:dev
```

`npm run setup:dev` will:

- backfill missing `.env` keys
- create storage directories
- start PostgreSQL and Redis with Docker
- wait for those services to become healthy
- create the `ventrueadvisor` database if needed
- run database migrations
- seed local development data

4. Build the workspace:

```bash
npm run build
```

5. Start the application services in separate terminals:

```bash
npm run start:gateway
npm run start:worker
npm run start:telegram
```

If you prefer build-and-run wrappers:

```bash
npm run run:gateway
npm run run:worker
npm run run:telegram
```

6. Verify the gateway is healthy:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

## Environment Variables

The repo is configured to use the PostgreSQL database named `ventrueadvisor`.

Core runtime:

- `DATABASE_URL`
  PostgreSQL connection string. Default example: `postgres://postgres:postgres@localhost:5432/ventrueadvisor`
- `REDIS_URL`
  Redis connection string
- `STORAGE_ROOT`
  Artifact output root. Default example: `./storage`
- `API_PORT`
  Gateway HTTP port. Default: `3000`

Telegram:

- `TELEGRAM_BOT_TOKEN`
  Bot token from `@BotFather`
- `TELEGRAM_WEBHOOK_SECRET`
  Shared secret checked on incoming webhook requests
- `TELEGRAM_WEBHOOK_PORT`
  Local Telegram webhook server port. Default: `3001`
- `TELEGRAM_WEBHOOK_PATH`
  Default: `/telegram/webhook`
- `TELEGRAM_OPERATOR_USER_IDS`
  Optional comma-separated Telegram user IDs allowed to use operator-only commands
- `GATEWAY_API_BASE_URL`
  Telegram bot -> gateway base URL, usually `http://localhost:3000`
- `GATEWAY_API_AUTH_TOKEN`
  Optional auth token for gateway requests

Worker runtime:

- `COPILOT_RUNTIME_MODE`
  `deterministic-local-runtime` or `copilot-sdk`
- `COPILOT_CLI_PATH`
  Optional explicit path to the Copilot CLI
- `COPILOT_USE_LOGGED_IN_USER`
  `true` to use the logged-in local Copilot identity
- `GITHUB_TOKEN`
  Optional token-based auth for the Copilot SDK
- `AGENT_TIMEOUT_MS`
- `REPORT_RENDER_TIMEOUT_MS`
- `PRD_GENERATION_TIMEOUT_MS`
- `POC_GENERATION_TIMEOUT_MS`

Workflow tuning:

- `JUDGE_VC_PASS_THRESHOLD`
- `JUDGE_EVIDENCE_PASS_THRESHOLD`
- `MIN_SCORE_IMPROVEMENT`
- `DEFAULT_MAX_ITERATIONS`
- `COMPLEX_TOPIC_MAX_ITERATIONS`
- `MAX_STAGNANT_ITERATIONS`
- `DEFAULT_RESEARCH_STYLE`
- `BROWSING_AUTONOMY_PROFILE`
- `BROWSING_ALLOW_ADJACENT_EXPLORATION`
- `BROWSING_ALLOW_COMPETITOR_EXPLORATION`
- `BROWSING_ALLOW_OPEN_ENDED_QUERIES`
- `BROWSING_MAX_SOURCES_PER_QUERY`
- `BROWSING_RECENCY_WINDOW_DAYS`
- `PREFER_TERMINAL_DECISION_BY_ITERATION`
- `REJECT_ON_CONSECUTIVE_STAGNATION`
- `REJECT_ON_TERMINATION_WARNING_NEXT_WEAK_ITERATION`
- `REJECT_ON_UNRESOLVED_FATAL_FLAWS`
- `ALLOW_REVISE_ON_FATAL_FLAW_WITH_DISPROOF_PATH`
- `REQUIRE_JUDGE_PASS_FOR_PASS_ROUTING`
- `REQUIRE_PASS_FOR_DOWNSTREAM_GENERATION`

Validate environment state before startup:

```bash
npm run env:check
```

Useful scoped checks:

```bash
npm run env:check -- --scope common,gateway-api
npm run env:check -- --scope telegram-bot --allow-placeholder-secrets
npm run env:check -- --scope worker
```

## Local Development Commands

Bootstrap only:

```bash
npm run bootstrap:dev
```

Start infrastructure only:

```bash
npm run services:up
npm run services:status
```

Stop infrastructure:

```bash
npm run services:down
```

Run migrations:

```bash
npm run db:migrate
```

Seed development storage data:

```bash
npm run seed:dev
```

Verification:

```bash
npm run build
npm run typecheck
npm run lint
npm run test
npm run test:acceptance
npm run format
```

## Runtime Modes

There are two execution modes:

- `deterministic-local-runtime`
  Uses the local deterministic worker runtime. Useful for offline development and stable tests.
- `copilot-sdk`
  Uses the GitHub Copilot SDK for model-backed agent execution and live web research.

The worker selects the runtime mode from `COPILOT_RUNTIME_MODE`. In `copilot-sdk` mode, the selected model is currently global for the whole worker runtime. The system does not yet support a different model per agent.

## Architecture

### Apps

- `apps/gateway-api`
  Case lifecycle API, operator reports, runtime model selection, health checks, and dashboard
- `apps/telegram-bot`
  Telegram command parsing, Telegram webhook verification, response formatting, and gateway integration
- `apps/worker`
  Queue consumers, agent execution, retry handling, routing decisions, and downstream artifact generation

### Shared Packages

- `packages/shared-types`
  Shared enums, DTOs, Zod schemas, runtime env loading, workflow config loading
- `packages/workflow-core`
  Agent runtime contracts, queue definitions, iteration planning, routing policy, retries, normalization
- `packages/persistence`
  PostgreSQL repositories and runtime settings persistence
- `packages/report-renderer`
  Markdown and JSON rendering for approved summaries and downstream docs
- `packages/agent-specs`
  YAML prompt registry and rendered prompt construction

### Data Stores

- PostgreSQL stores:
  cases, iterations, agent outputs, Judge tasks, score details, audit logs, approvals, prompt template versions, runtime settings
- Redis stores:
  BullMQ jobs and queue coordination
- Filesystem stores:
  generated case artifacts under `storage/cases/{caseId}/...`

## Standard Workflow

The normal user path is:

1. Create a case
2. Start the workflow
3. Poll status
4. If approved, request PRD
5. If PRD exists, request POC

Judge controls the loop:

- `PASS`
  Case becomes eligible for downstream generation
- `REVISE`
  Targeted reruns are queued for the required upstream agents
- `PIVOT`
  A broader rerun path is queued, optionally invalidating prior research
- `REJECT`
  Case is closed and downstream generation is blocked

## Telegram Setup

1. Create a bot with `@BotFather`.
2. Put the bot token in `.env` as `TELEGRAM_BOT_TOKEN`.
3. Generate a webhook secret and put it in `.env` as `TELEGRAM_WEBHOOK_SECRET`.
4. Start `gateway`, `worker`, and `telegram`.
5. Expose the local Telegram webhook server on `TELEGRAM_WEBHOOK_PORT` over public HTTPS.
6. Register the public webhook URL with Telegram.

Example public tunnel with `localhost.run`:

```bash
ssh -R 80:localhost:3001 nokey@localhost.run
```

Example webhook registration:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://<PUBLIC_HOST>/telegram/webhook\",\"secret_token\":\"<YOUR_TELEGRAM_WEBHOOK_SECRET>\"}"
```

Verify registration:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Important:

- Telegram requires a public HTTPS webhook URL
- tunnel URLs are ephemeral unless you use a paid/fixed tunnel
- if your tunnel URL changes, you must call `setWebhook` again

## Telegram Commands

User commands:

- `/model`
  Show current runtime mode, selected model, and available models
- `/model {modelId}`
  Set the global Copilot runtime model
- `/model default`
  Clear explicit model selection and use the SDK default
- `/newidea {topic}`
  Create a new case
- `/startcase {caseId}`
  Queue the first workflow run
- `/status {caseId}`
  Show case state, latest Judge decision, task summary, and downstream readiness
- `/prd {caseId}`
  Request PRD generation
- `/poc {caseId}`
  Request POC generation
- `/next-topic`
  Show the next queued topic
- `/portfolio {limit}`
  Show ranked cases and queue summary

Operator-only commands:

- `/approve {caseId} {FORCE_REVISE|FORCE_PIVOT|FORCE_PASS_TO_PRD}`
- `/reject {caseId}`

Do not type angle brackets literally. Use the real case ID directly.

## Typical Telegram Session

```text
/model
/newidea AI bookkeeping for freelancers
/startcase 123e4567-e89b-12d3-a456-426614174000
/status 123e4567-e89b-12d3-a456-426614174000
/prd 123e4567-e89b-12d3-a456-426614174000
/poc 123e4567-e89b-12d3-a456-426614174000
```

Typical outputs:

- `/newidea`
  returns a new `caseId`
- `/startcase`
  returns a queued workflow job ID
- `/status`
  returns current state, latest decision, PRD/POC readiness, and next steps
- `/prd`
  returns accepted/in-progress status
- `/poc`
  returns accepted/in-progress status

## HTTP API Surface

Main JSON routes exposed by `apps/gateway-api`:

- `POST /api/cases`
- `POST /api/cases/{caseId}/start`
- `GET /api/cases/{caseId}`
- `GET /api/cases/{caseId}/iterations`
- `GET /api/cases/{caseId}/outputs`
- `POST /api/cases/{caseId}/approve`
- `POST /api/cases/{caseId}/reject`
- `POST /api/cases/{caseId}/founder-value`
- `POST /api/cases/{caseId}/generate-prd`
- `POST /api/cases/{caseId}/generate-poc`
- `GET /api/cases/next-topic`
- `GET /api/cases/portfolio?limit=N`
- `GET /api/runtime/model`
- `PUT /api/runtime/model`
- `GET /api/reports/metrics`
- `GET /api/reports/opportunities`
- `GET /health`
- `GET /metrics`
- `GET /dashboard`

## Generated Artifacts

Case artifacts are written under:

```text
storage/
  cases/
    {caseId}/
      approved_business_summary.json
      final_business_plan.md
      prd.md
      poc_spec.md
      implementation_handoff.json
      iterations/
        {iterationNo}/
          outputs/
```

The worker persists both raw and normalized agent outputs, but normalized output is the downstream source of truth.

## Where To Change Agent Behavior

There are several layers that affect how an agent behaves.

### 1. Prompt spec YAML

This is the primary place to change agent role, instructions, required sections, and JSON output shape:

- `docs/agent-specs/common.base.yaml`
- `docs/agent-specs/agent-a.fact-researcher.yaml`
- `docs/agent-specs/agent-b.opportunity-strategist.yaml`
- `docs/agent-specs/agent-c.vc-critic.yaml`
- `docs/agent-specs/agent-d.prd-strategist.yaml`
- `docs/agent-specs/agent-e.poc-architect.yaml`
- `docs/agent-specs/agent-j.judge.yaml`

### 2. Prompt assembly

The final prompt sent to the model is assembled in:

- `packages/agent-specs/src/registry.ts`
- `packages/agent-specs/src/prompt-renderer.ts`

### 3. Output validation and normalization

If you change the agent's structured output, you may also need to update:

- `packages/shared-types/src/agent-output-schemas.ts`
- `packages/workflow-core/src/fact-researcher.ts`
- `packages/workflow-core/src/opportunity-strategist.ts`
- `packages/workflow-core/src/vc-critic.ts`
- `packages/workflow-core/src/judge.ts`
- `packages/workflow-core/src/prd-strategist.ts`
- `packages/workflow-core/src/poc-architect.ts`

### 4. Workflow routing

If you want to change when an agent runs or reruns:

- `packages/workflow-core/src/first-iteration.ts`
- `packages/workflow-core/src/revise-flow.ts`
- `packages/workflow-core/src/pivot-flow.ts`
- `packages/workflow-core/src/routing-policy.ts`
- `apps/worker/src/main.ts`

### 5. Runtime and browsing settings

If you want to change defaults for judge thresholds, research style, browsing autonomy, or runtime mode:

- `.env`
- `.env.example`
- `packages/shared-types/src/config.ts`
- `packages/shared-types/src/runtime-env.ts`
- `apps/worker/src/web-research-tool.ts`

## Model Selection

The selected Copilot model is stored in the `runtime_settings` table and can be changed at runtime through either:

- Telegram: `/model`
- HTTP API: `PUT /api/runtime/model`

Current limitation:

- model selection is global for the worker runtime
- there is no per-agent model assignment yet

## Founder-Value Capture

Founder-value feedback can be recorded with `POST /api/cases/{caseId}/founder-value`.

The initial fields are:

- `perceivedUsefulnessScore`
- `confidenceIncreaseScore`
- `manualResearchMinutesSaved`
- optional `respondentType`
- optional `actor`
- optional `notes`

Each founder-value write also creates an audit log entry.

## Troubleshooting

Health endpoint shows worker not ready:

- make sure `npm run start:worker` is running
- check Redis and PostgreSQL are healthy
- check the worker heartbeat file under `STORAGE_ROOT`

Telegram bot receives no updates:

- confirm `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`
- confirm the Telegram process is running
- confirm the public tunnel is alive
- confirm `getWebhookInfo` points to the current public URL

Copilot runtime fails:

- verify `COPILOT_RUNTIME_MODE=copilot-sdk`
- verify your local Copilot auth is valid or `GITHUB_TOKEN` is set
- run `/model` or `GET /api/runtime/model` to inspect auth status and available models

Case stays in queued or in-progress state:

- check the worker logs
- confirm Redis is reachable
- confirm the worker process is connected to the same `REDIS_URL` and `DATABASE_URL` as the gateway

## Source Of Truth

Implementation must stay aligned with:

- `docs/prd.md`
- `docs/orchestrator-rules.md`
- `docs/technical-spec.md`
- `docs/agent-specs/*.yaml`
- `docs/task.md`

If source-of-truth behavior changes, update the docs first, then implement.

## Contributing

See `CONTRIBUTING.md` for the task workflow, verification expectations, and repository update rules.
