import { describe, expect, it } from 'vitest';

import {
  ApprovalSchema,
  getHumanOverrideRiskLevel,
  isHighRiskHumanOverrideAction,
} from '../src/index.js';

describe('override approval policy', () => {
  it('classifies pass-to-prd and reject overrides as high risk', () => {
    expect(isHighRiskHumanOverrideAction('FORCE_PASS_TO_PRD')).toBe(true);
    expect(isHighRiskHumanOverrideAction('FORCE_REJECT')).toBe(true);
    expect(isHighRiskHumanOverrideAction('FORCE_REVISE')).toBe(false);
    expect(getHumanOverrideRiskLevel('FORCE_PIVOT')).toBe('standard');
  });

  it('requires high-risk approval records to be explicitly marked in metadata', () => {
    expect(() =>
      ApprovalSchema.parse({
        approvalId: 'approval-1',
        caseId: 'case-1',
        iterationId: 'iter-1',
        requestedAction: 'FORCE_PASS_TO_PRD',
        status: 'RESOLVED',
        requestedAt: '2026-03-12T00:00:00.000Z',
        resolvedAt: '2026-03-12T00:01:00.000Z',
        resolvedBy: 'operator',
        metadata: {},
      }),
    ).toThrow('High-risk human override approvals must be marked as high risk.');
  });

  it('requires resolved approval records to identify who resolved them', () => {
    expect(() =>
      ApprovalSchema.parse({
        approvalId: 'approval-2',
        caseId: 'case-1',
        iterationId: 'iter-1',
        requestedAction: 'FORCE_REVISE',
        status: 'RESOLVED',
        requestedAt: '2026-03-12T00:00:00.000Z',
        metadata: {},
      }),
    ).toThrow(
      'Resolved approval records must include both resolvedAt and resolvedBy.',
    );
  });
});
