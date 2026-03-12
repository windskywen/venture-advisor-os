import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry, renderAgentPrompt } from '@venture-advisor-os/agent-specs';
import type { AgentOutput } from '@venture-advisor-os/shared-types';

import { buildTraceablePriorOutputs } from '../src/index.js';

describe('traceable prior outputs', () => {
  it('preserves output refs across mixed-iteration reruns for downstream prompts', () => {
    const agentOutputs: AgentOutput[] = [
      {
        agentOutputId: 'a-1',
        caseId: 'case-1',
        iterationId: 'iter-1',
        iterationNo: 1,
        agentName: 'FactResearcher',
        rawOutput: '{}',
        normalizedOutput: {
          market_problem_definition: 'Manual documentation is slow.',
        },
        validationErrors: [],
        createdAt: '2026-03-10T00:00:00.000Z',
      },
      {
        agentOutputId: 'b-1',
        caseId: 'case-1',
        iterationId: 'iter-1',
        iterationNo: 1,
        agentName: 'OpportunityStrategist',
        rawOutput: '{}',
        normalizedOutput: {
          recommended_entry_point: {
            title: 'Initial wedge',
          },
        },
        validationErrors: [],
        createdAt: '2026-03-10T00:05:00.000Z',
      },
      {
        agentOutputId: 'b-2',
        caseId: 'case-1',
        iterationId: 'iter-2',
        iterationNo: 2,
        agentName: 'OpportunityStrategist',
        rawOutput: '{}',
        normalizedOutput: {
          recommended_entry_point: {
            title: 'Reframed wedge',
          },
        },
        validationErrors: [],
        createdAt: '2026-03-11T00:00:00.000Z',
      },
      {
        agentOutputId: 'c-2',
        caseId: 'case-1',
        iterationId: 'iter-2',
        iterationNo: 2,
        agentName: 'VCCritic',
        rawOutput: '{}',
        normalizedOutput: {
          recommendation: 'Revise',
        },
        validationErrors: [],
        createdAt: '2026-03-11T00:05:00.000Z',
      },
    ];
    const priorOutputs = buildTraceablePriorOutputs(agentOutputs);

    expect(
      priorOutputs.traceable_prior_outputs.latestByAgent.FactResearcher,
    ).toMatchObject({
      agentOutputId: 'a-1',
      iterationId: 'iter-1',
      iterationNo: 1,
    });
    expect(
      priorOutputs.traceable_prior_outputs.latestByAgent.OpportunityStrategist,
    ).toMatchObject({
      agentOutputId: 'b-2',
      iterationId: 'iter-2',
      iterationNo: 2,
    });
    expect(priorOutputs.traceable_prior_outputs.history).toHaveLength(4);

    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const rendered = renderAgentPrompt({
      registry,
      agentName: 'Judge',
      caseContext: {
        topic: 'AI note-taking for consultants',
        market_facts_summary: {
          pain_points: ['Manual documentation'],
        },
        opportunity_summary: {
          recommended_entry_point: {
            title: 'Reframed wedge',
          },
        },
        vc_critic_summary: {
          recommendation: 'Revise',
        },
        iteration_no: 2,
        max_iterations: 3,
      },
      priorOutputs,
    });

    expect(rendered.inputPayload.traceable_prior_outputs).toMatchObject({
      latestByAgent: {
        FactResearcher: {
          agentOutputId: 'a-1',
          iterationNo: 1,
        },
        OpportunityStrategist: {
          agentOutputId: 'b-2',
          iterationNo: 2,
        },
      },
    });
    expect(rendered.prompt).toContain('"agentOutputId": "a-1"');
    expect(rendered.prompt).toContain('"agentOutputId": "b-2"');
  });
});
