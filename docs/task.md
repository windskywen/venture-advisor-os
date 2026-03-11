# Venture Advisor OS Implementation Tasks

## Purpose
This backlog translates the frozen PRD, orchestrator rules, technical spec, and agent specs into an executable implementation plan.
Use this file as the ordered build checklist and requirement coverage map.

## Source Documents
- `docs/prd.md`
- `docs/orchestrator-rules.md`
- `docs/technical-spec.md`
- `docs/agent-specs/common.base.yaml`
- `docs/agent-specs/agent-a.fact-researcher.yaml`
- `docs/agent-specs/agent-b.opportunity-strategist.yaml`
- `docs/agent-specs/agent-c.vc-critic.yaml`
- `docs/agent-specs/agent-d.prd-strategist.yaml`
- `docs/agent-specs/agent-e.poc-architect.yaml`
- `docs/agent-specs/agent-j.judge.yaml`

## Working Rules
- Build in phase order unless a dependency explicitly allows parallel work.
- Treat the source documents above as the source of truth.
- Keep implementation aligned with the frozen PASS/override contract unless the docs are intentionally updated first.
- Do not implement post-MVP backlog items until MVP release gates are green.

## 0. Contract Alignment and Open Decisions
- [x] T0001 Align PASS flow, manual override semantics, Judge task contract, and failure model across specs.
- [x] T0002 Rename the technical spec file and remove workflow/API drift from the docs.
- [x] T0003 Resolve the `judge_tasks` input contract for Agent A and Agent B: canonical runtime input is structured `JudgeTask[]`, while the prompt renderer may derive human-readable bullets from those objects.
- [x] T0004 Define `/next-topic` as a persisted API-backed capability that returns the next pending case from storage using deterministic oldest-first selection across actionable pending states.
- [ ] T0005 Record any future source-of-truth doc changes in this backlog before implementation starts.

## 1. Monorepo and Developer Foundation
- [ ] T1001 Create the monorepo layout: `apps/telegram-bot`, `apps/gateway-api`, `apps/worker`, `packages/shared-types`, `packages/workflow-core`, `packages/persistence`, `packages/report-renderer`, `packages/agent-specs`.
- [ ] T1002 Set up Node.js/TypeScript workspace tooling: package manager workspaces, tsconfig, build, lint, test, format, and env validation.
- [ ] T1003 Add local developer bootstrap: `.env.example`, PostgreSQL, Redis, storage root setup, and seed scripts.
- [ ] T1004 Add repository docs for architecture, local run commands, package responsibilities, and contribution workflow.
- [ ] T1005 Establish CI for install, typecheck, lint, unit test, schema validation, and prompt-spec validation checks.
- [ ] T1006 Add package ownership boundaries so business logic stays outside route handlers and bot adapters.

## 2. Shared Domain Contracts and Config
- [ ] T2001 Implement shared enums for case status, Judge decision, agent name, Judge task type, override action, failure category, rejection category, permission level, and prompt template version state.
- [ ] T2002 Implement shared DTOs for case create/start/status/iterations/outputs/approve/reject/generate-prd/generate-poc and `next-topic` response contracts.
- [ ] T2003 Implement shared schemas for `OpportunityCase`, `Iteration`, `AgentOutput`, `JudgeTask`, `ScoreDetail`, `Approval`, `AuditLog`, and approved business summary artifacts.
- [ ] T2004 Implement shared schemas for normalized outputs of Agent A, B, C, J, D, and E.
- [ ] T2005 Implement environment-driven config for thresholds and limits: VC pass, evidence pass, max iterations, minimum score improvement, max stagnant iterations, timeout budgets, and standard-vs-complex topic iteration overrides.
- [ ] T2006 Add storage manifest helpers for artifact paths, file names, iteration refs, and path allowlists.
- [ ] T2007 Add a prompt template registry loader that reads `docs/agent-specs/*.yaml` and exposes versioned prompt metadata.
- [ ] T2008 Encode the shared `common.base.yaml` conventions in code: decision labels, scoring scale `1-10`, markdown section requirement, JSON summary requirement, citation requirement for facts, and explicit fact/inference/assumption separation.
- [ ] T2009 Externalize orchestration thresholds and routing policy so score and loop-control behavior is configurable rather than hard-coded.
- [ ] T2010 Add schema-level validation for required markdown section names even when the normalized JSON omits some rendered sections.
- [ ] T2011 Implement a shared JudgeTask type used consistently by storage, orchestration, API, and Agent A/B prompt inputs.

