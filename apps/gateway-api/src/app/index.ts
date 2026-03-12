import { randomUUID } from 'node:crypto';

import {
  assertPocGenerationAllowed,
  assertPrdGenerationAllowed,
  buildManualOverrideResolution,
} from '@venture-advisor-os/workflow-core';
import {
  type Approval,
  type AgentOutput,
  type ApproveCaseRequestDto,
  BrowsingAutonomyInputSchema,
  type BrowsingAutonomy,
  type BrowsingAutonomyInput,
  type CaseActionResponseDto,
  type CaseSummaryDto,
  type AuditLog,
  FounderValueMeasurementSchema,
  type FounderValueMeasurement,
  type GetCaseOutputsResponseDto,
  type GetCaseIterationsResponseDto,
  type Iteration,
  type NextTopicResponseDto,
  type OperatorMetricsReportDto,
  type OpportunityRankingReportDto,
  type OutputArtifactDto,
  type PortfolioCaseRankDto,
  type PortfolioOverviewDto,
  type JudgeTask,
  type RejectCaseRequestDto,
  type RecordFounderValueMeasurementRequestDto,
  type RecordFounderValueMeasurementResponseDto,
  OpportunityCaseSchema,
  loadWorkflowConfig,
  type CreateCaseRequestDto,
  type CreateCaseResponseDto,
  createBrowsingAutonomySettings,
  type OpportunityCase,
  type StartCaseResponseDto,
  type StructuredLogger,
  createNoopStructuredLogger,
  isHighRiskHumanOverrideAction,
  ResearchStyleSchema,
} from '@venture-advisor-os/shared-types';
import { z } from 'zod';

export const GATEWAY_API_APP_LAYER = '@venture-advisor-os/gateway-api/app';

const SAFE_CASE_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const TrimmedRequiredStringSchema = z.string().trim().min(1);
const TrimmedOptionalStringSchema = z.string().trim().min(1).optional();
const TrimmedStringArraySchema = z.array(z.string().trim().min(1)).optional();
const SafeCaseIdSchema = z
  .string()
  .trim()
  .regex(SAFE_CASE_ID_PATTERN, 'Case identifiers may only contain letters, numbers, underscores, and hyphens.');

const CreateCaseRequestSchema = z.object({
  topic: TrimmedRequiredStringSchema,
  region: TrimmedOptionalStringSchema,
  founderProfile: TrimmedOptionalStringSchema,
  preferredBusinessModels: TrimmedStringArraySchema,
  constraints: TrimmedStringArraySchema,
  researchStyle: ResearchStyleSchema.optional(),
  browsingAutonomy: BrowsingAutonomyInputSchema.optional(),
});
const ApproveCaseRequestSchema = z.object({
  action: z.enum(['FORCE_REVISE', 'FORCE_PIVOT', 'FORCE_PASS_TO_PRD']),
  reason: TrimmedOptionalStringSchema,
});
const RejectCaseRequestSchema = z.object({
  reason: TrimmedOptionalStringSchema,
  rejectionCategory: z
    .enum([
      'WEAK_MARKET',
      'WEAK_WILLINGNESS_TO_PAY',
      'WEAK_MOAT',
      'WEAK_GTM',
      'FOUNDER_MISMATCH',
      'EXCESSIVE_REGULATORY_BURDEN',
      'FEATURE_NOT_COMPANY',
      'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
    ])
    .optional(),
  portfolioEscalationMetadata: z.record(z.string(), z.unknown()).optional(),
});
const RecordFounderValueMeasurementRequestSchema = z.object({
  respondentType: z.enum(['OPERATOR', 'FOUNDER']).default('OPERATOR'),
  actor: TrimmedOptionalStringSchema,
  perceivedUsefulnessScore: z.number().int().min(1).max(5),
  confidenceIncreaseScore: z.number().int().min(1).max(5),
  manualResearchMinutesSaved: z.number().int().nonnegative(),
  notes: TrimmedOptionalStringSchema,
});
const PortfolioLimitSchema = z.number().int().positive().max(50).default(5);

