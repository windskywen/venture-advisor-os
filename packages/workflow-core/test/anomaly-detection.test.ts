import { describe, expect, it } from 'vitest';

import { loadWorkflowConfig } from '@venture-advisor-os/shared-types';

import { detectWorkflowAnomalies } from '../src/index.js';

describe('workflow anomaly detection', () => {
  it('routes invalid judge output schemas to manual review', () => {
    const assessment = detectWorkflowAnomalies({
      judgeOutput: {
        decision: 'PASS',
      },
      config: loadWorkflowConfig(),
      topicComplexity: 'standard',
      iterationNumber: 1,
      consecutiveStagnantIterations: 0,
      scoreImprovement: 1,
      majorObjectionResolved: true,
      evidenceGainLow: false,
      acceptedObjectionsResolved: true,
    });

    expect(assessment).toMatchObject({
      recommendedAction: 'MANUAL_REVIEW',
      findings: [
        {
          type: 'INVALID_JUDGE_DECISION_SCHEMA',
          failureCategory: 'SCHEMA_VALIDATION_FAILURE',
        },
      ],
    });
  });

  it('routes contradictory pass decisions to manual review', () => {
    const assessment = detectWorkflowAnomalies({
      judgeOutput: {
        decision: 'PASS',
        rationale: 'Looks good.',
        accepted_objections: [],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 8,
          freshness: 8,
          confidence: 8,
        },
        iteration_worthiness: {
          should_continue: false,
          reason: 'No more work needed.',
        },
        next_iteration_tasks: [],
        termination_warning: false,
      },
      vcCriticOutput: {
        summary: 'Too risky.',
        objections: ['Weak moat'],
        fatal_flaws: ['Weak moat'],
        manageable_risks: [],
        score_breakdown: [],
        key_questions: [],
        recommendation: 'Reject',
      },
      config: loadWorkflowConfig(),
      topicComplexity: 'standard',
      iterationNumber: 2,
      consecutiveStagnantIterations: 0,
      scoreImprovement: 1,
      majorObjectionResolved: true,
      evidenceGainLow: false,
      acceptedObjectionsResolved: true,
    });

    expect(assessment).toMatchObject({
      recommendedAction: 'MANUAL_REVIEW',
      findings: [
        {
          type: 'CONTRADICTORY_AGENT_OUTPUTS',
          failureCategory: 'JUDGE_DEAD_END',
        },
      ],
    });
  });

  it('routes low-value dead-end loops to terminal rejection', () => {
    const assessment = detectWorkflowAnomalies({
      judgeOutput: {
        decision: 'REVISE',
        rationale: 'There might be something here, but evidence is weak.',
        accepted_objections: ['Weak demand'],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 5,
          freshness: 6,
          confidence: 5,
        },
        iteration_worthiness: {
          should_continue: true,
          reason: 'Only if new evidence appears.',
        },
        next_iteration_tasks: [],
        termination_warning: true,
      },
      config: loadWorkflowConfig({
        MAX_STAGNANT_ITERATIONS: '2',
        MIN_SCORE_IMPROVEMENT: '0.5',
      }),
      topicComplexity: 'standard',
      iterationNumber: 3,
      consecutiveStagnantIterations: 2,
      scoreImprovement: 0.1,
      majorObjectionResolved: false,
      evidenceGainLow: true,
      acceptedObjectionsResolved: false,
    });

    expect(assessment).toMatchObject({
      recommendedAction: 'REJECT',
      findings: [
        {
          type: 'LOW_VALUE_DEAD_END_LOOP',
          rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
        },
      ],
    });
  });
});