## 3. Persistence and Artifact Storage
- [ ] T3001 Create database migrations for `opportunity_cases`, `case_iterations`, `agent_outputs`, `judge_tasks`, `score_details`, `audit_logs`, `approvals`, and `prompt_template_versions`.
- [ ] T3002 Implement repositories/services for case CRUD, iteration writes, score persistence, audit logging, approvals, prompt template versions, and override resolution metadata.
- [ ] T3003 Implement the file storage adapter for `/storage/cases/{caseId}/...` including `approved_business_summary.json`, `final_business_plan.md`, `prd.md`, and `poc_spec.md`.
- [ ] T3004 Persist both raw and normalized agent outputs; make normalized output the only downstream source of truth.
- [ ] T3005 Implement artifact indexing so API responses can return file refs for latest outputs.
- [ ] T3006 Add transactional guards so workflow state is not advanced unless DB and storage writes succeed.
- [ ] T3007 Preserve immutable iteration snapshots, versioned outputs, and reusable research artifact refs across revise/pivot flows.
- [ ] T3008 Persist score details per dimension plus computed summary scores needed by routing logic, including VC average and Judge evidence scoring inputs.
- [ ] T3009 Add repository query support and indexing for deterministic next-pending-case selection by actionable status and creation order.

## 4. Workflow Core and Orchestration
- [ ] T4001 Implement the case state machine with the allowed transitions from the technical spec.
- [ ] T4002 Implement BullMQ queues/jobs for case start, agent run, case review, report render, PRD generation, and POC generation.
- [ ] T4003 Implement first-iteration orchestration: A -> B -> C -> J with no skipping.
- [ ] T4004 Implement Judge task classification and rerun planning for A only, B only, A + B, and prohibited reruns.
- [ ] T4005 Implement the REVISE flow using targeted reruns and mandatory C -> J follow-up.
- [ ] T4006 Implement the PIVOT flow that preserves reusable A research unless the pivot invalidates it.
- [ ] T4007 Implement PASS flow gating: compose approved business summary and final business plan, enqueue D, then E, then complete.
- [ ] T4008 Implement REJECT as a terminal flow and persist rejection rationale, rejection category, and portfolio escalation metadata.
- [ ] T4009 Implement stagnation detection, fatal flaw handling, termination warnings, and iteration budget enforcement.
- [ ] T4010 Implement manual review and operator override flow for `FORCE_REVISE`, `FORCE_PIVOT`, `FORCE_PASS_TO_PRD`, and `FORCE_REJECT`.
- [ ] T4011 Implement retry policy for infra failure, timeout, malformed output, normalization failure, schema validation failure, Judge dead-end, and storage failure.
- [ ] T4012 Prevent D/E execution unless the latest Judge decision is PASS and the current case state allows downstream generation.
- [ ] T4013 Implement partial rerun exception rules: allow C-only reruns only for formatting-only upstream changes and allow J-only reruns only for system error recovery.
- [ ] T4014 Detect contradictory agent outputs, invalid Judge decision schema, and low-value dead-end loops; route those cases to manual review or terminal rejection.
- [ ] T4015 Implement workflow events for rejection escalation and `/next-topic` continuation using the persisted next-pending-case selection policy.

