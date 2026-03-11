## Comprehensive Product Requirements Document

**Version:** 1.0  
**Status:** Draft
**Product Type:** Multi-agent startup opportunity evaluation and product planning system  
**Primary Interface:** Telegram Bot + Codex/Copilot-assisted development workflow  
**Execution Core:** Agent orchestrator with iterative Judge loop

---

## 1. Executive Summary

Venture Advisor OS is a multi-agent AI advisory system designed to help a technical founder systematically discover, evaluate, challenge, and refine startup opportunities across industries and markets.

The system begins with a user-provided topic, market, or business direction. It then uses multiple specialized agents to research the market, identify software-entry opportunities, critique them from a venture capital perspective, and decide whether the idea should proceed, be revised, pivoted, or rejected. Only validated opportunities move forward into downstream outputs such as a business plan, PRD, and POC specification.

The core differentiator is not idea generation alone, but a disciplined **iterative validation loop**:
- Research
- Synthesis
- VC-style critique
- Judge decision
- Targeted rerun if needed
- Pass only when evidence and strategic viability are strong enough

This creates a system closer to a venture studio or investment screening engine than a generic AI chatbot.

---

## 2. Product Vision

Build a founder-grade AI operating system that helps identify high-potential software startup opportunities and eliminates weak ones before time and engineering effort are wasted.

---

## 3. Product Mission

Enable solo founders and small technical teams to:
- explore new startup markets faster
- evaluate opportunity quality more rigorously
- reduce false-positive startup ideas
- transform validated ideas into actionable product plans
- produce business plan, PRD, and POC outputs with minimal manual overhead

---

## 4. Product Goals

### 4.1 Primary Goals
The system must:
1. Accept a startup topic, market, or direction from the user
2. Research current market information and evidence
3. Identify problems, pain points, workflow gaps, and software entry opportunities
4. Critique the idea from a skeptical VC/investor perspective
5. Run an iterative pass/revise/pivot/reject decision loop
6. Preserve evidence, scores, decisions, and iteration history
7. Generate downstream documents only after opportunity approval:
   - business plan
   - PRD
   - POC specification

### 4.2 Secondary Goals
The system should:
- support portfolio-style topic evaluation across multiple ideas
- preserve reusable research artifacts
- enable structured development handoff into Codex/Copilot workflows
- provide auditable reasoning and structured outputs

### 4.3 Non-Goals for MVP
The system will not initially:
- auto-deploy software
- auto-push production code
- act as a fully autonomous venture capitalist
- provide a full web dashboard
- replace human strategic judgment entirely
- support multi-tenant enterprise collaboration in first release

---

## 5. Problem Statement

Technical founders often have many possible startup ideas but lack a rigorous system to determine which opportunities are worth building.

Existing challenges include:
- too many markets to evaluate manually
- weak distinction between interesting problems and investable businesses
- poor separation between facts, assumptions, and storytelling
- insufficient adversarial review before product work begins
- premature PRD/POC creation for weak ideas
- fragmented workflow between market research, business planning, and product design

Venture Advisor OS solves this by introducing structured multi-agent analysis and a gatekeeping workflow before productization.

---

## 6. Target Users

### 6.1 Primary User
**Solo technical founder**
- strong software engineering capability
- limited time and capital
- wants to find high-leverage business opportunities
- needs help with market research, challenge, and structuring

### 6.2 Secondary Users
**Small startup teams**
- 2–10 person founding or innovation teams
- need structured opportunity analysis before committing resources

**Technical consultants / venture builders**
- want repeatable startup opportunity evaluation workflows

**Internal innovation leads**
- want a disciplined screening tool for potential software initiatives

---

## 7. User Personas

### Persona A: Solo Technical Founder
- knows how to build software
- not always strong in market selection
- wants AI to act as market researcher + VC critic + product planner
- values speed, clarity, and focus

