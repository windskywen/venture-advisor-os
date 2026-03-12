import {
  JudgeOutputSchema,
  VcCriticOutputSchema,
  type FailureCategory,
  type RejectionCategory,
  type WorkflowConfig,
} from '@venture-advisor-os/shared-types';

import {
  hasReachedIterationBudget,
  isScoreImprovementMaterial,
  shouldRejectAfterTerminationWarning,
  shouldRejectForStagnation,
  type TopicComplexity,
} from './routing-policy.js';

export interface WorkflowAnomalyInput {
  judgeOutput: unknown;
  vcCriticOutput?: unknown;
  config: WorkflowConfig;
  topicComplexity: TopicComplexity;
  iterationNumber: number;
  consecutiveStagnantIterations: number;
  scoreImprovement: number;
  majorObjectionResolved: boolean;
  evidenceGainLow: boolean;
  acceptedObjectionsResolved: boolean;
}

export interface WorkflowAnomalyFinding {
  type:
    | 'CONTRADICTORY_AGENT_OUTPUTS'
    | 'INVALID_JUDGE_DECISION_SCHEMA'
    | 'LOW_VALUE_DEAD_END_LOOP';
  recommendedAction: 'MANUAL_REVIEW' | 'REJECT';
  message: string;
  failureCategory?: FailureCategory;
  rejectionCategory?: RejectionCategory;
}

export interface WorkflowAnomalyAssessment {
  findings: WorkflowAnomalyFinding[];
  recommendedAction: 'NONE' | 'MANUAL_REVIEW' | 'REJECT';
}

export function detectWorkflowAnomalies(
  input: WorkflowAnomalyInput,
): WorkflowAnomalyAssessment {
  const findings: WorkflowAnomalyFinding[] = [];
  const parsedJudge = JudgeOutputSchema.safeParse(input.judgeOutput);

  if (!parsedJudge.success) {
    findings.push({
      type: 'INVALID_JUDGE_DECISION_SCHEMA',
      recommendedAction: 'MANUAL_REVIEW',
      message: 'Judge output failed schema validation and requires manual review.',
      failureCategory: 'SCHEMA_VALIDATION_FAILURE',
    });

    return {
      findings,
      recommendedAction: 'MANUAL_REVIEW',
    };
  }

  const judgeOutput = parsedJudge.data;
  const parsedVcCritic = input.vcCriticOutput
    ? VcCriticOutputSchema.safeParse(input.vcCriticOutput)
    : undefined;

  if (
    judgeOutput.decision === 'PASS' &&
    ((parsedVcCritic?.success === true &&
      parsedVcCritic.data.fatal_flaws.length > 0) ||
      judgeOutput.next_iteration_tasks.length > 0 ||
      judgeOutput.iteration_worthiness.should_continue)
  ) {
    findings.push({
      type: 'CONTRADICTORY_AGENT_OUTPUTS',
      recommendedAction: 'MANUAL_REVIEW',
      message:
        'Agent outputs are contradictory: PASS was issued despite unresolved fatal flaws or additional iteration work.',
      failureCategory: 'JUDGE_DEAD_END',
    });
  }

  const lowValueDeadEndDetected =
    shouldRejectForStagnation(input.config, {
      scoreImprovement: input.scoreImprovement,
      majorObjectionResolved: input.majorObjectionResolved,
      evidenceGainLow: input.evidenceGainLow,
      consecutiveStagnantIterations: input.consecutiveStagnantIterations,
    }) ||
    shouldRejectAfterTerminationWarning(input.config, {
      terminationWarning: judgeOutput.termination_warning,
      scoreImprovement: input.scoreImprovement,
      acceptedObjectionsResolved: input.acceptedObjectionsResolved,
    }) ||
    (hasReachedIterationBudget(
      input.config,
      input.iterationNumber,
      input.topicComplexity,
    ) &&
      !isScoreImprovementMaterial(input.config, input.scoreImprovement) &&
      judgeOutput.decision !== 'PASS');

  if (lowValueDeadEndDetected) {
    findings.push({
      type: 'LOW_VALUE_DEAD_END_LOOP',
      recommendedAction: 'REJECT',
      message:
        'The case is stuck in a low-value loop without enough progress to justify another iteration.',
      rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
    });
  }

  return {
    findings,
    recommendedAction: findings.some(
      (finding) => finding.recommendedAction === 'REJECT',
    )
      ? 'REJECT'
      : findings.length > 0
        ? 'MANUAL_REVIEW'
        : 'NONE',
  };
}
