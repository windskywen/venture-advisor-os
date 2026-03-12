import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';
import {
  createArtifactIndexService,
  createFileStorageAdapter,
  createIterationSnapshotService,
  createPersistenceDatabase,
  createPersistenceRepositories,
} from '@venture-advisor-os/persistence';
import {
  ApprovedBusinessSummaryArtifactSchema,
  type CaseStatus,
  createStructuredLogger,
  loadWorkerRuntimeEnvironment,
  type EnvironmentLike,
  type Iteration,
  type JudgeDecision,
  type JudgeTask,
  type OpportunityCase,
  type RejectionCategory,
  type StructuredLogger,
} from '@venture-advisor-os/shared-types';
import {
  type AgentRunJobData,
  type AgentRuntimeAdapter,
  buildRejectFlowResult,
  createCopilotSdkAgentRuntimeAdapter,
  createWorkflowFlowProducer,
  createWorkflowQueues,
  createWorkflowWorkers,
  enqueueFirstIterationFlow,
  enqueuePivotIterationFlow,
  enqueueReviseIterationFlow,
  executeFactResearcher,
  executeJudge,
  executeOpportunityStrategist,
  executePocArchitect,
  executePrdStrategist,
  executeVcCritic,
  persistAgentRun,
  type ResearchTool,
  type WorkflowProcessorMap,
} from '@venture-advisor-os/workflow-core';

import {
  createDownstreamArtifactService,
  type DownstreamArtifactService,
} from './downstream-artifacts.js';
import {
  createDeterministicAgentRuntime,
  createDeterministicResearchTool,
} from './local-runtime.js';
import { createLiveWebResearchTool } from './web-research-tool.js';

const WORKER_HEARTBEAT_FILE_NAME = '.worker-heartbeat.json';
const WORKER_HEARTBEAT_INTERVAL_MS = 30_000;

const env = loadEnvironment();
const runtime = loadWorkerRuntimeEnvironment(env);
const logger = createStructuredLogger({
  context: {
    service: 'venture-advisor-worker',
  },
});
const database = createPersistenceDatabase({
  connectionString: runtime.databaseUrl,
});
const repositories = createPersistenceRepositories(database);
const storage = createFileStorageAdapter({
  storageRootDirectory: runtime.storageRoot,
});
const artifactIndex = createArtifactIndexService(storage);
const iterationSnapshots = createIterationSnapshotService(
  repositories,
  storage,
  artifactIndex,
);
const downstreamArtifacts = createDownstreamArtifactService({
  repositories: {
    cases: repositories.cases,
    agentOutputs: repositories.agentOutputs,
  },
  storage,
  logger,
});
const registry = loadPromptTemplateRegistry({
  repoRoot: process.cwd(),
});
const deterministicRuntime = createDeterministicAgentRuntime(registry);
const deterministicResearchTool = createDeterministicResearchTool();
const copilotRuntime = createCopilotSdkAgentRuntimeAdapter({
  cliPath: runtime.copilotCliPath,
  githubToken: runtime.githubToken,
  useLoggedInUser: runtime.useLoggedInUser,
  timeoutMs: runtime.workflowConfig.timeoutBudgets.agentRunMs,
  workingDirectory: process.cwd(),
  selectionStore: {
    async getSelectedModelId() {
      return (
        await repositories.runtimeSettings.getCopilotModelSelection()
      )?.modelId ?? null;
    },
  },
});
const agentRuntime =
  runtime.agentRuntimeMode === 'copilot-sdk'
    ? copilotRuntime
    : deterministicRuntime;
const researchTool =
  runtime.agentRuntimeMode === 'copilot-sdk'
    ? createLiveWebResearchTool({
        fallbackTool: deterministicResearchTool,
      })
    : deterministicResearchTool;
const redisConnection = createRedisConnection(runtime.redisUrl);
const queues = createWorkflowQueues(redisConnection, {
  removeOnComplete: true,
  removeOnFail: true,
});
const flowProducer = createWorkflowFlowProducer(redisConnection);
const heartbeatPath = resolve(runtime.storageRoot, WORKER_HEARTBEAT_FILE_NAME);

await mkdir(resolve(runtime.storageRoot), { recursive: true });

const heartbeat = startWorkerHeartbeat(heartbeatPath, logger);
const processors = createProcessors({
  repositories,
  storage,
  iterationSnapshots,
  artifactIndex,
  downstreamArtifacts,
  registry,
  agentRuntime,
  researchTool,
  flowProducer,
  queues,
  logger,
  now: () => new Date(),
});
const workers = createWorkflowWorkers(redisConnection, processors, {
  concurrency: 1,
});

await Promise.all([
  workers.caseStart.waitUntilReady(),
  workers.agentRun.waitUntilReady(),
  workers.caseReview.waitUntilReady(),
  workers.reportRender.waitUntilReady(),
  workers.prdGeneration.waitUntilReady(),
  workers.pocGeneration.waitUntilReady(),
]);

console.log(
  `Worker listening for workflow jobs using ${runtime.databaseUrl} and ${runtime.redisUrl}`,
);
console.log(`Worker heartbeat file: ${heartbeatPath}`);
console.log(`Worker runtime mode: ${runtime.agentRuntimeMode}`);

registerSignalHandlers(async () => {
  heartbeat.stop();
  await Promise.all([
    workers.close(),
    queues.close(),
    flowProducer.close(),
    agentRuntime === copilotRuntime ? copilotRuntime.close() : Promise.resolve(),
    database.close(),
  ]);
});

interface WorkerDependencies {
  repositories: ReturnType<typeof createPersistenceRepositories>;
  storage: ReturnType<typeof createFileStorageAdapter>;
  iterationSnapshots: ReturnType<typeof createIterationSnapshotService>;
  artifactIndex: ReturnType<typeof createArtifactIndexService>;
  downstreamArtifacts: DownstreamArtifactService;
  registry: ReturnType<typeof loadPromptTemplateRegistry>;
  agentRuntime: AgentRuntimeAdapter;
  researchTool: ResearchTool;
  flowProducer: ReturnType<typeof createWorkflowFlowProducer>;
  queues: ReturnType<typeof createWorkflowQueues>;
  logger: StructuredLogger;
  now: () => Date;
}

