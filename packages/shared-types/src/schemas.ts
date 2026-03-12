import { z } from 'zod';

import { COMMON_BASE_SCORE_SCALE } from './common-base.js';
import {
  AGENT_NAMES,
  BROWSING_AUTONOMY_PROFILES,
  CASE_STATUSES,
  FAILURE_CATEGORIES,
  FOUNDER_VALUE_MEASUREMENT_SOURCES,
  JUDGE_DECISIONS,
  OVERRIDE_ACTIONS,
  type ResearchStyle,
  RESEARCH_STYLES,
  REJECTION_CATEGORIES,
} from './enums.js';
import { JudgeTaskSchema } from './judge-task.js';
import { isHighRiskHumanOverrideAction } from './override-approvals.js';

const TimestampSchema = z.string().min(1);
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const PortfolioEscalationMetadataSchema = z.record(
  z.string(),
  JsonValueSchema,
);

export type PortfolioEscalationMetadata = z.infer<
  typeof PortfolioEscalationMetadataSchema
>;

export const ResearchStyleSchema = z.enum(RESEARCH_STYLES);

export const BrowsingAutonomySchema = z.object({
  profile: z.enum(BROWSING_AUTONOMY_PROFILES),
  allowAdjacentExploration: z.boolean(),
  allowCompetitorExploration: z.boolean(),
  allowOpenEndedQueries: z.boolean(),
  maxSources: z.number().int().positive().max(20),
  recencyWindowDays: z.number().int().positive(),
});

export type BrowsingAutonomy = z.infer<typeof BrowsingAutonomySchema>;

export const BrowsingAutonomyInputSchema = z.object({
  profile: z.enum(BROWSING_AUTONOMY_PROFILES).optional(),
  allowAdjacentExploration: z.boolean().optional(),
  allowCompetitorExploration: z.boolean().optional(),
  allowOpenEndedQueries: z.boolean().optional(),
  maxSources: z.number().int().positive().max(20).optional(),
  recencyWindowDays: z.number().int().positive().optional(),
});

export type BrowsingAutonomyInput = z.infer<
  typeof BrowsingAutonomyInputSchema
>;

export const AgentRuntimeModeSchema = z.enum([
  'deterministic-local-runtime',
  'copilot-sdk',
]);

export type AgentRuntimeMode = z.infer<typeof AgentRuntimeModeSchema>;

export const CopilotModelSelectionSchema = z.object({
  modelId: z.string().trim().min(1).nullable().default(null),
  updatedAt: TimestampSchema,
  updatedBy: z.string().trim().min(1),
});

export type CopilotModelSelection = z.infer<
  typeof CopilotModelSelectionSchema
>;

export const DEFAULT_RESEARCH_STYLE: ResearchStyle = 'BALANCED';

export const BROWSING_AUTONOMY_PRESETS: Record<
  BrowsingAutonomy['profile'],
  BrowsingAutonomy
> = {
  RESTRICTED: {
    profile: 'RESTRICTED',
    allowAdjacentExploration: false,
    allowCompetitorExploration: false,
    allowOpenEndedQueries: false,
    maxSources: 3,
    recencyWindowDays: 30,
  },
  STANDARD: {
    profile: 'STANDARD',
    allowAdjacentExploration: false,
    allowCompetitorExploration: true,
    allowOpenEndedQueries: false,
    maxSources: 5,
    recencyWindowDays: 120,
  },
  EXPANDED: {
    profile: 'EXPANDED',
    allowAdjacentExploration: true,
    allowCompetitorExploration: true,
    allowOpenEndedQueries: true,
    maxSources: 8,
    recencyWindowDays: 365,
  },
};

export function createBrowsingAutonomySettings(
  input?: BrowsingAutonomyInput,
): BrowsingAutonomy {
  const profile = input?.profile ?? 'STANDARD';

  return BrowsingAutonomySchema.parse({
    ...BROWSING_AUTONOMY_PRESETS[profile],
    ...input,
    profile,
  });
}