## 5. Agent Runtime, Prompting, and Normalization
- [ ] T5001 Implement a prompt renderer that combines base spec, agent role instructions, case context, prior outputs, structured Judge tasks, scoring rubric, stop conditions, and output schema.
- [ ] T5002 Implement a runtime adapter interface for agent execution; start with a mock executor and keep the Copilot/Codex adapter behind the same contract.
- [ ] T5003 Implement a safe research tool abstraction for latest-market-information retrieval, source capture, freshness tracking, and citation metadata.
- [ ] T5004 Implement FactResearcher execution and normalization with evidence dates, facts vs assumptions, competitor mapping, workflow gaps, and source metadata.
- [ ] T5005 Implement OpportunityStrategist execution and normalization with opportunity options, recommended entry point, business model hypotheses, MVP direction, why-this-angle reasoning, and feasibility scores.
- [ ] T5006 Implement VCCritic execution and normalization with objections, fatal flaws, manageable risks, score breakdown, key questions, and recommendation.
- [ ] T5007 Implement Judge execution and normalization with decision, rationale, accepted/rejected objections, evidence assessment, iteration worthiness, next tasks, and termination warning.
- [ ] T5008 Enforce Judge task output enums: target agent, task type, blocking, and description.
- [ ] T5009 Implement PRDStrategist execution and normalization for validated PASS cases only.
- [ ] T5010 Implement POCArchitect execution and normalization after PRD exists and validates.
- [ ] T5011 Persist raw output, normalized output, score details, validation errors, token usage, and latency for every agent run.
- [ ] T5012 Retry malformed outputs once with a stricter formatting reminder, then fail safely.
- [ ] T5013 Enforce `common.base.yaml` output conventions across all agents: markdown sections, JSON summary presence, citations for factual claims, explicit fact/inference/assumption labeling, and scoring scale compliance.
- [ ] T5014 Validate every agent's required markdown sections, including sections not fully represented in the YAML JSON schema, before accepting output as normalized.
- [ ] T5015 Ensure Agent A/B/C/J inputs and outputs remain traceable across iterations and reruns so downstream prompts can reference prior evidence cleanly.
- [ ] T5016 Pass structured JudgeTask[] into Agent A/B at runtime and render a readable bullet summary from those objects for model consumption.

## 6. Gateway API
- [ ] T6001 Implement `POST /api/cases` for topic intake with topic, region, founder profile, preferred business models, constraints, default iteration budget, and initial `TOPIC_ACCEPTED` status.
- [ ] T6002 Implement `POST /api/cases/{caseId}/start` to enqueue first workflow execution.
- [ ] T6003 Implement `GET /api/cases/{caseId}` for case summary, current status, latest decision, downstream readiness, and manual-review state.
- [ ] T6004 Implement `GET /api/cases/{caseId}/iterations` for iteration history and summaries.
- [ ] T6005 Implement `GET /api/cases/{caseId}/outputs` for latest normalized outputs and artifact refs.
- [ ] T6006 Implement `POST /api/cases/{caseId}/approve` for operator overrides only.
- [ ] T6007 Implement `POST /api/cases/{caseId}/reject` for operator force-reject/manual closure only.
- [ ] T6008 Implement `POST /api/cases/{caseId}/generate-prd` with correct downstream gating.
- [ ] T6009 Implement `POST /api/cases/{caseId}/generate-poc` with correct downstream gating.
- [ ] T6010 Implement `GET /api/cases/next-topic` to return the next pending persisted case using deterministic selection policy and an empty result when none exists.
- [ ] T6011 Add request validation, authentication between Telegram and API, correlation IDs, and idempotency protections.
- [ ] T6012 Keep case create/start APIs fast and non-blocking by queuing long-running agent work and returning accepted responses quickly.
- [ ] T6013 Expose a basic health/metrics surface for worker, queue, DB, and storage readiness.

## 7. Telegram Bot
- [ ] T7001 Implement `/newidea {topic}` to create a case.
- [ ] T7002 Implement `/startcase {caseId}` to start workflow execution.
- [ ] T7003 Implement `/status {caseId}` to return current state, latest Judge decision, and next steps.
- [ ] T7004 Implement `/approve {caseId} {action}` as an operator override command only.
- [ ] T7005 Implement `/reject {caseId}` as an operator override/manual closure command only.
- [ ] T7006 Implement `/prd {caseId}` and `/poc {caseId}` for downstream generation requests within allowed states.
- [ ] T7007 Implement `/next-topic` by calling the persisted backend endpoint and returning the selected next pending case or an explicit empty-state response.
- [ ] T7008 Implement webhook or polling runner plus webhook secret validation.
- [ ] T7009 Keep Telegram as a control plane only; do not support document editing or arbitrary shell/path input.
- [ ] T7010 Send compact summaries for workflow start, Judge decisions, revise/pivot tasks, rejection rationale, and PRD/POC readiness.