function createProcessors(
  dependencies: WorkerDependencies,
): WorkflowProcessorMap {
  return {
    caseStart: async (job) => {
      try {
        return await processCaseStart(dependencies, job.data.caseId, job.data.requestedAt);
      } catch (error) {
        await failCase(dependencies, job.data.caseId, error, {
          failureCategory: 'INFRA_FAILURE',
        });
        throw error;
      }
    },
    agentRun: async (job) => {
      try {
        return await processAgentRun(dependencies, job.data);
      } catch (error) {
        await failCase(dependencies, job.data.caseId, error, {
          iterationId: job.data.iterationId,
          iterationNo: job.data.iterationNo,
          agentName: job.data.agentName,
          failureCategory: 'INVALID_AGENT_OUTPUT',
        });
        throw error;
      }
    },
    caseReview: async (job) => {
      try {
        return await processCaseReview(dependencies, job.data);
      } catch (error) {
        await failCase(dependencies, job.data.caseId, error, {
          iterationId: job.data.iterationId,
          iterationNo: job.data.iterationNo,
          agentName: 'Judge',
          failureCategory: 'INVALID_AGENT_OUTPUT',
        });
        throw error;
      }
    },
    reportRender: async (job) => {
      try {
        return await processReportRender(dependencies, job.data.caseId);
      } catch (error) {
        await failCase(dependencies, job.data.caseId, error, {
          iterationNo: job.data.approvedIterationNo,
          failureCategory: 'STORAGE_FAILURE',
        });
        throw error;
      }
    },
    prdGeneration: async (job) => {
      try {
        return await processPrdGeneration(
          dependencies,
          job.data.caseId,
          job.data.approvedIterationNo,
        );
      } catch (error) {
        await failCase(dependencies, job.data.caseId, error, {
          iterationNo: job.data.approvedIterationNo,
          agentName: 'PRDStrategist',
          failureCategory: 'INVALID_AGENT_OUTPUT',
        });
        throw error;
      }
    },
    pocGeneration: async (job) => {
      try {
        return await processPocGeneration(
          dependencies,
          job.data.caseId,
          job.data.approvedIterationNo,
        );
      } catch (error) {
        await failCase(dependencies, job.data.caseId, error, {
          iterationNo: job.data.approvedIterationNo,
          agentName: 'POCArchitect',
          failureCategory: 'INVALID_AGENT_OUTPUT',
        });
        throw error;
      }
    },
  };
}

async function processCaseStart(
  dependencies: WorkerDependencies,
  caseId: string,
  requestedAt: string,
) {
  const caseRecord = await requireCase(dependencies, caseId);
  const iterationNo = caseRecord.currentIteration + 1;
  const iterationId = randomUUID();
  const startedAt = normalizeTimestamp(requestedAt, dependencies.now);

  await dependencies.storage.ensureCaseWorkspace(caseId, iterationNo);
  await dependencies.repositories.iterations.create({
    iterationId,
    caseId,
    iterationNo,
    agentOutputIds: [],
    judgeTaskIds: [],
    scoreDetailIds: [],
    statusAtStart: caseRecord.status,
    startedAt,
  });

  const updatedCase = await dependencies.repositories.cases.update({
    ...caseRecord,
    status: 'RESEARCHING',
    currentIteration: iterationNo,
    finalDecision: undefined,
    failureCategory: undefined,
    rejectionRationale: undefined,
    rejectionCategory: undefined,
    manualReviewRequired: false,
    updatedAt: startedAt,
  });
  await writeCaseSnapshot(dependencies, updatedCase);
  await dependencies.repositories.auditLogs.create({
    auditLogId: randomUUID(),
    caseId,
    iterationId,
    iterationNo,
    action: 'ITERATION_STARTED',
    actor: 'system',
    metadata: {
      queuedAt: startedAt,
      status: updatedCase.status,
    },
    createdAt: startedAt,
  });

  await enqueueFirstIterationFlow(dependencies.flowProducer, {
    caseId,
    iterationId,
    iterationNo,
  });

  dependencies.logger.child({ caseId, iterationId }).info(
    'workflow.case.started',
    'Started the first workflow iteration for a case.',
    {
      iterationNo,
    },
  );

  return {
    caseId,
    iterationId,
    iterationNo,
  };
}

