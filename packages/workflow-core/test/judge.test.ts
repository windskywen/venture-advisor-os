import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import {
  createMockAgentRuntimeAdapter,
  executeJudge,
  normalizeJudgeOutput,
} from '../src/index.js';
import { renderCompliantAgentOutput } from './test-helpers.js';

describe('Judge execution and normalization', () => {
  it('normalizes JSON summaries from raw output', () => {
    const normalized = normalizeJudgeOutput(`{
      "decision": "REVISE",
      "rationale": "Evidence needs refreshing.",
      "accepted_objections": ["Weak evidence"],
      "rejected_objections": [],
      "evidence_assessment": {
        "completeness": 6,
        "freshness": 5,
        "confidence": 6
      },
      "iteration_worthiness": {
        "should_continue": true,
        "reason": "Clear evidence gap remains."
      },
      "next_iteration_tasks": [
        {
          "target_agent": "FACT_RESEARCHER",
          "task_type": "EVIDENCE_REFRESH",
          "description": "Refresh the latest market evidence.",
          "blocking": true
        }
      ],
      "termination_warning": false
    }`);

    expect(normalized.decision).toBe('REVISE');
    expect(normalized.next_iteration_tasks).toHaveLength(1);
  });

  it('executes Judge through prompt rendering, runtime, and normalization', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const runtime = createMockAgentRuntimeAdapter(() => ({
      agentName: 'Judge',
      rawOutput: renderCompliantAgentOutput(registry, 'Judge', {
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
      }),
    }));

    const result = await executeJudge({
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
        vc_critic_summary: {
          fatal_flaws: ['Weak moat'],
        },
        iteration_no: 1,
        max_iterations: 3,
      },
    });

    expect(result.normalizedOutput.decision).toBe('REVISE');
    expect(result.renderedPrompt.prompt).toContain('Termination Warning');
  });

  it('rejects PASS outputs that still include next iteration tasks', () => {
    expect(() =>
      normalizeJudgeOutput(`{
        "decision": "PASS",
        "rationale": "Looks good.",
        "accepted_objections": [],
        "rejected_objections": [],
        "evidence_assessment": {
          "completeness": 8,
          "freshness": 8,
          "confidence": 8
        },
        "iteration_worthiness": {
          "should_continue": false,
          "reason": "No further work needed."
        },
        "next_iteration_tasks": [
          {
            "target_agent": "FACT_RESEARCHER",
            "task_type": "EVIDENCE_REFRESH",
            "description": "Should not be present.",
            "blocking": true
          }
        ],
        "termination_warning": false
      }`),
    ).toThrow('Judge PASS decisions must not include next_iteration_tasks.');
  });

  it('enforces Judge task enums in next iteration tasks', () => {
    expect(() =>
      normalizeJudgeOutput(`{
        "decision": "REVISE",
        "rationale": "Evidence needs refreshing.",
        "accepted_objections": ["Weak evidence"],
        "rejected_objections": [],
        "evidence_assessment": {
          "completeness": 6,
          "freshness": 5,
          "confidence": 6
        },
        "iteration_worthiness": {
          "should_continue": true,
          "reason": "Clear evidence gap remains."
        },
        "next_iteration_tasks": [
          {
            "target_agent": "INVALID_AGENT",
            "task_type": "NOT_A_TASK",
            "description": "Invalid task.",
            "blocking": true
          }
        ],
        "termination_warning": false
      }`),
    ).toThrow();
  });
});
