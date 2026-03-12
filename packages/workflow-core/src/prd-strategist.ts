import {
  renderAgentPrompt,
  type PromptTemplateRegistry,
  type RenderedAgentPrompt,
} from '@venture-advisor-os/agent-specs';
import {
  PrdStrategistOutputSchema,
  type JudgeDecision,
  type PrdStrategistOutput,
  type CaseStatus,
} from '@venture-advisor-os/shared-types';

import type {
  AgentRuntimeAdapter,
  AgentRuntimeResponse,
} from './agent-runtime.js';
import { assertPrdGenerationAllowed } from './downstream-gating.js';
import { extractJsonSummary } from './normalization-utils.js';
import { assertOutputConventions } from './output-conventions.js';

export interface PrdStrategistExecutionInput {
  registry: PromptTemplateRegistry;
  runtime: AgentRuntimeAdapter;
  caseContext: Record<string, unknown> & {
    topic: string;
    approved_business_summary: Record<string, unknown>;
  };
  currentStatus: CaseStatus;
  latestJudgeDecision: JudgeDecision;
  hasExistingPrd: boolean;
  priorOutputs?: Record<string, unknown>;
  stopConditions?: readonly string[];
}

export interface PrdStrategistExecutionResult {
  renderedPrompt: RenderedAgentPrompt;
  runtimeResponse: AgentRuntimeResponse;
  normalizedOutput: PrdStrategistOutput;
}

export async function executePrdStrategist(
  input: PrdStrategistExecutionInput,
): Promise<PrdStrategistExecutionResult> {
  assertPrdGenerationAllowed({
    currentStatus: input.currentStatus,
    latestJudgeDecision: input.latestJudgeDecision,
    hasExistingPrd: input.hasExistingPrd,
  });

  const renderedPrompt = renderAgentPrompt({
    registry: input.registry,
    agentName: 'PRDStrategist',
    caseContext: input.caseContext,
    priorOutputs: input.priorOutputs,
    stopConditions: input.stopConditions,
  });
  const runtimeResponse = await input.runtime.run({
    agentName: 'PRDStrategist',
    prompt: renderedPrompt.prompt,
    inputPayload: renderedPrompt.inputPayload,
  });
  assertOutputConventions({
    registry: input.registry,
    agentName: 'PRDStrategist',
    rawOutput: runtimeResponse.rawOutput,
  });
  const normalizedOutput = normalizePrdStrategistOutput(
    runtimeResponse.rawOutput,
  );

  return {
    renderedPrompt,
    runtimeResponse,
    normalizedOutput,
  };
}

export function normalizePrdStrategistOutput(
  rawOutput: string | unknown,
): PrdStrategistOutput {
  const normalizedOutput = PrdStrategistOutputSchema.parse(
    extractJsonSummary(rawOutput),
  );

  if (normalizedOutput.functional_requirements.length === 0) {
    throw new Error(
      'PRDStrategist output must include functional requirements.',
    );
  }

  return normalizedOutput;
}
