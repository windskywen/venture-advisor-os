import type {
  AgentName,
  ResearchStyle,
  CaseStatus,
  FailureCategory,
  FounderValueMeasurementSource,
  JudgeDecision,
  OverrideAction,
  RejectionCategory,
} from './enums.js';
import type { JudgeTaskDto } from './judge-task.js';
import type {
  AgentRuntimeMode,
  BrowsingAutonomy,
  BrowsingAutonomyInput,
  CopilotModelSelection,
  FounderValueMeasurement,
} from './schemas.js';

export interface CreateCaseRequestDto {
  topic: string;
  region?: string;
  founderProfile?: string;
  preferredBusinessModels?: string[];
  constraints?: string[];
  researchStyle?: ResearchStyle;
  browsingAutonomy?: BrowsingAutonomyInput;
}

export interface CreateCaseResponseDto {
  caseId: string;
  status: CaseStatus;
}

export interface StartCaseResponseDto {
  caseId: string;
  accepted: true;
  queuedJobId: string;
}

export interface CaseSummaryDto {
  caseId: string;
  topic: string;
  region?: string;
  founderProfile?: string;
  preferredBusinessModels: string[];
  constraints: string[];
  researchStyle?: ResearchStyle;
  browsingAutonomy?: BrowsingAutonomy;
  status: CaseStatus;
  currentIteration: number;
  maxIterations: number;
  approvedSourceIterationNo?: number;
  latestDecision?: JudgeDecision;
  finalDecision?: JudgeDecision;
  failureCategory?: FailureCategory;
  rejectionRationale?: string;
  rejectionCategory?: RejectionCategory;
  portfolioEscalationMetadata?: Record<string, unknown>;
  manualReviewRequired: boolean;
  hasPrd: boolean;
  hasPoc: boolean;
  nextSteps: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IterationSummaryDto {
  iterationNo: number;
  status: CaseStatus;
  judgeDecision?: JudgeDecision;
  nextTaskCount: number;
  startedAt?: string;
  completedAt?: string;
}

export interface GetCaseIterationsResponseDto {
  caseId: string;
  iterations: IterationSummaryDto[];
}

export type OutputArtifactKind =
  | 'normalized-output'
  | 'raw-output'
  | 'approved-business-summary'
  | 'business-plan'
  | 'prd'
  | 'poc'
  | 'handoff'
  | 'codex-execution-plan';

export interface OutputArtifactDto {
  name: string;
  path: string;
  kind: OutputArtifactKind;
}

export interface GetCaseOutputsResponseDto {
  caseId: string;
  latestNormalizedOutputs: Partial<Record<AgentName, Record<string, unknown>>>;
  fileRefs: OutputArtifactDto[];
}

export type ApproveCaseActionDto = Extract<
  OverrideAction,
  'FORCE_REVISE' | 'FORCE_PIVOT' | 'FORCE_PASS_TO_PRD'
>;

export interface ApproveCaseRequestDto {
  action: ApproveCaseActionDto;
  reason?: string;
}

export interface RejectCaseRequestDto {
  reason?: string;
  rejectionCategory?: RejectionCategory;
  portfolioEscalationMetadata?: Record<string, unknown>;
}

export interface CaseActionResponseDto {
  caseId: string;
  accepted: true;
  status: CaseStatus;
  queuedJobId?: string;
}

export type GeneratePrdResponseDto = CaseActionResponseDto;

export type GeneratePocResponseDto = CaseActionResponseDto;

export interface NextTopicResponseDto {
  case: CaseSummaryDto | null;
}

export type PortfolioPriorityBand =
  | 'fresh-actionable'
  | 'manual-review-failed'
  | 'active'
  | 'completed'
  | 'rejected';

export interface PortfolioCaseRankDto {
  rank: number;
  priorityBand: PortfolioPriorityBand;
  eligibleForNextTopic: boolean;
  case: CaseSummaryDto;
}

export interface PortfolioOverviewDto {
  generatedAt: string;
  nextTopicCaseId?: string;
  rankedCases: PortfolioCaseRankDto[];
  summary: {
    totalCases: number;
    nextTopicEligibleCount: number;
    byPriorityBand: Record<PortfolioPriorityBand, number>;
  };
}

export interface RecordFounderValueMeasurementRequestDto {
  respondentType?: FounderValueMeasurementSource;
  actor?: string;
  perceivedUsefulnessScore: number;
  confidenceIncreaseScore: number;
  manualResearchMinutesSaved: number;
  notes?: string;
}

export type RecordFounderValueMeasurementResponseDto = FounderValueMeasurement;

export interface ProductMetricsSnapshotDto {
  generatedAt: string;
  topicsReachingJudgeCompletion: number;
  prePrdRejectionRate: number;
  averageIterationsPerCase: number;
  passToPrdCompletionRate: number;
  passToPocCompletionRate: number;
  averageTimeToDecisionMs: number;
  schemaValidationSuccessRate: number;
  manualOverrideCount: number;
  stagnationDetectedCount: number;
  stagnationRejectedCount: number;
  targetedRerunRate: number;
}

export interface FounderValueMetricsSummaryDto {
  measurementCount: number;
  averagePerceivedUsefulnessScore: number;
  averageConfidenceIncreaseScore: number;
  averageManualResearchMinutesSaved: number;
  latestMeasurementAt?: string;
  byRespondentType: Record<FounderValueMeasurementSource, number>;
}

export interface OperatorMetricsReportDto {
  generatedAt: string;
  productMetrics: ProductMetricsSnapshotDto;
  founderValue: FounderValueMetricsSummaryDto;
}

export type OpportunityDecisionBucket = JudgeDecision | 'PENDING';

export interface OpportunityRankedCaseDto {
  caseId: string;
  topic: string;
  status: CaseStatus;
  latestDecision: OpportunityDecisionBucket;
  opportunityScore: number;
  vcScoreAverage: number;
  evidenceScoreAverage: number;
  founderValueScore: number;
  approvedForBuild: boolean;
  updatedAt: string;
}

export interface OpportunityRankingReportDto {
  generatedAt: string;
  rankedCases: OpportunityRankedCaseDto[];
  summary: {
    totalCases: number;
    averageOpportunityScore: number;
    approvedForBuildCount: number;
    topOpportunityCaseId?: string;
    byDecision: Record<OpportunityDecisionBucket, number>;
    byStatus: Partial<Record<CaseStatus, number>>;
  };
}

export interface RuntimeModelOptionDto {
  id: string;
  name: string;
  supportsReasoningEffort: boolean;
  defaultReasoningEffort?: string;
}

export interface RuntimeModelAuthStatusDto {
  isAuthenticated: boolean;
  authType?: string;
  login?: string;
  statusMessage?: string;
}

export interface GetRuntimeModelResponseDto {
  runtimeMode: AgentRuntimeMode;
  selection: CopilotModelSelection;
  auth: RuntimeModelAuthStatusDto;
  availableModels: RuntimeModelOptionDto[];
}

export interface UpdateRuntimeModelRequestDto {
  modelId?: string;
  updatedBy?: string;
}

export type UpdateRuntimeModelResponseDto = GetRuntimeModelResponseDto;

export type { JudgeTaskDto };
