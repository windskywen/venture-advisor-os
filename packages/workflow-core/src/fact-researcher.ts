import {
  renderAgentPrompt,
  type PromptTemplateRegistry,
  type RenderedAgentPrompt,
} from '@venture-advisor-os/agent-specs';
import {
  FactResearcherOutputSchema,
  type BrowsingAutonomy,
  type FactResearcherOutput,
  type JudgeTaskPayload,
  type ResearchStyle,
} from '@venture-advisor-os/shared-types';

import type {
  AgentRuntimeAdapter,
  AgentRuntimeResponse,
} from './agent-runtime.js';
import { extractJsonSummary } from './normalization-utils.js';
import { assertOutputConventions } from './output-conventions.js';
import type { ResearchReport, ResearchTool } from './research-tool.js';

export interface FactResearcherExecutionInput {
  registry: PromptTemplateRegistry;
  runtime: AgentRuntimeAdapter;
  researchTool: ResearchTool;
  caseContext: Record<string, unknown> & {
    topic: string;
    region?: string;
    researchStyle?: ResearchStyle;
    browsingAutonomy?: BrowsingAutonomy;
  };
  priorOutputs?: Record<string, unknown>;
  judgeTasks?: readonly JudgeTaskPayload[];
  requestedAt: string;
  stopConditions?: readonly string[];
}

export interface FactResearcherExecutionResult {
  renderedPrompt: RenderedAgentPrompt;
  runtimeResponse: AgentRuntimeResponse;
  researchReport: ResearchReport;
  normalizedOutput: FactResearcherOutput;
}

export async function executeFactResearcher(
  input: FactResearcherExecutionInput,
): Promise<FactResearcherExecutionResult> {
  const researchReport = await input.researchTool.search({
    topic: input.caseContext.topic,
    region: input.caseContext.region,
    requestedAt: input.requestedAt,
    researchStyle: input.caseContext.researchStyle,
    browsingAutonomy: input.caseContext.browsingAutonomy,
  });

  const renderedPrompt = renderAgentPrompt({
    registry: input.registry,
    agentName: 'FactResearcher',
    caseContext: {
      ...input.caseContext,
      latest_research_findings: researchReport.findings,
    },
    priorOutputs: input.priorOutputs,
    judgeTasks: input.judgeTasks,
    stopConditions: input.stopConditions,
  });
  const runtimeResponse = await input.runtime.run({
    agentName: 'FactResearcher',
    prompt: renderedPrompt.prompt,
    inputPayload: renderedPrompt.inputPayload,
  });
  assertOutputConventions({
    registry: input.registry,
    agentName: 'FactResearcher',
    rawOutput: runtimeResponse.rawOutput,
  });
  const normalizedOutput = normalizeFactResearcherOutput(
    runtimeResponse.rawOutput,
  );

  return {
    renderedPrompt,
    runtimeResponse,
    researchReport,
    normalizedOutput,
  };
}

export function normalizeFactResearcherOutput(
  rawOutput: string | unknown,
): FactResearcherOutput {
  const normalizedOutput = FactResearcherOutputSchema.parse(
    extractJsonSummary(rawOutput),
  );

  for (const evidence of normalizedOutput.evidence) {
    if (!evidence.source_date || !evidence.source_type) {
      throw new Error(
        'FactResearcher evidence entries must include source_date and source_type.',
      );
    }
  }

  return normalizedOutput;
}