async function processAgentRun(
  dependencies: WorkerDependencies,
  input: AgentRunJobData,
) {
  if (
    input.agentName !== 'FactResearcher' &&
    input.agentName !== 'OpportunityStrategist' &&
    input.agentName !== 'VCCritic'
  ) {
    throw new Error(`Unsupported agentRun queue agent: ${input.agentName}`);
  }

  const caseRecord = await requireCase(dependencies, input.caseId);
  await requireIteration(dependencies, input.iterationId);
  const latestOutputs =
    await dependencies.repositories.agentOutputs.getLatestNormalizedByCaseId(
      input.caseId,
    );
  const timestamp = dependencies.now().toISOString();

  await updateCaseStatusIfChanged(
    dependencies,
    caseRecord,
    resolveAgentStatus(input.agentName),
    timestamp,
  );

  if (input.agentName === 'FactResearcher') {
    const result = await executeFactResearcher({
      registry: dependencies.registry,
      runtime: dependencies.agentRuntime,
      researchTool: dependencies.researchTool,
      caseContext: {
        topic: caseRecord.topic,
        region: caseRecord.region,
        researchStyle: caseRecord.researchStyle,
        browsingAutonomy: caseRecord.browsingAutonomy,
        iteration_no: input.iterationNo,
      },
      priorOutputs: latestOutputs,
      judgeTasks: input.judgeTasks,
      requestedAt: timestamp,
    });
    const persisted = await persistRun(dependencies, {
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      agentName: 'FactResearcher',
      rawOutput: result.runtimeResponse.rawOutput,
      normalizedOutput: result.normalizedOutput,
      tokenUsage: result.runtimeResponse.metadata?.tokenUsage,
      latencyMs: result.runtimeResponse.metadata?.latencyMs,
      createdAt: timestamp,
    });

    await Promise.all([
      dependencies.storage.writeIterationInput(
        input.caseId,
        input.iterationNo,
        'fact_researcher.prompt.md',
        result.renderedPrompt.prompt,
      ),
      dependencies.storage.writeIterationInput(
        input.caseId,
        input.iterationNo,
        'fact_researcher.input.json',
        result.renderedPrompt.inputPayload,
      ),
      dependencies.storage.writeIterationInput(
        input.caseId,
        input.iterationNo,
        'research_report.json',
        result.researchReport,
      ),
      dependencies.storage.writeIterationOutput(
        input.caseId,
        input.iterationNo,
        'marketFacts',
        renderMarketFactsMarkdown(caseRecord.topic, result.normalizedOutput),
      ),
      dependencies.storage.writeIterationOutput(
        input.caseId,
        input.iterationNo,
        'painEvidence',
        renderPainEvidenceMarkdown(result.normalizedOutput),
      ),
      dependencies.storage.writeIterationOutput(
        input.caseId,
        input.iterationNo,
        'competitorMap',
        renderCompetitorMapMarkdown(result.normalizedOutput),
      ),
      dependencies.storage.writeIterationRaw(
        input.caseId,
        input.iterationNo,
        'factResearcher',
        {
          rawOutput: result.runtimeResponse.rawOutput,
          metadata: result.runtimeResponse.metadata,
        },
      ),
    ]);

    return {
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      agentOutputId: persisted.agentOutput.agentOutputId,
    };
  }

  if (input.agentName === 'OpportunityStrategist') {
    const marketFactsSummary = expectNormalizedOutput(
      latestOutputs.FactResearcher,
      'FactResearcher',
    );
    const result = await executeOpportunityStrategist({
      registry: dependencies.registry,
      runtime: dependencies.agentRuntime,
      caseContext: {
        topic: caseRecord.topic,
        market_facts_summary: marketFactsSummary,
        iteration_no: input.iterationNo,
      },
      priorOutputs: latestOutputs,
      judgeTasks: input.judgeTasks,
    });
    const persisted = await persistRun(dependencies, {
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      agentName: 'OpportunityStrategist',
      rawOutput: result.runtimeResponse.rawOutput,
      normalizedOutput: result.normalizedOutput,
      tokenUsage: result.runtimeResponse.metadata?.tokenUsage,
      latencyMs: result.runtimeResponse.metadata?.latencyMs,
      createdAt: timestamp,
    });

    await Promise.all([
      dependencies.storage.writeIterationInput(
        input.caseId,
        input.iterationNo,
        'opportunity_strategist.prompt.md',
        result.renderedPrompt.prompt,
      ),
      dependencies.storage.writeIterationInput(
        input.caseId,
        input.iterationNo,
        'opportunity_strategist.input.json',
        result.renderedPrompt.inputPayload,
      ),
      input.researchArtifactRefs && input.researchArtifactRefs.length > 0
        ? dependencies.storage.writeIterationInput(
            input.caseId,
            input.iterationNo,
            'research_artifact_refs.used.json',
            input.researchArtifactRefs,
          )
        : Promise.resolve(undefined),
      dependencies.storage.writeIterationOutput(
        input.caseId,
        input.iterationNo,
        'opportunityOptions',
        renderOpportunityOptionsMarkdown(result.normalizedOutput),
      ),
      dependencies.storage.writeIterationOutput(
        input.caseId,
        input.iterationNo,
        'businessModelHypotheses',
        renderBusinessModelMarkdown(result.normalizedOutput),
      ),
      dependencies.storage.writeIterationRaw(
        input.caseId,
        input.iterationNo,
        'strategist',
        {
          rawOutput: result.runtimeResponse.rawOutput,
          metadata: result.runtimeResponse.metadata,
        },
      ),
    ]);

    return {
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      agentOutputId: persisted.agentOutput.agentOutputId,
    };
  }

  const marketFactsSummary = expectNormalizedOutput(
    latestOutputs.FactResearcher,
    'FactResearcher',
  );
  const opportunitySummary = expectNormalizedOutput(
    latestOutputs.OpportunityStrategist,
    'OpportunityStrategist',
  );
  const result = await executeVcCritic({
    registry: dependencies.registry,
    runtime: dependencies.agentRuntime,
    caseContext: {
      topic: caseRecord.topic,
      market_facts_summary: marketFactsSummary,
      opportunity_summary: opportunitySummary,
      iteration_no: input.iterationNo,
    },
    priorOutputs: latestOutputs,
  });
  const persisted = await persistRun(dependencies, {
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    agentName: 'VCCritic',
    rawOutput: result.runtimeResponse.rawOutput,
    normalizedOutput: result.normalizedOutput,
    tokenUsage: result.runtimeResponse.metadata?.tokenUsage,
    latencyMs: result.runtimeResponse.metadata?.latencyMs,
    createdAt: timestamp,
  });

  await Promise.all([
    dependencies.storage.writeIterationInput(
      input.caseId,
      input.iterationNo,
      'vc_critic.prompt.md',
      result.renderedPrompt.prompt,
    ),
    dependencies.storage.writeIterationInput(
      input.caseId,
      input.iterationNo,
      'vc_critic.input.json',
      result.renderedPrompt.inputPayload,
    ),
    dependencies.storage.writeIterationOutput(
      input.caseId,
      input.iterationNo,
      'vcCriticReport',
      renderVcCriticMarkdown(result.normalizedOutput),
    ),
    dependencies.storage.writeIterationRaw(
      input.caseId,
      input.iterationNo,
      'vcCritic',
      {
        rawOutput: result.runtimeResponse.rawOutput,
        metadata: result.runtimeResponse.metadata,
      },
    ),
  ]);

  return {
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    agentOutputId: persisted.agentOutput.agentOutputId,
  };
}

