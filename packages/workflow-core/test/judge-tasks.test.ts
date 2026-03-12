import { describe, expect, it } from 'vitest';

import {
  buildJudgeTaskPromptInputs,
  buildJudgeTaskRoutingPlan,
} from '../src/index.js';

describe('workflow-core JudgeTask helpers', () => {
  it('partitions judge tasks into orchestration buckets', () => {
    const plan = buildJudgeTaskRoutingPlan([
      {
        taskType: 'FACT_RESEARCH',
        targetAgent: 'FACT_RESEARCHER',
        description: 'Verify recent market evidence.',
        blocking: true,
      },
      {
        taskType: 'ICP_REFOCUS',
        targetAgent: 'OPPORTUNITY_STRATEGIST',
        description: 'Refocus the ICP.',
        blocking: false,
      },
    ]);

    expect(plan.blockingTasks).toHaveLength(1);
    expect(plan.factResearcherTasks).toHaveLength(1);
    expect(plan.opportunityStrategistTasks).toHaveLength(1);
  });

  it('renders prompt inputs from the shared JudgeTask payload', () => {
    const promptInputs = buildJudgeTaskPromptInputs(
      [
        {
          taskType: 'FACT_RESEARCH',
          targetAgent: 'FACT_RESEARCHER',
          description: 'Verify recent market evidence.',
          blocking: true,
        },
        {
          taskType: 'GTM_REWORK',
          targetAgent: 'OPPORTUNITY_STRATEGIST',
          description: 'Rework go-to-market.',
          blocking: false,
        },
      ],
      'FACT_RESEARCHER',
    );

    expect(promptInputs).toEqual([
      {
        task_type: 'FACT_RESEARCH',
        target_agent: 'FACT_RESEARCHER',
        description: 'Verify recent market evidence.',
        blocking: true,
      },
    ]);
  });
});