export interface GatewayApiAppDependencies {
  repositories: {
    cases: {
      create(caseRecord: OpportunityCase): Promise<OpportunityCase>;
      getById(caseId: string): Promise<OpportunityCase | null>;
      getNextPendingCase(): Promise<OpportunityCase | null>;
      listAll?(): Promise<OpportunityCase[]>;
      update(caseRecord: OpportunityCase): Promise<OpportunityCase>;
    };
    iterations: {
      listByCaseId(caseId: string): Promise<Iteration[]>;
    };
    agentOutputs: {
      getLatestByCaseIdAndAgentName(
        caseId: string,
        agentName: AgentOutput['agentName'],
      ): Promise<AgentOutput | null>;
      getLatestNormalizedByCaseId(
        caseId: string,
      ): Promise<Partial<Record<AgentOutput['agentName'], Record<string, unknown>>>>;
    };
    judgeTasks: {
      listByIterationId(iterationId: string): Promise<JudgeTask[]>;
    };
    approvals: {
      create(approval: Approval): Promise<Approval>;
    };
    auditLogs: {
      create(auditLog: AuditLog): Promise<AuditLog>;
    };
    founderValueMeasurements?: {
      create(
        measurement: FounderValueMeasurement,
      ): Promise<FounderValueMeasurement>;
    };
  };
  artifactIndex: {
    listCaseArtifacts(caseId: string): Promise<OutputArtifactDto[]>;
    listLatestOutputArtifacts(
      caseId: string,
      latestIterationNo?: number | null,
    ): Promise<OutputArtifactDto[]>;
  };
  queues: {
    caseStart: {
      add(
        jobName: string,
        data: {
          caseId: string;
          requestedAt: string;
        },
      ): Promise<{
        id?: string | number | null;
      }>;
    };
    prdGeneration: {
      add(
        jobName: string,
        data: {
          caseId: string;
          approvedIterationNo: number;
        },
      ): Promise<{
        id?: string | number | null;
      }>;
    };
    pocGeneration: {
      add(
        jobName: string,
        data: {
          caseId: string;
          approvedIterationNo: number;
        },
      ): Promise<{
        id?: string | number | null;
      }>;
    };
  };
  now?: () => Date;
  workflowConfig?: ReturnType<typeof loadWorkflowConfig>;
  logger?: StructuredLogger;
  reporting?: {
    getOperatorMetricsReport(): Promise<OperatorMetricsReportDto>;
    getOpportunityRankingReport?(): Promise<OpportunityRankingReportDto>;
  };
}

export interface GatewayApiApp {
  createCase(request: CreateCaseRequestDto): Promise<CreateCaseResponseDto>;
  startCase(caseId: string): Promise<StartCaseResponseDto>;
  getCase(caseId: string): Promise<CaseSummaryDto>;
  getCaseIterations(caseId: string): Promise<GetCaseIterationsResponseDto>;
  getCaseOutputs(caseId: string): Promise<GetCaseOutputsResponseDto>;
  approveCase(
    caseId: string,
    request: ApproveCaseRequestDto,
  ): Promise<CaseActionResponseDto>;
  rejectCase(
    caseId: string,
    request: RejectCaseRequestDto,
  ): Promise<CaseActionResponseDto>;
  recordFounderValueMeasurement(
    caseId: string,
    request: RecordFounderValueMeasurementRequestDto,
  ): Promise<RecordFounderValueMeasurementResponseDto>;
  getOperatorMetricsReport(): Promise<OperatorMetricsReportDto>;
  getOpportunityRankingReport(): Promise<OpportunityRankingReportDto>;
  generatePrd(caseId: string): Promise<CaseActionResponseDto>;
  generatePoc(caseId: string): Promise<CaseActionResponseDto>;
  getNextTopic(): Promise<NextTopicResponseDto>;
  getPortfolio(limit?: number): Promise<PortfolioOverviewDto>;
}

