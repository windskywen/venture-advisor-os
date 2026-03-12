import { describe, expect, it } from 'vitest';

import {
  assertPocGenerationAllowed,
  assertPrdGenerationAllowed,
  canGeneratePoc,
  canGeneratePrd,
} from '../src/index.js';

describe('downstream generation gating', () => {
  it('allows PRD generation only for PASS cases in allowed states', () => {
    expect(
      canGeneratePrd({
        currentStatus: 'APPROVED_FOR_PRD',
        latestJudgeDecision: 'PASS',
        hasExistingPrd: false,
      }),
    ).toBe(true);

    expect(
      canGeneratePrd({
        currentStatus: 'APPROVED_FOR_PRD',
        latestJudgeDecision: 'REVISE',
        hasExistingPrd: false,
      }),
    ).toBe(false);
  });

  it('allows POC generation only after PASS and an existing PRD', () => {
    expect(
      canGeneratePoc({
        currentStatus: 'PRD_IN_PROGRESS',
        latestJudgeDecision: 'PASS',
        hasPrd: true,
        hasExistingPoc: false,
      }),
    ).toBe(true);

    expect(
      canGeneratePoc({
        currentStatus: 'APPROVED_FOR_PRD',
        latestJudgeDecision: 'PASS',
        hasPrd: false,
        hasExistingPoc: false,
      }),
    ).toBe(false);
  });

  it('throws when PRD/POC generation is requested from invalid states', () => {
    expect(() =>
      assertPrdGenerationAllowed({
        currentStatus: 'REJECTED',
        latestJudgeDecision: 'PASS',
        hasExistingPrd: false,
      }),
    ).toThrow('PRD generation requires latestJudgeDecision=PASS');

    expect(() =>
      assertPocGenerationAllowed({
        currentStatus: 'COMPLETED',
        latestJudgeDecision: 'PASS',
        hasPrd: false,
        hasExistingPoc: false,
      }),
    ).toThrow('POC generation requires latestJudgeDecision=PASS');
  });
});
