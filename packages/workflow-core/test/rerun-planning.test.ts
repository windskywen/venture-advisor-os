import { describe, expect, it } from 'vitest';

import { isJudgeTaskTargetValid, planJudgeTaskRerun } from '../src/index.js';

describe('Judge rerun planning', () => {
  it('plans an Agent A only rerun with mandatory C -> J follow-up', () => {
    const plan = planJudgeTaskRerun([
      {
        taskType: 'EVIDENCE_REFRESH',
        targetAgent: 'FACT_RESEARCHER',
        description: 'Refresh recent market evidence.',
        blocking: true,
      },
    ]);

    expect(plan.strategy).toBe('A_ONLY');
    expect(plan.followUpAgents).toEqual(['VCCritic', 'Judge']);
    expect(plan.blockingTasks).toHaveLength(1);
  });

  it('plans an Agent B only rerun when all tasks target strategy work', () => {
    const plan = planJudgeTaskRerun([
      {
        taskType: 'GTM_REWORK',
        targetAgent: 'OPPORTUNITY_STRATEGIST',
        description: 'Rework go-to-market.',
        blocking: false,
      },
    ]);

    expect(plan.strategy).toBe('B_ONLY');
    expect(plan.opportunityStrategistTasks).toHaveLength(1);
  });

  it('plans A then B when the Judge tasks span both agents', () => {
    const plan = planJudgeTaskRerun([
      {
        taskType: 'FACT_RESEARCH',
        targetAgent: 'FACT_RESEARCHER',
        description: 'Confirm user pain frequency.',
        blocking: true,
      },
      {
        taskType: 'ICP_REFOCUS',
        targetAgent: 'OPPORTUNITY_STRATEGIST',
        description: 'Narrow the ICP.',
        blocking: true,
      },
    ]);

    expect(plan.strategy).toBe('A_THEN_B');
  });

  it('marks invalid target/task combinations as prohibited', () => {
    const plan = planJudgeTaskRerun([
      {
        taskType: 'FACT_RESEARCH',
        targetAgent: 'OPPORTUNITY_STRATEGIST',
        description: 'Invalid target.',
        blocking: true,
      },
    ]);

    expect(plan.strategy).toBe('PROHIBITED');
    expect(
      isJudgeTaskTargetValid(
        plan.blockingTasks[0] ?? {
          taskType: 'FACT_RESEARCH',
          targetAgent: 'OPPORTUNITY_STRATEGIST',
          description: 'Invalid target.',
          blocking: true,
        },
      ),
    ).toBe(false);
  });

  it('can prohibit terminal-risk reruns when the caller wants direct stop behavior', () => {
    const plan = planJudgeTaskRerun(
      [
        {
          taskType: 'TERMINAL_RISK_CONFIRMATION',
          targetAgent: 'FACT_RESEARCHER',
          description: 'Confirm the fatal blocker.',
          blocking: true,
        },
      ],
      { terminalRiskMode: 'reject' },
    );

    expect(plan.strategy).toBe('PROHIBITED');
  });
});