export function createGatewayApiApp(
  dependencies: GatewayApiAppDependencies,
): GatewayApiApp {
  const now = dependencies.now ?? (() => new Date());
  const workflowConfig =
    dependencies.workflowConfig ?? loadWorkflowConfig(process.env);
  const logger = dependencies.logger ?? createNoopStructuredLogger();

  return {
    async createCase(request) {
      const parsedRequest = CreateCaseRequestSchema.parse(request);
      const timestamp = now().toISOString();
      const caseRecord = OpportunityCaseSchema.parse({
        caseId: randomUUID(),
        topic: parsedRequest.topic,
        region: parsedRequest.region,
        founderProfile: parsedRequest.founderProfile,
        preferredBusinessModels: parsedRequest.preferredBusinessModels ?? [],
        constraints: parsedRequest.constraints ?? [],
        researchStyle:
          parsedRequest.researchStyle ?? workflowConfig.research.defaultStyle,
        browsingAutonomy: resolveRequestedBrowsingAutonomy(
          parsedRequest.browsingAutonomy,
          workflowConfig,
        ),
        status: 'TOPIC_ACCEPTED',
        currentIteration: 0,
        maxIterations: workflowConfig.iterationBudget.standardTopicMaxIterations,
        manualReviewRequired: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const createdCase = await dependencies.repositories.cases.create(caseRecord);
      await dependencies.repositories.auditLogs.create({
        auditLogId: randomUUID(),
        caseId: createdCase.caseId,
        action: 'CASE_CREATED',
        actor: 'user',
        metadata: {
          status: createdCase.status,
          currentIteration: createdCase.currentIteration,
          maxIterations: createdCase.maxIterations,
        },
        createdAt: timestamp,
      });
      logger.child({
        caseId: createdCase.caseId,
      }).info('case.created', 'Created a new opportunity case.', {
        status: createdCase.status,
      });

      return {
        caseId: createdCase.caseId,
        status: createdCase.status,
      };
    },
    async startCase(caseId) {
      const normalizedCaseId = SafeCaseIdSchema.parse(caseId);
      const existingCase =
        await dependencies.repositories.cases.getById(normalizedCaseId);
      if (!existingCase) {
        throw new GatewayApiAppError(
          404,
          `Case ${normalizedCaseId} was not found.`,
        );
      }

      if (existingCase.status !== 'TOPIC_ACCEPTED') {
        throw new GatewayApiAppError(
          409,
          `Case ${normalizedCaseId} cannot be started from status ${existingCase.status}.`,
        );
      }

      const requestedAt = now().toISOString();
      const job = await dependencies.queues.caseStart.add('caseStart', {
        caseId: normalizedCaseId,
        requestedAt,
      });
      const jobId = String(job.id ?? randomUUID());
      await dependencies.repositories.auditLogs.create({
        auditLogId: randomUUID(),
        caseId: normalizedCaseId,
        action: 'CASE_START_REQUESTED',
        actor: 'user',
        metadata: {
          queuedJobId: jobId,
          requestedAt,
        },
        createdAt: requestedAt,
      });
      logger.child({
        caseId: normalizedCaseId,
        jobId,
      }).info(
        'case.start.enqueued',
        'Queued the first workflow execution for a case.',
        {
        },
      );

      return {
        caseId: normalizedCaseId,
        accepted: true,
        queuedJobId: jobId,
      };
    },
    async getCase(caseId) {
      return buildCaseSummary(SafeCaseIdSchema.parse(caseId));
    },
    async getCaseIterations(caseId) {
      const normalizedCaseId = SafeCaseIdSchema.parse(caseId);
      const caseRecord =
        await dependencies.repositories.cases.getById(normalizedCaseId);
      if (!caseRecord) {
        throw new GatewayApiAppError(
          404,
          `Case ${normalizedCaseId} was not found.`,
        );
      }

      const iterations = await dependencies.repositories.iterations.listByCaseId(
        normalizedCaseId,
      );
      const taskCounts = await Promise.all(
        iterations.map((iteration) =>
          dependencies.repositories.judgeTasks
            .listByIterationId(iteration.iterationId)
            .then((tasks) => ({
              iterationId: iteration.iterationId,
              count: tasks.length,
            })),
        ),
      );
      const taskCountByIterationId = new Map(
        taskCounts.map((entry) => [entry.iterationId, entry.count]),
      );

      return {
        caseId: normalizedCaseId,
        iterations: iterations.map((iteration) => ({
          iterationNo: iteration.iterationNo,
          status:
            iteration.statusAtEnd ?? iteration.statusAtStart ?? caseRecord.status,
          judgeDecision: iteration.judgeDecision,
          nextTaskCount:
            taskCountByIterationId.get(iteration.iterationId) ?? 0,
          startedAt: iteration.startedAt,
          completedAt: iteration.completedAt,
        })),
      };
    },
    async getCaseOutputs(caseId) {
      const normalizedCaseId = SafeCaseIdSchema.parse(caseId);
      const caseRecord =
        await dependencies.repositories.cases.getById(normalizedCaseId);
      if (!caseRecord) {
        throw new GatewayApiAppError(
          404,
          `Case ${normalizedCaseId} was not found.`,
        );
      }

      const [latestNormalizedOutputs, fileRefs] = await Promise.all([
        dependencies.repositories.agentOutputs.getLatestNormalizedByCaseId(
          normalizedCaseId,
        ),
        dependencies.artifactIndex.listLatestOutputArtifacts(
          normalizedCaseId,
          caseRecord.currentIteration > 0 ? caseRecord.currentIteration : null,
        ),
      ]);

      return {
        caseId: normalizedCaseId,
        latestNormalizedOutputs,
        fileRefs,
      };
    },
    async approveCase(caseId, request) {
      const normalizedCaseId = SafeCaseIdSchema.parse(caseId);
      const parsedRequest = ApproveCaseRequestSchema.parse(request);
      const caseRecord =
        await dependencies.repositories.cases.getById(normalizedCaseId);
      if (!caseRecord) {
        throw new GatewayApiAppError(
          404,
          `Case ${normalizedCaseId} was not found.`,
        );
      }

      const iterations = await dependencies.repositories.iterations.listByCaseId(
        normalizedCaseId,
      );
      const latestCompletedIteration = [...iterations]
        .filter((iteration) => iteration.completedAt !== undefined)
        .sort((left, right) => right.iterationNo - left.iterationNo)[0];
      if (!latestCompletedIteration) {
        throw new GatewayApiAppError(
          409,
          `Case ${normalizedCaseId} has no completed iteration available for override.`,
        );
      }

      const judgeTasks = await dependencies.repositories.judgeTasks.listByIterationId(
        latestCompletedIteration.iterationId,
      );
      const resolution = buildManualOverrideResolution({
        caseId: normalizedCaseId,
        currentStatus: caseRecord.status,
        action: parsedRequest.action,
        latestCompletedIteration: {
          iterationId: latestCompletedIteration.iterationId,
          iterationNo: latestCompletedIteration.iterationNo,
        },
        judgeTasks: judgeTasks.map((task) => ({
          taskType: task.taskType,
          targetAgent: task.targetAgent,
          description: task.description,
          blocking: task.blocking,
        })),
      });
      const timestamp = now().toISOString();
      const approvalRecord = buildManualOverrideApproval({
        caseId: normalizedCaseId,
        iterationId: latestCompletedIteration.iterationId,
        requestedAction: parsedRequest.action,
        timestamp,
        reason: parsedRequest.reason,
        metadata: resolution.auditMetadata,
      });

      if (isHighRiskHumanOverrideAction(parsedRequest.action)) {
        await dependencies.repositories.approvals.create(approvalRecord);
      }

      await dependencies.repositories.cases.update({
        ...caseRecord,
        status: resolution.nextStatus,
        finalDecision: resolution.finalDecision,
        manualReviewRequired: resolution.manualReviewRequired,
        approvedSourceIterationId:
          resolution.approvedSourceIterationId ?? caseRecord.approvedSourceIterationId,
        approvedSourceIterationNo:
          resolution.approvedSourceIterationNo ?? caseRecord.approvedSourceIterationNo,
        updatedAt: timestamp,
      });

      if (!isHighRiskHumanOverrideAction(parsedRequest.action)) {
        await dependencies.repositories.approvals.create(approvalRecord);
      }
      await dependencies.repositories.auditLogs.create({
        auditLogId: randomUUID(),
        caseId: normalizedCaseId,
        iterationId: latestCompletedIteration.iterationId,
        iterationNo: latestCompletedIteration.iterationNo,
        action: `MANUAL_OVERRIDE_${parsedRequest.action}`,
        actor: 'operator',
        metadata: {
          reason: parsedRequest.reason,
          ...resolution.auditMetadata,
        },
        createdAt: timestamp,
      });
      logger.child({
        caseId: normalizedCaseId,
        iterationId: latestCompletedIteration.iterationId,
      }).info(
        'case.override.applied',
        'Applied a manual override to a case.',
        {
          action: parsedRequest.action,
          status: resolution.nextStatus,
        },
      );

      return {
        caseId: normalizedCaseId,
        accepted: true,
        status: resolution.nextStatus,
      };
    },
    async rejectCase(caseId, request) {
      const normalizedCaseId = SafeCaseIdSchema.parse(caseId);
      const parsedRequest = RejectCaseRequestSchema.parse(request);
      const caseRecord =
        await dependencies.repositories.cases.getById(normalizedCaseId);
      if (!caseRecord) {
        throw new GatewayApiAppError(
          404,
          `Case ${normalizedCaseId} was not found.`,
        );
      }

      const iterations = await dependencies.repositories.iterations.listByCaseId(
        normalizedCaseId,
      );
      const latestCompletedIteration = [...iterations]
        .filter((iteration) => iteration.completedAt !== undefined)
        .sort((left, right) => right.iterationNo - left.iterationNo)[0];
      if (!latestCompletedIteration) {
        throw new GatewayApiAppError(
          409,
          `Case ${normalizedCaseId} has no completed iteration available for rejection override.`,
        );
      }

      const resolution = buildManualOverrideResolution({
        caseId: normalizedCaseId,
        currentStatus: caseRecord.status,
        action: 'FORCE_REJECT',
        latestCompletedIteration: {
          iterationId: latestCompletedIteration.iterationId,
          iterationNo: latestCompletedIteration.iterationNo,
        },
        rejectionRationale:
          parsedRequest.reason ?? 'Case closed manually by operator.',
        rejectionCategory:
          parsedRequest.rejectionCategory ??
          'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
        portfolioEscalationMetadata:
          parsedRequest.portfolioEscalationMetadata ?? {},
      });
      if (resolution.followUp.kind !== 'reject') {
        throw new Error('FORCE_REJECT must resolve to a reject follow-up.');
      }
      const timestamp = now().toISOString();
      const approvalRecord = buildManualOverrideApproval({
        caseId: normalizedCaseId,
        iterationId: latestCompletedIteration.iterationId,
        requestedAction: 'FORCE_REJECT',
        timestamp,
        reason: parsedRequest.reason,
        metadata: {
          rejectionCategory: resolution.followUp.rejectionCategory,
          portfolioEscalationMetadata:
            resolution.followUp.portfolioEscalationMetadata,
          ...resolution.auditMetadata,
        },
      });

      await dependencies.repositories.approvals.create(approvalRecord);

      await dependencies.repositories.cases.update({
        ...caseRecord,
        status: resolution.nextStatus,
        finalDecision: resolution.finalDecision,
        manualReviewRequired: resolution.manualReviewRequired,
        rejectionRationale: resolution.followUp.rejectionRationale,
        rejectionCategory: resolution.followUp.rejectionCategory,
        portfolioEscalationMetadata:
          resolution.followUp.portfolioEscalationMetadata,
        updatedAt: timestamp,
      });

      await dependencies.repositories.auditLogs.create({
        auditLogId: randomUUID(),
        caseId: normalizedCaseId,
        iterationId: latestCompletedIteration.iterationId,
        iterationNo: latestCompletedIteration.iterationNo,
        action: 'MANUAL_OVERRIDE_FORCE_REJECT',
        actor: 'operator',
        metadata: {
          reason: parsedRequest.reason,
          rejectionCategory: resolution.followUp.rejectionCategory,
          portfolioEscalationMetadata:
            resolution.followUp.portfolioEscalationMetadata,
          ...resolution.auditMetadata,
        },
        createdAt: timestamp,
      });
      logger.child({
        caseId: normalizedCaseId,
        iterationId: latestCompletedIteration.iterationId,
      }).info(
        'case.override.applied',
        'Applied a manual rejection override to a case.',
        {
          action: 'FORCE_REJECT',
          status: resolution.nextStatus,
        },
      );

      return {
        caseId: normalizedCaseId,
        accepted: true,
        status: resolution.nextStatus,
      };
    },
    async recordFounderValueMeasurement(caseId, request) {
      const normalizedCaseId = SafeCaseIdSchema.parse(caseId);
      const parsedRequest =
        RecordFounderValueMeasurementRequestSchema.parse(request);
      const caseRecord =
        await dependencies.repositories.cases.getById(normalizedCaseId);
      if (!caseRecord) {
        throw new GatewayApiAppError(
          404,
          `Case ${normalizedCaseId} was not found.`,
        );
      }

      const repository = dependencies.repositories.founderValueMeasurements;
      if (!repository) {
        throw new GatewayApiAppError(
          500,
          'Founder value measurement repository is not configured.',
        );
      }

      const timestamp = now().toISOString();
      const measurement = FounderValueMeasurementSchema.parse({
        measurementId: randomUUID(),
        caseId: normalizedCaseId,
        respondentType: parsedRequest.respondentType,
        actor: parsedRequest.actor ?? 'operator',
        perceivedUsefulnessScore: parsedRequest.perceivedUsefulnessScore,
        confidenceIncreaseScore: parsedRequest.confidenceIncreaseScore,
        manualResearchMinutesSaved: parsedRequest.manualResearchMinutesSaved,
        notes: parsedRequest.notes,
        createdAt: timestamp,
      });

      const createdMeasurement = await repository.create(measurement);
      await dependencies.repositories.auditLogs.create({
        auditLogId: randomUUID(),
        caseId: normalizedCaseId,
        action: 'FOUNDER_VALUE_MEASUREMENT_RECORDED',
        actor: createdMeasurement.actor,
        metadata: {
          measurementId: createdMeasurement.measurementId,
          respondentType: createdMeasurement.respondentType,
          perceivedUsefulnessScore: createdMeasurement.perceivedUsefulnessScore,
          confidenceIncreaseScore: createdMeasurement.confidenceIncreaseScore,
          manualResearchMinutesSaved:
            createdMeasurement.manualResearchMinutesSaved,
        },
        createdAt: timestamp,
      });
      logger.child({
        caseId: normalizedCaseId,
      }).info(
        'founder.value.recorded',
        'Recorded a founder-value measurement for a case.',
        {
          respondentType: createdMeasurement.respondentType,
          perceivedUsefulnessScore:
            createdMeasurement.perceivedUsefulnessScore,
          confidenceIncreaseScore:
            createdMeasurement.confidenceIncreaseScore,
          manualResearchMinutesSaved:
            createdMeasurement.manualResearchMinutesSaved,
        },
      );

      return createdMeasurement;
    },
    async generatePrd(caseId) {
      const normalizedCaseId = SafeCaseIdSchema.parse(caseId);
      const caseRecord =
        await dependencies.repositories.cases.getById(normalizedCaseId);
      if (!caseRecord) {
        throw new GatewayApiAppError(
          404,
          `Case ${normalizedCaseId} was not found.`,
        );
      }

      const [latestJudgeOutput, artifacts] = await Promise.all([
        dependencies.repositories.agentOutputs.getLatestByCaseIdAndAgentName(
          normalizedCaseId,
          'Judge',
        ),
        dependencies.artifactIndex.listCaseArtifacts(normalizedCaseId),
      ]);
      const latestJudgeDecision = resolveLatestDecision(caseRecord, latestJudgeOutput);
      const artifactKinds = new Set(artifacts.map((artifact) => artifact.kind));

      try {
        assertPrdGenerationAllowed({
          currentStatus: caseRecord.status,
          latestJudgeDecision: latestJudgeDecision ?? 'REJECT',
          hasExistingPrd: artifactKinds.has('prd'),
        });
      } catch (error) {
        throw new GatewayApiAppError(
          409,
          error instanceof Error ? error.message : String(error),
        );
      }

      const approvedIterationNo =
        caseRecord.approvedSourceIterationNo ?? caseRecord.currentIteration;
      if (approvedIterationNo <= 0) {
        throw new GatewayApiAppError(
          409,
          `Case ${normalizedCaseId} does not have an approved iteration available for PRD generation.`,
        );
      }

      const timestamp = now().toISOString();
      const job = await dependencies.queues.prdGeneration.add('prdGeneration', {
        caseId: normalizedCaseId,
        approvedIterationNo,
      });
      const jobId = String(job.id ?? randomUUID());

      await dependencies.repositories.cases.update({
        ...caseRecord,
        status: 'PRD_IN_PROGRESS',
        updatedAt: timestamp,
      });
      await dependencies.repositories.auditLogs.create({
        auditLogId: randomUUID(),
        caseId: normalizedCaseId,
        iterationId: caseRecord.approvedSourceIterationId,
        iterationNo: caseRecord.approvedSourceIterationNo,
        action: 'GENERATE_PRD_REQUESTED',
        actor: 'system',
        metadata: {
          approvedIterationNo,
          queuedJobId: jobId,
        },
        createdAt: timestamp,
      });
      logger.child({
        caseId: normalizedCaseId,
        iterationId: caseRecord.approvedSourceIterationId,
        jobId,
      }).info(
        'prd.generation.enqueued',
        'Queued PRD generation for an approved case.',
        {
          approvedIterationNo,
        },
      );

      return {
        caseId: normalizedCaseId,
        accepted: true,
        status: 'PRD_IN_PROGRESS',
        queuedJobId: jobId,
      };
    },
    async generatePoc(caseId) {
      const normalizedCaseId = SafeCaseIdSchema.parse(caseId);
      const caseRecord =
        await dependencies.repositories.cases.getById(normalizedCaseId);
      if (!caseRecord) {
        throw new GatewayApiAppError(
          404,
          `Case ${normalizedCaseId} was not found.`,
        );
      }

      const [latestJudgeOutput, artifacts] = await Promise.all([
        dependencies.repositories.agentOutputs.getLatestByCaseIdAndAgentName(
          normalizedCaseId,
          'Judge',
        ),
        dependencies.artifactIndex.listCaseArtifacts(normalizedCaseId),
      ]);
      const latestJudgeDecision = resolveLatestDecision(caseRecord, latestJudgeOutput);
      const artifactKinds = new Set(artifacts.map((artifact) => artifact.kind));

      try {
        assertPocGenerationAllowed({
          currentStatus: caseRecord.status,
          latestJudgeDecision: latestJudgeDecision ?? 'REJECT',
          hasPrd: artifactKinds.has('prd'),
          hasExistingPoc: artifactKinds.has('poc'),
        });
      } catch (error) {
        throw new GatewayApiAppError(
          409,
          error instanceof Error ? error.message : String(error),
        );
      }

      const approvedIterationNo =
        caseRecord.approvedSourceIterationNo ?? caseRecord.currentIteration;
      if (approvedIterationNo <= 0) {
        throw new GatewayApiAppError(
          409,
          `Case ${normalizedCaseId} does not have an approved iteration available for POC generation.`,
        );
      }

      const timestamp = now().toISOString();
      const job = await dependencies.queues.pocGeneration.add('pocGeneration', {
        caseId: normalizedCaseId,
        approvedIterationNo,
      });
      const jobId = String(job.id ?? randomUUID());

      await dependencies.repositories.cases.update({
        ...caseRecord,
        status: 'POC_IN_PROGRESS',
        updatedAt: timestamp,
      });
      await dependencies.repositories.auditLogs.create({
        auditLogId: randomUUID(),
        caseId: normalizedCaseId,
        iterationId: caseRecord.approvedSourceIterationId,
        iterationNo: caseRecord.approvedSourceIterationNo,
        action: 'GENERATE_POC_REQUESTED',
        actor: 'system',
        metadata: {
          approvedIterationNo,
          queuedJobId: jobId,
        },
        createdAt: timestamp,
      });
      logger.child({
        caseId: normalizedCaseId,
        iterationId: caseRecord.approvedSourceIterationId,
        jobId,
      }).info(
        'poc.generation.enqueued',
        'Queued POC generation for an approved case.',
        {
          approvedIterationNo,
        },
      );

      return {
        caseId: normalizedCaseId,
        accepted: true,
        status: 'POC_IN_PROGRESS',
        queuedJobId: jobId,
      };
    },
    async getOperatorMetricsReport() {
      if (!dependencies.reporting) {
        throw new GatewayApiAppError(
          500,
          'Operator metrics reporting is not configured.',
        );
      }

      return dependencies.reporting.getOperatorMetricsReport();
    },
    async getOpportunityRankingReport() {
      if (!dependencies.reporting?.getOpportunityRankingReport) {
        throw new GatewayApiAppError(
          500,
          'Opportunity ranking reporting is not configured.',
        );
      }

      return dependencies.reporting.getOpportunityRankingReport();
    },
    async getNextTopic() {
      const nextCase = await dependencies.repositories.cases.getNextPendingCase();
      if (!nextCase) {
        logger.info(
          'next-topic.selected',
          'No pending case is available for next-topic selection.',
        );
        return {
          case: null,
        };
      }

      logger.child({
        caseId: nextCase.caseId,
      }).info(
        'next-topic.selected',
        'Selected the next pending case.',
        {
          status: nextCase.status,
        },
      );

      return {
        case: await buildCaseSummary(nextCase.caseId),
      };
    },
    async getPortfolio(limit) {
      const listAllCases = dependencies.repositories.cases.listAll;
      if (!listAllCases) {
        throw new GatewayApiAppError(
          500,
          'Portfolio case listing is not configured.',
        );
      }

      const caseRecords = await listAllCases();
      const normalizedLimit = PortfolioLimitSchema.parse(limit ?? 5);
      const rankedCaseRecords = [...caseRecords].sort(comparePortfolioCases);
      const rankedCases = await Promise.all(
        rankedCaseRecords.slice(0, normalizedLimit).map(async (caseRecord, index) => ({
          rank: index + 1,
          priorityBand: resolvePortfolioPriorityBand(caseRecord),
          eligibleForNextTopic: isNextTopicEligible(caseRecord),
          case: await buildCaseSummary(caseRecord.caseId),
        })),
      );

      return {
        generatedAt: now().toISOString(),
        nextTopicCaseId: rankedCaseRecords.find(isNextTopicEligible)?.caseId,
        rankedCases,
        summary: {
          totalCases: caseRecords.length,
          nextTopicEligibleCount: caseRecords.filter(isNextTopicEligible).length,
          byPriorityBand: summarizePortfolioPriorityBands(caseRecords),
        },
      };
    },
  };

  async function buildCaseSummary(caseId: string): Promise<CaseSummaryDto> {
    const caseRecord = await dependencies.repositories.cases.getById(caseId);
    if (!caseRecord) {
      throw new GatewayApiAppError(404, `Case ${caseId} was not found.`);
    }

    const [latestJudgeOutput, artifacts] = await Promise.all([
      dependencies.repositories.agentOutputs.getLatestByCaseIdAndAgentName(
        caseId,
        'Judge',
      ),
      dependencies.artifactIndex.listCaseArtifacts(caseId),
    ]);
    const latestDecision = resolveLatestDecision(caseRecord, latestJudgeOutput);
    const artifactKinds = new Set(artifacts.map((artifact) => artifact.kind));

    return {
      caseId: caseRecord.caseId,
      topic: caseRecord.topic,
      region: caseRecord.region,
      founderProfile: caseRecord.founderProfile,
      preferredBusinessModels: caseRecord.preferredBusinessModels,
      constraints: caseRecord.constraints,
      researchStyle: caseRecord.researchStyle,
      browsingAutonomy: caseRecord.browsingAutonomy,
      status: caseRecord.status,
      currentIteration: caseRecord.currentIteration,
      maxIterations: caseRecord.maxIterations,
      approvedSourceIterationNo: caseRecord.approvedSourceIterationNo,
      latestDecision,
      finalDecision: caseRecord.finalDecision,
      failureCategory: caseRecord.failureCategory,
      rejectionRationale: caseRecord.rejectionRationale,
      rejectionCategory: caseRecord.rejectionCategory,
      portfolioEscalationMetadata: caseRecord.portfolioEscalationMetadata,
      manualReviewRequired: caseRecord.manualReviewRequired,
      hasPrd: artifactKinds.has('prd'),
      hasPoc: artifactKinds.has('poc'),
      nextSteps: buildNextSteps(caseRecord.status, {
        manualReviewRequired: caseRecord.manualReviewRequired,
        hasPrd: artifactKinds.has('prd'),
        hasPoc: artifactKinds.has('poc'),
      }),
      createdAt: caseRecord.createdAt,
      updatedAt: caseRecord.updatedAt,
    };
  }
}

function isNextTopicEligible(caseRecord: OpportunityCase): boolean {
  return (
    caseRecord.status === 'TOPIC_ACCEPTED' ||
    caseRecord.status === 'REVISE_REQUIRED' ||
    caseRecord.status === 'PIVOT_REQUIRED' ||
    (caseRecord.status === 'FAILED' && caseRecord.manualReviewRequired === true)
  );
}

function resolvePortfolioPriorityBand(
  caseRecord: OpportunityCase,
): PortfolioCaseRankDto['priorityBand'] {
  if (
    caseRecord.status === 'TOPIC_ACCEPTED' ||
    caseRecord.status === 'REVISE_REQUIRED' ||
    caseRecord.status === 'PIVOT_REQUIRED'
  ) {
    return 'fresh-actionable';
  }

  if (caseRecord.status === 'FAILED' && caseRecord.manualReviewRequired) {
    return 'manual-review-failed';
  }

  if (caseRecord.status === 'REJECTED') {
    return 'rejected';
  }

  if (caseRecord.status === 'COMPLETED') {
    return 'completed';
  }

  return 'active';
}

function comparePortfolioCases(
  left: OpportunityCase,
  right: OpportunityCase,
): number {
  const leftBand = resolvePortfolioPriorityBand(left);
  const rightBand = resolvePortfolioPriorityBand(right);
  const bandOrder: Record<PortfolioCaseRankDto['priorityBand'], number> = {
    'fresh-actionable': 0,
    'manual-review-failed': 1,
    active: 2,
    completed: 3,
    rejected: 4,
  };

  if (bandOrder[leftBand] !== bandOrder[rightBand]) {
    return bandOrder[leftBand] - bandOrder[rightBand];
  }

  if (
    leftBand === 'fresh-actionable' ||
    leftBand === 'manual-review-failed'
  ) {
    return (
      left.createdAt.localeCompare(right.createdAt) ||
      left.caseId.localeCompare(right.caseId)
    );
  }

  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.caseId.localeCompare(right.caseId)
  );
}

function summarizePortfolioPriorityBands(
  caseRecords: readonly OpportunityCase[],
): PortfolioOverviewDto['summary']['byPriorityBand'] {
  const counts: PortfolioOverviewDto['summary']['byPriorityBand'] = {
    'fresh-actionable': 0,
    'manual-review-failed': 0,
    active: 0,
    completed: 0,
    rejected: 0,
  };

  for (const caseRecord of caseRecords) {
    counts[resolvePortfolioPriorityBand(caseRecord)] += 1;
  }

  return counts;
}

function resolveRequestedBrowsingAutonomy(
  requested: BrowsingAutonomyInput | undefined,
  workflowConfig: ReturnType<typeof loadWorkflowConfig>,
): BrowsingAutonomy {
  const defaults = createBrowsingAutonomySettings({
    profile: workflowConfig.browsingAutonomy.defaultProfile,
    allowAdjacentExploration:
      workflowConfig.browsingAutonomy.allowAdjacentExploration,
    allowCompetitorExploration:
      workflowConfig.browsingAutonomy.allowCompetitorExploration,
    allowOpenEndedQueries:
      workflowConfig.browsingAutonomy.allowOpenEndedQueries,
    maxSources: workflowConfig.browsingAutonomy.maxSourcesPerQuery,
    recencyWindowDays: workflowConfig.browsingAutonomy.recencyWindowDays,
  });

  return createBrowsingAutonomySettings({
    ...defaults,
    ...requested,
    profile: requested?.profile ?? defaults.profile,
    allowAdjacentExploration:
      (requested?.allowAdjacentExploration ??
        defaults.allowAdjacentExploration) &&
      workflowConfig.browsingAutonomy.allowAdjacentExploration,
    allowCompetitorExploration:
      (requested?.allowCompetitorExploration ??
        defaults.allowCompetitorExploration) &&
      workflowConfig.browsingAutonomy.allowCompetitorExploration,
    allowOpenEndedQueries:
      (requested?.allowOpenEndedQueries ?? defaults.allowOpenEndedQueries) &&
      workflowConfig.browsingAutonomy.allowOpenEndedQueries,
    maxSources: Math.min(
      requested?.maxSources ?? defaults.maxSources,
      workflowConfig.browsingAutonomy.maxSourcesPerQuery,
    ),
    recencyWindowDays: Math.min(
      requested?.recencyWindowDays ?? defaults.recencyWindowDays,
      workflowConfig.browsingAutonomy.recencyWindowDays,
    ),
  });
}

export class GatewayApiAppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function resolveLatestDecision(
  caseRecord: OpportunityCase,
  latestJudgeOutput: AgentOutput | null,
): CaseSummaryDto['latestDecision'] {
  const normalizedDecision = latestJudgeOutput?.normalizedOutput.decision;
  if (
    normalizedDecision === 'PASS' ||
    normalizedDecision === 'REVISE' ||
    normalizedDecision === 'PIVOT' ||
    normalizedDecision === 'REJECT'
  ) {
    return normalizedDecision;
  }

  return caseRecord.finalDecision;
}

function buildNextSteps(
  status: OpportunityCase['status'],
  context: {
    manualReviewRequired: boolean;
    hasPrd: boolean;
    hasPoc: boolean;
  },
): string[] {
  switch (status) {
    case 'TOPIC_ACCEPTED':
      return ['Start the case to enqueue the first A -> B -> C -> J iteration.'];
    case 'REVISE_REQUIRED':
      return ['Review Judge feedback and restart the targeted revise workflow.'];
    case 'PIVOT_REQUIRED':
      return ['Review Judge feedback and restart the pivot workflow.'];
    case 'APPROVED_FOR_PRD':
      return context.hasPrd
        ? ['Generate the POC once the PRD is reviewed and ready.']
        : ['Generate the PRD from the approved iteration.'];
    case 'PRD_IN_PROGRESS':
      return context.hasPrd
        ? ['Generate the POC after confirming the PRD output.']
        : ['Wait for PRD generation to complete.'];
    case 'POC_IN_PROGRESS':
      return context.hasPoc
        ? ['Review the generated POC specification.']
        : ['Wait for POC generation to complete.'];
    case 'FAILED':
      return context.manualReviewRequired
        ? ['Manual review is required before the case can proceed.']
        : ['Investigate the failure before retrying this case.'];
    case 'REJECTED':
      return ['Case is closed. Review the rejection rationale and move to the next topic.'];
    case 'COMPLETED':
      return ['Review the final artifacts and implementation handoff outputs.'];
    default:
      return ['Monitor workflow progress or query outputs for more detail.'];
  }
}

function buildManualOverrideApproval(input: {
  caseId: string;
  iterationId: string;
  requestedAction: Approval['requestedAction'];
  timestamp: string;
  reason?: string;
  metadata: Record<string, unknown>;
}): Approval {
  return {
    approvalId: randomUUID(),
    caseId: input.caseId,
    iterationId: input.iterationId,
    requestedAction: input.requestedAction,
    status: 'RESOLVED',
    requestedAt: input.timestamp,
    resolvedAt: input.timestamp,
    resolvedBy: 'operator',
    metadata: {
      reason: input.reason,
      approvalRecordRequired: isHighRiskHumanOverrideAction(
        input.requestedAction,
      ),
      ...input.metadata,
    },
  };
}
