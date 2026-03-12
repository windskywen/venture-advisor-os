import {
  Queue,
  QueueEvents,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
  type Processor,
  type WorkerOptions,
} from 'bullmq';
import {
  AgentName,
  JudgeTaskPayload,
  type StructuredLogger,
  createNoopStructuredLogger,
} from '@venture-advisor-os/shared-types';

export const WORKFLOW_QUEUE_NAMES = {
  caseStart: 'workflow-case-start',
  agentRun: 'workflow-agent-run',
  caseReview: 'workflow-case-review',
  reportRender: 'workflow-report-render',
  prdGeneration: 'workflow-prd-generation',
  pocGeneration: 'workflow-poc-generation',
} as const;

export interface ReusableResearchArtifactRef {
  sourceIterationNo: number;
  path: string;
  kind: 'normalized-output' | 'raw-output';
}

export interface CaseStartJobData {
  caseId: string;
  requestedAt: string;
}

export interface AgentRunJobData {
  caseId: string;
  iterationId: string;
  iterationNo: number;
  agentName: AgentName;
  judgeTasks?: JudgeTaskPayload[];
  researchArtifactRefs?: ReusableResearchArtifactRef[];
}

export interface CaseReviewJobData {
  caseId: string;
  iterationId: string;
  iterationNo: number;
}

export interface ReportRenderJobData {
  caseId: string;
  approvedIterationNo: number;
}

export interface PrdGenerationJobData {
  caseId: string;
  approvedIterationNo: number;
}

export interface PocGenerationJobData {
  caseId: string;
  approvedIterationNo: number;
}

export interface WorkflowJobDataMap {
  caseStart: CaseStartJobData;
  agentRun: AgentRunJobData;
  caseReview: CaseReviewJobData;
  reportRender: ReportRenderJobData;
  prdGeneration: PrdGenerationJobData;
  pocGeneration: PocGenerationJobData;
}

export interface WorkflowQueues {
  caseStart: Queue<CaseStartJobData>;
  agentRun: Queue<AgentRunJobData>;
  caseReview: Queue<CaseReviewJobData>;
  reportRender: Queue<ReportRenderJobData>;
  prdGeneration: Queue<PrdGenerationJobData>;
  pocGeneration: Queue<PocGenerationJobData>;
  close(): Promise<void>;
}

export interface WorkflowQueueEvents {
  caseStart: QueueEvents;
  agentRun: QueueEvents;
  caseReview: QueueEvents;
  reportRender: QueueEvents;
  prdGeneration: QueueEvents;
  pocGeneration: QueueEvents;
  close(): Promise<void>;
}

export type WorkflowQueueEventSubscriber = Pick<QueueEvents, 'on' | 'off'>;

export type WorkflowQueueEventSubscribers = Record<
  keyof WorkflowJobDataMap,
  WorkflowQueueEventSubscriber
>;

export interface WorkflowProcessorMap {
  caseStart: Processor<CaseStartJobData>;
  agentRun: Processor<AgentRunJobData>;
  caseReview: Processor<CaseReviewJobData>;
  reportRender: Processor<ReportRenderJobData>;
  prdGeneration: Processor<PrdGenerationJobData>;
  pocGeneration: Processor<PocGenerationJobData>;
}

export interface WorkflowWorkers {
  caseStart: Worker<CaseStartJobData>;
  agentRun: Worker<AgentRunJobData>;
  caseReview: Worker<CaseReviewJobData>;
  reportRender: Worker<ReportRenderJobData>;
  prdGeneration: Worker<PrdGenerationJobData>;
  pocGeneration: Worker<PocGenerationJobData>;
  close(): Promise<void>;
}

export function createWorkflowQueues(
  connection: ConnectionOptions,
  defaultJobOptions?: JobsOptions,
): WorkflowQueues {
  const queues = {
    caseStart: new Queue<CaseStartJobData>(WORKFLOW_QUEUE_NAMES.caseStart, {
      connection,
      defaultJobOptions,
    }),
    agentRun: new Queue<AgentRunJobData>(WORKFLOW_QUEUE_NAMES.agentRun, {
      connection,
      defaultJobOptions,
    }),
    caseReview: new Queue<CaseReviewJobData>(WORKFLOW_QUEUE_NAMES.caseReview, {
      connection,
      defaultJobOptions,
    }),
    reportRender: new Queue<ReportRenderJobData>(
      WORKFLOW_QUEUE_NAMES.reportRender,
      {
        connection,
        defaultJobOptions,
      },
    ),
    prdGeneration: new Queue<PrdGenerationJobData>(
      WORKFLOW_QUEUE_NAMES.prdGeneration,
      {
        connection,
        defaultJobOptions,
      },
    ),
    pocGeneration: new Queue<PocGenerationJobData>(
      WORKFLOW_QUEUE_NAMES.pocGeneration,
      {
        connection,
        defaultJobOptions,
      },
    ),
  };

  return {
    ...queues,
    close() {
      return closeQueueResources(Object.values(queues));
    },
  };
}

