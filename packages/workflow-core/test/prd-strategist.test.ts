import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import {
  createMockAgentRuntimeAdapter,
  executePrdStrategist,
  normalizePrdStrategistOutput,
} from '../src/index.js';
import { renderCompliantAgentOutput } from './test-helpers.js';

describe('PRDStrategist execution and normalization', () => {
  it('normalizes JSON summaries from raw output', () => {
    const normalized = normalizePrdStrategistOutput(`{
      "product_overview": "An AI note copilot for consultants.",
      "problem_statement": "Manual meeting documentation is slow.",
      "target_users": ["Consultants"],
      "use_cases": ["Capture meeting notes"],
      "functional_requirements": ["Record notes", "Summarize actions"],
      "non_functional_requirements": ["Keep summaries available within 30 seconds"],
      "mvp_scope": ["Meeting note capture"],
      "out_of_scope": ["CRM sync"],
      "user_stories": ["As a consultant, I want structured notes."],
      "success_metrics": ["Reduce documentation time by 50%"],
      "risks": ["Users may not trust automated summaries"],
      "open_questions": ["Should recordings be optional at launch?"]
    }`);

    expect(normalized.functional_requirements).toContain('Record notes');
    expect(normalized.non_functional_requirements).toContain(
      'Keep summaries available within 30 seconds',
    );
  });

  it('executes PRDStrategist only for PASS-approved downstream cases', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const runtime = createMockAgentRuntimeAdapter(() => ({
      agentName: 'PRDStrategist',
      rawOutput: renderCompliantAgentOutput(registry, 'PRDStrategist', {
        product_overview: 'An AI note copilot for consultants.',
        problem_statement: 'Manual meeting documentation is slow.',
        target_users: ['Consultants'],
        use_cases: ['Capture meeting notes'],
        functional_requirements: ['Record notes', 'Summarize actions'],
        non_functional_requirements: [
          'Keep summaries available within 30 seconds',
        ],
        mvp_scope: ['Meeting note capture'],
        out_of_scope: ['CRM sync'],
        user_stories: ['As a consultant, I want structured notes.'],
        success_metrics: ['Reduce documentation time by 50%'],
        risks: ['Users may not trust automated summaries'],
        open_questions: ['Should recordings be optional at launch?'],
      }),
    }));

    const result = await executePrdStrategist({
      registry,
      runtime,
      caseContext: {
        topic: 'AI note-taking for consultants',
        approved_business_summary: {
          recommendation: 'Proceed',
        },
      },
      currentStatus: 'APPROVED_FOR_PRD',
      latestJudgeDecision: 'PASS',
      hasExistingPrd: false,
    });

    expect(result.normalizedOutput.problem_statement).toBe(
      'Manual meeting documentation is slow.',
    );
    expect(result.renderedPrompt.prompt).toContain('Open Questions');
  });

  it('rejects PRD execution for non-PASS decisions', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const runtime = createMockAgentRuntimeAdapter(() => ({
      agentName: 'PRDStrategist',
      rawOutput: '{}',
    }));

    await expect(
      executePrdStrategist({
        registry,
        runtime,
        caseContext: {
          topic: 'AI note-taking for consultants',
          approved_business_summary: {},
        },
        currentStatus: 'APPROVED_FOR_PRD',
        latestJudgeDecision: 'REVISE',
        hasExistingPrd: false,
      }),
    ).rejects.toThrow('PRD generation requires latestJudgeDecision=PASS');
  });
});
