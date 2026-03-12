import { describe, expect, it } from 'vitest';

import {
  JudgeTaskSchema,
  filterJudgeTasksForTargetAgent,
  fromJudgeTaskPromptInput,
  toJudgeTaskPromptInput,
} from '../src/index.js';

describe('JudgeTask shared contract', () => {
  it('validates stored judge task records and exposes the shared payload fields', () => {
    const parseResult = JudgeTaskSchema.safeParse({
      taskId: 'task-001',
      caseId: 'case-001',
      iterationId: 'iter-001',
      iterationNo: 2,
      taskType: 'EVIDENCE_REFRESH',
      targetAgent: 'FACT_RESEARCHER',
      description: 'Refresh recent market evidence.',
      blocking: true,
    });

    expect(parseResult.success).toBe(true);
  });

  it('maps between internal and prompt-input JudgeTask shapes', () => {
    const promptInput = toJudgeTaskPromptInput({
      taskType: 'MVP_RESCOPING',
      targetAgent: 'OPPORTUNITY_STRATEGIST',
      description: 'Narrow the MVP around a single workflow.',
      blocking: false,
    });

    expect(promptInput).toEqual({
      task_type: 'MVP_RESCOPING',
      target_agent: 'OPPORTUNITY_STRATEGIST',
      description: 'Narrow the MVP around a single workflow.',
      blocking: false,
    });

    expect(fromJudgeTaskPromptInput(promptInput)).toEqual({
      taskType: 'MVP_RESCOPING',
      targetAgent: 'OPPORTUNITY_STRATEGIST',
      description: 'Narrow the MVP around a single workflow.',
      blocking: false,
    });
  });

  it('filters shared JudgeTask payloads by target agent', () => {
    const tasks = [
      {
        taskType: 'FACT_RESEARCH' as const,
        targetAgent: 'FACT_RESEARCHER' as const,
        description: 'Collect more evidence.',
        blocking: true,
      },
      {
        taskType: 'GTM_REWORK' as const,
        targetAgent: 'OPPORTUNITY_STRATEGIST' as const,
        description: 'Rework go-to-market.',
        blocking: false,
      },
    ];

    expect(filterJudgeTasksForTargetAgent(tasks, 'FACT_RESEARCHER')).toEqual([
      tasks[0],
    ]);
  });
});
