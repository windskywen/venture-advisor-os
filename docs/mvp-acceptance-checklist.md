# MVP Acceptance Checklist

Last run: 2026-03-12

Use this checklist before marking release gates green or cutting an MVP release.

## Source Documents

- `docs/prd.md` section 26
- `docs/technical-spec.md` section 23
- `docs/orchestrator-rules.md` sections 17-18
- `docs/agent-specs/common.base.yaml`

## Execution Command

Run the curated acceptance suite:

```bash
npm run test:acceptance
```

Run the type-level guardrail before release as well:

```bash
npm run typecheck
```

## Checklist

| Gate | Requirement | Source Alignment | Evidence | Result |
| --- | --- | --- | --- | --- |
| G001 | User can create and start a case from Telegram. | PRD 26.1, Technical Spec 23.1 | `apps/telegram-bot/test/telegram-gateway-integration.test.ts`, `apps/gateway-api/test/create-case.test.ts`, `apps/gateway-api/test/start-case.test.ts` | PASS |
| G002 | Iteration 1 runs A -> B -> C -> J. | PRD 26.2, Technical Spec 23.2, Orchestrator first-iteration flow | `packages/workflow-core/test/workflow-e2e.test.ts` | PASS |
| G003 | Judge returns PASS, REVISE, PIVOT, or REJECT with valid normalized output. | PRD 26.3, Technical Spec 23.3, Judge agent spec | `packages/workflow-core/test/workflow-e2e.test.ts`, `packages/workflow-core/test/judge.test.ts` | PASS |
| G004 | REVISE and PIVOT trigger targeted reruns only. | PRD 26.4, Orchestrator revise/pivot routing rules | `packages/workflow-core/test/workflow-e2e.test.ts`, `packages/workflow-core/test/revise-flow.test.ts`, `packages/workflow-core/test/pivot-flow.test.ts` | PASS |
| G005 | PASS automatically generates approved business summary, business plan, PRD, and POC. | PRD 26.6, Technical Spec 23.5-23.6, Orchestrator PASS flow | `apps/worker/test/downstream-artifacts.test.ts`, `apps/gateway-api/test/generate-prd.test.ts`, `apps/gateway-api/test/generate-poc.test.ts`, `packages/workflow-core/test/pass-flow.test.ts` | PASS |
| G006 | REJECT is terminal and blocks downstream generation. | PRD 26.5, Technical Spec 23.10, Orchestrator reject flow | `packages/workflow-core/test/reject-flow.test.ts`, `packages/workflow-core/test/downstream-gating.test.ts`, `apps/gateway-api/test/generate-prd.test.ts`, `apps/gateway-api/test/generate-poc.test.ts`, `packages/workflow-core/test/workflow-e2e.test.ts` | PASS |
| G007 | Every agent run is validated, audited, and persisted in raw + normalized form. | PRD 26.7-26.8, Technical Spec 23.7-23.8, Orchestrator logging rules | `packages/workflow-core/test/agent-run-persistence.test.ts`, `packages/persistence/test/repositories.test.ts`, `apps/gateway-api/test/create-case.test.ts`, `apps/gateway-api/test/start-case.test.ts`, `apps/gateway-api/test/approve-case.test.ts`, `apps/gateway-api/test/reject-case.test.ts`, `apps/gateway-api/test/record-founder-value.test.ts`, `apps/gateway-api/test/generate-prd.test.ts`, `apps/gateway-api/test/generate-poc.test.ts` | PASS |
| G008 | Every case is queryable while work is in progress. | PRD 26.9, Technical Spec 23.3, product status-query requirements | `apps/gateway-api/test/get-case-async-status.test.ts`, `apps/telegram-bot/test/telegram-gateway-integration.test.ts`, `apps/gateway-api/test/get-case.test.ts` | PASS |
| G009 | Failure paths fail safely and require explicit recovery or override. | PRD 26.10, Technical Spec 23.9-23.10, Orchestrator manual review and override rules | `packages/workflow-core/test/malformed-output-retry.test.ts`, `packages/workflow-core/test/workflow-e2e.test.ts`, `apps/gateway-api/test/approve-case.test.ts`, `apps/gateway-api/test/reject-case.test.ts`, `packages/workflow-core/test/retry-policy.test.ts` | PASS |
| G010 | Security guardrails are enforced in Telegram, API, worker, and storage layers. | Technical Spec section 18, MVP permission model, path-safety rules | `apps/gateway-api/test/request-protections.test.ts`, `apps/telegram-bot/test/security-boundaries.test.ts`, `apps/worker/test/downstream-artifacts.test.ts`, `packages/shared-types/test/runtime-env.test.ts`, `packages/shared-types/test/mvp-permissions.test.ts` | PASS |
| G011 | Agent outputs satisfy required sections, citations, JSON summary requirements, and scoring-scale rules. | `docs/agent-specs/common.base.yaml`, PRD output requirements, Technical Spec formatting rules | `packages/workflow-core/test/output-conventions.test.ts`, `packages/workflow-core/test/output-sections.test.ts`, `packages/agent-specs/test/markdown-sections.test.ts`, `packages/agent-specs/test/registry.test.ts` | PASS |
| G012 | Runtime and product-quality metrics are available for MVP evaluation. | PRD metrics requirements, Technical Spec metrics section | `apps/gateway-api/test/health-metrics.test.ts`, `apps/gateway-api/test/operator-metrics-report.test.ts`, `packages/persistence/test/product-metrics.test.ts`, `packages/persistence/test/operator-metrics-report.test.ts` | PASS |

## Release Decision

If `npm run typecheck` and `npm run test:acceptance` are both green, this checklist is satisfied and the release gates in `docs/task.md` can be marked complete.
