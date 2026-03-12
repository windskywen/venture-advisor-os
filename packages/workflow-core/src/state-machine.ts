import {
  CASE_STATUSES,
  type CaseStatus,
} from '@venture-advisor-os/shared-types';

const baseTransitionMap = {
  NEW: ['TOPIC_ACCEPTED'],
  TOPIC_ACCEPTED: ['RESEARCHING'],
  RESEARCHING: ['SYNTHESIZING'],
  SYNTHESIZING: ['VC_REVIEW'],
  VC_REVIEW: ['JUDGE_REVIEW'],
  JUDGE_REVIEW: [
    'REVISE_REQUIRED',
    'PIVOT_REQUIRED',
    'APPROVED_FOR_PRD',
    'REJECTED',
  ],
  REVISE_REQUIRED: ['RESEARCHING'],
  PIVOT_REQUIRED: ['SYNTHESIZING'],
  APPROVED_FOR_PRD: ['PRD_IN_PROGRESS'],
  PRD_IN_PROGRESS: ['POC_IN_PROGRESS'],
  POC_IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  FAILED: [],
} as const satisfies Record<CaseStatus, readonly CaseStatus[]>;

export const WORKFLOW_STATE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> =
  Object.fromEntries(
    CASE_STATUSES.map((status) => {
      const transitions = new Set<CaseStatus>(baseTransitionMap[status]);
      if (status !== 'FAILED') {
        transitions.add('FAILED');
      }

      return [status, [...transitions]];
    }),
  ) as Record<CaseStatus, CaseStatus[]>;

export function getAllowedNextStates(currentStatus: CaseStatus): CaseStatus[] {
  return [...WORKFLOW_STATE_TRANSITIONS[currentStatus]];
}

export function canTransitionCaseState(
  currentStatus: CaseStatus,
  nextStatus: CaseStatus,
): boolean {
  return WORKFLOW_STATE_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function assertAllowedCaseTransition(
  currentStatus: CaseStatus,
  nextStatus: CaseStatus,
): void {
  if (canTransitionCaseState(currentStatus, nextStatus)) {
    return;
  }

  throw new Error(
    `Invalid case status transition: ${currentStatus} -> ${nextStatus}`,
  );
}
