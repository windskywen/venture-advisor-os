import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import {
  createMockAgentRuntimeAdapter,
  executePocArchitect,
  normalizePocArchitectOutput,
} from '../src/index.js';
import { renderCompliantAgentOutput } from './test-helpers.js';

describe('POCArchitect execution and normalization', () => {
  it('normalizes JSON summaries from raw output', () => {
    const normalized = normalizePocArchitectOutput(`{
      "poc_goal": "Validate that consultants accept AI-generated notes.",
      "validation_hypotheses": ["Users trust generated summaries."],
      "demo_scope": ["Meeting note capture"],
      "technical_architecture": ["Frontend", "API", "LLM service"],
      "core_modules": ["Capture", "Summarization"],
      "data_inputs": ["Meeting transcript"],
      "mock_vs_real": ["Real transcript input", "Mock CRM sync"],
      "acceptance_criteria": ["Users confirm summaries are useful"],
      "build_tasks": ["Build transcript upload", "Build summarization flow"],
      "risks_and_fallback": ["If transcript quality is poor, fall back to curated sample inputs"]
    }`);

    expect(normalized.build_tasks).toContain('Build transcript upload');
    expect(normalized.risks_and_fallback).toContain(
      'If transcript quality is poor, fall back to curated sample inputs',
    );
  });

  it('executes POCArchitect only when a PRD already exists', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const runtime = createMockAgentRuntimeAdapter(() => ({
      agentName: 'POCArchitect',
      rawOutput: renderCompliantAgentOutput(registry, 'POCArchitect', {
        poc_goal: 'Validate that consultants accept AI-generated notes.',
        validation_hypotheses: ['Users trust generated summaries.'],
        demo_scope: ['Meeting note capture'],
        technical_architecture: ['Frontend', 'API', 'LLM service'],
        core_modules: ['Capture', 'Summarization'],
        data_inputs: ['Meeting transcript'],
        mock_vs_real: ['Real transcript input', 'Mock CRM sync'],
        acceptance_criteria: ['Users confirm summaries are useful'],
        build_tasks: ['Build transcript upload', 'Build summarization flow'],
        risks_and_fallback: [
          'If transcript quality is poor, fall back to curated sample inputs',
        ],
      }),
    }));

    const result = await executePocArchitect({
      registry,
      runtime,
      caseContext: {
        topic: 'AI note-taking for consultants',
        prd_summary: {
          product_overview: 'An AI note copilot for consultants.',
        },
      },
      currentStatus: 'PRD_IN_PROGRESS',
      latestJudgeDecision: 'PASS',
      hasPrd: true,
      hasExistingPoc: false,
    });

    expect(result.normalizedOutput.poc_goal).toBe(
      'Validate that consultants accept AI-generated notes.',
    );
    expect(result.renderedPrompt.prompt).toContain('Risks and Fallback Plan');
  });

  it('rejects POC execution when PRD gating is not satisfied', async () => {
    const registry = loadPromptTemplateRegistry({
      repoRoot: process.cwd(),
    });
    const runtime = createMockAgentRuntimeAdapter(() => ({
      agentName: 'POCArchitect',
      rawOutput: '{}',
    }));

    await expect(
      executePocArchitect({
        registry,
        runtime,
        caseContext: {
          topic: 'AI note-taking for consultants',
          prd_summary: {},
        },
        currentStatus: 'APPROVED_FOR_PRD',
        latestJudgeDecision: 'PASS',
        hasPrd: false,
        hasExistingPoc: false,
      }),
    ).rejects.toThrow(
      'POC generation requires latestJudgeDecision=PASS, an existing PRD',
    );
  });
});
