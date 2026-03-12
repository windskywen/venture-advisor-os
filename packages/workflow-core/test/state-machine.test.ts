import { describe, expect, it } from 'vitest';

import {
  assertAllowedCaseTransition,
  canTransitionCaseState,
  getAllowedNextStates,
} from '../src/index.js';

describe('workflow state machine', () => {
  it('allows only the documented primary path transitions', () => {
    expect(canTransitionCaseState('NEW', 'TOPIC_ACCEPTED')).toBe(true);
    expect(canTransitionCaseState('TOPIC_ACCEPTED', 'RESEARCHING')).toBe(true);
    expect(canTransitionCaseState('JUDGE_REVIEW', 'APPROVED_FOR_PRD')).toBe(
      true,
    );
    expect(canTransitionCaseState('PRD_IN_PROGRESS', 'POC_IN_PROGRESS')).toBe(
      true,
    );
  });

  it('allows a transition to FAILED from non-failed states', () => {
    expect(getAllowedNextStates('RESEARCHING')).toContain('FAILED');
    expect(getAllowedNextStates('COMPLETED')).toContain('FAILED');
    expect(canTransitionCaseState('FAILED', 'FAILED')).toBe(false);
  });

  it('rejects invalid transitions with a clear error', () => {
    expect(() =>
      assertAllowedCaseTransition('TOPIC_ACCEPTED', 'VC_REVIEW'),
    ).toThrow('TOPIC_ACCEPTED -> VC_REVIEW');
    expect(canTransitionCaseState('REJECTED', 'APPROVED_FOR_PRD')).toBe(false);
  });
});
