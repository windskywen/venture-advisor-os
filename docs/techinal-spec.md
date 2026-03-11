# Venture Advisor OS
## Technical Implementation Specification
Version: v0.1

---

## 1. Purpose

This document defines the implementation-level technical design for Venture Advisor OS, a multi-agent startup opportunity evaluation system using Telegram as the interaction layer, Copilot SDK as the agent execution core, and a local Gateway/Worker architecture for orchestration, persistence, security, and reporting.

The system is designed to:
- accept startup opportunity topics
- research market facts using latest web information
- synthesize software entry opportunities
- critique from a VC perspective
- iteratively loop until pass / revise / pivot / reject
- generate business plan, PRD, and POC documents only after a topic passes validation

---

## 2. System Scope

### In scope for MVP
- Telegram command interface
- Case creation and workflow triggering
- Agent orchestration for A/B/C/J
- Iterative review loop
- PostgreSQL persistence
- Markdown / JSON artifact storage
- Judge decision routing
- PRD / POC generation after PASS

### Out of scope for MVP
- Full web dashboard
- Multi-tenant user/org model
- Automated deployment
- Git push / PR automation
- Production code generation in real repos
- Advanced RBAC

---

## 3. High-Level Architecture

User -> Telegram Bot -> Gateway API -> Queue -> Worker -> Copilot SDK -> Copilot CLI -> Tools / Web / Local Storage

### Components
1. Telegram Bot App
2. Gateway API
3. Workflow Worker
4. PostgreSQL
5. Redis / BullMQ
6. File Storage
7. Copilot Session Adapter
8. Prompt / Agent Spec Registry
9. Report Renderer
10. Audit Logger

---

## 4. Applications

### 4.1 telegram-bot
Responsibilities:
- receive Telegram commands
- validate basic command format
- call Gateway API
- return summaries and decision messages
- expose webhook endpoint or polling runner

### 4.2 gateway-api
Responsibilities:
- receive authenticated requests from Telegram bot
- create/update cases
- expose case query APIs
- enqueue jobs for workers
- manage approval endpoints
- provide current workflow state

### 4.3 worker
Responsibilities:
- execute orchestration logic
- run agents via Copilot SDK
- persist outputs
- update iteration state
- compose reports
- record scores and audit logs

---

## 5. Core Domain Concepts

### 5.1 Opportunity Case
Represents one startup idea / market topic under evaluation.

Fields:
- caseId
- topic
- region
- founderProfile
- preferredBusinessModels
- constraints
- status
- currentIteration
- maxIterations
- finalDecision

### 5.2 Iteration
Represents one evaluation cycle for a case.

Each iteration contains:
- Agent A outputs
- Agent B outputs
- Agent C critique
- Agent J decision
- score breakdown
- next-step tasks

### 5.3 Agent Output
A persisted normalized output from one agent run.

### 5.4 Judge Task
A structured follow-up task emitted by Judge for revise or pivot.

---

## 6. State Machine

States:
- NEW
- TOPIC_ACCEPTED
- RESEARCHING
- SYNTHESIZING
- VC_REVIEW
- JUDGE_REVIEW
- REVISE_REQUIRED
- PIVOT_REQUIRED
- APPROVED_FOR_PRD
- PRD_IN_PROGRESS
- POC_IN_PROGRESS
- COMPLETED
- REJECTED
- FAILED

Allowed transitions:
- NEW -> TOPIC_ACCEPTED
- TOPIC_ACCEPTED -> RESEARCHING
- RESEARCHING -> SYNTHESIZING
- SYNTHESIZING -> VC_REVIEW
- VC_REVIEW -> JUDGE_REVIEW
- JUDGE_REVIEW -> REVISE_REQUIRED
- JUDGE_REVIEW -> PIVOT_REQUIRED
- JUDGE_REVIEW -> APPROVED_FOR_PRD
- JUDGE_REVIEW -> REJECTED
- REVISE_REQUIRED -> RESEARCHING
- PIVOT_REQUIRED -> SYNTHESIZING
- APPROVED_FOR_PRD -> PRD_IN_PROGRESS
- PRD_IN_PROGRESS -> POC_IN_PROGRESS
- POC_IN_PROGRESS -> COMPLETED
- any -> FAILED

---

## 7. Iteration Workflow

### 7.1 Standard first pass
1. Create case
2. Increment iteration = 1
3. Run Agent A
4. Run Agent B using A output
5. Run Agent C using A + B outputs
6. Run Agent J using A + B + C outputs
7. Route by Judge decision

### 7.2 REVISE flow
1. Read Judge tasks
2. Re-run only the required parts of A and/or B
3. Re-run C
4. Re-run J
5. Stop if max iterations reached or pass / reject