export function createWorkflowQueueEvents(
  connection: ConnectionOptions,
  logger: StructuredLogger = createNoopStructuredLogger(),
): WorkflowQueueEvents {
  const events = {
    caseStart: new QueueEvents(WORKFLOW_QUEUE_NAMES.caseStart, { connection }),
    agentRun: new QueueEvents(WORKFLOW_QUEUE_NAMES.agentRun, { connection }),
    caseReview: new QueueEvents(WORKFLOW_QUEUE_NAMES.caseReview, {
      connection,
    }),
    reportRender: new QueueEvents(WORKFLOW_QUEUE_NAMES.reportRender, {
      connection,
    }),
    prdGeneration: new QueueEvents(WORKFLOW_QUEUE_NAMES.prdGeneration, {
      connection,
    }),
    pocGeneration: new QueueEvents(WORKFLOW_QUEUE_NAMES.pocGeneration, {
      connection,
    }),
  };
  const unregisterLogging = registerWorkflowQueueFailureLogging(events, logger);

  return {
    ...events,
    close() {
      unregisterLogging();
      return closeQueueResources(Object.values(events));
    },
  };
}

export function createWorkflowWorkers(
  connection: ConnectionOptions,
  processors: WorkflowProcessorMap,
  workerOptions?: Omit<WorkerOptions, 'connection'>,
): WorkflowWorkers {
  const workers = {
    caseStart: new Worker<CaseStartJobData>(
      WORKFLOW_QUEUE_NAMES.caseStart,
      processors.caseStart,
      { connection, ...workerOptions },
    ),
    agentRun: new Worker<AgentRunJobData>(
      WORKFLOW_QUEUE_NAMES.agentRun,
      processors.agentRun,
      { connection, ...workerOptions },
    ),
    caseReview: new Worker<CaseReviewJobData>(
      WORKFLOW_QUEUE_NAMES.caseReview,
      processors.caseReview,
      { connection, ...workerOptions },
    ),
    reportRender: new Worker<ReportRenderJobData>(
      WORKFLOW_QUEUE_NAMES.reportRender,
      processors.reportRender,
      { connection, ...workerOptions },
    ),
    prdGeneration: new Worker<PrdGenerationJobData>(
      WORKFLOW_QUEUE_NAMES.prdGeneration,
      processors.prdGeneration,
      { connection, ...workerOptions },
    ),
    pocGeneration: new Worker<PocGenerationJobData>(
      WORKFLOW_QUEUE_NAMES.pocGeneration,
      processors.pocGeneration,
      { connection, ...workerOptions },
    ),
  };

  return {
    ...workers,
    close() {
      return closeQueueResources(Object.values(workers));
    },
  };
}

async function closeQueueResources(
  resources: Array<{ close(): Promise<void> }>,
): Promise<void> {
  await Promise.all(resources.map((resource) => resource.close()));
}

export function registerWorkflowQueueFailureLogging(
  events: WorkflowQueueEventSubscribers,
  logger: StructuredLogger = createNoopStructuredLogger(),
): () => void {
  const unbinds: Array<() => void> = [];

  for (const queueName of Object.keys(events) as Array<
    keyof WorkflowQueueEventSubscribers
  >) {
    const subscriber = events[queueName];
    const failedListener = (payload: {
      jobId?: string;
      failedReason?: string;
      prev?: string;
    }) => {
      logger.error(
        'workflow.queue.failed',
        'A workflow queue job failed.',
        {
          queueName,
          jobId: payload.jobId,
          failedReason: payload.failedReason,
          previousStatus: payload.prev,
        },
      );
    };
    const errorListener = (error: Error) => {
      logger.error(
        'workflow.queue.events_error',
        error.message,
        {
          queueName,
        },
      );
    };

    subscriber.on('failed', failedListener);
    subscriber.on('error', errorListener);
    unbinds.push(() => subscriber.off('failed', failedListener));
    unbinds.push(() => subscriber.off('error', errorListener));
  }

  return () => {
    for (const unbind of unbinds) {
      unbind();
    }
  };
}
