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
  const runtimeResponse = await input.runtime.run({
    agentName: 'Judge',
    prompt: renderedPrompt.prompt,
    inputPayload: renderedPrompt.inputPayload,
  });
  assertOutputConventions({
    registry: input.registry,
    agentName: 'Judge',
    rawOutput: runtimeResponse.rawOutput,
  });
  const normalizedOutput = normalizeJudgeOutput(runtimeResponse.rawOutput);

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