async function processCaseReview(
  dependencies: WorkerDependencies,
  input: {
    caseId: string;
    iterationId: string;
    iterationNo: number;
  },
) {
  const caseRecord = await requireCase(dependencies, input.caseId);
  const iteration = await requireIteration(dependencies, input.iterationId);
  const timestamp = dependencies.now().toISOString();
  const reviewingCase =
    caseRecord.status === 'JUDGE_REVIEW'
      ? caseRecord
      : await dependencies.repositories.cases.update({
          ...caseRecord,
          status: 'JUDGE_REVIEW',
          updatedAt: timestamp,
        });
  const latestOutputs =
    await dependencies.repositories.agentOutputs.getLatestNormalizedByCaseId(
      input.caseId,
    );
  const factResearch = expectNormalizedOutput(
    latestOutputs.FactResearcher,
    'FactResearcher',
  );
  const opportunitySummary = expectNormalizedOutput(
    latestOutputs.OpportunityStrategist,
    'OpportunityStrategist',
  );
  const vcCriticSummary = expectNormalizedOutput(
    latestOutputs.VCCritic,
    'VCCritic',
  );
  const judge = await executeJudge({
    registry: dependencies.registry,
    runtime: dependencies.agentRuntime,
    caseContext: {
      topic: reviewingCase.topic,
      market_facts_summary: factResearch,
      opportunity_summary: opportunitySummary,
      vc_critic_summary: vcCriticSummary,
      iteration_no: input.iterationNo,
      max_iterations: reviewingCase.maxIterations,
    },
    priorOutputs: latestOutputs,
  });
  const persisted = await persistRun(dependencies, {
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    agentName: 'Judge',
    rawOutput: judge.runtimeResponse.rawOutput,
    normalizedOutput: judge.normalizedOutput,
    tokenUsage: judge.runtimeResponse.metadata?.tokenUsage,
    latencyMs: judge.runtimeResponse.metadata?.latencyMs,
    createdAt: timestamp,
  });
  const judgeTasks = mapJudgeTasks(
    input.caseId,
    input.iterationId,
    input.iterationNo,
    judge.normalizedOutput.next_iteration_tasks,
  );

  await Promise.all([
    dependencies.repositories.judgeTasks.replaceForIteration(
      input.iterationId,
      judgeTasks,
    ),
    dependencies.storage.writeIterationInput(
      input.caseId,
      input.iterationNo,
      'judge.prompt.md',
      judge.renderedPrompt.prompt,
    ),
    dependencies.storage.writeIterationInput(
      input.caseId,
      input.iterationNo,
      'judge.input.json',
      judge.renderedPrompt.inputPayload,
    ),
    dependencies.storage.writeIterationOutput(
      input.caseId,
      input.iterationNo,
      'judgeDecision',
      judge.normalizedOutput,
    ),
    dependencies.storage.writeIterationOutput(
      input.caseId,
      input.iterationNo,
      'decisionMemo',
      renderJudgeDecisionMarkdown(judge.normalizedOutput),
    ),
    dependencies.storage.writeIterationRaw(
      input.caseId,
      input.iterationNo,
      'judge',
      {
        rawOutput: judge.runtimeResponse.rawOutput,
        metadata: judge.runtimeResponse.metadata,
      },
    ),
  ]);

  const completedIteration = await dependencies.repositories.iterations.update({
    ...iteration,
    judgeDecision: judge.normalizedOutput.decision,
    statusAtEnd: resolveJudgeTerminalStatus(
      judge.normalizedOutput.decision,
      reviewingCase.maxIterations,
      input.iterationNo,
    ),
    completedAt: timestamp,
  });

  if (judge.normalizedOutput.decision === 'PASS') {
    const approvedCase = await dependencies.repositories.cases.update({
      ...reviewingCase,
      status: 'APPROVED_FOR_PRD',
      finalDecision: 'PASS',
      approvedSourceIterationId: input.iterationId,
      approvedSourceIterationNo: input.iterationNo,
      failureCategory: undefined,
      rejectionRationale: undefined,
      rejectionCategory: undefined,
      manualReviewRequired: false,
      updatedAt: timestamp,
    });
    await writeCaseSnapshot(dependencies, approvedCase);
    await dependencies.repositories.auditLogs.create({
      auditLogId: randomUUID(),
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      action: 'ITERATION_APPROVED',
      actor: 'system',
      metadata: {
        judgeDecision: judge.normalizedOutput.decision,
        agentOutputId: persisted.agentOutput.agentOutputId,
      },
      createdAt: timestamp,
    });
    await dependencies.queues.reportRender.add('reportRender', {
      caseId: input.caseId,
      approvedIterationNo: input.iterationNo,
    });
    return {
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      judgeDecision: 'PASS',
      nextStatus: approvedCase.status,
    };
  }

  if (
    judge.normalizedOutput.decision === 'REJECT' ||
    input.iterationNo >= reviewingCase.maxIterations
  ) {
    const rejectionCategory = resolveRejectionCategory(
      judge.normalizedOutput.rationale,
      input.iterationNo >= reviewingCase.maxIterations,
    );
    const rejectResult = buildRejectFlowResult({
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      currentStatus: 'JUDGE_REVIEW',
      rationale: judge.normalizedOutput.rationale,
      category: rejectionCategory,
      decidedAt: timestamp,
    });
    const rejectedCase = await dependencies.repositories.cases.update({
      ...reviewingCase,
      status: rejectResult.nextStatus,
      finalDecision: rejectResult.finalDecision,
      rejectionRationale: rejectResult.rejectionRationale,
      rejectionCategory: rejectResult.rejectionCategory,
      portfolioEscalationMetadata: rejectResult.portfolioEscalationMetadata,
      manualReviewRequired: false,
      updatedAt: timestamp,
    });
    await dependencies.repositories.iterations.update({
      ...completedIteration,
      statusAtEnd: 'REJECTED',
      judgeDecision: 'REJECT',
      completedAt: timestamp,
    });
    await writeCaseSnapshot(dependencies, rejectedCase);
    await dependencies.repositories.auditLogs.create({
      auditLogId: randomUUID(),
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      action: 'ITERATION_REJECTED',
      actor: 'system',
      metadata: {
        judgeDecision: judge.normalizedOutput.decision,
        rejectionCategory,
        rationale: judge.normalizedOutput.rationale,
      },
      createdAt: timestamp,
    });

    return {
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      judgeDecision: 'REJECT',
      nextStatus: rejectedCase.status,
    };
  }

  const nextIterationNo = input.iterationNo + 1;
  const nextIterationId = randomUUID();
  const nextStatus =
    judge.normalizedOutput.decision === 'PIVOT'
      ? 'PIVOT_REQUIRED'
      : 'REVISE_REQUIRED';
  const continuationCase = await dependencies.repositories.cases.update({
    ...reviewingCase,
    status: nextStatus,
    currentIteration: nextIterationNo,
    finalDecision: judge.normalizedOutput.decision,
    manualReviewRequired: false,
    updatedAt: timestamp,
  });
  await dependencies.repositories.iterations.create({
    iterationId: nextIterationId,
    caseId: input.caseId,
    iterationNo: nextIterationNo,
    agentOutputIds: [],
    judgeTaskIds: [],
    scoreDetailIds: [],
    statusAtStart: nextStatus,
    startedAt: timestamp,
  });
  await writeCaseSnapshot(dependencies, continuationCase);

  const rerunTasks = judgeTasks.map((task) => ({
    taskType: task.taskType,
    targetAgent: task.targetAgent,
    description: task.description,
    blocking: task.blocking,
  }));

  if (nextStatus === 'REVISE_REQUIRED') {
    await enqueueReviseIterationFlow(dependencies.flowProducer, {
      caseId: input.caseId,
      iterationId: nextIterationId,
      iterationNo: nextIterationNo,
      judgeTasks: rerunTasks,
    });
  } else {
    const invalidateResearch = rerunTasks.some(
      (task) => task.targetAgent === 'FACT_RESEARCHER',
    );
    const reusableResearchArtifactRefs = invalidateResearch
      ? []
      : await dependencies.iterationSnapshots.buildReusableResearchArtifactRefs(
          input.caseId,
          input.iterationNo,
        );
    if (reusableResearchArtifactRefs.length > 0) {
      await dependencies.iterationSnapshots.writeReusableResearchArtifactRefs(
        input.caseId,
        nextIterationNo,
        reusableResearchArtifactRefs,
      );
    }

    await enqueuePivotIterationFlow(dependencies.flowProducer, {
      caseId: input.caseId,
      iterationId: nextIterationId,
      iterationNo: nextIterationNo,
      judgeTasks: rerunTasks,
      invalidateResearch,
      reusableResearchArtifactRefs: reusableResearchArtifactRefs.map((artifact) => ({
        sourceIterationNo: artifact.sourceIterationNo,
        path: artifact.path,
        kind: artifact.kind === 'raw-output' ? 'raw-output' : 'normalized-output',
      })),
    });
  }

  await dependencies.repositories.auditLogs.create({
    auditLogId: randomUUID(),
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    action:
      nextStatus === 'REVISE_REQUIRED'
        ? 'ITERATION_REVISE_QUEUED'
        : 'ITERATION_PIVOT_QUEUED',
    actor: 'system',
    metadata: {
      nextIterationId,
      nextIterationNo,
      judgeDecision: judge.normalizedOutput.decision,
      taskCount: judgeTasks.length,
    },
    createdAt: timestamp,
  });

  return {
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    judgeDecision: judge.normalizedOutput.decision,
    nextIterationId,
    nextIterationNo,
    nextStatus,
  };
}