## 8. Business Plan, PRD, POC, and Handoff Outputs
- [ ] T8001 Implement approved business summary composition from the latest PASS iteration outputs.
- [ ] T8002 Implement the final business plan renderer with all required sections: executive summary, market problem definition, user pain points, market landscape, competitor analysis, software entry opportunity, business model recommendation, GTM recommendation, risks and counterarguments, final recommendation, why now, and next steps.
- [ ] T8003 Implement PRD output with all required sections from the PRD and PRDStrategist spec, including non-functional requirements, risks, and open questions.
- [ ] T8004 Implement POC spec output with all required sections from the PRD and POCArchitect spec, including mock-vs-real decisions and fallback planning.
- [ ] T8005 Ensure PRD/POC artifacts trace to the approved iteration and can be re-generated safely if missing.
- [ ] T8006 Produce a structured Codex/Copilot handoff bundle or artifact index from the approved outputs so validated ideas can move cleanly into implementation.

## 9. Security and Guardrails
- [ ] T9001 Enforce project alias to allowlisted directory mapping; never accept arbitrary OS paths from Telegram.
- [ ] T9002 Restrict worker writes to the controlled case workspace only.
- [ ] T9003 Keep MVP permissions limited to `L0` and `L1`; do not expose local command execution, git commit, git push, or deploy actions.
- [ ] T9004 Require approval records for high-risk human override actions.
- [ ] T9005 Validate and sanitize all inbound Telegram and API payloads.
- [ ] T9006 Add secrets/config guidance and startup validation for bot token, webhook secret, database URL, Redis URL, storage root, Copilot runtime path, and timeout thresholds.
- [ ] T9007 Verify that no Telegram command path can trigger arbitrary shell execution or uncontrolled filesystem access.

## 10. Observability, Reporting, Metrics, and Developer Experience
- [ ] T10001 Implement structured JSON logging for lifecycle events, agent runs, validation errors, retries, queue failures, storage paths, and routing decisions.
- [ ] T10002 Implement correlation fields: requestId, caseId, iterationId, agentName, and jobId.
- [ ] T10003 Implement metrics for the PRD success metrics set: topics reaching Judge completion, pre-PRD rejection rate, average iterations per case, PASS-to-PRD/POC completion rate, time-to-decision, schema validation success rate, manual override count, stagnation detection outcomes, and targeted-rerun rate.
- [ ] T10004 Add audit views or reports that expose scores, decisions, rerun plans, thresholds used, termination triggers, rejection categories, and overrides.
- [ ] T10005 Keep markdown specs and agent rules first-class in the repo; document how prompt template versions map back to source YAML.
- [ ] T10006 Make local setup straightforward for a new developer.
- [ ] T10007 Define founder-value measurement capture for perceived usefulness, confidence increase, and reduction in manual research time, even if initial collection is lightweight or operator-driven.
- [ ] T10008 Expose a lightweight metrics/reporting endpoint or query surface for operators to inspect runtime and product-quality signals.

## 11. Testing and Acceptance
- [ ] T11001 Add unit tests for shared schemas, state transitions, score calculations, stagnation rules, fatal flaw rules, and Judge task classification.
- [ ] T11002 Add integration tests for repositories, storage, queue workers, prompt registry loading, and env/config validation.
- [ ] T11003 Add end-to-end tests for baseline PASS, REVISE, PIVOT, REJECT, malformed output handling, storage failure handling, schema validation failure, and manual overrides.
- [ ] T11004 Add Telegram-to-API integration tests for supported commands, including `/next-topic` selection and empty-state behavior.
- [ ] T11005 Verify that all required output sections exist for Agent A, B, C, J, business plan, PRD, and POC documents.
- [ ] T11006 Validate that downstream documents are never generated before PASS.
- [ ] T11007 Validate that users can query case status at any time during asynchronous execution.
- [ ] T11008 Validate that every major action creates an audit log and that every agent run persists raw + normalized output.
- [ ] T11009 Validate `common.base.yaml` conventions: citations for facts, JSON summary presence, markdown section structure, and scoring-scale compliance.
- [ ] T11010 Run an MVP acceptance checklist against the PRD, orchestrator rules, technical spec, and agent specs before release.

## 12. Post-MVP Backlog
- [ ] T12001 Portfolio manager for multiple topics and ranked next-topic handling.
- [ ] T12002 Opportunity ranking across cases and richer analytics.
- [ ] T12003 Web dashboard.
- [ ] T12004 Deeper Codex workflow integration and code-generation adjacency.
- [ ] T12005 Additional research styles, configurable Judge thresholds, and broader browsing autonomy controls.