### 7.3 PIVOT flow
1. Keep A market facts where still relevant
2. Re-run B with pivot instructions
3. Re-run C
4. Re-run J

### 7.4 PASS flow
1. Run D to generate PRD
2. Run E to generate POC
3. Compose final business plan
4. Mark case as COMPLETED

---

## 8. Queue Design

Recommended queue names:
- case-start
- agent-run
- case-review
- report-render
- prd-generate
- poc-generate

Job payload example:
{
  "caseId": "uuid",
  "iterationNo": 2,
  "jobType": "run-agent",
  "agentName": "FactResearcher",
  "contextRefs": ["output-a1", "judge-task-1"]
}

Retry policy:
- transient infrastructure errors: retry up to 3
- schema validation errors: do not retry automatically
- agent timeout: retry once
- repeated agent invalid output: mark case FAILED_REVIEW and require manual inspect

---

## 9. Persistence Model

### Tables
- opportunity_cases
- case_iterations
- agent_outputs
- judge_tasks
- score_details
- audit_logs
- approvals
- prompt_template_versions

### Additional table: approvals
Fields:
- approvalId
- caseId
- iterationId
- requestedAction
- status
- requestedAt
- resolvedAt
- resolvedBy
- metadata

### Additional table: prompt_template_versions
Fields:
- templateVersionId
- agentName
- version
- templateBody
- schemaBody
- isActive
- createdAt

---

## 10. Storage Layout

/storage/cases/{caseId}/
  case.json
  final_business_plan.md
  prd.md
  poc_spec.md
  /iterations/{iterationNo}/
    inputs/
    outputs/
      market_facts.md
      pain_evidence.md
      competitor_map.md
      opportunity_options.md
      business_model_hypotheses.md
      vc_critic_report.md
      judge_decision.json
      decision_memo.md
    raw/
      fact_researcher.raw.json
      strategist.raw.json
      vc_critic.raw.json
      judge.raw.json

Rules:
- persist both raw output and normalized output
- normalized output is source of truth for downstream logic
- raw output is retained for debugging and audit

---

## 11. Gateway API Specification

### 11.1 POST /api/cases
Create a new opportunity case.

Request body:
- topic: string
- region?: string
- founderProfile?: string
- preferredBusinessModels?: string[]
- constraints?: string[]

Response:
- caseId
- status

### 11.2 POST /api/cases/{caseId}/start
Enqueue first workflow execution.

Response:
- accepted: true
- queuedJobId

### 11.3 GET /api/cases/{caseId}
Returns case summary with current state and latest decision.

### 11.4 GET /api/cases/{caseId}/iterations
Returns all iterations and summaries.

### 11.5 GET /api/cases/{caseId}/outputs
Returns latest normalized outputs and file refs.

### 11.6 POST /api/cases/{caseId}/approve
Body:
- action: string

### 11.7 POST /api/cases/{caseId}/reject
Body:
- reason?: string

### 11.8 POST /api/cases/{caseId}/generate-prd
Allowed only when status = APPROVED_FOR_PRD or COMPLETED without PRD.

### 11.9 POST /api/cases/{caseId}/generate-poc
Allowed only after PRD exists.

---

## 12. Telegram Command Mapping

Commands:
- /newidea {topic}
- /startcase {caseId}
- /status {caseId}
- /review {caseId}
- /approve {caseId} {action}
- /reject {caseId}
- /prd {caseId}
- /poc {caseId}
- /next-topic

Mapping:
- /newidea -> POST /api/cases
- /startcase -> POST /api/cases/{caseId}/start
- /status -> GET /api/cases/{caseId}
- /approve -> POST /api/cases/{caseId}/approve
- /reject -> POST /api/cases/{caseId}/reject
- /prd -> POST /api/cases/{caseId}/generate-prd
- /poc -> POST /api/cases/{caseId}/generate-poc

---

## 13. Agent Execution Contract

Each agent execution must support:
- input context assembly
- system prompt loading by version
- user prompt rendering
- output schema validation
- raw output persistence
- normalized output generation
- score extraction if relevant
- audit logging

Interface:
runAgent({
  caseId,
  iterationNo,
  agentName,
  inputContext,
  templateVersion,
  outputSchema
}) => AgentRunResult

AgentRunResult:
- success: boolean
- rawText: string
- normalizedJson: object
- markdown?: string
- scoreDetails?: array
- validationErrors?: array
- tokensUsed?: number
- latencyMs?: number

---

## 14. Prompt Rendering Strategy

Prompts should be template-driven.

Inputs:
- case metadata
- iteration number
- judge tasks if any
- prior agent outputs
- scoring rubric
- stop conditions
- output schema

Rendering stages:
1. load system spec
2. load role instructions
3. inject structured context
4. inject formatting and output constraints
5. attach schema reminder

---

## 15. Output Normalization

Need a parser/normalizer layer per agent.