async function processReportRender(
  dependencies: WorkerDependencies,
  caseId: string,
) {
  const result = await dependencies.downstreamArtifacts.ensureApprovedArtifacts(
    caseId,
  );
  await dependencies.repositories.auditLogs.create({
    auditLogId: randomUUID(),
    caseId,
    iterationNo: result.approvedIterationNo,
    action: 'APPROVED_ARTIFACTS_RENDERED',
    actor: 'system',
    metadata: {
      approvedBusinessSummaryPath: result.approvedBusinessSummaryPath,
      finalBusinessPlanPath: result.finalBusinessPlanPath,
      created: result.created,
    },
    createdAt: dependencies.now().toISOString(),
  });

  return result;
}

async function processPrdGeneration(
  dependencies: WorkerDependencies,
  caseId: string,
  approvedIterationNo: number,
) {
  const caseRecord = await requireCase(dependencies, caseId);
  await dependencies.downstreamArtifacts.ensureApprovedArtifacts(caseId);
  const approvedSummary = await loadApprovedBusinessSummary(dependencies, caseId);
  const latestOutputs =
    await dependencies.repositories.agentOutputs.getLatestNormalizedByCaseId(caseId);
  const existingArtifacts = await dependencies.artifactIndex.listCaseArtifacts(caseId);
  const hasExistingPrd = existingArtifacts.some((artifact) => artifact.kind === 'prd');
  const logicalStatus: CaseStatus =
    caseRecord.status === 'PRD_IN_PROGRESS' ? 'APPROVED_FOR_PRD' : caseRecord.status;
  const result = await executePrdStrategist({
    registry: dependencies.registry,
    runtime: dependencies.agentRuntime,
    caseContext: {
      topic: caseRecord.topic,
      approved_business_summary: approvedSummary.summary,
    },
    currentStatus: logicalStatus,
    latestJudgeDecision: resolvePassDecision(caseRecord),
    hasExistingPrd,
    priorOutputs: latestOutputs,
  });
  const persisted = await persistRun(dependencies, {
    caseId,
    iterationId: caseRecord.approvedSourceIterationId ?? `approved:${caseId}`,
    iterationNo: approvedIterationNo,
    agentName: 'PRDStrategist',
    rawOutput: result.runtimeResponse.rawOutput,
    normalizedOutput: result.normalizedOutput,
    tokenUsage: result.runtimeResponse.metadata?.tokenUsage,
    latencyMs: result.runtimeResponse.metadata?.latencyMs,
    createdAt: dependencies.now().toISOString(),
  });

  await Promise.all([
    dependencies.storage.writeIterationInput(
      caseId,
      approvedIterationNo,
      'prd_strategist.prompt.md',
      result.renderedPrompt.prompt,
    ),
    dependencies.storage.writeIterationInput(
      caseId,
      approvedIterationNo,
      'prd_strategist.input.json',
      result.renderedPrompt.inputPayload,
    ),
  ]);

  const artifact = await dependencies.downstreamArtifacts.ensurePrdArtifact(caseId);
  await dependencies.repositories.auditLogs.create({
    auditLogId: randomUUID(),
    caseId,
    iterationId: caseRecord.approvedSourceIterationId,
    iterationNo: approvedIterationNo,
    action: 'PRD_GENERATED',
    actor: 'system',
    metadata: {
      agentOutputId: persisted.agentOutput.agentOutputId,
      artifactPath: artifact.artifactPath,
      created: artifact.created,
    },
    createdAt: dependencies.now().toISOString(),
  });

  return {
    caseId,
    approvedIterationNo,
    artifactPath: artifact.artifactPath,
  };
}

