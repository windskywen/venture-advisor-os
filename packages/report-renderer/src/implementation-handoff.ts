import {
  ImplementationHandoffArtifactSchema,
  type ApprovedBusinessSummaryArtifact,
  type ImplementationHandoffArtifact,
  type PocArchitectOutput,
  type PrdStrategistOutput,
} from '@venture-advisor-os/shared-types';

export interface ComposeImplementationHandoffInput {
  caseId: string;
  approvedIterationNo: number;
  approvedBusinessSummary: ApprovedBusinessSummaryArtifact;
  prd: PrdStrategistOutput;
  poc: PocArchitectOutput;
  artifactRefs: {
    approvedBusinessSummary: string;
    finalBusinessPlan: string;
    prd: string;
    pocSpec: string;
    codexExecutionPlan: string;
  };
  generatedAt?: string;
  sourceOutputRefs?: string[];
}

export function composeImplementationHandoff(
  input: ComposeImplementationHandoffInput,
): ImplementationHandoffArtifact {
  const summary = input.approvedBusinessSummary.summary;

  const implementationBrief = {
    topic: readRequiredString(summary.topic, 'topic'),
    marketProblemDefinition: readRequiredString(
      summary.market_problem_definition,
      'market_problem_definition',
    ),
    targetUserSegments: readStringArray(
      summary.target_user_segments,
      'target_user_segments',
    ),
    recommendedEntryPoint: readRecommendedEntryPoint(summary),
    productOverview: input.prd.product_overview,
    useCases: input.prd.use_cases,
    mvpScope: input.prd.mvp_scope,
    functionalRequirements: input.prd.functional_requirements,
    nonFunctionalRequirements: input.prd.non_functional_requirements,
    technicalArchitecture: input.poc.technical_architecture,
    coreModules: input.poc.core_modules,
    buildTasks: input.poc.build_tasks,
    mockVsReal: input.poc.mock_vs_real,
    successMetrics: input.prd.success_metrics,
    risks: [...input.prd.risks, ...input.poc.risks_and_fallback],
    openQuestions: input.prd.open_questions,
  } as const;

  return ImplementationHandoffArtifactSchema.parse({
    caseId: input.caseId,
    approvedIterationNo: input.approvedIterationNo,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceOutputRefs:
      input.sourceOutputRefs ??
      [
        ...input.approvedBusinessSummary.sourceOutputRefs,
        `iteration:${input.approvedIterationNo}:PRDStrategist`,
        `iteration:${input.approvedIterationNo}:POCArchitect`,
      ],
    artifactRefs: input.artifactRefs,
    implementationBrief,
    codexExecutionPlan: {
      starterPrompt: buildStarterPrompt(implementationBrief),
      bootstrapTasks: implementationBrief.buildTasks.slice(0, 3),
      validationChecklist: [
        ...implementationBrief.successMetrics,
        ...implementationBrief.nonFunctionalRequirements,
        ...implementationBrief.mockVsReal.slice(0, 2),
      ],
    },
  });
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Implementation handoff requires summary.${fieldName}.`);
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  ) {
    return value;
  }

  throw new Error(`Implementation handoff requires summary.${fieldName}.`);
}

function readRecommendedEntryPoint(summary: Record<string, unknown>): string {
  const entryPoint = summary.recommended_entry_point;
  if (typeof entryPoint === 'object' && entryPoint !== null) {
    const title = (entryPoint as Record<string, unknown>).title;
    if (typeof title === 'string' && title.trim().length > 0) {
      return title;
    }
  }

  throw new Error(
    'Implementation handoff requires summary.recommended_entry_point.title.',
  );
}

function buildStarterPrompt(input: {
  topic: string;
  recommendedEntryPoint: string;
  mvpScope: readonly string[];
  buildTasks: readonly string[];
}): string {
  const firstBuildTask = input.buildTasks[0] ?? 'deliver the first working slice';
  return `Implement ${input.recommendedEntryPoint} for ${input.topic}. Start with ${firstBuildTask}. Keep the build inside the MVP scope: ${input.mvpScope.join(', ')}.`;
}
