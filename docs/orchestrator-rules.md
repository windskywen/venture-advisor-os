# Venture Advisor OS
## Orchestrator Rules
Version: v0.1

---

## 1. Purpose

This document defines the orchestration rules for Venture Advisor OS.

It specifies:
- how the workflow moves between agents
- when to rerun Agent A, B, C, or J
- when to PASS / REVISE / PIVOT / REJECT
- when to stop iterating
- how to interpret score changes
- how to avoid wasteful loops

This document is the decision discipline layer of the system.

---

## 2. Core Principle

The orchestrator must optimize for:
- evidence quality
- decision quality
- iteration efficiency
- controlled cost
- rejection of weak topics early

The orchestrator must NOT:
- blindly rerun all agents every time
- loop without new evidence
- confuse weak evidence with strong narrative
- let a topic proceed to PRD / POC without Judge approval

---

## 3. Workflow Summary

Default flow:

1. Create Case
2. Run Agent A (FactResearcher)
3. Run Agent B (OpportunityStrategist)
4. Run Agent C (VCCritic)
5. Run Agent J (Judge)
6. Route by Judge decision:
   - PASS -> D -> E
   - REVISE -> targeted rerun
   - PIVOT -> B-led rerun
   - REJECT -> close case

---

## 4. Agent Responsibilities in Orchestration

### Agent A
Used when factual research needs to be created or updated.

Typical triggers:
- missing market data
- missing competitor comparison
- weak pain evidence
- stale or low-confidence research
- judge requests new factual evidence

### Agent B
Used when the opportunity framing or business strategy needs refinement.

Typical triggers:
- weak entry point
- unclear monetization
- poor target-user fit
- weak MVP direction
- pivot requirement

### Agent C
Always used after any meaningful A or B rerun.

Purpose:
- re-evaluate the revised opportunity
- re-score the business
- confirm whether prior objections remain valid

### Agent J
Always used after C.

Purpose:
- make final routing decision
- emit concrete next-step tasks
- decide whether another iteration is justified

---

## 5. Default First Iteration Rule

On iteration 1:
- run A
- run B
- run C
- run J

No skipping allowed on first pass.

Reason:
the system needs a full baseline.

---

## 6. Decision Routing Rules

## 6.1 PASS

Judge returns PASS when:
- evidence is sufficiently complete
- evidence is sufficiently fresh
- key objections are answered
- there are no unresolved fatal flaws
- opportunity is viable enough to justify productization

Actions:
1. set case status = APPROVED_FOR_PRD
2. compose final business plan and approved business summary from the approved iteration outputs
3. enqueue Agent D
4. after D success, enqueue Agent E
5. set case status = COMPLETED

PASS is final for validation loop.
PASS does not require a separate manual approval step unless a human explicitly invokes the manual review escape hatch.

---

## 6.2 REVISE

Judge returns REVISE when:
- topic still has potential
- evidence is incomplete or rebuttal is weak
- opportunity is not yet reject-worthy
- the missing pieces are concrete and collectible

Actions:
1. set case status = REVISE_REQUIRED
2. persist judge tasks
3. classify judge tasks by target agent
4. rerun only the required agents
5. then rerun C
6. then rerun J

REVISE should be targeted, not full reset.

---

## 6.3 PIVOT

Judge returns PIVOT when:
- the market problem is still interesting
- the current entry angle is weak
- another product shape or user segment is more promising

Actions:
1. set case status = PIVOT_REQUIRED
2. preserve reusable A research unless judge explicitly says it is stale or invalid
3. rerun B with pivot instructions
4. rerun C
5. rerun J

PIVOT usually does not require full A rerun unless the pivot changes the target user or market substantially.

---

## 6.4 REJECT

Judge returns REJECT when:
- fatal flaws remain unresolved
- evidence still does not support the opportunity
- score stagnates across iterations
- business case remains weak after revision
- iteration value is too low
- max iteration reached without sufficient improvement

Actions:
1. set case status = REJECTED
2. persist rejection rationale
3. stop all downstream workflows
4. optionally notify portfolio manager to move to next topic

REJECT is terminal.

---

## 7. Targeted Rerun Rules

The orchestrator must inspect Judge tasks and decide what to rerun.

---

## 7.1 Rerun A only when:

Rerun Agent A if judge tasks include:
- collect more buyer pain evidence
- refresh market size data
- add latest trend data
- expand competitor research
- find pricing evidence
- validate operational workflow assumptions
- verify factual claim challenged by C

Examples:
- "Need 3 more competitors with pricing data"
- "Need fresher TAM sources"
- "Need evidence that target users currently experience this pain"

Then:
- rerun A
- rerun B if B depends materially on the new A findings
- rerun C
- rerun J

Important:
If A changes evidence materially, B should usually rerun too.

---

## 7.2 Rerun B only when:

Rerun Agent B if judge tasks include:
- redefine target user
- improve entry point selection
- revise monetization model
- reduce MVP scope
- reposition product shape
- improve GTM logic
- shift from SaaS to AI tool or vice versa

Examples:
- "Current solution is feature-like, not a company"
- "Need better wedge strategy"
- "Need sharper initial ICP"

Then:
- reuse prior A unless stale
- rerun B
- rerun C
- rerun J

---

## 7.3 Rerun A + B when:

Rerun both A and B if:
- factual basis is weak AND business framing depends on it
- pivot changes target user significantly
- C challenges both evidence and strategic interpretation
- market assumptions and positioning are both unstable

Examples:
- target market changed from enterprise to SMB
- prior pain evidence is weak and monetization logic depends on buyer type
- pricing and workflow reality both unclear

Then:
- rerun A
- rerun B
- rerun C
- rerun J

---

## 7.4 Do not rerun A or B when:

Do not rerun when:
- judge already decided REJECT
- no concrete new research tasks were produced
- prior iteration yielded no meaningful evidence gain
- issue is not fixable by more research
- score stagnation threshold already reached

Examples:
- fatal flaw: market too small
- fatal flaw: buyer unwilling to pay
- fatal flaw: zero plausible moat in crowded market with low switching cost
- fatal flaw: founder fit fundamentally absent for regulated distribution-heavy market

In these cases:
- reject instead of looping

---

## 8. Score-Based Rules

## 8.1 VC Average Score

Calculate average from Agent C score dimensions.

Recommended interpretation:
- 8.0 to 10.0 = strong
- 7.0 to 7.9 = promising
- 6.0 to 6.9 = uncertain
- below 6.0 = weak

This score alone cannot determine PASS, but it heavily influences routing.

---

## 8.2 Judge Evidence Scores

Judge should output:
- completeness
- freshness
- confidence

Recommended interpretation:
- 8.0+ = strong
- 6.5 to 7.9 = acceptable
- below 6.5 = insufficient

---

## 8.3 Suggested Thresholds

Environment-configurable defaults:

- VC_PASS_THRESHOLD = 7.5
- EVIDENCE_PASS_THRESHOLD = 7.0
- MAX_ITERATIONS = 3
- MIN_SCORE_IMPROVEMENT = 0.4
- MAX_STAGNANT_ITERATIONS = 2

---

## 9. Score Stagnation Rules

The orchestrator must compare current iteration vs prior iteration.

A topic is considered stagnant if:
- vcAverage improvement < MIN_SCORE_IMPROVEMENT
AND
- no major objection was resolved
AND
- judge says evidence gain is low

If stagnation happens for 2 consecutive iterations:
- reject topic

Reason:
The system should not waste time polishing weak opportunities.

---

## 10. Fatal Flaw Rules

A fatal flaw means a problem that likely invalidates the business case.

Examples:
- no credible payer
- market too small to sustain venture-scale outcome
- incumbents too strong and differentiation too weak
- distribution impossible for current founder type
- regulatory barriers too high for proposed entry
- product is only a narrow feature with low standalone value
- user pain exists but does not translate into buying behavior

If C marks one or more fatal flaws and J agrees they remain unresolved:
- default to REJECT
- do not REVISE unless there is a concrete path to disprove the flaw

---

## 11. Termination Warning Rules

Judge may set termination_warning = true when:
- another weak cycle should end the topic
- evidence gain potential is low
- the business case is close to rejection
- iteration budget is almost exhausted

If termination_warning = true and next iteration still fails to:
- improve score materially
OR
- resolve accepted objections
then orchestrator should REJECT automatically unless manual override exists.

---

## 12. Iteration Budget Rules

Default max iterations:
- standard topic: 3
- complex topic: 5 only if explicitly configured

Rules:
- iteration 1 = baseline
- iteration 2 = strongest revise/pivot attempt
- iteration 3 = final decision round

