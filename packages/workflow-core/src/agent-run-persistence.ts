import {
  JudgeOutputSchema,
  type AgentName,
  type AgentOutput,
  type ScoreDetail,
  VcCriticOutputSchema,
  type StructuredLogger,
  createNoopStructuredLogger,
} from '@venture-advisor-os/shared-types';

export interface AgentRunPersistenceRepositories {
  agentOutputs: {
    create(agentOutput: AgentOutput): Promise<AgentOutput>;
  };
  scoreDetails: {
    insertMany(scoreDetails: readonly ScoreDetail[]): Promise<ScoreDetail[]>;
  };
}

export interface PersistAgentRunInput {
  agentOutputId: string;
  caseId: string;
  iterationId: string;
  iterationNo: number;
  agentName: AgentName;
  rawOutput: string | Record<string, unknown>;
  normalizedOutput: Record<string, unknown>;
  validationErrors?: string[];
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
  createdAt: string;
}

export interface PersistedAgentRun {
  agentOutput: AgentOutput;
  scoreDetails: ScoreDetail[];
}

export async function persistAgentRun(
  repositories: AgentRunPersistenceRepositories,
  input: PersistAgentRunInput,
  logger: StructuredLogger = createNoopStructuredLogger(),
): Promise<PersistedAgentRun> {
  const runLogger = logger.child({
    caseId: input.caseId,
    iterationId: input.iterationId,
    agentName: input.agentName,
  });
  const agentOutput = await repositories.agentOutputs.create({
    agentOutputId: input.agentOutputId,
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    agentName: input.agentName,
    rawOutput: input.rawOutput,
    normalizedOutput: input.normalizedOutput,
    validationErrors: input.validationErrors ?? [],
    tokenUsage: input.tokenUsage,
    latencyMs: input.latencyMs,
    createdAt: input.createdAt,
  });

  const scoreDetails = deriveScoreDetails(input);
  const persistedScoreDetails =
    scoreDetails.length > 0
      ? await repositories.scoreDetails.insertMany(scoreDetails)
      : [];

  if ((input.validationErrors ?? []).length > 0) {
    runLogger.warn(
      'agent.run.validation_errors',
      'Persisted agent run with validation errors.',
      {
        validationErrorCount: input.validationErrors?.length ?? 0,
      },
    );
  }

  runLogger.info('agent.run.persisted', 'Persisted an agent run.', {
    scoreDetailCount: persistedScoreDetails.length,
  });

  return {
    agentOutput,
    scoreDetails: persistedScoreDetails,
  };
}

function deriveScoreDetails(input: PersistAgentRunInput): ScoreDetail[] {
  if (input.agentName === 'VCCritic') {
    const normalizedOutput = VcCriticOutputSchema.parse(input.normalizedOutput);

    return normalizedOutput.score_breakdown
      .filter(
        (entry): entry is typeof entry & { score: number } =>
          entry.score !== undefined,
      )
      .map((entry, index) => ({
        scoreDetailId: `${input.agentOutputId}:score:${index}`,
        caseId: input.caseId,
        iterationId: input.iterationId,
        iterationNo: input.iterationNo,
        scoringAgent: 'VCCritic',
        dimension: entry.dimension ?? `dimension-${index}`,
        score: entry.score,
        rationale: entry.rationale ?? undefined,
      }));
  }

  if (input.agentName === 'Judge') {
    const normalizedOutput = JudgeOutputSchema.parse(input.normalizedOutput);
    const evidenceAssessment = normalizedOutput.evidence_assessment;

    return [
      {
        scoreDetailId: `${input.agentOutputId}:score:completeness`,
        caseId: input.caseId,
        iterationId: input.iterationId,
        iterationNo: input.iterationNo,
        scoringAgent: 'Judge',
        dimension: 'completeness',
        score: evidenceAssessment.completeness,
        rationale: normalizedOutput.rationale,
      },
      {
        scoreDetailId: `${input.agentOutputId}:score:freshness`,
        caseId: input.caseId,
        iterationId: input.iterationId,
        iterationNo: input.iterationNo,
        scoringAgent: 'Judge',
        dimension: 'freshness',
        score: evidenceAssessment.freshness,
        rationale: normalizedOutput.rationale,
      },
      {
        scoreDetailId: `${input.agentOutputId}:score:confidence`,
        caseId: input.caseId,
        iterationId: input.iterationId,
        iterationNo: input.iterationNo,
        scoringAgent: 'Judge',
        dimension: 'confidence',
        score: evidenceAssessment.confidence,
        rationale: normalizedOutput.rationale,
      },
    ];
  }

  return [];
}