Examples:
- FactResearcherNormalizer
- OpportunityStrategistNormalizer
- VCCriticNormalizer
- JudgeNormalizer
- PRDNormalizer
- POCNormalizer

Rules:
- parse structured JSON if present
- fallback to section-based markdown parsing
- fail fast if required sections missing
- store validation errors to audit

---

## 16. Scoring Logic

### VC score dimensions
- problemSeverity
- painFrequency
- willingnessToPay
- marketSize
- urgency
- competitionPressure
- differentiationPotential
- moatPotential
- gtmFeasibility
- founderFit
- technicalDefensibility
- timeToMVP
- regulatoryRisk

### Judge score dimensions
- evidenceCompleteness
- evidenceFreshness
- assumptionRisk
- rebuttalStrength
- businessViabilityConfidence
- iterationWorthiness

### Decision heuristics
PASS:
- vcAverage >= thresholdPass
- evidenceCompleteness >= thresholdEvidence
- no unresolved fatal risks
- judgeDecision = PASS

REVISE:
- viability plausible
- evidence or rebuttal insufficient

PIVOT:
- market valid, entry angle weak

REJECT:
- fatal flaws unresolved
- score stagnation
- max iterations exceeded without sufficient improvement

Config should be environment-driven or DB-driven.

---

## 17. Report Composition

### final_business_plan.md
Sections:
1. executive summary
2. market problem definition
3. user pain points
4. market landscape
5. competitor analysis
6. software opportunity
7. business model recommendation
8. GTM recommendation
9. risks and counterarguments
10. final recommendation
11. why now
12. next steps

### prd.md
Sections:
1. product overview
2. problem statement
3. target users
4. use cases
5. requirements
6. scope
7. user stories
8. metrics
9. risks
10. open questions

### poc_spec.md
Sections:
1. poc goal
2. hypotheses
3. scope
4. architecture
5. modules
6. data plan
7. acceptance criteria
8. build tasks
9. risks and fallback

---

## 18. Security and Guardrails

### Rules
- Telegram cannot specify arbitrary OS paths
- Gateway maps project aliases to allowlisted directories
- Worker only writes inside case workspace
- No shell execution in MVP except explicitly allowed safe commands
- High-risk actions require approval record

### Permission levels
- L0: read-only research
- L1: write reports
- L2: run safe local commands
- L3: git commit
- L4: git push / deploy

MVP enabled:
- L0
- L1

---

## 19. Observability

Must record:
- case lifecycle events
- agent execution start/end
- validation errors
- scores
- judge decisions
- retries
- queue failures
- storage paths

Recommended:
- structured JSON logs
- requestId / caseId / iterationId correlation
- basic metrics endpoint
- optional OpenTelemetry later

---

## 20. Failure Handling

### Categories
1. infra failure
2. agent timeout
3. malformed output
4. normalization failure
5. judge dead-end
6. storage failure

### Handling
- infra failure -> retry
- malformed output -> retry once with stricter formatting reminder
- repeated normalization failure -> mark FAILED
- storage failure -> do not advance workflow
- judge dead-end -> require manual inspect or reject case

---

## 21. Environment Variables

Examples:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- GATEWAY_PORT
- DATABASE_URL
- REDIS_URL
- STORAGE_ROOT
- COPILOT_CLI_PATH
- COPILOT_SDK_TIMEOUT_MS
- DEFAULT_MAX_ITERATIONS
- SCORE_THRESHOLD_PASS
- SCORE_THRESHOLD_EVIDENCE

---

## 22. Suggested Monorepo Packages

/packages/shared-types
- DTOs
- enums
- schemas

/packages/agent-specs
- YAML templates
- role configs

/packages/report-renderer
- markdown composition
- section templates

/packages/persistence
- repositories
- migrations

/packages/workflow-core
- state machine
- orchestration helpers
- scoring logic

---

## 23. MVP Acceptance Criteria

1. user can create a case from Telegram
2. system can run A/B/C/J for iteration 1
3. judge decision is persisted and visible via Telegram
4. revise loop works for at least one additional iteration
5. pass decision triggers PRD generation
6. PRD generation triggers POC generation
7. all outputs are saved to storage and indexed in DB
8. audit log exists for every agent run
9. malformed agent output does not silently corrupt workflow
10. rejected case stops further progression

---

## 24. Recommended Initial Delivery Sequence

Sprint 1:
- monorepo bootstrap
- DB migrations
- case CRUD
- Telegram bot basics

Sprint 2:
- worker + queue
- Copilot session adapter
- agent template registry
- A/B/C/J execution pipeline

Sprint 3:
- normalizers
- judge routing
- revise/pivot loops
- scoring persistence

Sprint 4:
- D/E generation
- report rendering
- approval hooks
- hardening and logs