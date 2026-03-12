import { describe, expect, it } from 'vitest';

import { assertPassFlowAllowed, buildPassFlowPlan } from '../src/index.js';

describe('PASS flow planning', () => {
  it('builds report-render -> PRD -> POC jobs for PASS cases', () => {
    const plan = buildPassFlowPlan({
      caseId: 'case-1',
      approvedIterationNo: 2,
      latestJudgeDecision: 'PASS',
      currentStatus: 'APPROVED_FOR_PRD',
    });

    expect(plan.reportRenderJob.caseId).toBe('case-1');
    expect(plan.prdGenerationJob.approvedIterationNo).toBe(2);
    expect(plan.pocGenerationJob.approvedIterationNo).toBe(2);
  });

  it('rejects non-PASS decisions', () => {
    expect(() =>
      assertPassFlowAllowed({
        caseId: 'case-1',
        approvedIterationNo: 2,
        latestJudgeDecision: 'REVISE',
        currentStatus: 'APPROVED_FOR_PRD',
      }),
    ).toThrow('latestJudgeDecision=PASS');
  });

  it('rejects invalid current states', () => {
    expect(() =>
      assertPassFlowAllowed({
        caseId: 'case-1',
        approvedIterationNo: 2,
        latestJudgeDecision: 'PASS',
        currentStatus: 'RESEARCHING',
      }),
    ).toThrow('currentStatus');
  });
});
