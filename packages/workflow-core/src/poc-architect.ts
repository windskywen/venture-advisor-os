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
import { executeWithMalformedOutputRetry } from './malformed-output-retry.js';
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
  const retryResult = await executeWithMalformedOutputRetry({
    runtime: input.runtime,
    request: {
      agentName: 'POCArchitect',
      prompt: renderedPrompt.prompt,
      inputPayload: renderedPrompt.inputPayload,
    },
    normalize(rawOutput) {
      assertOutputConventions({
        registry: input.registry,
        agentName: 'POCArchitect',
        rawOutput,
      });
      return normalizePocArchitectOutput(rawOutput);
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