By iteration 3, the orchestrator should strongly prefer PASS or REJECT.
Do not let borderline topics drift.

---

## 13. Judge Task Classification Rules

Each judge task must be classified to one of:

- FACT_RESEARCH
- STRATEGY_REFRAME
- EVIDENCE_REFRESH
- COMPETITOR_EXPANSION
- MONETIZATION_REWORK
- ICP_REFOCUS
- MVP_RESCOPING
- GTM_REWORK
- TERMINAL_RISK_CONFIRMATION

Judge task object contract:
- `task_type`: one of the enum values above
- `target_agent`: `FACT_RESEARCHER` or `OPPORTUNITY_STRATEGIST`
- `description`: concrete rerun instruction
- `blocking`: boolean indicating whether the next iteration must address it before PASS is possible

Routing example:

FACT_RESEARCH -> Agent A
EVIDENCE_REFRESH -> Agent A
COMPETITOR_EXPANSION -> Agent A
STRATEGY_REFRAME -> Agent B
MONETIZATION_REWORK -> Agent B
ICP_REFOCUS -> Agent B
MVP_RESCOPING -> Agent B
GTM_REWORK -> Agent B
TERMINAL_RISK_CONFIRMATION -> Agent A + B or direct reject depending on context

---

## 14. Partial Rerun Policy

The orchestrator should support partial reruns.

### Allowed partial reruns
- A only
- B only
- A then B
- C only only if upstream inputs changed formatting but not substance
- J only is NOT allowed unless there was a system error

### Not allowed
- skipping C after any meaningful A/B change
- skipping J after C
- running D/E before PASS

---

## 15. Downstream Generation Rules

## 15.1 Run Agent D only when:
- case status = APPROVED_FOR_PRD
- latest judge decision = PASS

## 15.2 Run Agent E only when:
- PRD exists
- D output validated successfully

## 15.3 Do not run D/E when:
- case is REVISE_REQUIRED
- case is PIVOT_REQUIRED
- case is REJECTED
- case is FAILED

---

## 16. Portfolio Escalation Rules

When a case is REJECTED:
- mark rejection category
- store why it failed
- optionally notify portfolio manager

Recommended rejection categories:
- weak market
- weak willingness to pay
- weak moat
- weak GTM
- founder mismatch
- excessive regulatory burden
- feature-not-company
- insufficient evidence after iteration budget

Portfolio manager can use this to rank future topics better.

---

## 17. Manual Review Escape Hatch

Manual review may be required when:
- repeated agent normalization failures
- contradictory outputs across agents
- judge outputs invalid decision schema
- case is strategically important despite weak score
- human wants override

Manual override options:
- FORCE_REVISE
- FORCE_PIVOT
- FORCE_PASS_TO_PRD
- FORCE_REJECT

All overrides must be audit logged.
These overrides are operator-only escape hatches and are not part of the normal PASS flow.
When `FORCE_PASS_TO_PRD` is used, the latest completed iteration becomes the approved source iteration for `approved_business_summary`, the final business plan, PRD generation, and POC generation.

---

## 18. Logging Requirements

For every routing decision, log:
- caseId
- iterationNo
- prior status
- next status
- judge decision
- rerun plan
- thresholds used
- score comparisons
- termination rule triggered
- manual override if any

---

## 19. Example Routing Scenarios

### Scenario A: Missing competitor pricing
- C says comparison incomplete
- J accepts objection
- J tasks A to gather pricing evidence
- A reruns
- B reruns if monetization affected
- C reruns
- J reruns

### Scenario B: Market is valid but wedge is weak
- C says feature-not-company risk
- J says market still attractive
- J decision = PIVOT
- rerun B only
- rerun C
- rerun J

### Scenario C: No real payer
- C says willingness to pay weak
- J agrees no credible buyer evidence
- prior iteration already tried to fix this
- J decision = REJECT

### Scenario D: Good score and risks manageable
- C average = 8.1
- J evidence confidence = 7.8
- no unresolved fatal flaws
- J decision = PASS
- run D then E

---

## 20. Final Orchestration Rule

The orchestrator exists to protect decision quality.

When in doubt:
- prefer explicit rejection over endless iteration
- prefer targeted rerun over full rerun
- prefer evidence over eloquence
- prefer disciplined scope over optimistic storytelling
