# Venture Advisor OS

Venture Advisor OS evaluates founder-submitted opportunities through a gated multi-agent workflow and only produces downstream delivery artifacts after a validated PASS decision.

## Current Status

The repository now contains the monorepo skeleton, shared tooling, local developer bootstrap, and the source-of-truth product and orchestration specs under `docs/`.
Application services are still placeholders until the remaining tasks in `docs/task.md` are implemented.

## Architecture Overview

The intended runtime architecture is:

1. `apps/telegram-bot` receives operator commands and acts as the control-plane interface.
2. `apps/gateway-api` exposes the case lifecycle API used by Telegram and future internal tooling.
3. `apps/worker` runs orchestration, queue consumers, agent execution, normalization, and downstream generation.
4. `packages/shared-types` holds shared enums, DTOs, schemas, and cross-service contracts.
5. `packages/workflow-core` holds routing rules, iteration logic, and orchestration behavior.
6. `packages/persistence` owns database access and artifact storage adapters.
7. `packages/report-renderer` owns approved business summary, business plan, PRD, and POC rendering.
8. `packages/agent-specs` exposes the versioned prompt/spec registry loaded from `docs/agent-specs`.

Supporting infrastructure:

- PostgreSQL stores case state, iterations, scores, approvals, and audit logs.
- Redis backs queueing and workflow coordination.
- The local filesystem storage root holds per-case artifacts under `storage/cases/{caseId}/...`.
- The source documents in `docs/` remain the contract for implementation decisions.

## Repository Layout

```text
apps/
  gateway-api/
  telegram-bot/
  worker/
packages/
  agent-specs/
  persistence/
  report-renderer/
  shared-types/
  workflow-core/
docs/
  agent-specs/
  orchestrator-rules.md
  prd.md
  task.md
  technical-spec.md
scripts/
  bootstrap-dev.mjs
  check-env.mjs
  seed-dev.mjs
compose.yaml
```

## Local Commands

Bootstrap the repo:

```bash
npm install
npm run setup:dev
```

`npm run setup:dev` backfills any missing keys in `.env`, creates the storage directories, starts PostgreSQL and Redis, waits for them to become reachable, runs DB migrations, and seeds sample storage data.

If you only want the filesystem/bootstrap step without starting infrastructure:

```bash
npm run bootstrap:dev
```

## Environment and Secrets

Copy `.env.example` to `.env` and replace the placeholder values before starting any service.

- `DATABASE_URL`: PostgreSQL connection string for the `ventrueadvisor` database.
- `REDIS_URL`: Redis connection string used for queueing and coordination.
- `STORAGE_ROOT`: local artifact root for `storage/cases/{caseId}/...`.
- `TELEGRAM_BOT_TOKEN`: Telegram bot token for the control-plane bot.
- `TELEGRAM_WEBHOOK_SECRET`: shared secret expected on Telegram webhook requests.
- `COPILOT_RUNTIME_PATH`: absolute filesystem path to the local Copilot/Codex runtime used by the worker.
- `AGENT_TIMEOUT_MS`, `REPORT_RENDER_TIMEOUT_MS`, `PRD_GENERATION_TIMEOUT_MS`, `POC_GENERATION_TIMEOUT_MS`: positive timeout thresholds used by workflow execution and downstream generation.

Run `npm run env:check` before startup to validate required secrets, URLs, paths, and timeout values.

For partial local setup, validate only the scopes you need:

```bash
npm run env:check -- --scope common,gateway-api
npm run env:check -- --scope telegram-bot --allow-placeholder-secrets
npm run env:check -- --scope worker
```

Start local infrastructure:

```bash
npm run services:up
npm run services:status
```

Stop local infrastructure:

```bash
npm run services:down
```

Seed local storage data:

```bash
npm run seed:dev
```

Run workspace checks:

```bash
npm run build
npm run typecheck
npm run lint
npm run test
npm run format
```

## Package Responsibilities

### Apps

- `apps/telegram-bot`: Telegram command parsing, response formatting, and API integration.
- `apps/gateway-api`: HTTP API surface for case creation, status, overrides, outputs, and downstream generation.
- `apps/worker`: background job execution, orchestration, validation, and artifact generation.

### Packages

- `packages/shared-types`: shared runtime contracts and validation primitives.
- `packages/workflow-core`: case state machine, Judge routing, loop controls, and queue planning.
- `packages/persistence`: PostgreSQL repositories, Redis helpers, and filesystem artifact access.
- `packages/report-renderer`: approved business summary, business plan, PRD, and POC renderers.
- `packages/agent-specs`: prompt template loading and access to versioned agent spec metadata.

## Prompt Templates

Prompt specs stay in-repo under `docs/agent-specs/*.yaml` and are loaded directly by `packages/agent-specs`. The runtime registry keeps each agent template traceable to its YAML source file and to the shared version defined in `docs/agent-specs/common.base.yaml`.

See `docs/agent-specs/README.md` for the YAML-to-`prompt_template_versions` mapping and the update workflow.

## Founder-Value Capture

Founder-value feedback can be recorded with `POST /api/cases/{caseId}/founder-value`. The initial capture is intentionally lightweight and operator-friendly:

- `perceivedUsefulnessScore`: 1-5
- `confidenceIncreaseScore`: 1-5
- `manualResearchMinutesSaved`: non-negative integer minutes
- optional `respondentType`, `actor`, and `notes`

Measurements are persisted separately from audit logs, and each write also creates an audit log entry for traceability.

## Operator Reporting

Operators can inspect product-quality signals through `GET /api/reports/metrics`. The report returns the current product metrics snapshot together with aggregate founder-value feedback so the team can review MVP usefulness without parsing Prometheus output.

## Source of Truth

Implementation must stay aligned with:

- `docs/prd.md`
- `docs/orchestrator-rules.md`
- `docs/technical-spec.md`
- `docs/agent-specs/*.yaml`
- `docs/task.md`

If any source-of-truth doc changes, record the change in the change log inside `docs/task.md` before implementing against it.

## Contributing

See `CONTRIBUTING.md` for the task-by-task workflow, verification expectations, and update rules for this repository.