const OpportunityCaseBaseSchema = z.object({
  caseId: z.string().min(1),
  topic: z.string().min(1),
  region: z.string().min(1).optional(),
  founderProfile: z.string().min(1).optional(),
  preferredBusinessModels: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([]),
  researchStyle: ResearchStyleSchema.optional(),
  browsingAutonomy: BrowsingAutonomySchema.optional(),
  status: z.enum(CASE_STATUSES),
  currentIteration: z.number().int().nonnegative(),
  maxIterations: z.number().int().positive(),
  approvedSourceIterationId: z.string().min(1).optional(),
  approvedSourceIterationNo: z.number().int().positive().optional(),
  finalDecision: z.enum(JUDGE_DECISIONS).optional(),
  failureCategory: z.enum(FAILURE_CATEGORIES).optional(),
  rejectionRationale: z.string().min(1).optional(),
  rejectionCategory: z.enum(REJECTION_CATEGORIES).optional(),
  portfolioEscalationMetadata: PortfolioEscalationMetadataSchema.default({}),
  manualReviewRequired: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).superRefine((value, context) => {
  const hasRejectionContext =
    value.status === 'REJECTED' ||
    value.finalDecision === 'REJECT' ||
    value.rejectionRationale !== undefined ||
    value.rejectionCategory !== undefined;

  if (!hasRejectionContext) {
    return;
  }

  if (value.rejectionRationale === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionRationale'],
      message: 'Rejected cases must persist a rejection rationale.',
    });
  }

  if (value.rejectionCategory === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionCategory'],
      message: 'Rejected cases must persist a rejection category.',
    });
  }
});

export const OpportunityCaseSchema = OpportunityCaseBaseSchema.superRefine(
  (value, context) => {
    const hasApprovedSourceIteration =
      value.approvedSourceIterationId !== undefined ||
      value.approvedSourceIterationNo !== undefined;

    if (
      hasApprovedSourceIteration &&
      (value.approvedSourceIterationId === undefined ||
        value.approvedSourceIterationNo === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['approvedSourceIterationId'],
        message:
          'Approved source iteration references must include both iteration id and iteration number.',
      });
    }
  },
);

export type OpportunityCase = z.infer<typeof OpportunityCaseSchema>;

export const IterationSchema = z.object({
  iterationId: z.string().min(1),
  caseId: z.string().min(1),
  iterationNo: z.number().int().positive(),
  statusAtStart: z.enum(CASE_STATUSES).optional(),
  statusAtEnd: z.enum(CASE_STATUSES).optional(),
  judgeDecision: z.enum(JUDGE_DECISIONS).optional(),
  agentOutputIds: z.array(z.string().min(1)).default([]),
  judgeTaskIds: z.array(z.string().min(1)).default([]),
  scoreDetailIds: z.array(z.string().min(1)).default([]),
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
});

export type Iteration = z.infer<typeof IterationSchema>;

export const AgentOutputSchema = z.object({
  agentOutputId: z.string().min(1),
  caseId: z.string().min(1),
  iterationId: z.string().min(1),
  iterationNo: z.number().int().positive(),
  agentName: z.enum(AGENT_NAMES),
  rawOutput: z.union([z.string(), JsonValueSchema]),
  normalizedOutput: z.record(z.string(), JsonValueSchema),
  validationErrors: z.array(z.string().min(1)).default([]),
  tokenUsage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    })
    .optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  createdAt: TimestampSchema,
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

export type StoredJudgeTask = z.infer<typeof JudgeTaskSchema>;
export const ScoreDetailSchema = z.object({
  scoreDetailId: z.string().min(1),
  caseId: z.string().min(1),
  iterationId: z.string().min(1),
  iterationNo: z.number().int().positive(),
  scoringAgent: z.enum(['VCCritic', 'Judge']),
  dimension: z.string().min(1),
  score: z
    .number()
    .min(COMMON_BASE_SCORE_SCALE.min)
    .max(COMMON_BASE_SCORE_SCALE.max),
  rationale: z.string().min(1).optional(),
});

export type ScoreDetail = z.infer<typeof ScoreDetailSchema>;