### Persona B: Venture Studio Operator
- evaluates many startup directions
- wants consistent output format
- needs portfolio-level comparison and rejection logic

### Persona C: Product-Minded Engineer
- wants to go from market idea to implementation-ready plan
- needs business context before building

---

## 8. User Jobs To Be Done

### Functional JTBD
- Help me determine whether a startup topic is worth pursuing
- Help me discover software problems hidden in a market
- Help me identify the best entry point for a product
- Help me challenge my own assumptions before building
- Help me produce a PRD and POC only if the idea is good enough

### Emotional JTBD
- Reduce uncertainty about startup direction
- Prevent wasted effort on weak ideas
- Increase confidence in selected topics
- Give me structured, professional output I can trust

### Social JTBD
- Help me communicate opportunities professionally to partners, investors, or collaborators
- Let me appear methodical and rigorous in how I evaluate ideas

---

## 9. Product Principles

1. **Evidence over eloquence**  
   Strong writing must not substitute for strong evidence.

2. **Adversarial validation is required**  
   Every opportunity must survive critique, not just generation.

3. **Do not productize weak ideas**  
   PRD and POC generation happen only after opportunity approval.

4. **Targeted iteration over full reruns**  
   If a topic needs revision, only rerun the necessary research/strategy components.

5. **Separate roles for better judgment**  
   Research, synthesis, critique, and final decision must not collapse into a single agent.

6. **Preserve auditability**  
   Outputs, scores, decisions, and tasks must be saved.

7. **Optimize for founder usefulness**  
   Recommendations must be actionable, not merely insightful.

---

## 10. Product Scope

### In Scope
- Topic intake
- Opportunity case creation
- Multi-agent workflow
- Market research
- Opportunity synthesis
- VC critique
- Judge-based decisioning
- Iteration loop
- Structured scoring
- Business plan generation
- PRD generation
- POC generation
- Telegram interaction layer
- Persistent storage
- Codex/Copilot-friendly documentation and handoff structure

### Out of Scope for MVP
- Web UI dashboard
- Investor CRM
- Fully automated browsing infrastructure management
- Financial forecasting engine beyond lightweight opportunity logic
- Live team collaboration workflow
- Full portfolio analytics dashboard

---

## 11. Product Overview

The system revolves around an **Opportunity Case**.

A user submits a topic. The system creates a case and runs it through a multi-agent pipeline:

1. **FactResearcher**  
   Gathers factual market evidence, user pain points, workflow gaps, competitors, and assumptions.

2. **OpportunityStrategist**  
   Converts evidence into opportunity options, product shapes, business model hypotheses, and MVP directions.

3. **VCCritic**  
   Challenges the opportunity with skeptical investment-style reasoning and assigns structured scores.

4. **Judge**  
   Decides whether the topic should PASS, REVISE, PIVOT, or REJECT. Emits next-step tasks if iteration is warranted.

5. **PRDStrategist**  
   Runs only after PASS. Produces an MVP-focused PRD.

6. **POCArchitect**  
   Runs only after PASS and PRD generation. Produces a technical validation plan.

---

## 12. End-to-End Workflow

### 12.1 Topic Intake
User submits:
- topic
- market or region
- founder profile
- constraints
- preferred business models if any

### 12.2 Iteration 1
- Agent A researches
- Agent B synthesizes
- Agent C critiques
- Agent J judges

### 12.3 Routing
Judge returns one of:
- PASS
- REVISE
- PIVOT
- REJECT

### 12.4 If REVISE
The system reruns only targeted research/strategy tasks, then re-runs C and J.

### 12.5 If PIVOT
The system retains reusable evidence, reframes opportunity strategy, then re-runs C and J.

### 12.6 If PASS
The system generates:
- approved business summary
- final business plan
- PRD
- POC specification

PASS automatically advances the workflow. No separate manual approval is required in the normal path.

### 12.7 If REJECT
The case is closed and recorded as a rejected topic.

---

## 13. Core User Flows

