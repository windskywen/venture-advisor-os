# Contributing

## Workflow

1. Start from the first incomplete task in `docs/task.md`.
2. Implement only that task and avoid mixing work from later tasks.
3. Verify the task is actually working with the relevant commands before marking it complete.
4. Mark the task complete in `docs/task.md` only after verification passes.
5. Move to the next incomplete task in order.

## Source-of-Truth Rules

- Treat `docs/prd.md`, `docs/orchestrator-rules.md`, `docs/technical-spec.md`, and `docs/agent-specs/*.yaml` as the contract.
- Keep prompt and agent-rule changes in `docs/agent-specs/*.yaml`; do not maintain a separate hand-edited prompt copy in TypeScript.
- Treat `docs/agent-specs/common.base.yaml` as the shared prompt version source for persisted `prompt_template_versions` records.
- If a source-of-truth document changes, record that change in the `docs/task.md` change log before continuing implementation.
- Do not silently invent workflow behavior that conflicts with those documents.

## Verification Expectations

Run the narrowest relevant checks for the task you changed.

Common commands:

```bash
npm run env:check
npm run build
npm run typecheck
npm run lint
npm run test
npm run format
```

Infrastructure commands:

```bash
npm run services:up
npm run services:status
npm run services:down
npm run bootstrap:dev
npm run seed:dev
```

## Change Scope

- Keep business logic out of transport adapters.
- Put shared contracts in `packages/shared-types`.
- Keep orchestration rules in `packages/workflow-core`.
- Keep persistence concerns in `packages/persistence`.
- Keep rendered artifact generation in `packages/report-renderer`.
- Keep prompt/spec loading in `packages/agent-specs`.

## Pull Request Expectations

- Summarize which task IDs were completed.
- Include the verification commands that were run.
- Note any blockers, follow-up work, or environmental prerequisites.
