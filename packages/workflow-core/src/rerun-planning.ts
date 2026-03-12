import type {
  AgentName,
  JudgeTaskPayload,
  JudgeTaskType,
} from '@venture-advisor-os/shared-types';

const TASK_TYPE_TARGET_MAP: Record<
  Exclude<JudgeTaskType, 'TERMINAL_RISK_CONFIRMATION'>,
  JudgeTaskPayload['targetAgent']
> = {
  FACT_RESEARCH: 'FACT_RESEARCHER',
  EVIDENCE_REFRESH: 'FACT_RESEARCHER',
  COMPETITOR_EXPANSION: 'FACT_RESEARCHER',
  STRATEGY_REFRAME: 'OPPORTUNITY_STRATEGIST',
  MONETIZATION_REWORK: 'OPPORTUNITY_STRATEGIST',
  ICP_REFOCUS: 'OPPORTUNITY_STRATEGIST',
  MVP_RESCOPING: 'OPPORTUNITY_STRATEGIST',
  GTM_REWORK: 'OPPORTUNITY_STRATEGIST',
};

export type RerunStrategy = 'A_ONLY' | 'B_ONLY' | 'A_THEN_B' | 'PROHIBITED';

export interface JudgeTaskRerunPlanningOptions {
  terminalRiskMode?: 'rerun' | 'reject';
}

export interface JudgeTaskRerunPlan {
  strategy: RerunStrategy;
  factResearcherTasks: JudgeTaskPayload[];
  opportunityStrategistTasks: JudgeTaskPayload[];
  followUpAgents: AgentName[];
  blockingTasks: JudgeTaskPayload[];
  prohibitedReasons: string[];
}

export function planJudgeTaskRerun(
  tasks: readonly JudgeTaskPayload[],
  options: JudgeTaskRerunPlanningOptions = {},
): JudgeTaskRerunPlan {
  if (tasks.length === 0) {
    return createProhibitedPlan(
      'No Judge tasks were provided for rerun planning.',
    );
  }

  const prohibitedReasons = validateJudgeTasks(tasks, options);
  if (prohibitedReasons.length > 0) {
    return createProhibitedPlan(...prohibitedReasons);
  }

  const factResearcherTasks = tasks.filter(
    (task) => task.targetAgent === 'FACT_RESEARCHER',
  );
  const opportunityStrategistTasks = tasks.filter(
    (task) => task.targetAgent === 'OPPORTUNITY_STRATEGIST',
  );
  const blockingTasks = tasks.filter((task) => task.blocking);

  const strategy =
    factResearcherTasks.length > 0 && opportunityStrategistTasks.length > 0
      ? 'A_THEN_B'
      : factResearcherTasks.length > 0
        ? 'A_ONLY'
        : 'B_ONLY';

  return {
    strategy,
    factResearcherTasks,
    opportunityStrategistTasks,
    followUpAgents: ['VCCritic', 'Judge'],
    blockingTasks,
    prohibitedReasons: [],
  };
}

export function isJudgeTaskTargetValid(
  task: JudgeTaskPayload,
  options: JudgeTaskRerunPlanningOptions = {},
): boolean {
  return validateJudgeTasks([task], options).length === 0;
}

function validateJudgeTasks(
  tasks: readonly JudgeTaskPayload[],
  options: JudgeTaskRerunPlanningOptions,
): string[] {
  const reasons: string[] = [];

  for (const task of tasks) {
    if (task.taskType === 'TERMINAL_RISK_CONFIRMATION') {
      if (options.terminalRiskMode === 'reject') {
        reasons.push(
          'TERMINAL_RISK_CONFIRMATION is configured to stop reruns and route to direct rejection/manual review.',
        );
      }
      continue;
    }

    const expectedTarget = TASK_TYPE_TARGET_MAP[task.taskType];
    if (task.targetAgent !== expectedTarget) {
      reasons.push(
        `Task ${task.taskType} must target ${expectedTarget}, not ${task.targetAgent}.`,
      );
    }
  }

  return reasons;
}

function createProhibitedPlan(...reasons: string[]): JudgeTaskRerunPlan {
  return {
    strategy: 'PROHIBITED',
    factResearcherTasks: [],
    opportunityStrategistTasks: [],
    followUpAgents: [],
    blockingTasks: [],
    prohibitedReasons: reasons,
  };
}