### Flow A: Create and evaluate a new topic
1. User submits new topic
2. System creates Opportunity Case
3. First iteration runs
4. User receives summary and current status
5. Judge decision determines next action

### Flow B: Revise a promising but weakly supported topic
1. Judge returns REVISE
2. System emits explicit follow-up tasks
3. Rerun targeted agents
4. VC critique repeats
5. Judge decides again

### Flow C: Pivot a weak entry angle
1. Judge returns PIVOT
2. Opportunity strategy is reframed
3. Critique and Judge rerun
4. Topic either improves or is rejected

### Flow D: Generate downstream product planning docs
1. Judge returns PASS
2. System composes the approved business summary and final business plan from the latest approved iteration
3. PRDStrategist generates PRD
4. POCArchitect generates POC plan
5. Final case is marked complete

---

## 14. Functional Requirements

## 14.1 Topic Intake Module
The system must:
- allow user to create a new opportunity case
- accept topic, region, founder profile, preferred business models, constraints
- store metadata
- assign default iteration budget
- return a case ID and initial status

### Inputs
- topic (required)
- region (optional)
- founder profile (optional)
- preferred business models (optional)
- constraints (optional)

### Outputs
- case created
- status = `TOPIC_ACCEPTED`

---

## 14.2 Fact Research Module
The system must:
- gather relevant, recent market evidence
- identify users, pains, and workflow gaps
- identify competitors and alternatives
- explicitly list assumptions
- persist outputs and evidence references

### Required output sections
- Market Problem Definition
- Target User Segments
- Pain Points
- Workflow Gaps
- Current Alternatives
- Competitor Snapshot
- Evidence List
- Facts vs Assumptions

---

## 14.3 Opportunity Strategy Module
The system must:
- generate 2–5 software opportunity options where possible
- identify best product form
- propose recommended entry point
- define business model hypotheses
- define MVP direction
- output feasibility scoring

### Required output sections
- Opportunity Options
- Problem-to-Solution Mapping
- Recommended Entry Point
- Business Model Hypotheses
- MVP Direction
- Feasibility Analysis
- Assumptions and Unknowns

---

## 14.4 VC Critique Module
The system must:
- evaluate opportunity from skeptical investor perspective
- identify fatal flaws and manageable risks
- assign structured scores
- raise concrete objections and key questions
- provide recommendation signal

### Required critique dimensions
- Problem Severity
- Pain Frequency
- Willingness to Pay
- Market Size
- Urgency
- Competition Pressure
- Differentiation Potential
- Moat Potential
- GTM Feasibility
- Founder Fit
- Technical Defensibility
- Time to MVP
- Regulatory Risk

---

## 14.5 Judge Module
The system must:
- determine whether opportunity should PASS, REVISE, PIVOT, or REJECT
- interpret evidence and critique quality
- prevent wasteful repeated loops
- produce explicit next-step tasks for REVISE or PIVOT
- detect termination conditions

### Required Judge outputs
- decision
- rationale
- accepted objections
- rejected objections
- evidence assessment
- iteration worthiness
- next iteration tasks
- termination warning

---

## 14.6 Business Plan Generation Module
The system must generate a final business plan after PASS.

### Required sections
- Executive Summary
- Market Problem Definition
- User Pain Points
- Market Landscape
- Competitor Analysis
- Software Entry Opportunity
- Business Model Recommendation
- GTM Recommendation
- Risks and Counterarguments
- Final Recommendation
- Why Now
- Next Steps

---

## 14.7 PRD Generation Module
The system must generate a product requirements document after PASS.

### Required sections
- Product Overview
- Problem Statement
- Target Users
- Use Cases
- Functional Requirements
- Non-Functional Requirements
- MVP Scope
- Out of Scope
- User Stories
- Success Metrics
- Risks
- Open Questions

---

## 14.8 POC Generation Module
The system must generate a technical POC spec after PASS.

