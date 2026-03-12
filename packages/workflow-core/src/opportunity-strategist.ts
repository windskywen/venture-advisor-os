import {
  renderAgentPrompt,
  type PromptTemplateRegistry,
  type RenderedAgentPrompt,
} from '@venture-advisor-os/agent-specs';
import {
  OpportunityStrategistOutputSchema,
  type JudgeTaskPayload,
  type OpportunityStrategistOutput,
} from '@venture-advisor-os/shared-types';

import type {
  AgentRuntimeAdapter,
  AgentRuntimeResponse,
} from './agent-runtime.js';
import { extractJsonSummary } from './normalization-utils.js';
import { assertOutputConventions } from './output-conventions.js';

export interface OpportunityStrategistExecutionInput {
  registry: PromptTemplateRegistry;
  runtime: AgentRuntimeAdapter;
  caseContext: Record<string, unknown> & {
    topic: string;
    market_facts_summary: Record<string, unknown>;
  };
  priorOutputs?: Record<string, unknown>;
  judgeTasks?: readonly JudgeTaskPayload[];
  stopConditions?: readonly string[];
}

export interface OpportunityStrategistExecutionResult {
  renderedPrompt: RenderedAgentPrompt;
  runtimeResponse: AgentRuntimeResponse;
  normalizedOutput: OpportunityStrategistOutput;
}

export async function executeOpportunityStrategist(
  input: OpportunityStrategistExecutionInput,
): Promise<OpportunityStrategistExecutionResult> {
  const renderedPrompt = renderAgentPrompt({
    registry: input.registry,
    agentName: 'OpportunityStrategist',
    caseContext: input.caseContext,
    priorOutputs: input.priorOutputs,
    judgeTasks: input.judgeTasks,
    stopConditions: input.stopConditions,
  });
  const runtimeResponse = await input.runtime.run({
    agentName: 'OpportunityStrategist',
    prompt: renderedPrompt.prompt,
    inputPayload: renderedPrompt.inputPayload,
  });
  assertOutputConventions({
    registry: input.registry,
    agentName: 'OpportunityStrategist',
    rawOutput: runtimeResponse.rawOutput,
  });
  const normalizedOutput = normalizeOpportunityStrategistOutput(
    runtimeResponse.rawOutput,
  );

  return {
    renderedPrompt,
    runtimeResponse,
    normalizedOutput,
  };
}

export function normalizeOpportunityStrategistOutput(
  rawOutput: string | unknown,
): OpportunityStrategistOutput {
  const normalizedOutput = OpportunityStrategistOutputSchema.parse(
    extractJsonSummary(rawOutput),
  );

  if (!normalizedOutput.recommended_entry_point.title) {
    throw new Error(
      'OpportunityStrategist output must include a recommended entry point title.',
    );
  }

  if (normalizedOutput.business_model_hypotheses.length === 0) {
    throw new Error(
      'OpportunityStrategist output must include at least one business model hypothesis.',
    );
  }

  return normalizedOutput;
}
