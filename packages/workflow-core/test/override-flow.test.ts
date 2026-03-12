import { describe, expect, it } from 'vitest';

import { buildManualOverrideResolution } from '../src/index.js';

describe('manual override flow', () => {
  it('promotes the latest completed iteration when forcing PASS to PRD', () => {
    const resolution = buildManualOverrideResolution({
      caseId: 'case-1',
      currentStatus: 'FAILED',
      action: 'FORCE_PASS_TO_PRD',
      latestCompletedIteration: {
        iterationId: 'iter-3',
        iterationNo: 3,
      },
    });

    expect(resolution).toMatchObject({
      caseId: 'case-1',
      action: 'FORCE_PASS_TO_PRD',
      nextStatus: 'APPROVED_FOR_PRD',
      finalDecision: 'PASS',
      approvedSourceIterationId: 'iter-3',
      approvedSourceIterationNo: 3,
      manualReviewRequired: false,
      followUp: {
        kind: 'pass',
      },
      auditMetadata: {
        riskLevel: 'high',
      },
    });
  });

  it('requires judge tasks when forcing REVISE or PIVOT', () => {
    expect(() =>
      buildManualOverrideResolution({
        caseId: 'case-1',
        currentStatus: 'JUDGE_REVIEW',
        action: 'FORCE_REVISE',
        latestCompletedIteration: {
          iterationId: 'iter-2',
          iterationNo: 2,
        },
      }),
    ).toThrow('FORCE_REVISE requires at least one Judge task.');
  });

  it('requires explicit rationale and category when forcing rejection', () => {
    const resolution = buildManualOverrideResolution({
      caseId: 'case-1',
      currentStatus: 'FAILED',
      action: 'FORCE_REJECT',
      rejectionRationale: 'Contradictory outputs required manual closure.',
      rejectionCategory: 'FEATURE_NOT_COMPANY',
      portfolioEscalationMetadata: {
        notifyPortfolioManager: true,
      },
    });

    expect(resolution).toMatchObject({
      nextStatus: 'REJECTED',
      finalDecision: 'REJECT',
      followUp: {
        kind: 'reject',
        rejectionCategory: 'FEATURE_NOT_COMPANY',
      },
      auditMetadata: {
        riskLevel: 'high',
      },
    });
  });

  it('rejects overrides from active non-review states', () => {
    expect(() =>
      buildManualOverrideResolution({
        caseId: 'case-1',
        currentStatus: 'RESEARCHING',
        action: 'FORCE_PASS_TO_PRD',
        latestCompletedIteration: {
          iterationId: 'iter-2',
          iterationNo: 2,
        },
      }),
    ).toThrow('Manual overrides are only allowed');
  });
});
