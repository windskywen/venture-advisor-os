import { describe, expect, it } from 'vitest';

import { loadWorkflowConfig } from '@venture-advisor-os/shared-types';

import {
  canGenerateDownstreamArtifacts,
  getRoutingPolicySnapshot,
  hasReachedIterationBudget,
  isIterationStagnant,
  meetsPassRoutingThresholds,
  resolveMaxIterations,
  shouldPreferTerminalDecision,
  shouldRejectAfterTerminationWarning,
  shouldRejectForFatalFlaws,
  shouldRejectForStagnation,
} from '../src/routing-policy.js';

describe('routing policy', () => {
  it('loads routing policy overrides from environment config', () => {
    const config = loadWorkflowConfig({
      JUDGE_VC_PASS_THRESHOLD: '8.2',
      PREFER_TERMINAL_DECISION_BY_ITERATION: '4',
      REJECT_ON_CONSECUTIVE_STAGNATION: 'false',
      REQUIRE_PASS_FOR_DOWNSTREAM_GENERATION: 'false',
    });

    const snapshot = getRoutingPolicySnapshot(config);

    expect(snapshot.routingPolicy.preferTerminalDecisionByIteration).toBe(4);
    expect(snapshot.judgeThresholds.vcPass).toBe(8.2);
    expect(snapshot.routingPolicy.rejectOnConsecutiveStagnation).toBe(false);
    expect(snapshot.routingPolicy.requirePassForDownstreamGeneration).toBe(
      false,
    );
  });

  it('applies pass routing thresholds from config', () => {
    const config = loadWorkflowConfig();

    expect(
      meetsPassRoutingThresholds(config, {
        vcAverage: 7.5,
        evidenceCompleteness: 7,
        judgeDecision: 'PASS',
        unresolvedFatalFlawCount: 0,
      }),
    ).toBe(true);

    expect(
      meetsPassRoutingThresholds(config, {
        vcAverage: 7.5,
        evidenceCompleteness: 7,
        judgeDecision: 'REVISE',
        unresolvedFatalFlawCount: 0,
      }),
    ).toBe(false);
  });

  it('detects stagnation and enforces the configured rejection threshold', () => {
    const config = loadWorkflowConfig({
      MIN_SCORE_IMPROVEMENT: '0.5',
      MAX_STAGNANT_ITERATIONS: '2',
    });

    expect(
      isIterationStagnant(config, {
        scoreImprovement: 0.2,
        majorObjectionResolved: false,
        evidenceGainLow: true,
      }),
    ).toBe(true);

    expect(
      shouldRejectForStagnation(config, {
        scoreImprovement: 0.2,
        majorObjectionResolved: false,
        evidenceGainLow: true,
        consecutiveStagnantIterations: 2,
      }),
    ).toBe(true);
  });

  it('respects fatal flaw and termination warning policies', () => {
    const config = loadWorkflowConfig();

    expect(
      shouldRejectForFatalFlaws(config, {
        unresolvedFatalFlawCount: 1,
        hasConcreteDisproofPath: false,
      }),
    ).toBe(true);

    expect(
      shouldRejectForFatalFlaws(config, {
        unresolvedFatalFlawCount: 1,
        hasConcreteDisproofPath: true,
      }),
    ).toBe(false);

    expect(
      shouldRejectAfterTerminationWarning(config, {
        terminationWarning: true,
        scoreImprovement: 0.1,
        acceptedObjectionsResolved: false,
      }),
    ).toBe(true);
  });

  it('uses configured iteration and downstream gating policy', () => {
    const config = loadWorkflowConfig({
      DEFAULT_MAX_ITERATIONS: '3',
      COMPLEX_TOPIC_MAX_ITERATIONS: '6',
    });

    expect(resolveMaxIterations(config, 'complex')).toBe(6);
    expect(hasReachedIterationBudget(config, 3, 'standard')).toBe(true);
    expect(hasReachedIterationBudget(config, 5, 'complex')).toBe(false);
    expect(shouldPreferTerminalDecision(config, 3)).toBe(true);
    expect(canGenerateDownstreamArtifacts(config, 'PASS')).toBe(true);
    expect(canGenerateDownstreamArtifacts(config, 'PIVOT')).toBe(false);
  });
});