async function processPocGeneration(
  dependencies: WorkerDependencies,
  caseId: string,
  approvedIterationNo: number,
) {
  const caseRecord = await requireCase(dependencies, caseId);
  await dependencies.downstreamArtifacts.ensureApprovedArtifacts(caseId);
  const latestOutputs =
    await dependencies.repositories.agentOutputs.getLatestNormalizedByCaseId(caseId);
  const prdSummary = expectNormalizedOutput(
    latestOutputs.PRDStrategist,
    'PRDStrategist',
  );
  const existingArtifacts = await dependencies.artifactIndex.listCaseArtifacts(caseId);
  const result = await executePocArchitect({
    registry: dependencies.registry,
    runtime: dependencies.agentRuntime,
    caseContext: {
      topic: caseRecord.topic,
      prd_summary: prdSummary,
    },
    currentStatus: caseRecord.status,
    latestJudgeDecision: resolvePassDecision(caseRecord),
    hasPrd: existingArtifacts.some((artifact) => artifact.kind === 'prd'),
    hasExistingPoc: existingArtifacts.some((artifact) => artifact.kind === 'poc'),
    priorOutputs: latestOutputs,
  });
  const persisted = await persistRun(dependencies, {
    caseId,
    iterationId: caseRecord.approvedSourceIterationId ?? `approved:${caseId}`,
    iterationNo: approvedIterationNo,
    agentName: 'POCArchitect',
    rawOutput: result.runtimeResponse.rawOutput,
    normalizedOutput: result.normalizedOutput,
    tokenUsage: result.runtimeResponse.metadata?.tokenUsage,
    latencyMs: result.runtimeResponse.metadata?.latencyMs,
    createdAt: dependencies.now().toISOString(),
  });

  await Promise.all([
    dependencies.storage.writeIterationInput(
      caseId,
      approvedIterationNo,
      'poc_architect.prompt.md',
      result.renderedPrompt.prompt,
    ),
    dependencies.storage.writeIterationInput(
      caseId,
      approvedIterationNo,
      'poc_architect.input.json',
      result.renderedPrompt.inputPayload,
    ),
  ]);

  const pocArtifact = await dependencies.downstreamArtifacts.ensurePocArtifact(caseId);
  const handoffArtifact =
    await dependencies.downstreamArtifacts.ensureImplementationHandoff(caseId);
  const completedCase = await dependencies.repositories.cases.update({
    ...caseRecord,
    status: 'COMPLETED',
    updatedAt: dependencies.now().toISOString(),
  });
  await writeCaseSnapshot(dependencies, completedCase);
  await dependencies.repositories.auditLogs.create({
    auditLogId: randomUUID(),
    caseId,
    iterationId: caseRecord.approvedSourceIterationId,
    iterationNo: approvedIterationNo,
    action: 'POC_GENERATED',
    actor: 'system',
    metadata: {
      agentOutputId: persisted.agentOutput.agentOutputId,
      pocArtifactPath: pocArtifact.artifactPath,
      handoffArtifactPath: handoffArtifact.artifactPath,
      created: pocArtifact.created || handoffArtifact.created,
    },
    createdAt: dependencies.now().toISOString(),
  });

  return {
    caseId,
    approvedIterationNo,
    pocArtifactPath: pocArtifact.artifactPath,
    handoffArtifactPath: handoffArtifact.artifactPath,
  };
}

async function persistRun(
  dependencies: WorkerDependencies,
  input: {
    caseId: string;
    iterationId: string;
    iterationNo: number;
    agentName:
      | 'FactResearcher'
      | 'OpportunityStrategist'
      | 'VCCritic'
      | 'Judge'
      | 'PRDStrategist'
      | 'POCArchitect';
    rawOutput: string;
    normalizedOutput: Record<string, unknown>;
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    latencyMs?: number;
    createdAt: string;
  },
) {
  return persistAgentRun(
    {
      agentOutputs: dependencies.repositories.agentOutputs,
      scoreDetails: dependencies.repositories.scoreDetails,
    },
    {
      agentOutputId: randomUUID(),
      caseId: input.caseId,
      iterationId: input.iterationId,
      iterationNo: input.iterationNo,
      agentName: input.agentName,
      rawOutput: input.rawOutput,
      normalizedOutput: input.normalizedOutput,
      tokenUsage: input.tokenUsage,
      latencyMs: input.latencyMs,
      createdAt: input.createdAt,
    },
    dependencies.logger,
  );
}

async function failCase(
  dependencies: WorkerDependencies,
  caseId: string,
  error: unknown,
  context: {
    iterationId?: string;
    iterationNo?: number;
    agentName?: string;
    failureCategory:
      | 'INFRA_FAILURE'
      | 'INVALID_AGENT_OUTPUT'
      | 'STORAGE_FAILURE';
  },
) {
  const caseRecord = await dependencies.repositories.cases.getById(caseId);
  const message = error instanceof Error ? error.message : String(error);
  dependencies.logger.child({ caseId, iterationId: context.iterationId }).error(
    'workflow.case.failed',
    'Marked a case as failed after worker processing error.',
    {
      iterationNo: context.iterationNo,
      agentName: context.agentName,
      failureCategory: context.failureCategory,
      error: message,
    },
  );

  if (!caseRecord) {
    return;
  }

  const failedCase = await dependencies.repositories.cases.update({
    ...caseRecord,
    status: 'FAILED',
    failureCategory: context.failureCategory,
    manualReviewRequired: true,
    updatedAt: dependencies.now().toISOString(),
  });
  await writeCaseSnapshot(dependencies, failedCase);
  await dependencies.repositories.auditLogs.create({
    auditLogId: randomUUID(),
    caseId,
    iterationId: context.iterationId,
    iterationNo: context.iterationNo,
    action: 'WORKFLOW_FAILED',
    actor: 'system',
    metadata: {
      agentName: context.agentName,
      failureCategory: context.failureCategory,
      error: message,
    },
    createdAt: dependencies.now().toISOString(),
  });
}

