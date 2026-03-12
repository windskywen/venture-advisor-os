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
import { executeWithMalformedOutputRetry } from './malformed-output-retry.js';
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
  const retryResult = await executeWithMalformedOutputRetry({
    runtime: input.runtime,
    request: {
      agentName: 'OpportunityStrategist',
      prompt: renderedPrompt.prompt,
      inputPayload: renderedPrompt.inputPayload,
    },
    normalize(rawOutput) {
      assertOutputConventions({
        registry: input.registry,
        agentName: 'OpportunityStrategist',
        rawOutput,
      });
      return normalizeOpportunityStrategistOutput(rawOutput);
    },
  });
  if (!retryResult.success) {
    throw new Error(retryResult.validationErrors.join(' '));
  }

  const runtimeResponse = retryResult.response;
  const normalizedOutput = retryResult.normalizedOutput;

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
