import type {
  AgentOutput,
  CaseStatus,
  FounderValueMeasurement,
  OpportunityCase,
  OpportunityDecisionBucket,
  OpportunityRankedCaseDto,
  OpportunityRankingReportDto,
} from '@venture-advisor-os/shared-types';

export interface OpportunityRankingReportRepositories {
  cases: {
    listAll(): Promise<OpportunityCase[]>;
  };
  agentOutputs: {
    listAll(): Promise<AgentOutput[]>;
  };
  founderValueMeasurements: {
    listAll(): Promise<FounderValueMeasurement[]>;
  };
}

export interface OpportunityRankingReportServiceDependencies {
  repositories: OpportunityRankingReportRepositories;
  now?: () => Date;
}

export interface OpportunityRankingReportService {
  collect(): Promise<OpportunityRankingReportDto>;
}

export function createOpportunityRankingReportService(
  dependencies: OpportunityRankingReportServiceDependencies,
): OpportunityRankingReportService {
  const now = dependencies.now ?? (() => new Date());

  return {
    async collect() {
      const [cases, agentOutputs, founderValueMeasurements] = await Promise.all([
        dependencies.repositories.cases.listAll(),
        dependencies.repositories.agentOutputs.listAll(),
        dependencies.repositories.founderValueMeasurements.listAll(),
      ]);

      const rankedCases = cases
        .map((caseRecord) =>
          buildRankedCase(caseRecord, agentOutputs, founderValueMeasurements),
        )
        .sort(compareRankedCases);

      return {
        generatedAt: now().toISOString(),
        rankedCases,
        summary: {
          totalCases: rankedCases.length,
          averageOpportunityScore: average(
            rankedCases.map((rankedCase) => rankedCase.opportunityScore),
          ),
          approvedForBuildCount: rankedCases.filter(
            (rankedCase) => rankedCase.approvedForBuild,
          ).length,
          topOpportunityCaseId: rankedCases[0]?.caseId,
          byDecision: summarizeByDecision(rankedCases),
          byStatus: summarizeByStatus(rankedCases),
        },
      };
    },
  };
}

function buildRankedCase(
  caseRecord: OpportunityCase,
  agentOutputs: readonly AgentOutput[],
  founderValueMeasurements: readonly FounderValueMeasurement[],
): OpportunityRankedCaseDto {
  const latestJudgeOutput = findLatestAgentOutput(
    agentOutputs,
    caseRecord.caseId,
    'Judge',
  );
  const latestVcCriticOutput = findLatestAgentOutput(
    agentOutputs,
    caseRecord.caseId,
    'VCCritic',
  );
  const latestDecision = resolveLatestDecision(caseRecord, latestJudgeOutput);
  const vcScoreAverage = resolveVcScoreAverage(latestVcCriticOutput);
  const evidenceScoreAverage = resolveEvidenceScoreAverage(latestJudgeOutput);
  const founderValueScore = resolveFounderValueScore(
    founderValueMeasurements,
    caseRecord.caseId,
  );
  const approvedForBuild = isApprovedForBuild(caseRecord.status);
  const opportunityScore = clampOpportunityScore(
    resolveDecisionBaseScore(latestDecision) +
      vcScoreAverage * 2 +
      evidenceScoreAverage * 2 +
      founderValueScore * 2 +
      (approvedForBuild ? 10 : 0),
  );

  return {
    caseId: caseRecord.caseId,
    topic: caseRecord.topic,
    status: caseRecord.status,
    latestDecision,
    opportunityScore,
    vcScoreAverage,
    evidenceScoreAverage,
    founderValueScore,
    approvedForBuild,
    updatedAt: caseRecord.updatedAt,
  };
}