async function requireCase(
  dependencies: WorkerDependencies,
  caseId: string,
): Promise<OpportunityCase> {
  const caseRecord = await dependencies.repositories.cases.getById(caseId);
  if (!caseRecord) {
    throw new Error(`Case ${caseId} was not found.`);
  }

  return caseRecord;
}

async function requireIteration(
  dependencies: WorkerDependencies,
  iterationId: string,
): Promise<Iteration> {
  const iteration = await dependencies.repositories.iterations.getById(iterationId);
  if (!iteration) {
    throw new Error(`Iteration ${iterationId} was not found.`);
  }

  return iteration;
}

async function updateCaseStatusIfChanged(
  dependencies: WorkerDependencies,
  caseRecord: OpportunityCase,
  nextStatus: CaseStatus,
  updatedAt: string,
) {
  if (caseRecord.status === nextStatus) {
    return caseRecord;
  }

  const updatedCase = await dependencies.repositories.cases.update({
    ...caseRecord,
    status: nextStatus,
    updatedAt,
  });
  await writeCaseSnapshot(dependencies, updatedCase);
  return updatedCase;
}

async function writeCaseSnapshot(
  dependencies: WorkerDependencies,
  caseRecord: OpportunityCase,
) {
  await dependencies.storage.writeCaseSnapshot(caseRecord.caseId, caseRecord);
}

function expectNormalizedOutput(
  value: Record<string, unknown> | undefined,
  agentName: string,
) {
  if (!value) {
    throw new Error(`No normalized output is available for ${agentName}.`);
  }

  return value;
}

function resolveAgentStatus(
  agentName: 'FactResearcher' | 'OpportunityStrategist' | 'VCCritic',
): CaseStatus {
  switch (agentName) {
    case 'FactResearcher':
      return 'RESEARCHING';
    case 'OpportunityStrategist':
      return 'SYNTHESIZING';
    case 'VCCritic':
      return 'VC_REVIEW';
  }
}

function resolveJudgeTerminalStatus(
  decision: JudgeDecision,
  maxIterations: number,
  iterationNo: number,
): CaseStatus {
  if (decision === 'PASS') {
    return 'APPROVED_FOR_PRD';
  }

  if (decision === 'PIVOT' && iterationNo < maxIterations) {
    return 'PIVOT_REQUIRED';
  }

  if (decision === 'REVISE' && iterationNo < maxIterations) {
    return 'REVISE_REQUIRED';
  }

  return 'REJECTED';
}

function mapJudgeTasks(
  caseId: string,
  iterationId: string,
  iterationNo: number,
  tasks: Array<{
    task_type: JudgeTask['taskType'];
    target_agent: JudgeTask['targetAgent'];
    description: string;
    blocking: boolean;
  }>,
): JudgeTask[] {
  return tasks.map((task, index) => ({
    taskId: `${iterationId}:task:${index + 1}`,
    caseId,
    iterationId,
    iterationNo,
    taskType: task.task_type,
    targetAgent: task.target_agent,
    description: task.description,
    blocking: task.blocking,
  }));
}

async function loadApprovedBusinessSummary(
  dependencies: WorkerDependencies,
  caseId: string,
) {
  const manifest = dependencies.storage.getCaseManifest(caseId);
  const approvedSummary = await dependencies.storage.readJson(
    manifest.approvedBusinessSummaryFile,
  );
  if (!approvedSummary) {
    throw new Error(`Approved business summary was not found for case ${caseId}.`);
  }

  return ApprovedBusinessSummaryArtifactSchema.parse(approvedSummary);
}

function resolvePassDecision(caseRecord: OpportunityCase): JudgeDecision {
  return caseRecord.finalDecision === 'PASS' ? 'PASS' : 'REJECT';
}

function resolveRejectionCategory(
  rationale: string,
  exhaustedBudget: boolean,
): RejectionCategory {
  if (exhaustedBudget) {
    return 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET';
  }

  const normalized = rationale.toLowerCase();
  if (normalized.includes('market')) {
    return 'WEAK_MARKET';
  }

  if (normalized.includes('willingness to pay') || normalized.includes('pricing')) {
    return 'WEAK_WILLINGNESS_TO_PAY';
  }

  if (normalized.includes('moat')) {
    return 'WEAK_MOAT';
  }

  if (normalized.includes('gtm') || normalized.includes('distribution')) {
    return 'WEAK_GTM';
  }

  if (normalized.includes('founder')) {
    return 'FOUNDER_MISMATCH';
  }

  if (normalized.includes('regulat')) {
    return 'EXCESSIVE_REGULATORY_BURDEN';
  }

  if (normalized.includes('feature')) {
    return 'FEATURE_NOT_COMPANY';
  }

  return 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET';
}

function renderMarketFactsMarkdown(
  topic: string,
  output: Record<string, unknown>,
): string {
  const targetSegments = readStringList(output.target_user_segments);
  const painPoints = readStringList(output.pain_points);
  const workflowGaps = readStringList(output.workflow_gaps);

  return [
    `# Market Facts`,
    ``,
    `Topic: ${topic}`,
    ``,
    `## Problem Definition`,
    String(output.market_problem_definition ?? ''),
    ``,
    `## Target Segments`,
    ...targetSegments.map((segment) => `- ${segment}`),
    ``,
    `## Pain Points`,
    ...painPoints.map((point) => `- ${point}`),
    ``,
    `## Workflow Gaps`,
    ...workflowGaps.map((gap) => `- ${gap}`),
    ``,
  ].join('\n');
}

