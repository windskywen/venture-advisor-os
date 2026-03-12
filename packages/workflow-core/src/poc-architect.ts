import {
  renderAgentPrompt,
  type PromptTemplateRegistry,
  type RenderedAgentPrompt,
} from '@venture-advisor-os/agent-specs';
import {
  PocArchitectOutputSchema,
  type CaseStatus,
  type JudgeDecision,
  type PocArchitectOutput,
} from '@venture-advisor-os/shared-types';

import type {
  AgentRuntimeAdapter,
  AgentRuntimeResponse,
} from './agent-runtime.js';
import { assertPocGenerationAllowed } from './downstream-gating.js';
import { extractJsonSummary } from './normalization-utils.js';
import { assertOutputConventions } from './output-conventions.js';

export interface PocArchitectExecutionInput {
  registry: PromptTemplateRegistry;
  runtime: AgentRuntimeAdapter;
  caseContext: Record<string, unknown> & {
    topic: string;
    prd_summary: Record<string, unknown>;
  };
  currentStatus: CaseStatus;
  latestJudgeDecision: JudgeDecision;
  hasPrd: boolean;
  hasExistingPoc: boolean;
  priorOutputs?: Record<string, unknown>;
  stopConditions?: readonly string[];
}

export interface PocArchitectExecutionResult {
  renderedPrompt: RenderedAgentPrompt;
  runtimeResponse: AgentRuntimeResponse;
  normalizedOutput: PocArchitectOutput;
}

export async function executePocArchitect(
  input: PocArchitectExecutionInput,
): Promise<PocArchitectExecutionResult> {
  assertPocGenerationAllowed({
    currentStatus: input.currentStatus,
    latestJudgeDecision: input.latestJudgeDecision,
    hasPrd: input.hasPrd,
    hasExistingPoc: input.hasExistingPoc,
  });

  const renderedPrompt = renderAgentPrompt({
    registry: input.registry,
    agentName: 'POCArchitect',
    caseContext: input.caseContext,
    priorOutputs: input.priorOutputs,
    stopConditions: input.stopConditions,
  });
  const runtimeResponse = await input.runtime.run({
    agentName: 'POCArchitect',
    prompt: renderedPrompt.prompt,
    inputPayload: renderedPrompt.inputPayload,
  });
  assertOutputConventions({
    registry: input.registry,
    agentName: 'POCArchitect',
    rawOutput: runtimeResponse.rawOutput,
  });
  const normalizedOutput = normalizePocArchitectOutput(
    runtimeResponse.rawOutput,
  );

  return {
    renderedPrompt,
    runtimeResponse,
    normalizedOutput,
  };
}

export function normalizePocArchitectOutput(
  rawOutput: string | unknown,
): PocArchitectOutput {
  const normalizedOutput = PocArchitectOutputSchema.parse(
    extractJsonSummary(rawOutput),
  );

  if (normalizedOutput.build_tasks.length === 0) {
    throw new Error('POCArchitect output must include build tasks.');
  }

  return normalizedOutput;
}
