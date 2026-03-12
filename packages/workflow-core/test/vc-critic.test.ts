import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import {
  createMockAgentRuntimeAdapter,
  executeVcCritic,
  normalizeVcCriticOutput,
} from '../src/index.js';
import { renderCompliantAgentOutput } from './test-helpers.js';

describe('VCCritic execution and normalization', () => {
  it('normalizes JSON summaries from raw output', () => {
    const normalized = normalizeVcCriticOutput(`{
      "summary": "The problem is real but crowded.",
      "objections": ["Crowded market"],
      "fatal_flaws": ["Weak moat"],
      "manageable_risks": ["Slow GTM"],
      "score_breakdown": [
        {
          "dimension": "Market Size",
          "score": 7,
          "rationale": "Large enough market."
        }
      ],
      "key_questions": ["Can the team differentiate?"],
      "recommendation": "Revise"
    }`);

    expect(normalized.fatal_flaws).toEqual(['Weak moat']);
    expect(normalized.score_breakdown[0]?.dimension).toBe('Market Size');
  });

  it('executes VCCritic through prompt rendering, runtime, and normalization', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const runtime = createMockAgentRuntimeAdapter(() => ({
      agentName: 'VCCritic',
      rawOutput: renderCompliantAgentOutput(registry, 'VCCritic', {
        summary: 'The problem is real but crowded.',
        objections: ['Crowded market'],
        fatal_flaws: ['Weak moat'],
        manageable_risks: ['Slow GTM'],
        score_breakdown: [
          {
            dimension: 'Market Size',
            score: 7,
            rationale: 'Large enough market.',
          },
        ],
        key_questions: ['Can the team differentiate?'],
        recommendation: 'Revise',
      }),
    }));

    const result = await executeVcCritic({
      registry,
      runtime,
      caseContext: {
        topic: 'AI note-taking for consultants',
        market_facts_summary: {
          pain_points: ['Manual documentation'],
        },
        opportunity_summary: {
          recommended_entry_point: {
            title: 'AI note copilot',
          },
        },
        iteration_no: 1,
      },
    });

    expect(result.normalizedOutput.objections).toEqual(['Crowded market']);
    expect(result.renderedPrompt.prompt).toContain('Scoring Breakdown');
    expect(result.renderedPrompt.prompt).toContain('Problem Severity');
  });
});
