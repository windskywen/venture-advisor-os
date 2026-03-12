import { describe, expect, it } from 'vitest';

import {
  createStructuredLogger,
  type StructuredLogEntry,
} from '@venture-advisor-os/shared-types';

import { persistAgentRun } from '../src/index.js';

describe('agent run persistence', () => {
  it('persists raw and normalized outputs plus VC score details', async () => {
    const calls: {
      agentOutputs: unknown[];
      scoreDetails: unknown[];
    } = {
      agentOutputs: [],
      scoreDetails: [],
    };

    const repositories = {
      agentOutputs: {
        async create(agentOutput) {
          calls.agentOutputs.push(agentOutput);
          return agentOutput;
        },
      },
      scoreDetails: {
        async insertMany(scoreDetails) {
          calls.scoreDetails.push(scoreDetails);
          return [...scoreDetails];
        },
      },
    };

    const result = await persistAgentRun(repositories, {
      agentOutputId: 'ao-1',
      caseId: 'case-1',
      iterationId: 'iter-1',
      iterationNo: 1,
      agentName: 'VCCritic',
      rawOutput: 'raw output',
      normalizedOutput: {
        summary: 'Crowded market.',
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
      },
      validationErrors: ['warning'],
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
      },
      latencyMs: 1200,
      createdAt: '2026-03-12T00:00:00.000Z',
    });

    expect(calls.agentOutputs).toHaveLength(1);
    expect(result.scoreDetails).toHaveLength(1);
    expect(result.scoreDetails[0]?.dimension).toBe('Market Size');
  });

  it('persists raw and normalized outputs for every major agent run type', async () => {
    const persistedAgentOutputs: Array<{
      agentName: string;
      rawOutput: unknown;
      normalizedOutput: Record<string, unknown>;
    }> = [];
    const repositories = {
      agentOutputs: {
        async create(agentOutput: {
          agentName: string;
          rawOutput: unknown;
          normalizedOutput: Record<string, unknown>;
        }) {
          persistedAgentOutputs.push(agentOutput);
          return agentOutput;
        },
      },
      scoreDetails: {
        async insertMany(scoreDetails: readonly unknown[]) {
          return [...scoreDetails];
        },
      },
    };
    const runs = [
      {
        agentName: 'FactResearcher' as const,
        rawOutput: 'fact raw output',
        normalizedOutput: {
          market_problem_definition: 'Manual bookkeeping is slow.',
          target_user_segments: ['Solo freelancers'],
          pain_points: ['Month-end close takes too long'],
          workflow_gaps: ['No lightweight automation'],
          current_alternatives: ['Spreadsheets'],
          competitors: [],
          evidence: [],
          assumptions: ['Users will review suggestions'],
        },
      },
      {
        agentName: 'OpportunityStrategist' as const,
        rawOutput: 'strategy raw output',
        normalizedOutput: {
          opportunity_options: [
            {
              title: 'AI bookkeeper copilot',
              product_shape: 'copilot',
              target_user: 'Solo freelancers',
              core_pain: 'Manual bookkeeping',
              monetization: 'subscription',
              pros: ['Fast setup'],
              cons: ['Crowded market'],
            },
          ],
          recommended_entry_point: {
            title: 'AI bookkeeper copilot',
            rationale: 'High-frequency pain point.',
          },
          business_model_hypotheses: ['Seat-based SaaS'],
          mvp_direction: ['Receipt capture', 'Monthly summary'],
          feasibility_scores: [
            {
              dimension: 'Technical',
              score: 8,
              rationale: 'Uses proven OCR and LLM tooling.',
            },
          ],
          key_assumptions: ['Users will upload receipts weekly.'],
        },
      },
      {
        agentName: 'VCCritic' as const,
        rawOutput: 'vc raw output',
        normalizedOutput: {
          summary: 'Crowded market.',
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
        },
      },
      {
        agentName: 'Judge' as const,
        rawOutput: 'judge raw output',
        normalizedOutput: {
          decision: 'REVISE',
          rationale: 'Evidence needs refreshing.',
          accepted_objections: ['Weak evidence'],
          rejected_objections: [],
          evidence_assessment: {
            completeness: 6,
            freshness: 5,
            confidence: 6,
          },
          iteration_worthiness: {
            should_continue: true,
            reason: 'Clear evidence gap remains.',
          },
          next_iteration_tasks: [
            {
              target_agent: 'FACT_RESEARCHER',
              task_type: 'EVIDENCE_REFRESH',
              description: 'Refresh the latest market evidence.',
              blocking: true,
            },
          ],
          termination_warning: false,
        },
      },
      {
        agentName: 'PRDStrategist' as const,
        rawOutput: 'prd raw output',
        normalizedOutput: {
          product_overview: 'An AI bookkeeper copilot for freelancers.',
          problem_statement: 'Manual bookkeeping is slow.',
          target_users: ['Solo freelancers'],
          use_cases: ['Capture receipts'],
          functional_requirements: ['Upload receipts', 'Generate monthly summaries'],
          non_functional_requirements: [
            'Keep summaries available within 30 seconds',
          ],
          mvp_scope: ['Receipt capture', 'Monthly summary'],
          out_of_scope: ['Bank-feed reconciliation'],
          user_stories: [
            'As a freelancer, I want quick bookkeeping summaries.',
          ],
          success_metrics: ['Reduce month-end bookkeeping time by 50%'],
          risks: ['Users may not trust generated categorizations'],
          open_questions: ['Should accountant export ship in MVP?'],
        },
      },
      {
        agentName: 'POCArchitect' as const,
        rawOutput: 'poc raw output',
        normalizedOutput: {
          poc_goal: 'Validate that freelancers trust AI bookkeeping summaries.',
          validation_hypotheses: ['Users trust generated summaries.'],
          demo_scope: ['Receipt upload and summary generation'],
          technical_architecture: ['Frontend', 'API', 'LLM service'],
          core_modules: ['Upload', 'OCR', 'Summarization'],
          data_inputs: ['Receipt images'],
          mock_vs_real: ['Real receipt input', 'Mock accounting export'],
          acceptance_criteria: ['Users confirm summaries are useful'],
          build_tasks: ['Build receipt upload', 'Build summarization flow'],
          risks_and_fallback: [
            'If OCR quality is poor, use a curated sample receipt set.',
          ],
        },
      },
    ];

    for (const [index, run] of runs.entries()) {
      await persistAgentRun(repositories, {
        agentOutputId: `ao-${index + 1}`,
        caseId: 'case-1',
        iterationId: 'iter-1',
        iterationNo: 1,
        createdAt: '2026-03-12T00:00:00.000Z',
        ...run,
      });
    }

    expect(persistedAgentOutputs).toHaveLength(runs.length);
    expect(
      persistedAgentOutputs.map((agentOutput) => ({
        agentName: agentOutput.agentName,
        rawOutput: agentOutput.rawOutput,
        normalizedOutput: agentOutput.normalizedOutput,
      })),
    ).toEqual(runs);
  });

  it('derives Judge evidence assessment as score details', async () => {
    const repositories = {
      agentOutputs: {
        async create(agentOutput) {
          return agentOutput;
        },
      },
      scoreDetails: {
        async insertMany(scoreDetails) {
          return [...scoreDetails];
        },
      },
    };

    const result = await persistAgentRun(repositories, {
      agentOutputId: 'ao-2',
      caseId: 'case-1',
      iterationId: 'iter-1',
      iterationNo: 1,
      agentName: 'Judge',
      rawOutput: 'raw output',
      normalizedOutput: {
        decision: 'REVISE',
        rationale: 'Evidence needs refreshing.',
        accepted_objections: ['Weak evidence'],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 6,
          freshness: 5,
          confidence: 6,
        },
        iteration_worthiness: {
          should_continue: true,
          reason: 'Clear evidence gap remains.',
        },
        next_iteration_tasks: [
          {
            target_agent: 'FACT_RESEARCHER',
            task_type: 'EVIDENCE_REFRESH',
            description: 'Refresh the latest market evidence.',
            blocking: true,
          },
        ],
        termination_warning: false,
      },
      createdAt: '2026-03-12T00:00:00.000Z',
    });

    expect(result.scoreDetails).toHaveLength(3);
    expect(result.scoreDetails.map((detail) => detail.dimension)).toEqual([
      'completeness',
      'freshness',
      'confidence',
    ]);
  });

  it('logs persisted agent runs and validation warnings as structured entries', async () => {
    const entries: StructuredLogEntry[] = [];
    const logger = createStructuredLogger({
      now: () => new Date('2026-03-12T00:00:00.000Z'),
      write(_line, entry) {
        entries.push(entry);
      },
    });
    const repositories = {
      agentOutputs: {
        async create(agentOutput) {
          return agentOutput;
        },
      },
      scoreDetails: {
        async insertMany(scoreDetails) {
          return [...scoreDetails];
        },
      },
    };

    await persistAgentRun(
      repositories,
      {
        agentOutputId: 'ao-3',
        caseId: 'case-1',
        iterationId: 'iter-1',
        iterationNo: 1,
        agentName: 'FactResearcher',
        rawOutput: 'raw output',
        normalizedOutput: {
          market_problem_definition: 'Manual bookkeeping is slow.',
          target_user_segments: ['Solo freelancers'],
          pain_points: ['Month-end close takes too long'],
          workflow_gaps: ['No lightweight automation'],
          current_alternatives: ['Spreadsheets'],
          competitors: [],
          evidence: [],
          assumptions: ['Users will review suggestions'],
        },
        validationErrors: ['Missing evidence freshness date'],
        createdAt: '2026-03-12T00:00:00.000Z',
      },
      logger,
    );

    expect(entries).toEqual([
      {
        timestamp: '2026-03-12T00:00:00.000Z',
        level: 'warn',
        event: 'agent.run.validation_errors',
        message: 'Persisted agent run with validation errors.',
        context: {
          agentName: 'FactResearcher',
          caseId: 'case-1',
          iterationId: 'iter-1',
          validationErrorCount: 1,
        },
      },
      {
        timestamp: '2026-03-12T00:00:00.000Z',
        level: 'info',
        event: 'agent.run.persisted',
        message: 'Persisted an agent run.',
        context: {
          agentName: 'FactResearcher',
          caseId: 'case-1',
          iterationId: 'iter-1',
          scoreDetailCount: 0,
        },
      },
    ]);
  });
});
