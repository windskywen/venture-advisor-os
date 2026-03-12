import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import {
  createMockAgentRuntimeAdapter,
  createResearchTool,
  executeFactResearcher,
  normalizeFactResearcherOutput,
} from '../src/index.js';
import { renderCompliantAgentOutput } from './test-helpers.js';

describe('FactResearcher execution and normalization', () => {
  it('normalizes JSON summaries from raw output', () => {
    const normalized = normalizeFactResearcherOutput(`\`\`\`json
{
  "market_problem_definition": "Consultants spend too much time documenting meetings.",
  "target_user_segments": ["Consultants"],
  "pain_points": ["Manual documentation"],
  "workflow_gaps": ["No structured note workflow"],
  "current_alternatives": ["Word docs"],
  "competitors": [
    {
      "name": "Tool A",
      "positioning": "Meeting notes",
      "weakness_or_gap": "Not tailored to consulting"
    }
  ],
  "evidence": [
    {
      "claim": "Consultants spend hours documenting meetings.",
      "source_date": "2026-03-01",
      "source_type": "report",
      "confidence": "high"
    }
  ],
  "assumptions": ["AI summarization quality is sufficient."]
}
\`\`\``);

    expect(normalized.workflow_gaps).toEqual([
      'No structured note workflow',
    ]);
    expect(normalized.evidence[0]?.source_date).toBe('2026-03-01');
  });

  it('executes FactResearcher through research, prompt rendering, runtime, and normalization', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const judgeTasks = [
      {
        taskType: 'EVIDENCE_REFRESH' as const,
        targetAgent: 'FACT_RESEARCHER' as const,
        description: 'Refresh the latest market evidence.',
        blocking: true,
      },
      {
        taskType: 'MVP_RESCOPING' as const,
        targetAgent: 'OPPORTUNITY_STRATEGIST' as const,
        description: 'Narrow the proposed product scope.',
        blocking: false,
      },
    ];
    const researchTool = createResearchTool((query) => ({
      query,
      findings: [
        {
          claim: 'Manual note capture is still common.',
          facts: ['Manual note capture slows consultants down.'],
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
      expect(request.inputPayload).toHaveProperty('latest_research_findings');
      expect(request.inputPayload).toMatchObject({
        researchStyle: 'COMPETITOR_INTENSIVE',
        browsingAutonomy: {
          profile: 'EXPANDED',
          allowAdjacentExploration: true,
          allowCompetitorExploration: true,
          allowOpenEndedQueries: true,
          maxSources: 6,
          recencyWindowDays: 180,
        },
      });
      expect(request.inputPayload.judge_tasks).toEqual([
        {
          task_type: 'EVIDENCE_REFRESH',
          target_agent: 'FACT_RESEARCHER',
          description: 'Refresh the latest market evidence.',
          blocking: true,
        },
      ]);
      expect(request.prompt).toContain(
        '- [blocking] EVIDENCE_REFRESH: Refresh the latest market evidence.',
      );

      return {
        agentName: request.agentName,
        rawOutput: renderCompliantAgentOutput(registry, request.agentName, {
          market_problem_definition:
            'Consultants spend too much time documenting meetings.',
          target_user_segments: ['Consultants'],
          pain_points: ['Manual documentation'],
          workflow_gaps: ['No structured note workflow'],
          current_alternatives: ['Word docs'],
          competitors: [
            {
              name: 'Tool A',
              positioning: 'Meeting notes',
              weakness_or_gap: 'Not tailored to consulting',
            },
          ],
          evidence: [
            {
              claim: 'Consultants spend hours documenting meetings.',
              source_date: '2026-03-01',
              source_type: 'report',
              confidence: 'high',
            },
          ],
          assumptions: ['AI summarization quality is sufficient.'],
        }),
      };
    });

    const result = await executeFactResearcher({
      registry,
      runtime,
      researchTool,
      caseContext: {
        topic: 'AI note-taking for consultants',
        region: 'AU',
        researchStyle: 'COMPETITOR_INTENSIVE',
        browsingAutonomy: {
          profile: 'EXPANDED',
          allowAdjacentExploration: true,
          allowCompetitorExploration: true,
          allowOpenEndedQueries: true,
          maxSources: 6,
          recencyWindowDays: 180,
        },
        iteration_no: 1,
      },
      judgeTasks,
      requestedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(result.researchReport.findings).toHaveLength(1);
    expect(result.researchReport.query).toMatchObject({
      researchStyle: 'COMPETITOR_INTENSIVE',
      browsingAutonomy: {
        profile: 'EXPANDED',
        allowAdjacentExploration: true,
        allowCompetitorExploration: true,
        allowOpenEndedQueries: true,
        maxSources: 6,
        recencyWindowDays: 180,
      },
    });
    expect(result.normalizedOutput.competitors[0]?.name).toBe('Tool A');
    expect(result.renderedPrompt.prompt).toContain('FactResearcher Prompt');
    expect(result.renderedPrompt.structuredJudgeTasks).toEqual([
      {
        task_type: 'EVIDENCE_REFRESH',
        target_agent: 'FACT_RESEARCHER',
        description: 'Refresh the latest market evidence.',
        blocking: true,
      },
    ]);
  });

  it('retries once when the first FactResearcher response misses the format contract', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const prompts: string[] = [];
    let callCount = 0;
    const researchTool = createResearchTool((query) => ({
      query,
      findings: [
        {
          claim: 'Manual note capture is still common.',
          facts: ['Manual note capture slows consultants down.'],
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
      prompts.push(request.prompt);
      callCount += 1;

      return {
        agentName: request.agentName,
        rawOutput:
          callCount === 1
            ? 'Here is a quick answer without the required sections.'
            : renderCompliantAgentOutput(registry, request.agentName, {
                market_problem_definition:
                  'Consultants spend too much time documenting meetings.',
                target_user_segments: ['Consultants'],
                pain_points: ['Manual documentation'],
                workflow_gaps: ['No structured note workflow'],
                current_alternatives: ['Word docs'],
                competitors: [
                  {
                    name: 'Tool A',
                    positioning: 'Meeting notes',
                    weakness_or_gap: 'Not tailored to consulting',
                  },
                ],
                evidence: [
                  {
                    claim: 'Consultants spend hours documenting meetings.',
                    source_date: '2026-03-01',
                    source_type: 'report',
                    confidence: 'high',
                  },
                ],
                assumptions: ['AI summarization quality is sufficient.'],
              }),
      };
    });

    const result = await executeFactResearcher({
      registry,
      runtime,
      researchTool,
      caseContext: {
        topic: 'AI note-taking for consultants',
        iteration_no: 1,
      },
      requestedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(result.normalizedOutput.market_problem_definition).toContain(
      'Consultants spend too much time',
    );
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('Previous validation errors:');
  });
});
