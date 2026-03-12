import { FlowProducer, type FlowJob } from 'bullmq';
import type { JudgeTaskPayload } from '@venture-advisor-os/shared-types';

import { planJudgeTaskRerun } from './rerun-planning.js';
import {
  WORKFLOW_QUEUE_NAMES,
  type AgentRunJobData,
  type CaseReviewJobData,
} from './queues.js';

export interface ReviseIterationFlowInput {
  caseId: string;
  iterationId: string;
  iterationNo: number;
  judgeTasks: JudgeTaskPayload[];
}

export interface ReviseIterationPlan {
  rerunJobSequence: AgentRunJobData[];
  caseReviewJob: CaseReviewJobData;
}

export function buildReviseIterationPlan(
  input: ReviseIterationFlowInput,
): ReviseIterationPlan {
  const rerunPlan = planJudgeTaskRerun(input.judgeTasks);
  if (rerunPlan.strategy === 'PROHIBITED') {
    throw new Error(
      `REVISE flow cannot be planned: ${rerunPlan.prohibitedReasons.join(' ')}`,
    );
  }

  const rerunJobSequence: AgentRunJobData[] = [];

  if (rerunPlan.factResearcherTasks.length > 0) {
    rerunJobSequence.push({
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      agentName: 'FactResearcher',
      judgeTasks: rerunPlan.factResearcherTasks,
    });
  }

  if (rerunPlan.opportunityStrategistTasks.length > 0) {
    rerunJobSequence.push({
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      agentName: 'OpportunityStrategist',
      judgeTasks: rerunPlan.opportunityStrategistTasks,
    });
  }

  rerunJobSequence.push({
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    agentName: 'VCCritic',
  });

  return {
    rerunJobSequence,
    caseReviewJob: {
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
    },
  };
}

export async function enqueueReviseIterationFlow(
  flowProducer: FlowProducer,
  input: ReviseIterationFlowInput,
) {
  return flowProducer.add(buildReviseIterationFlowDefinition(input));
}

export function buildReviseIterationFlowDefinition(
  input: ReviseIterationFlowInput,
): FlowJob {
  const plan = buildReviseIterationPlan(input);

  return {
    name: 'caseReview',
    queueName: WORKFLOW_QUEUE_NAMES.caseReview,
    data: plan.caseReviewJob,
    children: [buildAgentRunChain(plan.rerunJobSequence)],
  };
}

function buildAgentRunChain(jobSequence: AgentRunJobData[]): FlowJob {
  if (jobSequence.length === 0) {
    throw new Error('REVISE flow requires at least one agent rerun job.');
  }

  let currentNode: FlowJob | undefined;

  for (const job of jobSequence) {
    currentNode = {
      name: 'agentRun',
      queueName: WORKFLOW_QUEUE_NAMES.agentRun,
      data: job,
      children: currentNode ? [currentNode] : undefined,
    };
  }

  return currentNode as FlowJob;
}
