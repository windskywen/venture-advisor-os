import { describe, expect, it } from 'vitest';

import { buildReviseIterationPlan } from '../src/index.js';

describe('REVISE flow planning', () => {
  it('builds A -> B -> C for mixed Judge tasks before Judge rerun', () => {
    const plan = buildReviseIterationPlan({
      caseId: 'case-1',
      iterationId: 'iter-2',
      iterationNo: 2,
      judgeTasks: [
        {
          taskType: 'FACT_RESEARCH',
          targetAgent: 'FACT_RESEARCHER',
          description: 'Refresh research.',
          blocking: true,
        },
        {
          taskType: 'GTM_REWORK',
          targetAgent: 'OPPORTUNITY_STRATEGIST',
          description: 'Refine GTM.',
          blocking: true,
        },
      ],
    });

    expect(plan.rerunJobSequence.map((job) => job.agentName)).toEqual([
      'FactResearcher',
      'OpportunityStrategist',
      'VCCritic',
    ]);
    expect(plan.rerunJobSequence[0]?.judgeTasks).toHaveLength(1);
    expect(plan.rerunJobSequence[1]?.judgeTasks).toHaveLength(1);
  });

  it('builds B -> C when only strategy tasks are required', () => {
    const plan = buildReviseIterationPlan({
      caseId: 'case-1',
      iterationId: 'iter-2',
      iterationNo: 2,
      judgeTasks: [
        {
          taskType: 'ICP_REFOCUS',
          targetAgent: 'OPPORTUNITY_STRATEGIST',
          description: 'Refocus ICP.',
          blocking: false,
        },
      ],
    });

    expect(plan.rerunJobSequence.map((job) => job.agentName)).toEqual([
      'OpportunityStrategist',
      'VCCritic',
    ]);
  });

  it('rejects prohibited rerun plans', () => {
    expect(() =>
      buildReviseIterationPlan({
        caseId: 'case-1',
        iterationId: 'iter-2',
        iterationNo: 2,
        judgeTasks: [
          {
            taskType: 'FACT_RESEARCH',
            targetAgent: 'OPPORTUNITY_STRATEGIST',
            description: 'Invalid target.',
            blocking: true,
          },
        ],
      }),
    ).toThrow('REVISE flow cannot be planned');
  });
});
