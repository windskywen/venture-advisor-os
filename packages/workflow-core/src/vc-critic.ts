import {
  renderAgentPrompt,
  type PromptTemplateRegistry,
  type RenderedAgentPrompt,
} from '@venture-advisor-os/agent-specs';
import {
  VcCriticOutputSchema,
  type VcCriticOutput,
} from '@venture-advisor-os/shared-types';

import type {
  AgentRuntimeAdapter,
  AgentRuntimeResponse,
} from './agent-runtime.js';
import { extractJsonSummary } from './normalization-utils.js';
import { assertOutputConventions } from './output-conventions.js';

export interface VcCriticExecutionInput {
  registry: PromptTemplateRegistry;
  runtime: AgentRuntimeAdapter;
  caseContext: Record<string, unknown> & {
    topic: string;
    market_facts_summary: Record<string, unknown>;
    opportunity_summary: Record<string, unknown>;
  };
  priorOutputs?: Record<string, unknown>;
  stopConditions?: readonly string[];
}

export interface VcCriticExecutionResult {
  renderedPrompt: RenderedAgentPrompt;
  runtimeResponse: AgentRuntimeResponse;
  normalizedOutput: VcCriticOutput;
}

export async function executeVcCritic(
  input: VcCriticExecutionInput,
): Promise<VcCriticExecutionResult> {
  const renderedPrompt = renderAgentPrompt({
    registry: input.registry,
    agentName: 'VCCritic',
    caseContext: input.caseContext,
    priorOutputs: input.priorOutputs,
    stopConditions: input.stopConditions,
  });
  const runtimeResponse = await input.runtime.run({
    agentName: 'VCCritic',
    prompt: renderedPrompt.prompt,
    inputPayload: renderedPrompt.inputPayload,
  });
  assertOutputConventions({
    registry: input.registry,
    agentName: 'VCCritic',
    rawOutput: runtimeResponse.rawOutput,
  });
  const normalizedOutput = normalizeVcCriticOutput(runtimeResponse.rawOutput);

  return {
    renderedPrompt,
    runtimeResponse,
    normalizedOutput,
  };
}

export function normalizeVcCriticOutput(
  rawOutput: string | unknown,
): VcCriticOutput {
  const normalizedOutput = VcCriticOutputSchema.parse(
    extractJsonSummary(rawOutput),
  );

  if (normalizedOutput.score_breakdown.length === 0) {
    throw new Error(
      'VCCritic output must include at least one scoring breakdown entry.',
    );
  }

  if (normalizedOutput.recommendation.trim().length === 0) {
    throw new Error('VCCritic output must include a recommendation.');
  }

  return normalizedOutput;
}
