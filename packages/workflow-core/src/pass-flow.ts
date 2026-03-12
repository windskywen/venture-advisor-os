import { FlowProducer, type FlowJob } from 'bullmq';
import type {
  CaseStatus,
  JudgeDecision,
} from '@venture-advisor-os/shared-types';

import {
  WORKFLOW_QUEUE_NAMES,
  type PocGenerationJobData,
  type PrdGenerationJobData,
  type ReportRenderJobData,
} from './queues.js';

export interface PassFlowInput {
  caseId: string;
  approvedIterationNo: number;
  latestJudgeDecision: JudgeDecision;
  currentStatus: CaseStatus;
}

export interface PassFlowPlan {
  reportRenderJob: ReportRenderJobData;
  prdGenerationJob: PrdGenerationJobData;
  pocGenerationJob: PocGenerationJobData;
}

export function buildPassFlowPlan(input: PassFlowInput): PassFlowPlan {
  assertPassFlowAllowed(input);

  return {
    reportRenderJob: {
      caseId: input.caseId,
      approvedIterationNo: input.approvedIterationNo,
    },
    prdGenerationJob: {
      caseId: input.caseId,
      approvedIterationNo: input.approvedIterationNo,
    },
    pocGenerationJob: {
      caseId: input.caseId,
      approvedIterationNo: input.approvedIterationNo,
    },
  };
}

export async function enqueuePassFlow(
  flowProducer: FlowProducer,
  input: PassFlowInput,
) {
  return flowProducer.add(buildPassFlowDefinition(input));
}

export function buildPassFlowDefinition(input: PassFlowInput): FlowJob {
  const plan = buildPassFlowPlan(input);

  return {
    name: 'pocGeneration',
    queueName: WORKFLOW_QUEUE_NAMES.pocGeneration,
    data: plan.pocGenerationJob,
    children: [
      {
        name: 'prdGeneration',
        queueName: WORKFLOW_QUEUE_NAMES.prdGeneration,
        data: plan.prdGenerationJob,
        children: [
          {
            name: 'reportRender',
            queueName: WORKFLOW_QUEUE_NAMES.reportRender,
            data: plan.reportRenderJob,
          },
        ],
      },
    ],
  };
}

export function assertPassFlowAllowed(input: PassFlowInput): void {
  if (input.latestJudgeDecision !== 'PASS') {
    throw new Error(
      `PASS flow requires latestJudgeDecision=PASS, received ${input.latestJudgeDecision}.`,
    );
  }

  if (!['JUDGE_REVIEW', 'APPROVED_FOR_PRD'].includes(input.currentStatus)) {
    throw new Error(
      `PASS flow requires currentStatus to be JUDGE_REVIEW or APPROVED_FOR_PRD, received ${input.currentStatus}.`,
    );
  }
}