export const ApprovalSchema = z.object({
  approvalId: z.string().min(1),
  caseId: z.string().min(1),
  iterationId: z.string().min(1),
  requestedAction: z.enum(OVERRIDE_ACTIONS),
  status: z.string().min(1),
  requestedAt: TimestampSchema,
  resolvedAt: TimestampSchema.optional(),
  resolvedBy: z.string().min(1).optional(),
  metadata: z.record(z.string(), JsonValueSchema).default({}),
}).superRefine((value, context) => {
  if (
    value.status === 'RESOLVED' &&
    (value.resolvedAt === undefined || value.resolvedBy === undefined)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['resolvedAt'],
      message:
        'Resolved approval records must include both resolvedAt and resolvedBy.',
    });
  }

  if (
    isHighRiskHumanOverrideAction(value.requestedAction) &&
    value.metadata.riskLevel !== 'high'
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['metadata', 'riskLevel'],
      message: 'High-risk human override approvals must be marked as high risk.',
    });
  }
});

export type Approval = z.infer<typeof ApprovalSchema>;

export const AuditLogSchema = z.object({
  auditLogId: z.string().min(1),
  caseId: z.string().min(1),
  iterationId: z.string().min(1).optional(),
  iterationNo: z.number().int().positive().optional(),
  action: z.string().min(1),
  actor: z.string().min(1),
  metadata: z.record(z.string(), JsonValueSchema).default({}),
  createdAt: TimestampSchema,
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const FounderValueMeasurementSchema = z.object({
  measurementId: z.string().min(1),
  caseId: z.string().min(1),
  respondentType: z.enum(FOUNDER_VALUE_MEASUREMENT_SOURCES),
  actor: z.string().min(1),
  perceivedUsefulnessScore: z.number().int().min(1).max(5),
  confidenceIncreaseScore: z.number().int().min(1).max(5),
  manualResearchMinutesSaved: z.number().int().nonnegative(),
  notes: z.string().min(1).optional(),
  createdAt: TimestampSchema,
});

export type FounderValueMeasurement = z.infer<
  typeof FounderValueMeasurementSchema
>;

export const ApprovedBusinessSummaryArtifactSchema = z.object({
  caseId: z.string().min(1),
  approvedIterationNo: z.number().int().positive(),
  generatedAt: TimestampSchema,
  sourceOutputRefs: z.array(z.string().min(1)).default([]),
  summary: z.record(z.string(), JsonValueSchema),
});

export type ApprovedBusinessSummaryArtifact = z.infer<
  typeof ApprovedBusinessSummaryArtifactSchema
>;

export const ImplementationHandoffArtifactSchema = z.object({
  caseId: z.string().min(1),
  approvedIterationNo: z.number().int().positive(),
  generatedAt: TimestampSchema,
  sourceOutputRefs: z.array(z.string().min(1)).default([]),
  artifactRefs: z.object({
    approvedBusinessSummary: z.string().min(1),
    finalBusinessPlan: z.string().min(1),
    prd: z.string().min(1),
    pocSpec: z.string().min(1),
    codexExecutionPlan: z.string().min(1),
  }),
  implementationBrief: z.object({
    topic: z.string().min(1),
    marketProblemDefinition: z.string().min(1),
    targetUserSegments: z.array(z.string().min(1)),
    recommendedEntryPoint: z.string().min(1),
    productOverview: z.string().min(1),
    useCases: z.array(z.string().min(1)),
    mvpScope: z.array(z.string().min(1)),
    functionalRequirements: z.array(z.string().min(1)),
    nonFunctionalRequirements: z.array(z.string().min(1)),
    technicalArchitecture: z.array(z.string().min(1)),
    coreModules: z.array(z.string().min(1)),
    buildTasks: z.array(z.string().min(1)),
    mockVsReal: z.array(z.string().min(1)),
    successMetrics: z.array(z.string().min(1)),
    risks: z.array(z.string().min(1)),
    openQuestions: z.array(z.string().min(1)),
  }),
  codexExecutionPlan: z.object({
    starterPrompt: z.string().min(1),
    bootstrapTasks: z.array(z.string().min(1)),
    validationChecklist: z.array(z.string().min(1)),
  }),
});

export type ImplementationHandoffArtifact = z.infer<
  typeof ImplementationHandoffArtifactSchema
>;
