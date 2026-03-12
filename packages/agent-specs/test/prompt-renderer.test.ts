import { describe, expect, it } from 'vitest';

import type { JudgeTaskPayload } from '@venture-advisor-os/shared-types';

import {
  loadPromptTemplateRegistry,
  renderAgentPrompt,
} from '../src/index.js';

describe('prompt renderer', () => {
  const registry = loadPromptTemplateRegistry({
    repoRoot: process.cwd(),
  });

  it('renders structured context and target-filtered judge tasks for FactResearcher', () => {
    const judgeTasks: JudgeTaskPayload[] = [
      {
        taskType: 'EVIDENCE_REFRESH',
        targetAgent: 'FACT_RESEARCHER',
        description: 'Refresh the latest market evidence.',
        blocking: true,
      },
      {
        taskType: 'GTM_REWORK',
        targetAgent: 'OPPORTUNITY_STRATEGIST',
        description: 'Rework go-to-market.',
        blocking: false,
      },
    ];

    const rendered = renderAgentPrompt({
      registry,
      agentName: 'FactResearcher',
      caseContext: {
        topic: 'AI note-taking for consultants',
        iteration_no: 2,
      },
      priorOutputs: {
        prior_summary: {
          market_problem_definition: 'Documentation overhead.',
        },
      },
      judgeTasks,
      stopConditions: ['Do not infer a business model without evidence.'],
    });

    expect(rendered.inputPayload).toMatchObject({
      topic: 'AI note-taking for consultants',
      iteration_no: 2,
      prior_summary: {
        market_problem_definition: 'Documentation overhead.',
      },
      judge_tasks: [
        {
          task_type: 'EVIDENCE_REFRESH',
          target_agent: 'FACT_RESEARCHER',
          description: 'Refresh the latest market evidence.',
          blocking: true,
        },
      ],
    });
    expect(rendered.judgeTaskSummary).toEqual([
      '[blocking] EVIDENCE_REFRESH: Refresh the latest market evidence.',
    ]);
    expect(rendered.prompt).toContain('## Required Markdown Sections');
    expect(rendered.prompt).toContain('## Output Skeleton');
    expect(rendered.prompt).toContain('## Market Problem Definition');
    expect(rendered.prompt).toContain('Market Problem Definition');
    expect(rendered.prompt).toContain('Do not infer a business model without evidence.');
  });

  it('includes score dimensions for VCCritic prompts', () => {
    const rendered = renderAgentPrompt({
      registry,
      agentName: 'VCCritic',
      caseContext: {
        topic: 'AI note-taking for consultants',
      },
      priorOutputs: {
        market_facts_summary: {
          pain_points: ['Documentation overhead'],
        },
      },
    });

    expect(rendered.prompt).toContain('Use the shared scoring scale 1-10.');
    expect(rendered.prompt).toContain('Score dimensions:');
    expect(rendered.prompt).toContain('Problem Severity');
    expect(rendered.structuredJudgeTasks).toEqual([]);
  });

  it('throws for unknown agent names', () => {
    expect(() =>
      renderAgentPrompt({
        registry,
        agentName: 'UnknownAgent',
        caseContext: {
          topic: 'AI note-taking for consultants',
        },
      }),
    ).toThrow('Unknown prompt template agent');
  });
});
