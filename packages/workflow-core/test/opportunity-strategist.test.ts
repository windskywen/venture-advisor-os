import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import {
  createMockAgentRuntimeAdapter,
  executeOpportunityStrategist,
  normalizeOpportunityStrategistOutput,
} from '../src/index.js';
import { renderCompliantAgentOutput } from './test-helpers.js';

describe('OpportunityStrategist execution and normalization', () => {
  it('normalizes JSON summaries from raw output', () => {
    const normalized = normalizeOpportunityStrategistOutput(`{
      "opportunity_options": [
        {
          "title": "AI note copilot",
          "product_shape": "copilot",
          "target_user": "Consultants",
          "core_pain": "Manual documentation",
          "monetization": "subscription",
          "pros": ["Fast"],
          "cons": ["Competitive"]
        }
      ],
      "recommended_entry_point": {
        "title": "AI note copilot",
        "rationale": "Clear pain and repeat usage."
      },
      "business_model_hypotheses": ["Seat-based SaaS"],
      "mvp_direction": ["Capture notes", "Summarize actions"],
      "feasibility_scores": [
        {
          "dimension": "Technical",
          "score": 8,
          "rationale": "Existing models support summarization."
        }
      ],
      "key_assumptions": ["Consultants will trust generated summaries."]
    }`);

    expect(normalized.recommended_entry_point.title).toBe('AI note copilot');
    expect(normalized.business_model_hypotheses).toEqual(['Seat-based SaaS']);
  });

  it('executes OpportunityStrategist through prompt rendering, runtime, and normalization', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const runtime = createMockAgentRuntimeAdapter((request) => {
      expect(request.inputPayload.judge_tasks).toEqual([
        {
          task_type: 'MVP_RESCOPING',
          target_agent: 'OPPORTUNITY_STRATEGIST',
          description: 'Narrow the MVP to one workflow.',
          blocking: true,
        },
      ]);
      expect(request.prompt).toContain(
        '- [blocking] MVP_RESCOPING: Narrow the MVP to one workflow.',
      );

      return {
        agentName: 'OpportunityStrategist',
        rawOutput: renderCompliantAgentOutput(
          registry,
          'OpportunityStrategist',
          {
            opportunity_options: [
              {
                title: 'AI note copilot',
                product_shape: 'copilot',
                target_user: 'Consultants',
                core_pain: 'Manual documentation',
                monetization: 'subscription',
                pros: ['Fast'],
                cons: ['Competitive'],
              },
            ],
            recommended_entry_point: {
              title: 'AI note copilot',
              rationale: 'Clear pain and repeat usage.',
            },
            business_model_hypotheses: ['Seat-based SaaS'],
            mvp_direction: ['Capture notes', 'Summarize actions'],
            feasibility_scores: [
              {
                dimension: 'Technical',
                score: 8,
                rationale: 'Existing models support summarization.',
              },
            ],
            key_assumptions: ['Consultants will trust generated summaries.'],
          },
        ),
      };
    });

    const result = await executeOpportunityStrategist({
      registry,
      runtime,
      caseContext: {
        topic: 'AI note-taking for consultants',
        market_facts_summary: {
          pain_points: ['Manual documentation'],
        },
        iteration_no: 1,
      },
      judgeTasks: [
        {
          taskType: 'MVP_RESCOPING',
          targetAgent: 'OPPORTUNITY_STRATEGIST',
          description: 'Narrow the MVP to one workflow.',
          blocking: true,
        },
      ],
    });

    expect(result.normalizedOutput.recommended_entry_point.title).toBe(
      'AI note copilot',
    );
    expect(result.renderedPrompt.structuredJudgeTasks).toHaveLength(1);
    expect(result.renderedPrompt.prompt).toContain(
      'Business Model Hypotheses',
    );
  });
});
