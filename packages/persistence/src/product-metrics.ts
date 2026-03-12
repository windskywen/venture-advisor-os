import type {
  AgentOutput,
  AuditLog,
  Iteration,
  OpportunityCase,
  OutputArtifactDto,
  ProductMetricsSnapshotDto,
} from '@venture-advisor-os/shared-types';

export interface ProductMetricsRepositories {
  cases: {
    listAll(): Promise<OpportunityCase[]>;
  };
  iterations: {
    listAll(): Promise<Iteration[]>;
  };
  agentOutputs: {
    listAll(): Promise<AgentOutput[]>;
  };
  auditLogs: {
    listAll(): Promise<AuditLog[]>;
  };
}

export interface ProductMetricsArtifactIndex {
  listCaseArtifacts(caseId: string): Promise<OutputArtifactDto[]>;
}

export interface ProductMetricsServiceDependencies {
  repositories: ProductMetricsRepositories;
  artifactIndex?: ProductMetricsArtifactIndex;
  now?: () => Date;
}

export type ProductMetricsSnapshot = ProductMetricsSnapshotDto;

export interface ProductMetricsService {
  collect(): Promise<ProductMetricsSnapshot>;
  collectPrometheusMetrics(): Promise<Record<string, number>>;
}

export function createProductMetricsService(
  dependencies: ProductMetricsServiceDependencies,
): ProductMetricsService {
  const now = dependencies.now ?? (() => new Date());

  return {
    async collect() {
      const [cases, iterations, agentOutputs, auditLogs] = await Promise.all([
        dependencies.repositories.cases.listAll(),
        dependencies.repositories.iterations.listAll(),
        dependencies.repositories.agentOutputs.listAll(),
        dependencies.repositories.auditLogs.listAll(),
      ]);
      const artifactsByCaseId = dependencies.artifactIndex
        ? await loadArtifactsByCaseId(cases, dependencies.artifactIndex)
        : new Map<string, Set<OutputArtifactDto['kind']>>();
      const judgeOutputs = agentOutputs.filter(
        (output) => output.agentName === 'Judge',
      );
      const latestJudgeOutputByCaseId = indexLatestJudgeOutputs(judgeOutputs);
      const judgeCompletedCaseIds = new Set(judgeOutputs.map((output) => output.caseId));
      const passCases = cases.filter((caseRecord) => caseRecord.finalDecision === 'PASS');
      const rejectedBeforePrdCases = cases.filter((caseRecord) => {
        const rejected =
          caseRecord.finalDecision === 'REJECT' || caseRecord.status === 'REJECTED';
        return rejected && !hasArtifact(caseRecord, artifactsByCaseId, 'prd');
      });
      const averageIterationsPerCase =
        cases.length === 0
          ? 0
          : cases.reduce((total, caseRecord) => {
              const maxIterationNo = Math.max(
                caseRecord.currentIteration,
                ...iterations
                  .filter((iteration) => iteration.caseId === caseRecord.caseId)
                  .map((iteration) => iteration.iterationNo),
              );
              return total + maxIterationNo;
            }, 0) / cases.length;
      const averageTimeToDecisionMs = computeAverageTimeToDecisionMs(
        cases,
        latestJudgeOutputByCaseId,
      );

      return {
        generatedAt: now().toISOString(),
        topicsReachingJudgeCompletion: judgeCompletedCaseIds.size,
        prePrdRejectionRate: ratio(
          rejectedBeforePrdCases.length,
          judgeCompletedCaseIds.size,
        ),
        averageIterationsPerCase,
        passToPrdCompletionRate: ratio(
          passCases.filter((caseRecord) =>
            hasArtifact(caseRecord, artifactsByCaseId, 'prd'),
          ).length,
          passCases.length,
        ),
        passToPocCompletionRate: ratio(
          passCases.filter((caseRecord) =>
            hasArtifact(caseRecord, artifactsByCaseId, 'poc'),
          ).length,
          passCases.length,
        ),
        averageTimeToDecisionMs,
        schemaValidationSuccessRate: ratio(
          agentOutputs.filter((output) => output.validationErrors.length === 0).length,
          agentOutputs.length,
        ),
        manualOverrideCount: auditLogs.filter((log) =>
          log.action.startsWith('MANUAL_OVERRIDE_'),
        ).length,
        stagnationDetectedCount: cases.filter(
          (caseRecord) =>
            caseRecord.failureCategory === 'JUDGE_DEAD_END' ||
            caseRecord.rejectionCategory ===
              'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
        ).length,
        stagnationRejectedCount: cases.filter(
          (caseRecord) =>
            caseRecord.rejectionCategory ===
            'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
        ).length,
        targetedRerunRate: ratio(
          judgeOutputs.filter((output) => {
            const decision = output.normalizedOutput.decision;
            return decision === 'REVISE' || decision === 'PIVOT';
          }).length,
          judgeOutputs.length,
        ),
      };
    },
    async collectPrometheusMetrics() {
      const snapshot = await this.collect();

      return {
        venture_advisor_topics_reaching_judge_completion_total:
          snapshot.topicsReachingJudgeCompletion,
        venture_advisor_pre_prd_rejection_rate: snapshot.prePrdRejectionRate,
        venture_advisor_average_iterations_per_case:
          snapshot.averageIterationsPerCase,
        venture_advisor_pass_to_prd_completion_rate:
          snapshot.passToPrdCompletionRate,
        venture_advisor_pass_to_poc_completion_rate:
          snapshot.passToPocCompletionRate,
        venture_advisor_average_time_to_decision_ms:
          snapshot.averageTimeToDecisionMs,
        venture_advisor_schema_validation_success_rate:
          snapshot.schemaValidationSuccessRate,
        venture_advisor_manual_override_count: snapshot.manualOverrideCount,
        venture_advisor_stagnation_detected_count:
          snapshot.stagnationDetectedCount,
        venture_advisor_stagnation_rejected_count:
          snapshot.stagnationRejectedCount,
        venture_advisor_targeted_rerun_rate: snapshot.targetedRerunRate,
      };
    },
  };
}

