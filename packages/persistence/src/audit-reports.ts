import {
  loadWorkflowConfig,
  type AgentOutput,
  type Approval,
  type AuditLog,
  type FailureCategory,
  type Iteration,
  type JudgeDecision,
  type JudgeTask,
  type OpportunityCase,
  type RejectionCategory,
  type ScoreDetail,
  type WorkflowConfig,
} from '@venture-advisor-os/shared-types';

import {
  ROUTING_SCORE_DIMENSIONS,
  type RoutingScoreSnapshot,
} from './score-summaries.js';

export interface AuditReportRepositories {
  cases: {
    getById(caseId: string): Promise<OpportunityCase | null>;
  };
  iterations: {
    listByCaseId(caseId: string): Promise<Iteration[]>;
  };
  agentOutputs: {
    listByIterationId(iterationId: string): Promise<AgentOutput[]>;
  };
  judgeTasks: {
    listByIterationId(iterationId: string): Promise<JudgeTask[]>;
  };
  scoreDetails: {
    listByIterationId(iterationId: string): Promise<ScoreDetail[]>;
  };
  auditLogs: {
    listByCaseId(caseId: string): Promise<AuditLog[]>;
  };
  approvals: {
    listByCaseId(caseId: string): Promise<Approval[]>;
  };
}

export interface AuditReportServiceDependencies {
  repositories: AuditReportRepositories;
  workflowConfig?: WorkflowConfig;
}

export interface AuditIterationReport {
  iterationId: string;
  iterationNo: number;
  statusAtStart?: OpportunityCase['status'];
  statusAtEnd?: OpportunityCase['status'];
  judgeDecision?: JudgeDecision;
  rerunPlan: {
    strategy: 'NONE' | 'A_ONLY' | 'B_ONLY' | 'A_THEN_B' | 'PROHIBITED';
    blockingTaskCount: number;
    prohibitedReasons: string[];
  };
  routingSummary: RoutingScoreSnapshot | null;
  scoreDetails: ScoreDetail[];
  terminationTriggers: string[];
  rejectionCategory?: RejectionCategory;
}

export interface CaseAuditReport {
  caseRecord: OpportunityCase;
  thresholdsUsed: Pick<
    WorkflowConfig,
    'thresholds' | 'judgeThresholds' | 'iterationBudget' | 'routingPolicy'
  >;
  decisionSummary: {
    latestJudgeDecision?: JudgeDecision;
    finalDecision?: JudgeDecision;
    failureCategory?: FailureCategory;
    rejectionCategory?: RejectionCategory;
    manualReviewRequired: boolean;
  };
  iterations: AuditIterationReport[];
  overrides: {
    approvals: Approval[];
    auditLogs: AuditLog[];
  };
}

export interface AuditReportService {
  getCaseAuditReport(caseId: string): Promise<CaseAuditReport>;
}

export function createAuditReportService(
  dependencies: AuditReportServiceDependencies,
): AuditReportService {
  const workflowConfig =
    dependencies.workflowConfig ?? loadWorkflowConfig(process.env);

  return {
    async getCaseAuditReport(caseId) {
      const caseRecord = await dependencies.repositories.cases.getById(caseId);
      if (!caseRecord) {
        throw new Error(`Case ${caseId} was not found.`);
      }

      const [iterations, approvals, auditLogs] = await Promise.all([
        dependencies.repositories.iterations.listByCaseId(caseId),
        dependencies.repositories.approvals.listByCaseId(caseId),
        dependencies.repositories.auditLogs.listByCaseId(caseId),
      ]);
      const iterationReports = await Promise.all(
        iterations.map(async (iteration) => {
          const [agentOutputs, judgeTasks, scoreDetails] = await Promise.all([
            dependencies.repositories.agentOutputs.listByIterationId(
              iteration.iterationId,
            ),
            dependencies.repositories.judgeTasks.listByIterationId(
              iteration.iterationId,
            ),
            dependencies.repositories.scoreDetails.listByIterationId(
              iteration.iterationId,
            ),
          ]);
          const judgeOutput = agentOutputs.find(
            (output) => output.agentName === 'Judge',
          );

          return {
            iterationId: iteration.iterationId,
            iterationNo: iteration.iterationNo,
            statusAtStart: iteration.statusAtStart,
            statusAtEnd: iteration.statusAtEnd,
            judgeDecision: normalizeJudgeDecision(
              iteration.judgeDecision ?? judgeOutput?.normalizedOutput.decision,
            ),
            rerunPlan: summarizeRerunPlan(judgeTasks),
            routingSummary: summarizeRoutingScores(
              iteration.caseId,
              iteration.iterationId,
              iteration.iterationNo,
              scoreDetails,
            ),
            scoreDetails,
            terminationTriggers: deriveTerminationTriggers({
              caseRecord,
              iteration,
              judgeOutput,
            }),
            rejectionCategory:
              caseRecord.currentIteration === iteration.iterationNo
                ? caseRecord.rejectionCategory
                : undefined,
          } satisfies AuditIterationReport;
        }),
      );
      const latestJudgeDecision = iterationReports
        .map((iteration) => iteration.judgeDecision)
        .filter(
          (decision): decision is JudgeDecision => decision !== undefined,
        )
        .at(-1);

      return {
        caseRecord,
        thresholdsUsed: {
          thresholds: workflowConfig.thresholds,
          judgeThresholds: workflowConfig.judgeThresholds,
          iterationBudget: workflowConfig.iterationBudget,
          routingPolicy: workflowConfig.routingPolicy,
        },
        decisionSummary: {
          latestJudgeDecision,
          finalDecision: caseRecord.finalDecision,
          failureCategory: caseRecord.failureCategory,
          rejectionCategory: caseRecord.rejectionCategory,
          manualReviewRequired: caseRecord.manualReviewRequired,
        },
        iterations: iterationReports,
        overrides: {
          approvals,
          auditLogs: auditLogs.filter((log) =>
            log.action.startsWith('MANUAL_OVERRIDE_'),
          ),
        },
      };
    },
  };
}

