import type {
  CaseStatus,
  PortfolioEscalationMetadata,
  RejectionCategory,
} from '@venture-advisor-os/shared-types';

import { assertAllowedCaseTransition } from './state-machine.js';

export interface RejectFlowInput {
  caseId: string;
  iterationId: string;
  iterationNo: number;
  currentStatus: CaseStatus;
  rationale: string;
  category: RejectionCategory;
  decidedAt: string;
  portfolioEscalationMetadata?: PortfolioEscalationMetadata;
}

export interface RejectFlowResult {
  caseId: string;
  iterationId: string;
  iterationNo: number;
  nextStatus: 'REJECTED';
  finalDecision: 'REJECT';
  rejectionRationale: string;
  rejectionCategory: RejectionCategory;
  portfolioEscalationMetadata: PortfolioEscalationMetadata;
  notifyPortfolioManager: boolean;
  stopDownstreamWork: true;
  decidedAt: string;
}

export function buildRejectFlowResult(
  input: RejectFlowInput,
): RejectFlowResult {
  assertAllowedCaseTransition(input.currentStatus, 'REJECTED');

  const portfolioEscalationMetadata = input.portfolioEscalationMetadata ?? {};

  return {
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    nextStatus: 'REJECTED',
    finalDecision: 'REJECT',
    rejectionRationale: input.rationale,
    rejectionCategory: input.category,
    portfolioEscalationMetadata,
    notifyPortfolioManager:
      portfolioEscalationMetadata.notifyPortfolioManager === true,
    stopDownstreamWork: true,
    decidedAt: input.decidedAt,
  };
}
