import type {
  CaseStatus,
  JudgeDecision,
  JudgeTaskPayload,
  OverrideAction,
  PortfolioEscalationMetadata,
  RejectionCategory,
} from '@venture-advisor-os/shared-types';
import { getHumanOverrideRiskLevel } from '@venture-advisor-os/shared-types';

import { buildPassFlowPlan, type PassFlowPlan } from './pass-flow.js';

const MANUAL_OVERRIDE_ALLOWED_STATUSES = [
  'FAILED',
  'JUDGE_REVIEW',
  'REVISE_REQUIRED',
  'PIVOT_REQUIRED',
] as const;

type ManualOverrideAllowedStatus =
  (typeof MANUAL_OVERRIDE_ALLOWED_STATUSES)[number];

export interface CompletedIterationRef {
  iterationId: string;
  iterationNo: number;
}

export interface ManualOverrideInput {
  caseId: string;
  currentStatus: CaseStatus;
  action: OverrideAction;
  latestCompletedIteration?: CompletedIterationRef;
  judgeTasks?: JudgeTaskPayload[];
  rejectionRationale?: string;
  rejectionCategory?: RejectionCategory;
  portfolioEscalationMetadata?: PortfolioEscalationMetadata;
}

export type ManualOverrideFollowUp =
  | {
      kind: 'revise';
      iteration: CompletedIterationRef;
      judgeTasks: JudgeTaskPayload[];
    }
  | {
      kind: 'pivot';
      iteration: CompletedIterationRef;
      judgeTasks: JudgeTaskPayload[];
    }
  | {
      kind: 'pass';
      iteration: CompletedIterationRef;
      passFlowPlan: PassFlowPlan;
    }
  | {
      kind: 'reject';
      rejectionRationale: string;
      rejectionCategory: RejectionCategory;
      portfolioEscalationMetadata: PortfolioEscalationMetadata;
    };

export interface ManualOverrideResolution {
  caseId: string;
  action: OverrideAction;
  nextStatus:
    | 'REVISE_REQUIRED'
    | 'PIVOT_REQUIRED'
    | 'APPROVED_FOR_PRD'
    | 'REJECTED';
  finalDecision: JudgeDecision;
  manualReviewRequired: false;
  approvedSourceIterationId?: string;
  approvedSourceIterationNo?: number;
  followUp: ManualOverrideFollowUp;
  auditMetadata: Record<string, unknown>;
}

export function buildManualOverrideResolution(
  input: ManualOverrideInput,
): ManualOverrideResolution {
  assertAllowedManualOverrideStatus(input.currentStatus);

  switch (input.action) {
    case 'FORCE_REVISE':
      return {
        caseId: input.caseId,
        action: input.action,
        nextStatus: 'REVISE_REQUIRED',
        finalDecision: 'REVISE',
        manualReviewRequired: false,
        followUp: {
          kind: 'revise',
          iteration: requireLatestCompletedIteration(input),
          judgeTasks: requireJudgeTasks(input),
        },
        auditMetadata: {
          previousStatus: input.currentStatus,
          followUpKind: 'revise',
          riskLevel: getHumanOverrideRiskLevel(input.action),
        },
      };
    case 'FORCE_PIVOT':
      return {
        caseId: input.caseId,
        action: input.action,
        nextStatus: 'PIVOT_REQUIRED',
        finalDecision: 'PIVOT',
        manualReviewRequired: false,
        followUp: {
          kind: 'pivot',
          iteration: requireLatestCompletedIteration(input),
          judgeTasks: requireJudgeTasks(input),
        },
        auditMetadata: {
          previousStatus: input.currentStatus,
          followUpKind: 'pivot',
          riskLevel: getHumanOverrideRiskLevel(input.action),
        },
      };
    case 'FORCE_PASS_TO_PRD': {
      const latestCompletedIteration = requireLatestCompletedIteration(input);
      const passFlowPlan = buildPassFlowPlan({
        caseId: input.caseId,
        approvedIterationNo: latestCompletedIteration.iterationNo,
        latestJudgeDecision: 'PASS',
        currentStatus: 'APPROVED_FOR_PRD',
      });

      return {
        caseId: input.caseId,
        action: input.action,
        nextStatus: 'APPROVED_FOR_PRD',
        finalDecision: 'PASS',
        manualReviewRequired: false,
        approvedSourceIterationId: latestCompletedIteration.iterationId,
        approvedSourceIterationNo: latestCompletedIteration.iterationNo,
        followUp: {
          kind: 'pass',
          iteration: latestCompletedIteration,
          passFlowPlan,
        },
        auditMetadata: {
          previousStatus: input.currentStatus,
          followUpKind: 'pass',
          approvedSourceIterationId: latestCompletedIteration.iterationId,
          approvedSourceIterationNo: latestCompletedIteration.iterationNo,
          riskLevel: getHumanOverrideRiskLevel(input.action),
        },
      };
    }
    case 'FORCE_REJECT': {
      const rejectionRationale = requireRejectionRationale(input);
      const rejectionCategory = requireRejectionCategory(input);
      const portfolioEscalationMetadata = input.portfolioEscalationMetadata ?? {};

      return {
        caseId: input.caseId,
        action: input.action,
        nextStatus: 'REJECTED',
        finalDecision: 'REJECT',
        manualReviewRequired: false,
        followUp: {
          kind: 'reject',
          rejectionRationale,
          rejectionCategory,
          portfolioEscalationMetadata,
        },
        auditMetadata: {
          previousStatus: input.currentStatus,
          followUpKind: 'reject',
          rejectionCategory,
          riskLevel: getHumanOverrideRiskLevel(input.action),
        },
      };
    }
  }
}

function assertAllowedManualOverrideStatus(
  currentStatus: string,
): asserts currentStatus is ManualOverrideAllowedStatus {
  if (
    MANUAL_OVERRIDE_ALLOWED_STATUSES.includes(
      currentStatus as ManualOverrideAllowedStatus,
    )
  ) {
    return;
  }

  throw new Error(
    `Manual overrides are only allowed from FAILED, JUDGE_REVIEW, REVISE_REQUIRED, or PIVOT_REQUIRED. Received ${currentStatus}.`,
  );
}

function requireLatestCompletedIteration(
  input: ManualOverrideInput,
): CompletedIterationRef {
  if (input.latestCompletedIteration !== undefined) {
    return input.latestCompletedIteration;
  }

  throw new Error(
    `${input.action} requires the latest completed iteration to be provided.`,
  );
}

function requireJudgeTasks(input: ManualOverrideInput): JudgeTaskPayload[] {
  if (input.judgeTasks !== undefined && input.judgeTasks.length > 0) {
    return input.judgeTasks;
  }

  throw new Error(`${input.action} requires at least one Judge task.`);
}

function requireRejectionRationale(input: ManualOverrideInput): string {
  if (
    typeof input.rejectionRationale === 'string' &&
    input.rejectionRationale.trim().length > 0
  ) {
    return input.rejectionRationale;
  }

  throw new Error('FORCE_REJECT requires a rejection rationale.');
}

function requireRejectionCategory(
  input: ManualOverrideInput,
): RejectionCategory {
  if (input.rejectionCategory !== undefined) {
    return input.rejectionCategory;
  }

  throw new Error('FORCE_REJECT requires a rejection category.');
}