function findLatestAgentOutput(
  agentOutputs: readonly AgentOutput[],
  caseId: string,
  agentName: AgentOutput['agentName'],
): AgentOutput | undefined {
  return [...agentOutputs]
    .filter(
      (agentOutput) =>
        agentOutput.caseId === caseId && agentOutput.agentName === agentName,
    )
    .sort(
      (left, right) =>
        left.iterationNo - right.iterationNo ||
        left.createdAt.localeCompare(right.createdAt),
    )
    .at(-1);
}

function resolveLatestDecision(
  caseRecord: OpportunityCase,
  latestJudgeOutput?: AgentOutput,
): OpportunityDecisionBucket {
  const decision = latestJudgeOutput?.normalizedOutput.decision;
  if (
    decision === 'PASS' ||
    decision === 'REVISE' ||
    decision === 'PIVOT' ||
    decision === 'REJECT'
  ) {
    return decision;
  }

  return caseRecord.finalDecision ?? 'PENDING';
}

function resolveVcScoreAverage(latestVcCriticOutput?: AgentOutput): number {
  const scoreBreakdown =
    latestVcCriticOutput?.normalizedOutput.score_breakdown;
  if (!Array.isArray(scoreBreakdown)) {
    return 0;
  }

  const scores = scoreBreakdown
    .map((entry) =>
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { score?: unknown }).score === 'number'
        ? (entry as { score: number }).score
        : undefined,
    )
    .filter((score): score is number => score !== undefined);

  return average(scores);
}

function resolveEvidenceScoreAverage(latestJudgeOutput?: AgentOutput): number {
  const evidenceAssessment =
    latestJudgeOutput?.normalizedOutput.evidence_assessment;
  if (!evidenceAssessment || typeof evidenceAssessment !== 'object') {
    return 0;
  }

  const scores = ['completeness', 'freshness', 'confidence']
    .map((key) => (evidenceAssessment as Record<string, unknown>)[key])
    .filter((score): score is number => typeof score === 'number');

  return average(scores);
}

function resolveFounderValueScore(
  founderValueMeasurements: readonly FounderValueMeasurement[],
  caseId: string,
): number {
  const measurements = founderValueMeasurements.filter(
    (measurement) => measurement.caseId === caseId,
  );

  return average(
    measurements.map((measurement) => measurement.perceivedUsefulnessScore),
  );
}

function isApprovedForBuild(status: CaseStatus): boolean {
  return (
    status === 'APPROVED_FOR_PRD' ||
    status === 'PRD_IN_PROGRESS' ||
    status === 'POC_IN_PROGRESS' ||
    status === 'COMPLETED'
  );
}

function resolveDecisionBaseScore(
  latestDecision: OpportunityDecisionBucket,
): number {
  switch (latestDecision) {
    case 'PASS':
      return 70;
    case 'REVISE':
      return 45;
    case 'PIVOT':
      return 40;
    case 'REJECT':
      return 10;
    case 'PENDING':
    default:
      return 20;
  }
}

function clampOpportunityScore(score: number): number {
  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

function compareRankedCases(
  left: OpportunityRankedCaseDto,
  right: OpportunityRankedCaseDto,
): number {
  return (
    right.opportunityScore - left.opportunityScore ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.caseId.localeCompare(right.caseId)
  );
}

function summarizeByDecision(
  rankedCases: readonly OpportunityRankedCaseDto[],
): Record<OpportunityDecisionBucket, number> {
  const counts: Record<OpportunityDecisionBucket, number> = {
    PASS: 0,
    REVISE: 0,
    PIVOT: 0,
    REJECT: 0,
    PENDING: 0,
  };

  for (const rankedCase of rankedCases) {
    counts[rankedCase.latestDecision] += 1;
  }

  return counts;
}

function summarizeByStatus(
  rankedCases: readonly OpportunityRankedCaseDto[],
): Partial<Record<CaseStatus, number>> {
  return rankedCases.reduce<Partial<Record<CaseStatus, number>>>(
    (counts, rankedCase) => {
      counts[rankedCase.status] = (counts[rankedCase.status] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return Number((sum / values.length).toFixed(2));
}
