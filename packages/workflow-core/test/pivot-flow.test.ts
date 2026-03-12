import { describe, expect, it } from 'vitest';

import { buildPivotIterationPlan } from '../src/index.js';

describe('PIVOT flow planning', () => {
  it('builds B -> C when prior research can be reused', () => {
    const plan = buildPivotIterationPlan({
      caseId: 'case-1',
      iterationId: 'iter-2',
      iterationNo: 2,
      judgeTasks: [
        {
          taskType: 'STRATEGY_REFRAME',
          targetAgent: 'OPPORTUNITY_STRATEGIST',
          description: 'Reframe the entry point.',
          blocking: true,
        },
      ],
      invalidateResearch: false,
      reusableResearchArtifactRefs: [
        {
          sourceIterationNo: 1,
          path: 'storage/cases/case-1/iterations/1/outputs/market_facts.md',
          kind: 'normalized-output',
        },
      ],
    });

    expect(plan.rerunJobSequence.map((job) => job.agentName)).toEqual([
      'OpportunityStrategist',
      'VCCritic',
    ]);
    expect(plan.rerunJobSequence[0]?.researchArtifactRefs).toHaveLength(1);
  });

  it('prepends A when the pivot invalidates prior research', () => {
    const plan = buildPivotIterationPlan({
      caseId: 'case-1',
      iterationId: 'iter-2',
      iterationNo: 2,
      judgeTasks: [
        {
          taskType: 'STRATEGY_REFRAME',
          targetAgent: 'OPPORTUNITY_STRATEGIST',
          description: 'Reframe the entry point.',
          blocking: true,
        },
      ],
      invalidateResearch: true,
    });

    expect(plan.rerunJobSequence.map((job) => job.agentName)).toEqual([
      'FactResearcher',
      'OpportunityStrategist',
      'VCCritic',
    ]);
  });

  it('rejects prohibited pivot task combinations', () => {
    expect(() =>
      buildPivotIterationPlan({
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
        invalidateResearch: false,
      }),
    ).toThrow('PIVOT flow cannot be planned');
  });
});
