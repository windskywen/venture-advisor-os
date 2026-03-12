import { FlowProducer, type FlowJob } from 'bullmq';
import type { JudgeTaskPayload } from '@venture-advisor-os/shared-types';

import {
  WORKFLOW_QUEUE_NAMES,
  type AgentRunJobData,
  type CaseReviewJobData,
  type ReusableResearchArtifactRef,
} from './queues.js';
import { planJudgeTaskRerun } from './rerun-planning.js';

export interface PivotIterationFlowInput {
  caseId: string;
  iterationId: string;
  iterationNo: number;
  judgeTasks: JudgeTaskPayload[];
  invalidateResearch: boolean;
  reusableResearchArtifactRefs?: ReusableResearchArtifactRef[];
}

export interface PivotIterationPlan {
  rerunJobSequence: AgentRunJobData[];
  caseReviewJob: CaseReviewJobData;
}

export function buildPivotIterationPlan(
  input: PivotIterationFlowInput,
): PivotIterationPlan {
  const rerunPlan = planJudgeTaskRerun(input.judgeTasks);
  if (rerunPlan.strategy === 'PROHIBITED') {
    throw new Error(
      `PIVOT flow cannot be planned: ${rerunPlan.prohibitedReasons.join(' ')}`,
    );
  }

  const rerunJobSequence: AgentRunJobData[] = [];
  const shouldRerunResearch =
    input.invalidateResearch || rerunPlan.factResearcherTasks.length > 0;

  if (shouldRerunResearch) {
    rerunJobSequence.push({
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      agentName: 'FactResearcher',
      judgeTasks: rerunPlan.factResearcherTasks,
    });
  }

  rerunJobSequence.push({
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    agentName: 'OpportunityStrategist',
    judgeTasks: rerunPlan.opportunityStrategistTasks,
    researchArtifactRefs: shouldRerunResearch
      ? undefined
      : (input.reusableResearchArtifactRefs ?? []),
  });

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

export async function enqueuePivotIterationFlow(
  flowProducer: FlowProducer,
  input: PivotIterationFlowInput,
) {
  return flowProducer.add(buildPivotIterationFlowDefinition(input));
}

export function buildPivotIterationFlowDefinition(
  input: PivotIterationFlowInput,
): FlowJob {
  const plan = buildPivotIterationPlan(input);

  return {
    name: 'caseReview',
    queueName: WORKFLOW_QUEUE_NAMES.caseReview,
    data: plan.caseReviewJob,
    children: [buildAgentRunChain(plan.rerunJobSequence)],
  };
}

function buildAgentRunChain(jobSequence: AgentRunJobData[]): FlowJob {
  if (jobSequence.length === 0) {
    throw new Error('PIVOT flow requires at least one agent rerun job.');
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