### Required sections
- POC Goal
- Validation Hypotheses
- Demo Scope
- Technical Architecture
- Core Modules
- Data Inputs
- Mock vs Real Components
- Acceptance Criteria
- Build Tasks
- Risks and Fallback Plan

---

## 14.9 Telegram Bot Interface
The system must:
- accept commands from Telegram
- map commands to API actions
- return compact summaries
- report Judge decisions
- report PRD/POC readiness
- support status querying
- support operator override commands for exceptional manual review cases only

### Supported commands for MVP
- `/newidea`
- `/startcase`
- `/status`
- `/approve`
- `/reject`
- `/prd`
- `/poc`
- `/next-topic`

Command semantics:
- `/approve` is an operator override command, not a required step after PASS
- `/reject` is an operator override command for force-reject or manual closure
- `/next-topic` retrieves the next pending case from persisted storage using the backend selection policy, prioritizing fresh actionable topics before failed cases awaiting manual review

---

## 14.10 Persistence and Audit Layer
The system must:
- store all opportunity cases
- store all iterations
- store all normalized agent outputs
- store all score dimensions
- store all judge tasks
- store approvals and overrides
- store audit logs
- preserve raw outputs for debugging

---

## 15. Non-Functional Requirements

### 15.1 Reliability
- workflows must fail safely
- invalid agent output must not silently corrupt downstream flow
- each step must be persisted before routing to the next

### 15.2 Auditability
- all major actions must be logged
- every case must preserve versioned outputs and decisions
- downstream documents must trace to approved iteration

### 15.3 Maintainability
- clear module boundaries
- reusable shared types and schemas
- business logic must not be trapped in route handlers
- orchestration rules should be configurable

### 15.4 Extensibility
- easy to add new agents
- easy to add future tool integrations
- easy to add web UI later
- easy to add portfolio analytics later

### 15.5 Security
- Telegram must not directly execute local shell commands
- project paths must be allowlisted
- worker must operate only within controlled workspace
- high-risk actions must require approval

### 15.6 Performance
- case submission should return quickly
- long-running agent work should be asynchronous
- user should be able to query case status at any time

### 15.7 Developer Experience
- repo should be Codex/Copilot-friendly
- markdown specs and agent rules should be first-class artifacts
- local setup should be straightforward

---

## 16. Success Metrics

### 16.1 Product Metrics
- percentage of submitted topics that reach Judge completion
- percentage of topics rejected before PRD stage
- average number of iterations per case
- percentage of PASS cases that produce PRD and POC successfully
- median time from topic creation to final decision

### 16.2 Quality Metrics
- percentage of agent outputs that validate successfully against schema
- number of manual overrides required
- score stagnation detection accuracy
- percent of reruns that are targeted rather than full reruns

### 16.3 Founder Value Metrics
- perceived usefulness of final outputs
- reduction in time spent manually researching markets
- confidence increase in selected opportunities
- reduction in false-positive startup directions

---

## 17. Risks and Mitigations

### Risk 1: Endless iteration on weak topics
**Mitigation:**  
Judge termination warning, max iterations, stagnation rules, reject bias after repeated weak cycles.

### Risk 2: Beautiful but unsupported business ideas
**Mitigation:**  
fact vs assumption separation, evidence scoring, VC critique, Judge review.

### Risk 3: Overproduction of PRDs for bad ideas
**Mitigation:**  
strict PASS gate before D/E.

### Risk 4: Agent outputs are malformed or inconsistent
**Mitigation:**  
schema validation, raw + normalized output persistence, retry policy, failure states.

### Risk 5: Telegram becomes overloaded as a UI
**Mitigation:**  
keep Telegram as control plane only, not document editing layer.

### Risk 6: Architecture grows too broad too early
**Mitigation:**  
MVP excludes web dashboard, multi-tenant design, auto-deploy, advanced collaboration.

---

## 18. Assumptions

