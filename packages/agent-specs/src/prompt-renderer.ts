import {
  filterJudgeTasksForTargetAgent,
  toJudgeTaskPromptInput,
  type JudgeTaskPayload,
  type JudgeTaskPromptInput,
} from '@venture-advisor-os/shared-types';

import type { PromptTemplateRegistry, PromptTemplateMetadata } from './registry.js';

const AGENT_TO_JUDGE_TARGET = {
  FactResearcher: 'FACT_RESEARCHER',
  OpportunityStrategist: 'OPPORTUNITY_STRATEGIST',
} as const;

export interface AgentPromptRenderInput {
  registry: PromptTemplateRegistry;
  agentName: string;
  caseContext: Record<string, unknown>;
  priorOutputs?: Record<string, unknown>;
  judgeTasks?: readonly JudgeTaskPayload[];
  stopConditions?: readonly string[];
}

export interface RenderedAgentPrompt {
  agentName: string;
  prompt: string;
  inputPayload: Record<string, unknown>;
  structuredJudgeTasks: JudgeTaskPromptInput[];
  judgeTaskSummary: string[];
  requiredSections: string[];
}

export function renderAgentPrompt(
  input: AgentPromptRenderInput,
): RenderedAgentPrompt {
  const template = resolvePromptTemplate(input.registry, input.agentName);
  const structuredJudgeTasks = selectStructuredJudgeTasks(
    template,
    input.judgeTasks ?? [],
  );
  const judgeTaskSummary = structuredJudgeTasks.map(
    (task) =>
      `${task.blocking ? '[blocking] ' : ''}${task.task_type}: ${task.description}`,
  );

  const inputPayload: Record<string, unknown> = {
    ...input.caseContext,
    ...(input.priorOutputs ?? {}),
  };

  if (structuredJudgeTasks.length > 0) {
    inputPayload.judge_tasks = structuredJudgeTasks;
  }

  const prompt = [
    `# ${template.agentName} Prompt`,
    '',
    `Role: ${template.role}`,
    `Mission: ${template.mission}`,
    '',
    '## Global Rules',
    ...template.common.global_rules.map((rule) => `- ${rule}`),
    '',
    '## Objectives',
    ...template.objectives.map((objective) => `- ${objective}`),
    '',
    '## Agent Rules',
    ...template.rules.map((rule) => `- ${rule}`),
    '',
    '## Case Context',
    toJsonBlock(input.caseContext),
    '',
    '## Prior Outputs',
    toJsonBlock(input.priorOutputs ?? {}),
    '',
    '## Structured Judge Tasks',
    structuredJudgeTasks.length > 0
      ? toJsonBlock(structuredJudgeTasks)
      : 'None.',
    '',
    '## Judge Task Summary',
    judgeTaskSummary.length > 0
      ? judgeTaskSummary.map((task) => `- ${task}`).join('\n')
      : 'None.',
    '',
    '## Scoring Rubric',
    `Use the shared scoring scale ${template.common.scoring_scale.min}-${template.common.scoring_scale.max}.`,
    ...resolveScoreRubricLines(template),
    '',
    '## Stop Conditions',
    ...(input.stopConditions?.length
      ? input.stopConditions.map((condition) => `- ${condition}`)
      : ['- Stop when the required sections and JSON summary are complete.']),
    '',
    '## Required Markdown Sections',
    ...template.requiredSections.map((section) => `- ${section}`),
    '',
    '## Output Conventions',
    `- Markdown sections required: ${String(template.common.output_conventions.markdown_sections)}`,
    `- JSON summary required: ${String(template.common.output_conventions.json_summary_required)}`,
    `- Citation required for facts: ${String(template.common.output_conventions.citation_required_for_facts)}`,
    '',
    '## Input Schema',
    toJsonBlock(template.inputSchema ?? {}),
    '',
    '## JSON Summary Schema',
    toJsonBlock(template.jsonSummarySchema),
    '',
    '## Success Criteria',
    ...template.successCriteria.map((criterion) => `- ${criterion}`),
  ].join('\n');

  return {
    agentName: template.agentName,
    prompt,
    inputPayload,
    structuredJudgeTasks,
    judgeTaskSummary,
    requiredSections: template.requiredSections,
  };
}

function resolvePromptTemplate(
  registry: PromptTemplateRegistry,
  agentName: string,
): PromptTemplateMetadata {
  const template = registry.agents[agentName];
  if (template) {
    return template;
  }

  throw new Error(`Unknown prompt template agent: ${agentName}`);
}

function selectStructuredJudgeTasks(
  template: PromptTemplateMetadata,
  judgeTasks: readonly JudgeTaskPayload[],
): JudgeTaskPromptInput[] {
  const targetAgent =
    AGENT_TO_JUDGE_TARGET[
      template.agentName as keyof typeof AGENT_TO_JUDGE_TARGET
    ];
  if (!targetAgent) {
    return [];
  }

  return filterJudgeTasksForTargetAgent(judgeTasks, targetAgent).map(
    toJudgeTaskPromptInput,
  );
}

function resolveScoreRubricLines(template: PromptTemplateMetadata): string[] {
  const scoreDimensions = template.spec.score_dimensions;
  if (!Array.isArray(scoreDimensions) || scoreDimensions.length === 0) {
    return [];
  }

  return [
    'Score dimensions:',
    ...scoreDimensions.map((dimension) => `- ${String(dimension)}`),
  ];
}

function toJsonBlock(value: unknown): string {
  return ['```json', JSON.stringify(value, null, 2), '```'].join('\n');
}
