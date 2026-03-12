import { describe, expect, it } from 'vitest';

import { planPartialRerun } from '../src/index.js';

describe('partial rerun exceptions', () => {
  it('allows C-only reruns for formatting-only upstream changes', () => {
    expect(
      planPartialRerun({
        targetAgent: 'VCCritic',
        reason: 'FORMATTING_ONLY_UPSTREAM_CHANGE',
      }),
    ).toEqual({
      strategy: 'C_ONLY',
      targetAgent: 'VCCritic',
      reason: 'FORMATTING_ONLY_UPSTREAM_CHANGE',
    });
  });

  it('allows J-only reruns only for system error recovery', () => {
    expect(
      planPartialRerun({
        targetAgent: 'Judge',
        reason: 'SYSTEM_ERROR_RECOVERY',
      }),
    ).toEqual({
      strategy: 'J_ONLY',
      targetAgent: 'Judge',
      reason: 'SYSTEM_ERROR_RECOVERY',
    });
  });

  it('prohibits unsupported partial rerun combinations', () => {
    expect(
      planPartialRerun({
        targetAgent: 'Judge',
        reason: 'FORMATTING_ONLY_UPSTREAM_CHANGE',
      }),
    ).toMatchObject({
      strategy: 'PROHIBITED',
      prohibitedReason:
        'Judge-only reruns are only allowed for system error recovery.',
    });
  });
});
