import type { CaseStatus, JudgeDecision } from '@venture-advisor-os/shared-types';

export interface PrdGenerationGateInput {
  currentStatus: CaseStatus;
  latestJudgeDecision: JudgeDecision;
  hasExistingPrd: boolean;
}

export interface PocGenerationGateInput {
  currentStatus: CaseStatus;
  latestJudgeDecision: JudgeDecision;
  hasPrd: boolean;
  hasExistingPoc: boolean;
}

export function canGeneratePrd(
  input: PrdGenerationGateInput,
): boolean {
  if (input.latestJudgeDecision !== 'PASS') {
    return false;
  }

  if (input.currentStatus === 'APPROVED_FOR_PRD') {
    return true;
  }

  return input.currentStatus === 'COMPLETED' && !input.hasExistingPrd;
}

export function assertPrdGenerationAllowed(
  input: PrdGenerationGateInput,
): void {
  if (canGeneratePrd(input)) {
    return;
  }

  throw new Error(
    `PRD generation requires latestJudgeDecision=PASS and currentStatus to allow downstream generation. Received decision=${input.latestJudgeDecision}, status=${input.currentStatus}, hasExistingPrd=${input.hasExistingPrd}.`,
  );
}

export function canGeneratePoc(
  input: PocGenerationGateInput,
): boolean {
  if (input.latestJudgeDecision !== 'PASS' || !input.hasPrd) {
    return false;
  }

  if (input.currentStatus === 'PRD_IN_PROGRESS') {
    return true;
  }

  if (input.currentStatus === 'POC_IN_PROGRESS') {
    return true;
  }

  return input.currentStatus === 'COMPLETED' && !input.hasExistingPoc;
}

export function assertPocGenerationAllowed(
  input: PocGenerationGateInput,
): void {
  if (canGeneratePoc(input)) {
    return;
  }

  throw new Error(
    `POC generation requires latestJudgeDecision=PASS, an existing PRD, and a currentStatus that allows downstream generation. Received decision=${input.latestJudgeDecision}, status=${input.currentStatus}, hasPrd=${input.hasPrd}, hasExistingPoc=${input.hasExistingPoc}.`,
  );
}
