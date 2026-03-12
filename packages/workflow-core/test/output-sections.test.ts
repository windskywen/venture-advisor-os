import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import { renderCompliantAgentOutput } from './test-helpers.js';

describe('required output sections', () => {
  it('includes all required markdown sections for Agent A, B, C, and J outputs', () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const outputs = {
      FactResearcher: renderCompliantAgentOutput(registry, 'FactResearcher', {
        market_problem_definition:
          'Consultants spend too much time documenting meetings.',
        target_user_segments: ['Consultants'],
        pain_points: ['Manual documentation'],
        workflow_gaps: ['No structured note workflow'],
        current_alternatives: ['Word docs'],
        competitors: [],
        evidence: [
          {
            claim: 'Manual documentation is still common.',
            source_date: '2026-03-01',
            source_type: 'report',
            confidence: 'high',
          },
        ],
        assumptions: ['AI summarization quality is sufficient.'],
      }),
      OpportunityStrategist: renderCompliantAgentOutput(
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
      VCCritic: renderCompliantAgentOutput(registry, 'VCCritic', {
        summary: 'The problem is real but crowded.',
        objections: ['Crowded market'],
        fatal_flaws: [],
        manageable_risks: ['Slow GTM'],
        score_breakdown: [
          {
            dimension: 'Market Size',
            score: 7,
            rationale: 'Large enough market.',
          },
        ],
        key_questions: ['Can the team differentiate?'],
        recommendation: 'Proceed',
      }),
      Judge: renderCompliantAgentOutput(registry, 'Judge', {
        decision: 'PASS',
        rationale: 'Evidence is strong enough and objections are manageable.',
        accepted_objections: ['Crowded market'],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 8,
          freshness: 8,
          confidence: 8,
        },
        iteration_worthiness: {
          should_continue: false,
          reason: 'No further work is needed.',
        },
        next_iteration_tasks: [],
        termination_warning: false,
      }),
    } satisfies Record<string, string>;

    for (const [agentName, markdown] of Object.entries(outputs)) {
      const parseResult =
        registry.agents[agentName]?.requiredMarkdownSectionsSchema.safeParse(
          markdown,
        );

      expect(parseResult?.success, agentName).toBe(true);
    }
  });
});
