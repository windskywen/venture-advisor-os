import {
  renderAgentPrompt,
  type PromptTemplateRegistry,
  type RenderedAgentPrompt,
} from '@venture-advisor-os/agent-specs';
import {
  JudgeOutputSchema,
  type JudgeOutput,
} from '@venture-advisor-os/shared-types';

import type {
  AgentRuntimeAdapter,
  AgentRuntimeResponse,
} from './agent-runtime.js';
import { executeWithMalformedOutputRetry } from './malformed-output-retry.js';
import { extractJsonSummary } from './normalization-utils.js';
import { assertOutputConventions } from './output-conventions.js';

export interface JudgeExecutionInput {
  registry: PromptTemplateRegistry;
  runtime: AgentRuntimeAdapter;
  caseContext: Record<string, unknown> & {
    topic: string;
    market_facts_summary: Record<string, unknown>;
    opportunity_summary: Record<string, unknown>;
    vc_critic_summary: Record<string, unknown>;
    iteration_no: number;
    max_iterations: number;
  };
  priorOutputs?: Record<string, unknown>;
  stopConditions?: readonly string[];
}

export interface JudgeExecutionResult {
  renderedPrompt: RenderedAgentPrompt;
  runtimeResponse: AgentRuntimeResponse;
  normalizedOutput: JudgeOutput;
}

export async function executeJudge(
  input: JudgeExecutionInput,
): Promise<JudgeExecutionResult> {
  const renderedPrompt = renderAgentPrompt({
    registry: input.registry,
    agentName: 'Judge',
    caseContext: input.caseContext,
    priorOutputs: input.priorOutputs,
    stopConditions: input.stopConditions,
  });
  const retryResult = await executeWithMalformedOutputRetry({
    runtime: input.runtime,
    request: {
      agentName: 'Judge',
      prompt: renderedPrompt.prompt,
      inputPayload: renderedPrompt.inputPayload,
    },
    normalize(rawOutput) {
      assertOutputConventions({
        registry: input.registry,
        agentName: 'Judge',
        rawOutput,
      });
      return normalizeJudgeOutput(rawOutput);
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

export function normalizeJudgeOutput(rawOutput: string | unknown): JudgeOutput {
  const normalizedOutput = JudgeOutputSchema.parse(extractJsonSummary(rawOutput));

  if (
    normalizedOutput.decision === 'PASS' &&
    normalizedOutput.next_iteration_tasks.length > 0
  ) {
    throw new Error('Judge PASS decisions must not include next_iteration_tasks.');
  }

  if (
    ['REVISE', 'PIVOT'].includes(normalizedOutput.decision) &&
    normalizedOutput.next_iteration_tasks.length === 0
  ) {
    throw new Error(
      'Judge REVISE/PIVOT decisions must include at least one next_iteration_task.',
    );
  }

  return normalizedOutput;
}
