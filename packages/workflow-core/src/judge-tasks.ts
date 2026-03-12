import {
  filterJudgeTasksForTargetAgent,
  toJudgeTaskPromptInput,
  type JudgeTaskPayload,
  type JudgeTaskPromptInput,
  type JudgeTaskTargetAgent,
} from '@venture-advisor-os/shared-types';

export interface JudgeTaskRoutingPlan {
  allTasks: JudgeTaskPayload[];
  blockingTasks: JudgeTaskPayload[];
  factResearcherTasks: JudgeTaskPayload[];
  opportunityStrategistTasks: JudgeTaskPayload[];
}

export function buildJudgeTaskRoutingPlan(
  tasks: readonly JudgeTaskPayload[],
): JudgeTaskRoutingPlan {
  const allTasks = [...tasks];

  return {
    allTasks,
    blockingTasks: allTasks.filter((task) => task.blocking),
    factResearcherTasks: filterJudgeTasksForTargetAgent(
      allTasks,
      'FACT_RESEARCHER',
    ),
    opportunityStrategistTasks: filterJudgeTasksForTargetAgent(
      allTasks,
      'OPPORTUNITY_STRATEGIST',
    ),
  };
}

export function buildJudgeTaskPromptInputs(
  tasks: readonly JudgeTaskPayload[],
  targetAgent?: JudgeTaskTargetAgent,
): JudgeTaskPromptInput[] {
  const scopedTasks =
    targetAgent === undefined
      ? [...tasks]
      : filterJudgeTasksForTargetAgent(tasks, targetAgent);

  return scopedTasks.map((task) => toJudgeTaskPromptInput(task));
}
