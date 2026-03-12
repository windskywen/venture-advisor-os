import { FlowProducer, type ConnectionOptions, type FlowJob } from 'bullmq';

import {
  WORKFLOW_QUEUE_NAMES,
  type AgentRunJobData,
  type CaseReviewJobData,
} from './queues.js';

export interface FirstIterationFlowInput {
  caseId: string;
  iterationId: string;
  iterationNo: number;
}

export interface FirstIterationPlan {
  agentRunJobs: [AgentRunJobData, AgentRunJobData, AgentRunJobData];
  caseReviewJob: CaseReviewJobData;
}

export function buildFirstIterationPlan(
  input: FirstIterationFlowInput,
): FirstIterationPlan {
  return {
    agentRunJobs: [
      {
        caseId: input.caseId,
        iterationId: input.iterationId,
        iterationNo: input.iterationNo,
        agentName: 'FactResearcher',
      },
      {
        caseId: input.caseId,
        iterationId: input.iterationId,
        iterationNo: input.iterationNo,
        agentName: 'OpportunityStrategist',
      },
      {
        caseId: input.caseId,
        iterationId: input.iterationId,
        iterationNo: input.iterationNo,
        agentName: 'VCCritic',
      },
    ],
    caseReviewJob: {
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
    },
  };
}

export function createWorkflowFlowProducer(
  connection: ConnectionOptions,
): FlowProducer {
  return new FlowProducer({ connection });
}

export async function enqueueFirstIterationFlow(
  flowProducer: FlowProducer,
  input: FirstIterationFlowInput,
) {
  return flowProducer.add(buildFirstIterationFlowDefinition(input));
}

export function buildFirstIterationFlowDefinition(
  input: FirstIterationFlowInput,
): FlowJob {
  const plan = buildFirstIterationPlan(input);
  const [agentAJob, agentBJob, agentCJob] = plan.agentRunJobs;

  return {
    name: 'caseReview',
    queueName: WORKFLOW_QUEUE_NAMES.caseReview,
    data: plan.caseReviewJob,
    children: [
      {
        name: 'agentRun',
        queueName: WORKFLOW_QUEUE_NAMES.agentRun,
        data: agentCJob,
        children: [
          {
            name: 'agentRun',
            queueName: WORKFLOW_QUEUE_NAMES.agentRun,
            data: agentBJob,
            children: [
              {
                name: 'agentRun',
                queueName: WORKFLOW_QUEUE_NAMES.agentRun,
                data: agentAJob,
              },
            ],
          },
        ],
      },
    ],
  };
}