function summarizeRerunPlan(
  judgeTasks: readonly JudgeTask[],
): AuditIterationReport['rerunPlan'] {
  if (judgeTasks.length === 0) {
    return {
      strategy: 'NONE',
      blockingTaskCount: 0,
      prohibitedReasons: [],
    };
  }

  if (
    judgeTasks.some((task) => task.taskType === 'TERMINAL_RISK_CONFIRMATION')
  ) {
    return {
      strategy: 'PROHIBITED',
      blockingTaskCount: judgeTasks.filter((task) => task.blocking).length,
      prohibitedReasons: [
        'TERMINAL_RISK_CONFIRMATION requires direct rejection or manual review instead of a targeted rerun.',
      ],
    };
  }

  const hasFactResearcherTasks = judgeTasks.some(
    (task) => task.targetAgent === 'FACT_RESEARCHER',
  );
  const hasOpportunityStrategistTasks = judgeTasks.some(
    (task) => task.targetAgent === 'OPPORTUNITY_STRATEGIST',
  );

  return {
    strategy:
      hasFactResearcherTasks && hasOpportunityStrategistTasks
        ? 'A_THEN_B'
        : hasFactResearcherTasks
          ? 'A_ONLY'
          : 'B_ONLY',
    blockingTaskCount: judgeTasks.filter((task) => task.blocking).length,
    prohibitedReasons: [],
  };
}

function summarizeRoutingScores(
  caseId: string,
  iterationId: string,
  iterationNo: number,
  scoreDetails: readonly ScoreDetail[],
): RoutingScoreSnapshot | null {
  if (scoreDetails.length === 0) {
    return null;
  }

  const summary: RoutingScoreSnapshot = {
    caseId,
    iterationId,
    iterationNo,
  };

  for (const detail of scoreDetails) {
    switch (detail.dimension) {
      case ROUTING_SCORE_DIMENSIONS.vcAverage:
        summary.vcAverage = detail.score;
        break;
      case ROUTING_SCORE_DIMENSIONS.evidenceCompleteness:
        summary.evidenceCompleteness = detail.score;
        break;
      case ROUTING_SCORE_DIMENSIONS.evidenceFreshness:
        summary.evidenceFreshness = detail.score;
        break;
      case ROUTING_SCORE_DIMENSIONS.evidenceConfidence:
        summary.evidenceConfidence = detail.score;
        break;
      case ROUTING_SCORE_DIMENSIONS.iterationWorthiness:
        summary.iterationWorthiness = detail.score;
        break;
      default:
        break;
    }
  }

  return summary;
}

function deriveTerminationTriggers(input: {
  caseRecord: OpportunityCase;
  iteration: Iteration;
  judgeOutput?: AgentOutput;
}): string[] {
  const triggers: string[] = [];

  if (input.judgeOutput?.normalizedOutput.termination_warning === true) {
    triggers.push('termination_warning');
  }

  if (
    input.caseRecord.currentIteration === input.iteration.iterationNo &&
    input.caseRecord.failureCategory
  ) {
    triggers.push(`failure:${input.caseRecord.failureCategory}`);
  }

  if (
    input.caseRecord.currentIteration === input.iteration.iterationNo &&
    input.caseRecord.rejectionCategory
  ) {
    triggers.push(`rejection:${input.caseRecord.rejectionCategory}`);
  }

  return triggers;
}

function normalizeJudgeDecision(value: unknown): JudgeDecision | undefined {
  return value === 'PASS' ||
    value === 'REVISE' ||
    value === 'PIVOT' ||
    value === 'REJECT'
    ? value
    : undefined;
}
