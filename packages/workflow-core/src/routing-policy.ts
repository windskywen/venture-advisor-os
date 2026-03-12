import {
  JUDGE_DECISIONS,
  type JudgeDecision,
  type WorkflowConfig,
} from '@venture-advisor-os/shared-types';

export type TopicComplexity = 'standard' | 'complex';

export interface PassRoutingInputs {
  vcAverage: number;
  evidenceCompleteness: number;
  judgeDecision: JudgeDecision;
  unresolvedFatalFlawCount: number;
}

export interface StagnationInputs {
  scoreImprovement: number;
  majorObjectionResolved: boolean;
  evidenceGainLow: boolean;
}

export interface StagnationRejectionInputs extends StagnationInputs {
  consecutiveStagnantIterations: number;
}

export interface FatalFlawRoutingInputs {
  unresolvedFatalFlawCount: number;
  hasConcreteDisproofPath: boolean;
}

export interface TerminationWarningInputs {
  terminationWarning: boolean;
  scoreImprovement: number;
  acceptedObjectionsResolved: boolean;
}

export interface RoutingPolicySnapshot {
  thresholds: WorkflowConfig['thresholds'];
  judgeThresholds: WorkflowConfig['judgeThresholds'];
  iterationBudget: WorkflowConfig['iterationBudget'];
  routingPolicy: WorkflowConfig['routingPolicy'];
}

export function getRoutingPolicySnapshot(
  config: WorkflowConfig,
): RoutingPolicySnapshot {
  return {
    thresholds: { ...config.thresholds },
    judgeThresholds: { ...config.judgeThresholds },
    iterationBudget: { ...config.iterationBudget },
    routingPolicy: { ...config.routingPolicy },
  };
}

export function resolveMaxIterations(
  config: WorkflowConfig,
  topicComplexity: TopicComplexity,
): number {
  if (topicComplexity === 'complex') {
    return config.iterationBudget.complexTopicMaxIterations;
  }

  return config.iterationBudget.standardTopicMaxIterations;
}

export function hasReachedIterationBudget(
  config: WorkflowConfig,
  iterationNumber: number,
  topicComplexity: TopicComplexity,
): boolean {
  return iterationNumber >= resolveMaxIterations(config, topicComplexity);
}

export function isScoreImprovementMaterial(
  config: WorkflowConfig,
  scoreImprovement: number,
): boolean {
  return scoreImprovement >= config.thresholds.minimumScoreImprovement;
}

export function meetsPassRoutingThresholds(
  config: WorkflowConfig,
  inputs: PassRoutingInputs,
): boolean {
  const meetsScoreThresholds =
    inputs.vcAverage >= config.judgeThresholds.vcPass &&
    inputs.evidenceCompleteness >= config.judgeThresholds.evidencePass;
  const meetsJudgeDecision =
    !config.routingPolicy.requireJudgePassForPassRouting ||
    inputs.judgeDecision === JUDGE_DECISIONS[0];
  const meetsFatalFlawRequirement =
    !config.routingPolicy.rejectOnUnresolvedFatalFlaws ||
    inputs.unresolvedFatalFlawCount === 0;

  return (
    meetsScoreThresholds && meetsJudgeDecision && meetsFatalFlawRequirement
  );
}

export function isIterationStagnant(
  config: WorkflowConfig,
  inputs: StagnationInputs,
): boolean {
  return (
    !isScoreImprovementMaterial(config, inputs.scoreImprovement) &&
    !inputs.majorObjectionResolved &&
    inputs.evidenceGainLow
  );
}

export function shouldRejectForStagnation(
  config: WorkflowConfig,
  inputs: StagnationRejectionInputs,
): boolean {
  if (!config.routingPolicy.rejectOnConsecutiveStagnation) {
    return false;
  }

  return (
    isIterationStagnant(config, inputs) &&
    inputs.consecutiveStagnantIterations >=
      config.iterationBudget.maxStagnantIterations
  );
}

export function shouldRejectForFatalFlaws(
  config: WorkflowConfig,
  inputs: FatalFlawRoutingInputs,
): boolean {
  if (!config.routingPolicy.rejectOnUnresolvedFatalFlaws) {
    return false;
  }

  if (inputs.unresolvedFatalFlawCount === 0) {
    return false;
  }

  if (
    inputs.hasConcreteDisproofPath &&
    config.routingPolicy.allowReviseOnFatalFlawWithConcreteDisproofPath
  ) {
    return false;
  }

  return true;
}

export function shouldRejectAfterTerminationWarning(
  config: WorkflowConfig,
  inputs: TerminationWarningInputs,
): boolean {
  if (
    !config.routingPolicy
      .rejectOnTerminationWarningWithoutMaterialImprovement ||
    !inputs.terminationWarning
  ) {
    return false;
  }

  return (
    !isScoreImprovementMaterial(config, inputs.scoreImprovement) &&
    !inputs.acceptedObjectionsResolved
  );
}

export function shouldPreferTerminalDecision(
  config: WorkflowConfig,
  iterationNumber: number,
): boolean {
  return (
    iterationNumber >= config.routingPolicy.preferTerminalDecisionByIteration
  );
}

export function canGenerateDownstreamArtifacts(
  config: WorkflowConfig,
  latestJudgeDecision: JudgeDecision,
): boolean {
  if (!config.routingPolicy.requirePassForDownstreamGeneration) {
    return true;
  }

  return latestJudgeDecision === JUDGE_DECISIONS[0];
}