- Users are comfortable working through Telegram for control and summaries
- Users value structured business and product planning outputs
- Initial users are primarily solo founders or small technical teams
- Research and critique quality matter more than raw automation speed
- Codex/Copilot-assisted development is part of the build workflow
- Markdown artifacts are acceptable for MVP output format

---

## 19. Dependencies

### Product Dependencies
- agent prompt specifications
- orchestration rules
- normalized output schemas
- persistence layer
- Telegram bot integration
- asynchronous worker infrastructure

### Technical Dependencies
- Node.js / TypeScript
- PostgreSQL
- Redis / BullMQ
- storage for markdown and JSON artifacts
- agent runtime integration layer
- schema validation library

---

## 20. Core Data Objects

### Opportunity Case
Represents one topic being evaluated.

### Iteration
Represents one loop of research + strategy + critique + judgment.

### Agent Output
Stores one agent’s output for one case/iteration.

### Judge Task
Represents one structured action required before another loop.

### Score Detail
Stores one score dimension from C or J.

### Approval
Stores manual approval or override records.

### Audit Log
Stores activity and transition records.

---

## 21. State Machine

### Core states
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

### Key rules
- first iteration must run A → B → C → J
- REVISE triggers targeted rerun
- PIVOT triggers B-led reframing with critique/judge rerun
- PASS is required before D/E
- REJECT is terminal

---

## 22. Iteration and Decision Rules

### Max iterations
- default: 3
- configurable for advanced topics

### Decision meanings
- **PASS:** validated enough to productize
- **REVISE:** still promising but unsupported
- **PIVOT:** market may be valid, entry point is weak
- **REJECT:** insufficient viability

### Stagnation rule
If score improvement is below threshold across repeated cycles and major objections remain unresolved, reject the topic.

### Fatal flaw rule
If fatal flaws remain unresolved and there is no credible path to disprove them, reject rather than revise.

---

## 23. MVP Release Scope

### Must-have in MVP
- case creation
- A/B/C/J workflow
- iteration loop
- Judge routing
- persistence
- Telegram control plane
- business plan generation
- PRD generation
- POC generation
- audit logging
- schema validation

### Nice-to-have after MVP
- portfolio manager
- web dashboard
- opportunity ranking across cases
- richer analytics
- code-generation adjacency
- deeper Codex workflow integration

---

## 24. Release Plan

### Phase 1: Validation Engine MVP
- intake
- core data model
- A/B/C/J execution
- Judge routing
- persistence
- Telegram status flow

### Phase 2: Productization Layer
- D/E generation
- final business plan
- structured output refinement

### Phase 3: Expansion Layer
- portfolio manager
- better reporting
- code-generation adjacency
- deeper Codex workflow integration

---

## 25. Open Questions

- Should the system support multiple research styles by market type?
- How much browsing autonomy should agents have in future versions?
- Should portfolio management be part of MVP or Phase 2?
- How much scoring should be hard-coded versus configurable?
- Should users be able to define their own Judge thresholds?

---

## 26. Acceptance Criteria

The product is acceptable for MVP when:

1. A user can create a new opportunity case
2. The system can run a full first iteration through A/B/C/J
3. Judge can produce PASS, REVISE, PIVOT, or REJECT
4. REVISE and PIVOT can trigger targeted rerun logic
5. REJECT stops downstream progression
6. PASS automatically triggers business plan, PRD, and POC generation
7. Outputs are stored and retrievable
8. Score details and audit logs are persisted
9. Telegram can report current case status and final decision
10. Invalid outputs are handled safely and visibly

---

## 27. Final Summary

Venture Advisor OS is a disciplined startup opportunity operating system, not just an idea generator. Its central value lies in forcing startup topics through a structured adversarial review loop before product planning begins.

The system’s core advantage is the combination of:
- evidence-backed research
- opportunity synthesis
- venture-style criticism
- Judge-controlled iteration
- gated PRD/POC generation

That makes it useful for founders who want not merely more ideas, but better decisions.