async function loadArtifactsByCaseId(
  cases: readonly OpportunityCase[],
  artifactIndex: ProductMetricsArtifactIndex,
): Promise<Map<string, Set<OutputArtifactDto['kind']>>> {
  const artifactEntries: Array<[string, Set<OutputArtifactDto['kind']>]> =
    await Promise.all(
      cases.map(async (caseRecord) => [
        caseRecord.caseId,
        new Set(
          (await artifactIndex.listCaseArtifacts(caseRecord.caseId)).map(
            (artifact) => artifact.kind,
          ),
        ),
      ]),
  );

  return new Map(artifactEntries);
}

function indexLatestJudgeOutputs(
  judgeOutputs: readonly AgentOutput[],
): Map<string, AgentOutput> {
  return judgeOutputs.reduce((map, output) => {
    const existing = map.get(output.caseId);
    if (!existing) {
      map.set(output.caseId, output);
      return map;
    }

    if (existing.iterationNo < output.iterationNo) {
      map.set(output.caseId, output);
      return map;
    }

    if (
      existing.iterationNo === output.iterationNo &&
      existing.createdAt.localeCompare(output.createdAt) < 0
    ) {
      map.set(output.caseId, output);
    }

    return map;
  }, new Map<string, AgentOutput>());
}

function hasArtifact(
  caseRecord: OpportunityCase,
  artifactsByCaseId: ReadonlyMap<string, Set<OutputArtifactDto['kind']>>,
  artifactKind: OutputArtifactDto['kind'],
): boolean {
  const artifactKinds = artifactsByCaseId.get(caseRecord.caseId);
  if (artifactKinds?.has(artifactKind)) {
    return true;
  }

  if (artifactKind === 'prd') {
    return (
      caseRecord.status === 'POC_IN_PROGRESS' || caseRecord.status === 'COMPLETED'
    );
  }

  if (artifactKind === 'poc') {
    return caseRecord.status === 'COMPLETED';
  }

  return false;
}

function computeAverageTimeToDecisionMs(
  cases: readonly OpportunityCase[],
  latestJudgeOutputByCaseId: ReadonlyMap<string, AgentOutput>,
): number {
  const decisionDurations = cases
    .map((caseRecord) => {
      const latestJudgeOutput = latestJudgeOutputByCaseId.get(caseRecord.caseId);
      if (!latestJudgeOutput) {
        return null;
      }

      return (
        Date.parse(latestJudgeOutput.createdAt) - Date.parse(caseRecord.createdAt)
      );
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (decisionDurations.length === 0) {
    return 0;
  }

  return (
    decisionDurations.reduce((total, duration) => total + duration, 0) /
    decisionDurations.length
  );
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}