## Requirement Coverage Matrix

| Requirement area | Primary tasks |
| --- | --- |
| PRD 4.1 Primary goals | T6001, T4003-T4012, T8001-T8006 |
| PRD 4.2 Secondary goals | T3007, T8006, T12001-T12005 |
| PRD 4.3 MVP non-goals | T9003, T12001-T12005 |
| PRD 10 Scope and MVP boundaries | T1001-T1006, T4001-T4015, T8001-T8006, T12001-T12005 |
| PRD 12 End-to-end workflow | T4003-T4008, T7001-T7010 |
| PRD 13 Core user flows | T6001-T6009, T7001-T7010, T8001-T8006 |
| PRD 14.1 Topic intake | T6001, T6002, T7001, T7002 |
| PRD 14.2 Fact Research | T5003, T5004, T5011-T5015 |
| PRD 14.3 Opportunity Strategy | T5005, T5011-T5015 |
| PRD 14.4 VC Critique | T5006, T5011-T5015 |
| PRD 14.5 Judge Module | T4004-T4015, T5007, T5008 |
| PRD 14.6 Business plan generation | T4007, T8001, T8002 |
| PRD 14.7 PRD generation | T4007, T5009, T8003 |
| PRD 14.8 POC generation | T4007, T5010, T8004 |
| PRD 14.9 Telegram bot | T7001-T7010 |
| PRD 14.10 Persistence and audit | T3001-T3008, T5011, T10001-T10004, T11008 |
| PRD 15.1 Reliability | T3006, T4011-T4014, T5012, T11003 |
| PRD 15.2 Auditability | T3004-T3008, T10001-T10004, T11008 |
| PRD 15.3 Maintainability | T1001-T1006, T2001-T2011, T10005 |
| PRD 15.4 Extensibility | T1001, T2007-T2009, T5002, T12001-T12005 |
| PRD 15.5 Security | T9001-T9007 |
| PRD 15.6 Performance | T4002, T6002, T6011, T7003, T11007 |
| PRD 15.7 Developer experience | T1003-T1006, T10005-T10006 |
| PRD 16 Success Metrics | T10003, T10007, T10008 |
| PRD 17 Risks and mitigations | T4011-T4014, T5012, T9001-T9007, T11003 |
| PRD 19 Dependencies | T1002-T1005, T2007, T3001-T3003, T4002, T5002-T5003 |
| PRD 21 State machine | T2001, T4001, T11001 |
| PRD 22 Iteration and decision rules | T2005, T4004-T4009, T11001 |
| PRD 26 Acceptance criteria | T11010, G001-G012 |
| Orchestrator routing and rerun rules | T4003-T4015, T11001, T11003 |
| Orchestrator score, stagnation, fatal flaw, and termination rules | T2005, T4008-T4014, T3008, T11001 |
| Orchestrator portfolio and override rules | T4008, T4010, T4015, T12001 |
| Technical spec API, queue, storage, and failure handling | T3001-T3009, T4002, T4011, T6001-T6013 |
| Agent spec common base conventions | T2008, T5013, T11009 |
| Agent spec contracts A-E and J | T2004, T2011, T5004-T5016, T11005 |

## Release Gates
- [ ] G001 A user can create and start a case from Telegram.
- [ ] G002 Iteration 1 always runs A -> B -> C -> J.
- [ ] G003 Judge can return PASS, REVISE, PIVOT, or REJECT with valid normalized output.
- [ ] G004 REVISE and PIVOT trigger targeted reruns only.
- [ ] G005 PASS automatically generates approved business summary, business plan, PRD, and POC.
- [ ] G006 REJECT is terminal and blocks downstream generation.
- [ ] G007 Every agent run is validated, audited, and persisted in raw + normalized form.
- [ ] G008 Every case is queryable while work is in progress.
- [ ] G009 Failure paths fail safely and require explicit recovery or override.
- [ ] G010 Security guardrails are enforced in Telegram, API, worker, and storage layers.
- [ ] G011 Agent outputs satisfy required sections, citations, JSON summary requirements, and scoring-scale rules.
- [ ] G012 Runtime and product-quality metrics are available for MVP evaluation.