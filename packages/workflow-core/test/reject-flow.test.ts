import { describe, expect, it } from 'vitest';

import { buildRejectFlowResult } from '../src/index.js';

describe('reject flow', () => {
  it('builds a terminal rejection result with persisted rationale and category', () => {
    const result = buildRejectFlowResult({
      caseId: 'case-1',
      iterationId: 'iter-2',
      iterationNo: 2,
      currentStatus: 'JUDGE_REVIEW',
      rationale: 'Evidence remained too weak after the last iteration.',
      category: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
      decidedAt: '2026-03-12T00:00:00.000Z',
      portfolioEscalationMetadata: {
        notifyPortfolioManager: true,
        queueHint: 'next-topic',
      },
    });

    expect(result).toEqual({
      caseId: 'case-1',
      iterationId: 'iter-2',
      iterationNo: 2,
      nextStatus: 'REJECTED',
      finalDecision: 'REJECT',
      rejectionRationale: 'Evidence remained too weak after the last iteration.',
      rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
      portfolioEscalationMetadata: {
        notifyPortfolioManager: true,
        queueHint: 'next-topic',
      },
      notifyPortfolioManager: true,
      stopDownstreamWork: true,
      decidedAt: '2026-03-12T00:00:00.000Z',
    });
  });

  it('rejects invalid transitions into the terminal rejection state', () => {
    expect(() =>
      buildRejectFlowResult({
        caseId: 'case-1',
        iterationId: 'iter-2',
        iterationNo: 2,
        currentStatus: 'COMPLETED',
        rationale: 'This should not be allowed.',
        category: 'WEAK_MARKET',
        decidedAt: '2026-03-12T00:00:00.000Z',
      }),
    ).toThrow('Invalid case status transition');
  });
});