function renderPainEvidenceMarkdown(output: Record<string, unknown>): string {
  const evidence = Array.isArray(output.evidence) ? output.evidence : [];
  const assumptions = readStringList(output.assumptions);

  return [
    `# Pain Evidence`,
    ``,
    `## Evidence`,
    ...evidence.map((entry) => {
      const value = entry as Record<string, unknown>;
      return `- ${String(value.claim ?? 'Unknown claim')} (${String(value.source_type ?? 'source')}, ${String(value.source_date ?? 'unknown date')})`;
    }),
    ``,
    `## Assumptions`,
    ...assumptions.map((assumption) => `- ${assumption}`),
    ``,
  ].join('\n');
}

function renderCompetitorMapMarkdown(output: Record<string, unknown>): string {
  const competitors = Array.isArray(output.competitors) ? output.competitors : [];

  return [
    `# Competitor Map`,
    ``,
    ...competitors.map((entry) => {
      const value = entry as Record<string, unknown>;
      return `- ${String(value.name ?? 'Unknown')} | ${String(value.positioning ?? 'Unknown positioning')} | Gap: ${String(value.weakness_or_gap ?? 'Unknown gap')}`;
    }),
    ``,
  ].join('\n');
}

function renderOpportunityOptionsMarkdown(output: Record<string, unknown>): string {
  const options = Array.isArray(output.opportunity_options)
    ? output.opportunity_options
    : [];
  const recommended = output.recommended_entry_point as
    | Record<string, unknown>
    | undefined;

  return [
    `# Opportunity Options`,
    ``,
    `Recommended entry point: ${String(recommended?.title ?? '')}`,
    `Rationale: ${String(recommended?.rationale ?? '')}`,
    ``,
    ...options.map((entry) => {
      const value = entry as Record<string, unknown>;
      return `- ${String(value.title ?? 'Unknown')} | ${String(value.product_shape ?? 'Unknown shape')} | ${String(value.core_pain ?? 'Unknown pain')}`;
    }),
    ``,
  ].join('\n');
}

function renderBusinessModelMarkdown(output: Record<string, unknown>): string {
  const models = readStringList(output.business_model_hypotheses);
  const assumptions = readStringList(output.key_assumptions);

  return [
    `# Business Model Hypotheses`,
    ``,
    ...models.map((model) => `- ${model}`),
    ``,
    `## Key Assumptions`,
    ...assumptions.map((assumption) => `- ${assumption}`),
    ``,
  ].join('\n');
}

function renderVcCriticMarkdown(output: Record<string, unknown>): string {
  const objections = readStringList(output.objections);
  const risks = readStringList(output.manageable_risks);
  const scoreBreakdown = Array.isArray(output.score_breakdown)
    ? output.score_breakdown
    : [];

  return [
    `# VC Critic Report`,
    ``,
    `Summary: ${String(output.summary ?? '')}`,
    `Recommendation: ${String(output.recommendation ?? '')}`,
    ``,
    `## Objections`,
    ...objections.map((objection) => `- ${objection}`),
    ``,
    `## Manageable Risks`,
    ...risks.map((risk) => `- ${risk}`),
    ``,
    `## Scores`,
    ...scoreBreakdown.map((entry) => {
      const value = entry as Record<string, unknown>;
      return `- ${String(value.dimension ?? 'Unknown')}: ${String(value.score ?? 'n/a')} (${String(value.rationale ?? '')})`;
    }),
    ``,
  ].join('\n');
}

function renderJudgeDecisionMarkdown(output: Record<string, unknown>): string {
  const tasks = Array.isArray(output.next_iteration_tasks)
    ? output.next_iteration_tasks
    : [];

  return [
    `# Judge Decision`,
    ``,
    `Decision: ${String(output.decision ?? '')}`,
    `Rationale: ${String(output.rationale ?? '')}`,
    `Termination warning: ${String(output.termination_warning ?? false)}`,
    ``,
    `## Next Iteration Tasks`,
    ...(tasks.length > 0
      ? tasks.map((entry) => {
          const value = entry as Record<string, unknown>;
          return `- ${String(value.target_agent ?? 'UNKNOWN')}: ${String(value.task_type ?? 'UNKNOWN')} - ${String(value.description ?? '')}`;
        })
      : ['- None']),
    ``,
  ].join('\n');
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function startWorkerHeartbeat(
  heartbeatPath: string,
  logger: StructuredLogger,
) {
  let interval: NodeJS.Timeout | undefined;
  let active = true;

  const writeHeartbeat = async () => {
    if (!active) {
      return;
    }

    const payload = {
      pid: process.pid,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(heartbeatPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  };

  void writeHeartbeat().catch((error) => {
    logger.error(
      'worker.heartbeat.write_failed',
      error instanceof Error ? error.message : String(error),
    );
  });
  interval = setInterval(() => {
    void writeHeartbeat().catch((error) => {
      logger.error(
        'worker.heartbeat.write_failed',
        error instanceof Error ? error.message : String(error),
      );
    });
  }, WORKER_HEARTBEAT_INTERVAL_MS);

  return {
    stop() {
      active = false;
      if (interval) {
        clearInterval(interval);
      }
    },
  };
}

function createRedisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  const databaseIndex =
    url.pathname.length > 1 ? Number.parseInt(url.pathname.slice(1), 10) : 0;

  return {
    host: url.hostname,
    port: Number.parseInt(url.port || '6379', 10),
    db: Number.isNaN(databaseIndex) ? 0 : databaseIndex,
    username: url.username || undefined,
    password: url.password || undefined,
  };
}

function registerSignalHandlers(cleanup: () => Promise<void>): void {
  let shuttingDown = false;

  const handleSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down worker.`);
    cleanup()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        console.error('Worker shutdown failed.', error);
        process.exit(1);
      });
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
}

function loadEnvironment(): EnvironmentLike {
  const cwd = process.cwd();

  return {
    ...process.env,
    ...loadDotEnv(resolve(cwd, '.env.example')),
    ...loadDotEnv(resolve(cwd, '.env')),
  };
}

function loadDotEnv(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function normalizeTimestamp(
  value: string,
  fallback: () => Date,
): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? fallback().toISOString()
    : parsed.toISOString();
}
