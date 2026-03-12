import { randomUUID } from 'node:crypto';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';
import { createGuardedPersistenceCoordinator } from '@venture-advisor-os/persistence';
import { describe, expect, it } from 'vitest';

import {
  buildFirstIterationPlan,
  buildManualOverrideResolution,
  buildPassFlowPlan,
  buildPivotIterationPlan,
  buildRejectFlowResult,
  buildReviseIterationPlan,
  createMockAgentRuntimeAdapter,
  createResearchTool,
  executeFactResearcher,
  executeJudge,
  executeOpportunityStrategist,
  executeVcCritic,
  executeWithMalformedOutputRetry,
  normalizeFactResearcherOutput,
  persistAgentRun,
  resolveFailureHandling,
} from '../src/index.js';
import { renderCompliantAgentOutput } from './test-helpers.js';

const registry = loadPromptTemplateRegistry({
  repoRoot: process.cwd(),
});

describe('workflow end-to-end scenarios', () => {
  it('executes the baseline PASS path from A -> B -> C -> J and plans downstream generation', async () => {
    const scenario = await runFirstIterationScenario({
      judgeSummary: {
        decision: 'PASS',
        rationale: 'The opportunity is ready to move forward.',
        accepted_objections: ['Crowded market'],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 8,
          freshness: 8,
          confidence: 8,
        },
        iteration_worthiness: {
          should_continue: false,
          reason: 'No further loops are required.',
        },
        next_iteration_tasks: [],
        termination_warning: false,
      },
    });

    expect(
      scenario.firstIterationPlan.agentRunJobs.map((job) => job.agentName),
    ).toEqual(['FactResearcher', 'OpportunityStrategist', 'VCCritic']);
    expect(scenario.persistedAgentOutputs.map((output) => output.agentName)).toEqual([
      'FactResearcher',
      'OpportunityStrategist',
      'VCCritic',
      'Judge',
    ]);

    const passPlan = buildPassFlowPlan({
      caseId: 'case-1',
      approvedIterationNo: 1,
      latestJudgeDecision: scenario.judge.normalizedOutput.decision,
      currentStatus: 'APPROVED_FOR_PRD',
    });

    expect(passPlan.prdGenerationJob.approvedIterationNo).toBe(1);
    expect(passPlan.pocGenerationJob.approvedIterationNo).toBe(1);
  });

  it('executes the REVISE path and plans targeted reruns from Judge tasks', async () => {
    const scenario = await runFirstIterationScenario({
      judgeSummary: {
        decision: 'REVISE',
        rationale: 'Research and strategy both need one more pass.',
        accepted_objections: ['Weak evidence'],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 6,
          freshness: 6,
          confidence: 6,
        },
        iteration_worthiness: {
          should_continue: true,
          reason: 'Specific gaps remain tractable.',
        },
        next_iteration_tasks: [
          {
            target_agent: 'FACT_RESEARCHER',
            task_type: 'EVIDENCE_REFRESH',
            description: 'Refresh the latest market evidence.',
            blocking: true,
          },
          {
            target_agent: 'OPPORTUNITY_STRATEGIST',
            task_type: 'MVP_RESCOPING',
            description: 'Narrow the MVP to a single workflow.',
            blocking: true,
          },
        ],
        termination_warning: false,
      },
    });

    const revisePlan = buildReviseIterationPlan({
      caseId: 'case-1',
      iterationId: 'iter-1',
      iterationNo: 1,
      judgeTasks: scenario.judge.normalizedOutput.next_iteration_tasks.map(
        (task) => ({
          taskType: task.task_type,
          targetAgent: task.target_agent,
          description: task.description,
          blocking: task.blocking,
        }),
      ),
    });

    expect(revisePlan.rerunJobSequence.map((job) => job.agentName)).toEqual([
      'FactResearcher',
      'OpportunityStrategist',
      'VCCritic',
    ]);
  });

  it('executes the PIVOT path and preserves reusable research when the pivot allows it', async () => {
    const scenario = await runFirstIterationScenario({
      judgeSummary: {
        decision: 'PIVOT',
        rationale: 'The wedge is wrong, but the market research is reusable.',
        accepted_objections: ['Weak GTM'],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 7,
          freshness: 7,
          confidence: 7,
        },
        iteration_worthiness: {
          should_continue: true,
          reason: 'A focused pivot remains viable.',
        },
        next_iteration_tasks: [
          {
            target_agent: 'OPPORTUNITY_STRATEGIST',
            task_type: 'STRATEGY_REFRAME',
            description: 'Reframe the entry point around finance teams.',
            blocking: true,
          },
        ],
        termination_warning: false,
      },
    });

    const pivotPlan = buildPivotIterationPlan({
      caseId: 'case-1',
      iterationId: 'iter-1',
      iterationNo: 1,
      judgeTasks: scenario.judge.normalizedOutput.next_iteration_tasks.map(
        (task) => ({
          taskType: task.task_type,
          targetAgent: task.target_agent,
          description: task.description,
          blocking: task.blocking,
        }),
      ),
      invalidateResearch: false,
      reusableResearchArtifactRefs: [
        {
          sourceIterationNo: 1,
          path: 'storage/cases/case-1/iterations/1/outputs/fact-researcher.json',
          kind: 'normalized-output',
        },
      ],
    });

    expect(pivotPlan.rerunJobSequence.map((job) => job.agentName)).toEqual([
      'OpportunityStrategist',
      'VCCritic',
    ]);
    expect(pivotPlan.rerunJobSequence[0]?.researchArtifactRefs).toHaveLength(1);
  });

  it('executes the REJECT path and returns terminal rejection metadata', async () => {
    const scenario = await runFirstIterationScenario({
      judgeSummary: {
        decision: 'REJECT',
        rationale: 'Evidence remained too weak after review.',
        accepted_objections: ['Weak willingness to pay'],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 4,
          freshness: 5,
          confidence: 4,
        },
        iteration_worthiness: {
          should_continue: false,
          reason: 'The topic is not worth another loop.',
        },
        next_iteration_tasks: [],
        termination_warning: true,
      },
    });

    const rejectResult = buildRejectFlowResult({
      caseId: 'case-1',
      iterationId: 'iter-1',
      iterationNo: 1,
      currentStatus: 'JUDGE_REVIEW',
      rationale: scenario.judge.normalizedOutput.rationale,
      category: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
      decidedAt: '2026-03-12T11:00:00.000Z',
    });

    expect(rejectResult.nextStatus).toBe('REJECTED');
    expect(rejectResult.finalDecision).toBe('REJECT');
  });

  it('recovers malformed agent output with a retry before continuing', async () => {
    let attempts = 0;
    const result = await executeWithMalformedOutputRetry({
      runtime: createMockAgentRuntimeAdapter(() => {
        attempts += 1;

        return {
          agentName: 'FactResearcher',
          rawOutput:
            attempts === 1
              ? 'not valid json'
              : renderCompliantAgentOutput(registry, 'FactResearcher', {
                  market_problem_definition:
                    'Consultants spend too much time documenting meetings.',
                  target_user_segments: ['Consultants'],
                  pain_points: ['Manual documentation'],
                  workflow_gaps: ['No structured note workflow'],
                  current_alternatives: ['Word docs'],
                  competitors: [],
                  evidence: [
                    {
                      claim: 'Manual note capture is still common.',
                      source_date: '2026-03-01',
                      source_type: 'report',
                      confidence: 'high',
                    },
                  ],
                  assumptions: ['AI summarization quality is sufficient.'],
                }),
        };
      }),
      request: {
        agentName: 'FactResearcher',
        prompt: 'Original prompt',
        inputPayload: {},
      },
      normalize(rawOutput) {
        return normalizeFactResearcherOutput(rawOutput);
      },
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('routes schema validation failures to manual review without retrying', async () => {
    const runtime = createMockAgentRuntimeAdapter(() => ({
      agentName: 'Judge',
      rawOutput: renderCompliantAgentOutput(registry, 'Judge', {
        decision: 'REVISE',
      }),
    }));

    await expect(
      executeJudge({
        registry,
        runtime,
        caseContext: {
          topic: 'AI bookkeeping',
          market_facts_summary: {},
          opportunity_summary: {},
          vc_critic_summary: {},
          iteration_no: 1,
          max_iterations: 3,
        },
      }),
    ).rejects.toThrow();

    const resolution = resolveFailureHandling({
      category: 'SCHEMA_VALIDATION_FAILURE',
      retryCount: 0,
      caseId: 'case-1',
      iterationId: 'iter-1',
      agentName: 'Judge',
    });

    expect(resolution.nextAction).toBe('MANUAL_REVIEW');
    expect(resolution.shouldRetry).toBe(false);
  });

  it('fails safely on storage errors and blocks workflow advancement', async () => {
    const coordinator = createGuardedPersistenceCoordinator({
      async withTransaction(callback) {
        return callback({
          async query() {
            throw new Error('database write should not run');
          },
        });
      },
    });

    await expect(
      coordinator.execute({
        async writeStorage() {
          throw new Error('disk full');
        },
        async writeDatabase() {
          return 'unreachable';
        },
      }),
    ).rejects.toThrow('disk full');

    const resolution = resolveFailureHandling({
      category: 'STORAGE_FAILURE',
      retryCount: 0,
      caseId: 'case-1',
      iterationId: 'iter-1',
    });

    expect(resolution.blockWorkflowAdvance).toBe(true);
    expect(resolution.nextAction).toBe('FAIL_CASE');
  });

  it('applies a manual PASS override and uses the promoted iteration for downstream work', () => {
    const resolution = buildManualOverrideResolution({
      caseId: 'case-1',
      currentStatus: 'FAILED',
      action: 'FORCE_PASS_TO_PRD',
      latestCompletedIteration: {
        iterationId: 'iter-2',
        iterationNo: 2,
      },
    });

    const passPlan = buildPassFlowPlan({
      caseId: 'case-1',
      approvedIterationNo: resolution.approvedSourceIterationNo!,
      latestJudgeDecision: 'PASS',
      currentStatus: resolution.nextStatus,
    });

    expect(resolution.approvedSourceIterationNo).toBe(2);
    expect(passPlan.prdGenerationJob.approvedIterationNo).toBe(2);
  });
});

async function runFirstIterationScenario(input: {
  judgeSummary: Record<string, unknown>;
}) {
  const repositories = createInMemoryRunRepositories();
  const researchTool = createResearchTool((query) => ({
    query,
    findings: [
      {
        claim: 'Manual note capture is still common.',
        facts: ['Manual documentation slows analysts down.'],
        sources: [
          {
            title: 'Industry report',
            snippet: 'Documentation is still manual.',
            sourceType: 'report',
            citation: {
              label: '[1]',
              url: 'https://example.com/report',
              publishedAt: '2026-03-01T00:00:00.000Z',
              retrievedAt: '2026-03-10T00:00:00.000Z',
            },
          },
        ],
      },
    ],
  }));
  const runtime = createMockAgentRuntimeAdapter((request) => {
    switch (request.agentName) {
      case 'FactResearcher':
        return {
          agentName: request.agentName,
          rawOutput: renderCompliantAgentOutput(registry, request.agentName, {
            market_problem_definition:
              'Analysts spend too much time documenting findings.',
            target_user_segments: ['Analysts'],
            pain_points: ['Manual documentation'],
            workflow_gaps: ['No structured note workflow'],
            current_alternatives: ['Docs and spreadsheets'],
            competitors: [],
            evidence: [
              {
                claim: 'Manual documentation is still common.',
                source_date: '2026-03-01',
                source_type: 'report',
                confidence: 'high',
              },
            ],
            assumptions: ['Users will adopt AI-assisted note capture.'],
          }),
        };
      case 'OpportunityStrategist':
        return {
          agentName: request.agentName,
          rawOutput: renderCompliantAgentOutput(registry, request.agentName, {
            opportunity_options: [
              {
                title: 'AI note copilot',
                product_shape: 'copilot',
                target_user: 'Analysts',
                core_pain: 'Manual documentation',
                monetization: 'subscription',
                pros: ['Fast'],
                cons: ['Competitive'],
              },
            ],
            recommended_entry_point: {
              title: 'AI note copilot',
              rationale: 'It addresses a high-frequency workflow pain.',
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
            key_assumptions: ['Users will trust generated summaries.'],
          }),
        };
      case 'VCCritic':
        return {
          agentName: request.agentName,
          rawOutput: renderCompliantAgentOutput(registry, request.agentName, {
            summary: 'Viable if focus stays narrow.',
            objections: ['Crowded market'],
            fatal_flaws: [],
            manageable_risks: ['Distribution is still unproven'],
            score_breakdown: [
              {
                dimension: 'Market Size',
                score: 7,
                rationale: 'The workflow is common enough to matter.',
              },
            ],
            key_questions: ['Can the team differentiate quickly?'],
            recommendation: 'Proceed',
          }),
        };
      case 'Judge':
        return {
          agentName: request.agentName,
          rawOutput: renderCompliantAgentOutput(
            registry,
            request.agentName,
            input.judgeSummary,
          ),
        };
      default:
        throw new Error(`Unexpected agent ${request.agentName}`);
    }
  });

  const firstIterationPlan = buildFirstIterationPlan({
    caseId: 'case-1',
    iterationId: 'iter-1',
    iterationNo: 1,
  });
  const factResearcher = await executeFactResearcher({
    registry,
    runtime,
    researchTool,
    caseContext: {
      topic: 'AI note-taking for analysts',
      region: 'AU',
      iteration_no: 1,
    },
    requestedAt: '2026-03-12T10:00:00.000Z',
  });
  await persistNormalizedRun(
    repositories,
    'FactResearcher',
    factResearcher.runtimeResponse.rawOutput,
    factResearcher.normalizedOutput,
  );

  const opportunityStrategist = await executeOpportunityStrategist({
    registry,
    runtime,
    caseContext: {
      topic: 'AI note-taking for analysts',
      market_facts_summary: factResearcher.normalizedOutput,
      iteration_no: 1,
    },
  });
  await persistNormalizedRun(
    repositories,
    'OpportunityStrategist',
    opportunityStrategist.runtimeResponse.rawOutput,
    opportunityStrategist.normalizedOutput,
  );

  const vcCritic = await executeVcCritic({
    registry,
    runtime,
    caseContext: {
      topic: 'AI note-taking for analysts',
      market_facts_summary: factResearcher.normalizedOutput,
      opportunity_summary: opportunityStrategist.normalizedOutput,
      iteration_no: 1,
    },
  });
  await persistNormalizedRun(
    repositories,
    'VCCritic',
    vcCritic.runtimeResponse.rawOutput,
    vcCritic.normalizedOutput,
  );

  const judge = await executeJudge({
    registry,
    runtime,
    caseContext: {
      topic: 'AI note-taking for analysts',
      market_facts_summary: factResearcher.normalizedOutput,
      opportunity_summary: opportunityStrategist.normalizedOutput,
      vc_critic_summary: vcCritic.normalizedOutput,
      iteration_no: 1,
      max_iterations: 3,
    },
  });
  await persistNormalizedRun(
    repositories,
    'Judge',
    judge.runtimeResponse.rawOutput,
    judge.normalizedOutput,
  );

  return {
    firstIterationPlan,
    factResearcher,
    opportunityStrategist,
    vcCritic,
    judge,
    persistedAgentOutputs: repositories.agentOutputs,
    persistedScoreDetails: repositories.scoreDetails,
  };
}

function createInMemoryRunRepositories() {
  const agentOutputs: Array<{ agentName: string }> = [];
  const scoreDetails: Array<{ dimension: string; score: number }> = [];

  return {
    agentOutputs,
    scoreDetails,
    repositories: {
      agentOutputs: {
        async create(agentOutput: {
          agentName: string;
          [key: string]: unknown;
        }) {
          agentOutputs.push({
            agentName: agentOutput.agentName,
          });
          return agentOutput;
        },
      },
      scoreDetails: {
        async insertMany(records: Array<{ dimension: string; score: number }>) {
          scoreDetails.push(...records);
          return records;
        },
      },
    },
  };
}

async function persistNormalizedRun(
  repositories: ReturnType<typeof createInMemoryRunRepositories>,
  agentName:
    | 'FactResearcher'
    | 'OpportunityStrategist'
    | 'VCCritic'
    | 'Judge',
  rawOutput: string | unknown,
  normalizedOutput: Record<string, unknown>,
) {
  await persistAgentRun(repositories.repositories, {
    agentOutputId: randomUUID(),
    caseId: 'case-1',
    iterationId: 'iter-1',
    iterationNo: 1,
    agentName,
    rawOutput:
      typeof rawOutput === 'string'
        ? rawOutput
        : (rawOutput as Record<string, unknown>),
    normalizedOutput,
    createdAt: '2026-03-12T10:00:00.000Z',
  });
}
